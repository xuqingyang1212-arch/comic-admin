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

func ListScripts(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.Script{})

	db = ApplyExact(db, c, "scriptId", "script_id")
	db = ApplyLike(db, c, "scriptName", "script_name")
	db = ApplyExact(db, c, "scriptType", "script_type")
	if v := TrimQuery(c, "writer"); v != "" {
		db = WhereUserNameLike(db, "writer_id", v)
	}
	if v := TrimQuery(c, "reviewer"); v != "" {
		db = WhereUserNameLike(db, "reviewer_id", v)
	}
	db = ApplyDateRange(db, c, "created_at", "startDate", "endDate")

	var scripts []model.Script
	total, _ := pagination.CountAndFind(db, p, "created_at DESC", &scripts, "Writer", "Reviewer")

	attachBooksToScripts(scripts)
	attachOriginalScriptsToScripts(scripts)
	response.OKPage(c, total, scripts)
}

func GetScript(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
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
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
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

	userID := middleware.GetUserID(c)
	task := model.ProductionTask{
		TaskName:         script.ScriptName,
		ScriptID:         script.ID,
		EpisodeCount:     script.EpisodeCount,
		ArtStyle:         req.ArtStyle,
		VisualEffect:     req.VisualEffect,
		AspectRatio:      req.AspectRatio,
		ProductionRemark: req.ProductionRemark,
		TaskType:         consts.TaskTypeProduce,
		TaskProgress:     consts.TaskProgressPending,
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
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
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
		AuditStatus:      consts.DraftStatusDraft,
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
