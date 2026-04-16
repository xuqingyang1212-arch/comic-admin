package handler

import (
	"strconv"
	"strings"
	"time"

	"comic-admin/internal/middleware"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListScripts(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.Script{})

	if v := strings.TrimSpace(c.Query("scriptId")); v != "" {
		db = db.Where("script_id = ?", v)
	}
	if v := strings.TrimSpace(c.Query("scriptName")); v != "" {
		db = db.Where("script_name LIKE ?", "%"+v+"%")
	}
	if v := c.Query("scriptType"); v != "" {
		db = db.Where("script_type = ?", v)
	}
	if v := strings.TrimSpace(c.Query("writer")); v != "" {
		db = db.Where("writer_id IN (SELECT id FROM users WHERE name LIKE ?)", "%"+v+"%")
	}
	if v := strings.TrimSpace(c.Query("reviewer")); v != "" {
		db = db.Where("reviewer_id IN (SELECT id FROM users WHERE name LIKE ?)", "%"+v+"%")
	}
	if v := c.Query("startDate"); v != "" {
		db = db.Where("created_at >= ?", v)
	}
	if v := c.Query("endDate"); v != "" {
		db = db.Where("created_at <= ?", v+" 23:59:59")
	}

	var total int64
	db.Count(&total)

	var scripts []model.Script
	db.Preload("Writer").Preload("Reviewer").Order("created_at DESC").Scopes(pagination.Paginate(p)).Find(&scripts)

	attachBooksToScripts(scripts)
	attachOriginalScriptsToScripts(scripts)
	response.OKPage(c, total, scripts)
}

func GetScript(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var script model.Script
	if err := model.DB.Preload("Writer").Preload("Reviewer").First(&script, id).Error; err != nil {
		response.FailNotFound(c, "剧本不存在")
		return
	}
	var book model.Book
	if model.DB.Select("id, book_id, book_name").First(&book, script.BookID).Error == nil {
		script.Book = &book
	}
	sl := []model.Script{script}
	attachOriginalScriptsToScripts(sl)
	script = sl[0]
	response.OK(c, script)
}

func attachOriginalScriptsToScripts(scripts []model.Script) {
	ids := make([]int64, 0, len(scripts))
	for _, s := range scripts {
		if s.OriginalScriptID != nil && *s.OriginalScriptID > 0 {
			ids = append(ids, *s.OriginalScriptID)
		}
	}
	if len(ids) == 0 {
		return
	}
	var originals []model.Script
	model.DB.Select("id, script_id, script_name").Where("id IN ?", ids).Find(&originals)
	sm := make(map[int64]*model.Script, len(originals))
	for i := range originals {
		sm[originals[i].ID] = &originals[i]
	}
	for i := range scripts {
		if scripts[i].OriginalScriptID != nil {
			if o, ok := sm[*scripts[i].OriginalScriptID]; ok {
				scripts[i].OriginalScript = o
			}
		}
	}
}

func attachBooksToScripts(scripts []model.Script) {
	bookIDs := make([]int64, 0, len(scripts))
	for _, s := range scripts {
		if s.BookID != 0 {
			bookIDs = append(bookIDs, s.BookID)
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
	for i := range scripts {
		if b, ok := bm[scripts[i].BookID]; ok {
			scripts[i].Book = b
		}
	}
}

type PublishTaskReq struct {
	ArtStyle         string `json:"artStyle" binding:"required"`
	VisualEffect     string `json:"visualEffect" binding:"required"`
	AspectRatio      string `json:"aspectRatio" binding:"required"`
	ProductionRemark string `json:"productionRemark"`
}

func PublishProductionTask(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var script model.Script
	if err := model.DB.First(&script, id).Error; err != nil {
		response.FailNotFound(c, "剧本不存在")
		return
	}

	var req PublishTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "画风/视觉效果/画面比例必填")
		return
	}

	var activeCnt int64
	model.DB.Model(&model.ProductionTask{}).
		Where("script_id = ? AND task_type = ? AND task_progress NOT IN ?", id, "制作", []string{"已完成", "已取消"}).
		Count(&activeCnt)
	if activeCnt > 0 {
		response.Fail(c, 400, "该剧本已有进行中的制作任务")
		return
	}

	userID := middleware.GetUserID(c)
	task := model.ProductionTask{
		TaskName:         script.ScriptName,
		ScriptID:         script.ID,
		EpisodeCount:     script.EpisodeCount,
		ArtStyle:         req.ArtStyle,
		VisualEffect:     req.VisualEffect,
		AspectRatio:      req.AspectRatio,
		ProductionRemark: req.ProductionRemark,
		TaskType:         "制作",
		TaskProgress:     "待认领",
		InitiatorID:      userID,
		ReviewerID:       &userID,
		PublishTime:      time.Now(),
	}

	if err := model.DB.Create(&task).Error; err != nil {
		response.FailServer(c, "发布失败")
		return
	}

	response.OK(c, task)
}

func CreateScriptRemake(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var script model.Script
	if err := model.DB.First(&script, id).Error; err != nil {
		response.FailNotFound(c, "剧本不存在")
		return
	}

	var req struct {
		ScriptName string `json:"scriptName" binding:"required"`
		Content    string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "剧本名称必填")
		return
	}

	draft := model.ScriptDraft{
		ScriptName:       req.ScriptName,
		Content:          req.Content,
		BookID:           script.BookID,
		ScriptType:       "多版本",
		OriginalScriptID: &script.ID,
		AuditStatus:      "待提审",
		WriterID:         middleware.GetUserID(c),
	}

	if draft.Content == "" {
		draft.Content = script.Content
	}

	if err := model.DB.Create(&draft).Error; err != nil {
		response.FailServer(c, "创建失败")
		return
	}

	response.OK(c, draft)
}
