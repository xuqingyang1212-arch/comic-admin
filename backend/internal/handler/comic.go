package handler

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"comic-admin/internal/middleware"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ListComics(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.Comic{})

	if v := strings.TrimSpace(c.Query("comicId")); v != "" {
		db = db.Where("comic_id = ?", v)
	}
	if v := strings.TrimSpace(c.Query("episodeName")); v != "" {
		db = db.Where("episode_name LIKE ?", "%"+v+"%")
	}
	if v := c.Query("artStyle"); v != "" {
		db = db.Where("art_style = ?", v)
	}
	if v := c.Query("visualEffect"); v != "" {
		db = db.Where("visual_effect = ?", v)
	}
	if v := c.Query("aspectRatio"); v != "" {
		db = db.Where("aspect_ratio = ?", v)
	}
	if v := strings.TrimSpace(c.Query("writer")); v != "" {
		db = db.Where("writer_id IN (SELECT id FROM users WHERE name LIKE ?)", "%"+v+"%")
	}
	if v := strings.TrimSpace(c.Query("producer")); v != "" {
		db = db.Where("producer_id IN (SELECT id FROM users WHERE name LIKE ?)", "%"+v+"%")
	}
	if v := c.Query("startDate"); v != "" {
		db = db.Where("created_at >= ?", v)
	}
	if v := c.Query("endDate"); v != "" {
		db = db.Where("created_at <= ?", v+" 23:59:59")
	}

	var total int64
	db.Count(&total)

	var comics []model.Comic
	db.Preload("Writer").Preload("Producer").
		Order("created_at DESC").Scopes(pagination.Paginate(p)).Find(&comics)

	scriptIDs := make([]int64, 0, len(comics))
	for _, co := range comics {
		if co.ScriptID > 0 {
			scriptIDs = append(scriptIDs, co.ScriptID)
		}
	}
	if len(scriptIDs) > 0 {
		var scripts []model.Script
		model.DB.Select("id, script_id, script_name, pay_episode, episode_count").Where("id IN ?", scriptIDs).Find(&scripts)
		sm := make(map[int64]*model.Script, len(scripts))
		for i := range scripts {
			sm[scripts[i].ID] = &scripts[i]
		}
		for i := range comics {
			comics[i].Script = sm[comics[i].ScriptID]
		}
	}

	response.OKPage(c, total, comics)
}

func GetComic(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var comic model.Comic
	if err := model.DB.Preload("Episodes", func(db *gorm.DB) *gorm.DB {
		return db.Order("episode_num ASC")
	}).Preload("Writer").Preload("Producer").First(&comic, id).Error; err != nil {
		response.FailNotFound(c, "漫剧不存在")
		return
	}
	if comic.ScriptID > 0 {
		var script model.Script
		if model.DB.Select("id, script_id, script_name, pay_episode, episode_count").First(&script, comic.ScriptID).Error == nil {
			comic.Script = &script
		}
	}
	response.OK(c, comic)
}

func CreateDownloadTask(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var comic model.Comic
	if err := model.DB.First(&comic, id).Error; err != nil {
		response.FailNotFound(c, "漫剧不存在")
		return
	}

	var req struct {
		DownloadContent string `json:"downloadContent" binding:"required"`
		Force           bool   `json:"force"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "下载内容必填")
		return
	}

	// Check if unexpired completed task exists
	var existing model.DownloadTask
	hasExisting := model.DB.Where("comic_id = ? AND download_content = ? AND status = ? AND expires_at > ?",
		id, req.DownloadContent, "已完成", time.Now()).First(&existing).Error == nil

	if hasExisting && !req.Force {
		response.OK(c, gin.H{"duplicate": true, "message": "下载中心已存在该下载任务，是否重新下载？"})
		return
	}

	if hasExisting {
		model.DB.Model(&existing).Update("status", "已失效")
	}

	task := model.DownloadTask{
		ComicID:         id,
		ComicName:       comic.EpisodeName,
		DownloadContent: req.DownloadContent,
		Status:          "进行中",
		CreatorID:       middleware.GetUserID(c),
	}
	model.DB.Create(&task)

	go packDownloadTask(task.ID)

	response.OK(c, gin.H{
		"taskId":  task.ID,
		"message": "下载任务已创建，请到下载中心查看",
	})
}

func CreateRevision(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var comic model.Comic
	if err := model.DB.First(&comic, id).Error; err != nil {
		response.FailNotFound(c, "漫剧不存在")
		return
	}

	var req struct {
		Opinions []ReviewOpinionReq `json:"opinions" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "修改意见必填")
		return
	}

	var activeCnt int64
	model.DB.Model(&model.ProductionTask{}).
		Where("comic_id = ? AND task_type = ? AND task_progress NOT IN ?", id, "修改", []string{"已完成", "已取消"}).
		Count(&activeCnt)
	if activeCnt > 0 {
		response.Fail(c, 400, "该漫剧已有进行中的修改任务")
		return
	}

	userID := middleware.GetUserID(c)

	// Build production remark from opinions
	var remarkParts []string
	for _, op := range req.Opinions {
		if strings.TrimSpace(op.Content) != "" {
			remarkParts = append(remarkParts, op.Content)
		}
	}
	productionRemark := strings.Join(remarkParts, "\n")

	task := model.ProductionTask{
		TaskName:         comic.EpisodeName,
		ScriptID:         comic.ScriptID,
		ComicID:          &comic.ID,
		EpisodeCount:     comic.EpisodeCount,
		ArtStyle:         comic.ArtStyle,
		VisualEffect:     comic.VisualEffect,
		AspectRatio:      comic.AspectRatio,
		ProductionRemark: productionRemark,
		TaskType:         "修改",
		TaskProgress:     "修改版制作中",
		InitiatorID:      userID,
		ProducerID:       &comic.ProducerID,
		ReviewerID:       &userID,
		PublishTime:      time.Now(),
	}
	model.DB.Create(&task)

	snapshot, _ := json.Marshal(req.Opinions)
	snapshotStr := string(snapshot)

	model.DB.Create(&model.ReviewAuditLog{
		ProductionTaskID: task.ID,
		Action:           "发起成片修改",
		StageType:        "修改版",
		OperatorID:       userID,
		OpinionSnapshot:  &snapshotStr,
		CreatedAt:        time.Now(),
	})

	// Pre-populate a "修改版" delivery with existing comic assets
	seedRevisionDelivery(&task, &comic)

	response.OK(c, task)
}

