package handler

import (
	"strings"
	"time"

	"comic-admin/internal/consts"
	"comic-admin/internal/middleware"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/idgen"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListScriptAuditHall(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.ScriptDraft{}).Where("audit_status != ?", consts.DraftStatusDraft)

	db = ApplyLike(db, c, "scriptName", "script_name")
	db = ApplyExact(db, c, "scriptType", "script_type")
	db = ApplyExact(db, c, "auditStatus", "audit_status")
	if v := TrimQuery(c, "writer"); v != "" {
		db = WhereUserNameLike(db, "writer_id", v)
	}
	if v := TrimQuery(c, "reviewer"); v != "" {
		db = WhereUserNameLike(db, "reviewer_id", v)
	}

	var drafts []model.ScriptDraft
	total, _ := pagination.CountAndFind(db, p, "created_at DESC", &drafts, "Writer", "Reviewer")

	attachBooks(drafts)
	attachOriginalScriptsToDrafts(drafts)
	response.OKPage(c, total, drafts)
}

func ListScriptAuditMine(c *gin.Context) {
	p := pagination.Parse(c)
	userID := middleware.GetUserID(c)
	db := model.DB.Model(&model.ScriptDraft{}).Where("reviewer_id = ?", userID)

	db = ApplyLike(db, c, "scriptName", "script_name")
	db = ApplyExact(db, c, "auditStatus", "audit_status")

	var drafts []model.ScriptDraft
	total, _ := pagination.CountAndFind(db, p, "created_at DESC", &drafts, "Writer", "Reviewer")

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

	if draft.AuditStatus != consts.DraftStatusPending {
		response.Fail(c, 400, "当前状态不可领取")
		return
	}

	userID := middleware.GetUserID(c)
	res := model.DB.Model(&draft).Where("audit_status = ?", consts.DraftStatusPending).Updates(map[string]any{
		"audit_status": consts.DraftStatusAuditing,
		"reviewer_id":  userID,
	})
	if res.RowsAffected == 0 {
		response.Fail(c, 400, "该任务已被领取")
		return
	}

	model.DB.Create(&model.ScriptAuditLog{
		ScriptDraftID: id,
		Action:        consts.ActionClaimTask,
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

	if draft.AuditStatus != consts.DraftStatusAuditing {
		response.Fail(c, 400, "当前状态不可审核")
		return
	}

	if req.Result == consts.DraftStatusRejected || req.Result == consts.DraftStatusFailed {
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
		var nameCnt int64
		model.DB.Model(&model.Script{}).Where("script_name = ?", draft.ScriptName).Count(&nameCnt)
		if nameCnt > 0 {
			response.Fail(c, 400, "剧本名称「"+draft.ScriptName+"」在剧本库中已存在，请修改后再审核通过")
			return
		}
	}

	userID := middleware.GetUserID(c)

	// Atomic CAS: only update if status is still auditing, prevents double-submit
	res := model.DB.Model(&draft).Where("audit_status = ?", consts.DraftStatusAuditing).Updates(map[string]any{
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
		response.OK(c, gin.H{"scriptId": script.ID, "displayScriptId": script.ScriptID})
		return
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
