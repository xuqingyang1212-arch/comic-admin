package handler

import (
	"strings"
	"time"

	"comic-admin/internal/middleware"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/idgen"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListScriptAuditHall(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.ScriptDraft{}).Where("audit_status != ?", "待提审")

	if v := strings.TrimSpace(c.Query("scriptName")); v != "" {
		db = db.Where("script_name LIKE ?", "%"+v+"%")
	}
	if v := c.Query("scriptType"); v != "" {
		db = db.Where("script_type = ?", v)
	}
	if v := c.Query("auditStatus"); v != "" {
		db = db.Where("audit_status = ?", v)
	}
	if v := strings.TrimSpace(c.Query("writer")); v != "" {
		db = db.Where("writer_id IN (SELECT id FROM users WHERE name LIKE ?)", "%"+v+"%")
	}
	if v := strings.TrimSpace(c.Query("reviewer")); v != "" {
		db = db.Where("reviewer_id IN (SELECT id FROM users WHERE name LIKE ?)", "%"+v+"%")
	}

	var total int64
	db.Count(&total)

	var drafts []model.ScriptDraft
	db.Preload("Writer").Preload("Reviewer").Order("created_at DESC").Scopes(pagination.Paginate(p)).Find(&drafts)

	attachBooks(drafts)
	attachOriginalScriptsToDrafts(drafts)
	response.OKPage(c, total, drafts)
}

func ListScriptAuditMine(c *gin.Context) {
	p := pagination.Parse(c)
	userID := middleware.GetUserID(c)
	db := model.DB.Model(&model.ScriptDraft{}).Where("reviewer_id = ?", userID)

	if v := strings.TrimSpace(c.Query("scriptName")); v != "" {
		db = db.Where("script_name LIKE ?", "%"+v+"%")
	}
	if v := c.Query("auditStatus"); v != "" {
		db = db.Where("audit_status = ?", v)
	}

	var total int64
	db.Count(&total)

	var drafts []model.ScriptDraft
	db.Preload("Writer").Preload("Reviewer").Order("created_at DESC").Scopes(pagination.Paginate(p)).Find(&drafts)

	attachBooks(drafts)
	attachOriginalScriptsToDrafts(drafts)
	response.OKPage(c, total, drafts)
}

func ClaimScriptAudit(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var draft model.ScriptDraft
	if err := model.DB.First(&draft, id).Error; err != nil {
		response.FailNotFound(c, "任务不存在")
		return
	}

	if draft.AuditStatus != "待认领" {
		response.Fail(c, 400, "当前状态不可领取")
		return
	}

	userID := middleware.GetUserID(c)
	res := model.DB.Model(&draft).Where("audit_status = ?", "待认领").Updates(map[string]any{
		"audit_status": "审核中",
		"reviewer_id":  userID,
	})
	if res.RowsAffected == 0 {
		response.Fail(c, 400, "该任务已被领取")
		return
	}

	model.DB.Create(&model.ScriptAuditLog{
		ScriptDraftID: id,
		Action:        "领取任务",
		OperatorID:    userID,
		CreatedAt:     time.Now(),
	})

	response.OKMsg(c, "领取成功")
}

type ScriptReviewReq struct {
	Result     string `json:"result" binding:"required"` // 审核通过 | 驳回修改 | 审核不通过
	Opinion    string `json:"opinion"`
	PayEpisode string `json:"payEpisode"`
}

func ReviewScriptAudit(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var req ScriptReviewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	var draft model.ScriptDraft
	if err := model.DB.First(&draft, id).Error; err != nil {
		response.FailNotFound(c, "任务不存在")
		return
	}

	if draft.AuditStatus != "审核中" {
		response.Fail(c, 400, "当前状态不可审核")
		return
	}

	if req.Result == "驳回修改" || req.Result == "审核不通过" {
		if strings.TrimSpace(req.Opinion) == "" {
			response.Fail(c, 400, "审核意见必填")
			return
		}
	}

	if req.Result == "审核通过" {
		if req.PayEpisode == "" {
			response.Fail(c, 400, "审核通过时付费卡点必填")
			return
		}
	}

	userID := middleware.GetUserID(c)

	// Atomic CAS: only update if status is still "审核中", prevents double-submit
	res := model.DB.Model(&draft).Where("audit_status = ?", "审核中").Updates(map[string]any{
		"audit_status":  req.Result,
		"audit_opinion": req.Opinion,
	})
	if res.RowsAffected == 0 {
		response.Fail(c, 400, "该任务已被处理，请勿重复操作")
		return
	}

	model.DB.Create(&model.ScriptAuditLog{
		ScriptDraftID: id,
		Action:        req.Result,
		OperatorID:    userID,
		Opinion:       req.Opinion,
		CreatedAt:     time.Now(),
	})

	if req.Result == "审核通过" {
		// Re-read draft to pick up any content/divider edits made during audit
		model.DB.First(&draft, id)

		script := model.Script{
			ScriptID:          idgen.NextID(),
			ScriptName:        draft.ScriptName,
			Content:           draft.Content,
			EpisodeCount:      draft.EpisodeCount,
			PayEpisode:        req.PayEpisode,
			PayBreakpointData: draft.PayBreakpointData,
			BookID:            draft.BookID,
			ScriptType:        draft.ScriptType,
			OriginalScriptID:  draft.OriginalScriptID,
			WriterID:          draft.WriterID,
			ReviewerID:        draft.ReviewerID,
			CreatedAt:         time.Now(),
		}
		if err := model.DB.Create(&script).Error; err != nil {
			response.FailServer(c, "剧本入库失败: "+err.Error())
			return
		}
	}

	response.OKMsg(c, "审核完成")
}

func SaveScriptAuditDraft(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var body struct {
		Content           string  `json:"content"`
		ScriptName        string  `json:"scriptName"`
		AuditOpinion      string  `json:"auditOpinion"`
		PayBreakpointData *string `json:"payBreakpointData"`
		EpisodeCount      *int    `json:"episodeCount"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	updates := map[string]any{}
	if body.Content != "" {
		updates["content"] = body.Content
	}
	if body.ScriptName != "" {
		updates["script_name"] = body.ScriptName
	}
	if body.AuditOpinion != "" {
		updates["audit_opinion"] = body.AuditOpinion
	}
	if body.PayBreakpointData != nil {
		updates["pay_breakpoint_data"] = *body.PayBreakpointData
	}
	if body.EpisodeCount != nil {
		updates["episode_count"] = *body.EpisodeCount
	}

	model.DB.Model(&model.ScriptDraft{}).Where("id = ?", id).Updates(updates)
	response.OKMsg(c, "保存成功")
}