func seedRevisionDelivery(task *model.ProductionTask, comic *model.Comic) {
	// Find the original 终版 delivery to copy file names and sizes
	origFiles := make(map[string]*model.TaskDeliveryFile) // keyed by fileType+episodeNum
	var origTask model.ProductionTask
	if model.DB.Where("script_id = ? AND task_type = ? AND task_progress = ?",
		comic.ScriptID, "制作", "已完成").Order("updated_at DESC").First(&origTask).Error == nil {
		var origDelivery model.TaskDelivery
		if model.DB.Where("task_id = ? AND delivery_type = ?", origTask.ID, "终版").
			Preload("Files").First(&origDelivery).Error == nil {
			for i := range origDelivery.Files {
				f := &origDelivery.Files[i]
				key := f.FileType + ":" + strconv.Itoa(f.EpisodeNum)
				origFiles[key] = f
			}
		}
	}

	lookup := func(fileType string, episodeNum int, fallbackURL string) (string, int64) {
		if f, ok := origFiles[fileType+":"+strconv.Itoa(episodeNum)]; ok {
			return f.FileName, f.FileSize
		}
		// Extract filename from URL path as last resort
		parts := strings.Split(fallbackURL, "/")
		return parts[len(parts)-1], 0
	}

	delivery := model.TaskDelivery{
		TaskID:       task.ID,
		DeliveryType: "修改版",
		EpisodeName:  comic.EpisodeName,
		CoverURL:     comic.CoverURL,
	}
	model.DB.Create(&delivery)

	if comic.CoverURL != "" {
		name, size := lookup("封面图", 0, comic.CoverURL)
		model.DB.Create(&model.TaskDeliveryFile{
			DeliveryID: delivery.ID,
			FileType:   "封面图",
			FileURL:    comic.CoverURL,
			FileName:   name,
			FileSize:   size,
		})
	}

	for _, img := range comic.CopyrightImages {
		if img != "" {
			name, size := lookup("版权证明", 0, img)
			model.DB.Create(&model.TaskDeliveryFile{
				DeliveryID: delivery.ID,
				FileType:   "版权证明",
				FileURL:    img,
				FileName:   name,
				FileSize:   size,
			})
		}
	}

	var episodes []model.ComicEpisode
	model.DB.Where("comic_id = ?", comic.ID).Order("episode_num ASC").Find(&episodes)

	for _, ep := range episodes {
		if ep.SubtitledURL != "" {
			name, size := lookup("有字幕视频", ep.EpisodeNum, ep.SubtitledURL)
			if size == 0 {
				size = ep.FileSize
			}
			model.DB.Create(&model.TaskDeliveryFile{
				DeliveryID: delivery.ID,
				FileType:   "有字幕视频",
				EpisodeNum: ep.EpisodeNum,
				FileURL:    ep.SubtitledURL,
				FileName:   name,
				FileSize:   size,
			})
		}
		if ep.RawURL != "" {
			name, size := lookup("无字幕视频", ep.EpisodeNum, ep.RawURL)
			if size == 0 {
				size = ep.FileSize
			}
			model.DB.Create(&model.TaskDeliveryFile{
				DeliveryID: delivery.ID,
				FileType:   "无字幕视频",
				EpisodeNum: ep.EpisodeNum,
				FileURL:    ep.RawURL,
				FileName:   name,
				FileSize:   size,
			})
		}
	}
}
