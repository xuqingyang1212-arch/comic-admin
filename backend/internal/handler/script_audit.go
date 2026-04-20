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
	"gorm.io/gorm"
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

	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&draft).Where("audit_status = ?", consts.DraftStatusPending).Updates(map[string]any{
			"audit_status": consts.DraftStatusAuditing,
			"reviewer_id":  userID,
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errConflict
		}
		return tx.Create(&model.ScriptAuditLog{
			ScriptDraftID: id,
			Action:        consts.ActionClaimTask,
			OperatorID:    userID,
			CreatedAt:     time.Now(),
		}).Error
	})
	if txErr != nil {
		if txErr == errConflict {
			response.Fail(c, 400, "该任务已被领取")
			return
		}
		response.Fail(c, 500, "领取失败，请重试")
		return
	}

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
	if !BindOrFail(c, &req) {
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

	if req.Result == consts.ReviewStatusApproved {
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

	var newScript model.Script
	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		// Atomic CAS: only update if status is still auditing, prevents double-submit
		res := tx.Model(&draft).Where("audit_status = ?", consts.DraftStatusAuditing).Updates(map[string]any{
			"audit_status":  req.Result,
			"audit_opinion": req.Opinion,
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errConflict
		}

		if err := tx.Create(&model.ScriptAuditLog{
			ScriptDraftID: id,
			Action:        req.Result,
			OperatorID:    userID,
			Opinion:       req.Opinion,
			CreatedAt:     time.Now(),
		}).Error; err != nil {
			return err
		}

		if req.Result == consts.ReviewStatusApproved {
			// Re-read draft to pick up any content/divider edits made during audit
			if err := tx.First(&draft, id).Error; err != nil {
				return err
			}
			newScript = model.Script{
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
			return tx.Create(&newScript).Error
		}
		return nil
	})
	if txErr != nil {
		if txErr == errConflict {
			response.Fail(c, 400, "该任务已被处理，请勿重复操作")
			return
		}
		response.FailServer(c, "审核失败，请重试")
		return
	}

	if req.Result == consts.ReviewStatusApproved {
		response.OK(c, gin.H{"scriptId": newScript.ID, "displayScriptId": newScript.ScriptID})
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
	if !BindOrFail(c, &body) {
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
