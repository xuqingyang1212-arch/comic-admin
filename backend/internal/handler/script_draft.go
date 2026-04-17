package handler

import (
	"time"

	"comic-admin/internal/consts"
	"comic-admin/internal/middleware"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListScriptDrafts(c *gin.Context) {
	p := pagination.Parse(c)
	userID := middleware.GetUserID(c)
	db := model.DB.Model(&model.ScriptDraft{}).Where("writer_id = ?", userID)

	db = ApplyLike(db, c, "scriptName", "script_name")
	if v := TrimQuery(c, "sourceBookId"); v != "" {
		db = db.Where("book_id IN (SELECT id FROM books WHERE book_id = ?)", v)
	}
	db = ApplyExact(db, c, "scriptType", "script_type")
	db = ApplyExact(db, c, "auditStatus", "audit_status")
	if v := TrimQuery(c, "originalScriptId"); v != "" {
		db = db.Where("original_script_id IN (SELECT id FROM scripts WHERE script_id = ?)", v)
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

func GetScriptDraft(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var draft model.ScriptDraft
	if err := model.DB.Preload("Writer").Preload("Reviewer").First(&draft, id).Error; err != nil {
		response.FailNotFound(c, "草稿不存在")
		return
	}
	sl := []model.ScriptDraft{draft}
	attachBooks(sl)
	attachOriginalScriptsToDrafts(sl)
	draft = sl[0]
	if draft.Book == nil {
		var book model.Book
		if model.DB.Select("id, book_id, book_name").First(&book, draft.BookID).Error == nil {
			draft.Book = &book
		}
	}
	response.OK(c, draft)
}

func attachOriginalScriptsToDrafts(drafts []model.ScriptDraft) {
	ids := make([]int64, 0, len(drafts))
	for _, d := range drafts {
		if d.OriginalScriptID != nil && *d.OriginalScriptID > 0 {
			ids = append(ids, *d.OriginalScriptID)
		}
	}
	if len(ids) == 0 {
		return
	}
	var scripts []model.Script
	model.DB.Select("id, script_id, script_name").Where("id IN ?", ids).Find(&scripts)
	sm := make(map[int64]*model.Script, len(scripts))
	for i := range scripts {
		sm[scripts[i].ID] = &scripts[i]
	}
	for i := range drafts {
		if drafts[i].OriginalScriptID != nil {
			if s, ok := sm[*drafts[i].OriginalScriptID]; ok {
				drafts[i].OriginalScript = s
			}
		}
	}
}

func attachBooks(drafts []model.ScriptDraft) {
	bookIDs := make([]int64, 0, len(drafts))
	for _, d := range drafts {
		if d.BookID != 0 {
			bookIDs = append(bookIDs, d.BookID)
		}
	}
	if len(bookIDs) == 0 {
		return
	}
	var books []model.Book
	model.DB.Select("id, book_id, book_name").Where("id IN ?", bookIDs).Find(&books)
	bm := make(map[int64]*model.Book, len(books))
	for i := range books {
		bm[books[i].ID] = &books[i]
	}
	for i := range drafts {
		if b, ok := bm[drafts[i].BookID]; ok {
			drafts[i].Book = b
		}
	}
}

type ScriptDraftReq struct {
	ScriptName        string  `json:"scriptName" binding:"required"`
	Content           string  `json:"content"`
	BookID            int64   `json:"bookId"`
	ScriptType        string  `json:"scriptType"`
	OriginalScriptID  *int64  `json:"originalScriptId"`
	EpisodeCount      int     `json:"episodeCount"`
	PayEpisode        string  `json:"payEpisode"`
	PayBreakpointData *string `json:"payBreakpointData"`
}

func CreateScriptDraft(c *gin.Context) {
	var req ScriptDraftReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "剧本名称必填")
		return
	}

	draft := model.ScriptDraft{
		ScriptName:        req.ScriptName,
		Content:           req.Content,
		BookID:            req.BookID,
		ScriptType:        req.ScriptType,
		OriginalScriptID:  req.OriginalScriptID,
		AuditStatus:       consts.DraftStatusDraft,
		WriterID:          middleware.GetUserID(c),
		EpisodeCount:      req.EpisodeCount,
		PayEpisode:        req.PayEpisode,
		PayBreakpointData: req.PayBreakpointData,
	}
	if err := model.DB.Create(&draft).Error; err != nil {
		response.FailServer(c, "创建失败")
		return
	}
	response.OK(c, draft)
}

func UpdateScriptDraft(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var draft model.ScriptDraft
	if err := model.DB.First(&draft, id).Error; err != nil {
		response.FailNotFound(c, "草稿不存在")
		return
	}

	if draft.AuditStatus != consts.DraftStatusDraft && draft.AuditStatus != consts.DraftStatusRejected {
		response.Fail(c, 400, "当前状态不可编辑")
		return
	}

	var req ScriptDraftReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	updates := map[string]any{
		"script_name":         req.ScriptName,
		"content":             req.Content,
		"episode_count":       req.EpisodeCount,
		"pay_episode":         req.PayEpisode,
	}
	if req.PayBreakpointData != nil {
		updates["pay_breakpoint_data"] = *req.PayBreakpointData
	}
	model.DB.Model(&draft).Updates(updates)
	response.OKMsg(c, "保存成功")
}

func SubmitScriptDraft(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var draft model.ScriptDraft
	if err := model.DB.First(&draft, id).Error; err != nil {
		response.FailNotFound(c, "草稿不存在")
		return
	}

	if draft.AuditStatus != consts.DraftStatusDraft && draft.AuditStatus != consts.DraftStatusRejected {
		response.Fail(c, 400, "当前状态不可提交")
		return
	}

	newStatus := consts.DraftStatusPending
	if draft.ReviewerID != nil && *draft.ReviewerID > 0 {
		newStatus = consts.DraftStatusAuditing
	}
	res := model.DB.Model(&draft).Where("audit_status IN ?", []string{consts.DraftStatusDraft, consts.DraftStatusRejected}).Update("audit_status", newStatus)
	if res.RowsAffected == 0 {
		response.Fail(c, 400, "该剧本已被提交，请勿重复操作")
		return
	}

	model.DB.Create(&model.ScriptAuditLog{
		ScriptDraftID: id,
		Action:        "提交审核",
		OperatorID:    middleware.GetUserID(c),
		CreatedAt:     time.Now(),
	})

	response.OKMsg(c, "提交成功")
}

func DeleteScriptDraft(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var draft model.ScriptDraft
	if err := model.DB.First(&draft, id).Error; err != nil {
		response.FailNotFound(c, "草稿不存在")
		return
	}

	if draft.AuditStatus != consts.DraftStatusDraft {
		response.Fail(c, 400, "仅待提审状态可删除")
		return
	}

	res := model.DB.Where("audit_status = ?", consts.DraftStatusDraft).Delete(&draft)
	if res.RowsAffected == 0 {
		response.Fail(c, 400, "状态已变更，无法删除")
		return
	}
	response.OKMsg(c, "删除成功")
}

func ListScriptAuditLogs(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var logs []model.ScriptAuditLog
	model.DB.Where("script_draft_id = ?", id).Preload("Operator").Order("created_at ASC").Find(&logs)
	response.OK(c, logs)
}
