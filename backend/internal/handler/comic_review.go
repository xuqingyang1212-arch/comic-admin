package handler

import (
	"encoding/json"
	"strconv"
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

func ListComicReviewTasks(c *gin.Context) {
	p := pagination.Parse(c)
	userID := middleware.GetUserID(c)
	db := model.DB.Model(&model.ReviewTask{}).Where("reviewer_id = ?", userID)

	db = ApplyExact(db, c, "taskType", "task_type")
	db = ApplyExact(db, c, "reviewStatus", "review_status")
	if v := TrimQuery(c, "taskName"); v != "" {
		db = db.Where("production_task_id IN (SELECT id FROM production_tasks WHERE task_name LIKE ?)", "%"+v+"%")
	}
	if v := TrimQuery(c, "producer"); v != "" {
		db = db.Where("production_task_id IN (SELECT id FROM production_tasks WHERE producer_id IN (SELECT id FROM users WHERE name LIKE ?))", "%"+v+"%")
	}
	if v := TrimQuery(c, "scriptId"); v != "" {
		if sid, err := strconv.ParseInt(v, 10, 64); err == nil {
			db = db.Where("production_task_id IN (SELECT id FROM production_tasks WHERE script_id = ?)", sid)
		}
	}

	var tasks []model.ReviewTask
	total, _ := pagination.CountAndFind(db, p, "created_at DESC", &tasks,
		"ProductionTask", "ProductionTask.Producer", "Reviewer")

	response.OKPage(c, total, tasks)
}

func GetComicReviewTask(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	var task model.ReviewTask
	if err := model.DB.First(&task, id).Error; err != nil {
		response.FailNotFound(c, "审核任务不存在")
		return
	}

	// Load relations in separate queries to avoid MySQL sort buffer issues
	if task.ProductionTaskID != 0 {
		var pt model.ProductionTask
		if model.DB.First(&pt, task.ProductionTaskID).Error == nil {
			if pt.ProducerID != nil {
				var producer model.User
				if model.DB.First(&producer, *pt.ProducerID).Error == nil {
					pt.Producer = &producer
				}
			}
			if pt.ScriptID != 0 {
				var script model.Script
				if model.DB.First(&script, pt.ScriptID).Error == nil {
					pt.Script = &script
				}
			}
			task.ProductionTask = &pt
		}
	}

	if task.ReviewerID != nil {
		var reviewer model.User
		if model.DB.First(&reviewer, *task.ReviewerID).Error == nil {
			task.Reviewer = &reviewer
		}
	}

	var opinions []model.ReviewOpinion
	model.DB.Where("review_task_id = ?", id).Order("sort_order ASC").Find(&opinions)
	task.Opinions = opinions

	if task.ProductionTask != nil {
		stageType := strings.TrimSuffix(task.TaskType, "审核")
		var delivery model.TaskDelivery
		if model.DB.Where("task_id = ? AND delivery_type = ?", task.ProductionTaskID, stageType).
			Order("created_at DESC").First(&delivery).Error == nil {
			var files []model.TaskDeliveryFile
			model.DB.Where("delivery_id = ?", delivery.ID).Find(&files)
			delivery.Files = files
			task.Delivery = &delivery
		}
	}

	response.OK(c, task)
}

type ComicReviewReq struct {
	Result   string              `json:"result" binding:"required"` // 审核通过 | 驳回修改
	Opinions []ReviewOpinionReq  `json:"opinions"`
	EpisodeName string           `json:"episodeName"`
}

type ReviewOpinionReq struct {
	Content string   `json:"content"`
	Images  []string `json:"images"`
}

func ReviewComicTask(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var req ComicReviewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	var reviewTask model.ReviewTask
	if err := model.DB.First(&reviewTask, id).Error; err != nil {
		response.FailNotFound(c, "审核任务不存在")
		return
	}

	if reviewTask.ReviewStatus != consts.ReviewStatusAuditing {
		response.Fail(c, 400, "当前状态不可审核")
		return
	}

	if req.Result == consts.ReviewStatusRejected {
		hasContent := false
		for _, op := range req.Opinions {
			if strings.TrimSpace(op.Content) != "" || len(op.Images) > 0 {
				hasContent = true
				break
			}
		}
		if !hasContent {
			response.Fail(c, 400, "驳回时审核意见必填")
			return
		}
	}

	var task model.ProductionTask
	model.DB.First(&task, reviewTask.ProductionTaskID)

	// Uniqueness check BEFORE any state mutation
	if req.Result == "审核通过" && (reviewTask.TaskType == "终版审核" || reviewTask.TaskType == "修改版审核") {
		epName := req.EpisodeName
		if epName == "" {
			epName = reviewTask.EpisodeName
		}
		if epName != "" {
			dupQuery := model.DB.Model(&model.Comic{}).Where("episode_name = ?", epName)
			if reviewTask.TaskType == "修改版审核" && task.ComicID != nil {
				dupQuery = dupQuery.Where("id != ?", *task.ComicID)
			}
			var dupCnt int64
			dupQuery.Count(&dupCnt)
			if dupCnt > 0 {
				response.Fail(c, 400, "剧集名称「"+epName+"」在漫剧列表中已存在，请修改后再审核通过")
				return
			}
		}
	}

	userID := middleware.GetUserID(c)

	// Atomic CAS: only update if status is still consts.ReviewStatusAuditing
	casRes := model.DB.Model(&reviewTask).Where("review_status = ?", consts.ReviewStatusAuditing).Updates(map[string]any{
		"review_status": req.Result,
		"episode_name":  req.EpisodeName,
	})
	if casRes.RowsAffected == 0 {
		response.Fail(c, 400, "该任务已被处理，请勿重复操作")
		return
	}

	// Replace opinions (clear old saved drafts first)
	model.DB.Where("review_task_id = ?", id).Delete(&model.ReviewOpinion{})
	for i, op := range req.Opinions {
		if strings.TrimSpace(op.Content) == "" && len(op.Images) == 0 {
			continue
		}
		model.DB.Create(&model.ReviewOpinion{
			ReviewTaskID: id,
			Content:      op.Content,
			Images:       op.Images,
			SortOrder:    i,
		})
	}

	// Snapshot opinions for audit log
	snapshot, _ := json.Marshal(req.Opinions)
	snapshotStr := string(snapshot)

	stageType := strings.TrimSuffix(reviewTask.TaskType, "审核")

	if req.Result == "审核通过" {
		switch reviewTask.TaskType {
		case "初版审核":
			model.DB.Model(&task).Update("task_progress", consts.TaskProgressFinalDraft)
		case "终版审核":
			model.DB.Model(&task).Update("task_progress", consts.TaskProgressCompleted)
			createComicFromTask(&task, &reviewTask)
		case "修改版审核":
			model.DB.Model(&task).Update("task_progress", consts.TaskProgressCompleted)
			updateComicFromTask(&task, &reviewTask)
		}
	} else {
		// 驳回修改 -> return to production
		switch reviewTask.TaskType {
		case "初版审核":
			model.DB.Model(&task).Update("task_progress", consts.TaskProgressFirstDraft)
		case "终版审核":
			model.DB.Model(&task).Update("task_progress", consts.TaskProgressFinalDraft)
		case "修改版审核":
			model.DB.Model(&task).Update("task_progress", consts.TaskProgressRevision)
		}
	}

	model.DB.Create(&model.ReviewAuditLog{
		ProductionTaskID: task.ID,
		Action:           req.Result,
		StageType:        stageType,
		OperatorID:       userID,
		OpinionSnapshot:  &snapshotStr,
		CreatedAt:        time.Now(),
	})

	response.OKMsg(c, "审核完成")
}

func createComicFromTask(task *model.ProductionTask, reviewTask *model.ReviewTask) {
	var delivery model.TaskDelivery
	model.DB.Where("task_id = ? AND delivery_type = ?", task.ID, consts.StageFinal).Preload("Files").Order("created_at DESC").First(&delivery)

	var script model.Script
	model.DB.First(&script, task.ScriptID)

	comic := model.Comic{
		ComicID:      idgen.NextID(),
		EpisodeName:  reviewTask.EpisodeName,
		ScriptID:     task.ScriptID,
		PayEpisode:   script.PayEpisode,
		CoverURL:     delivery.CoverURL,
		EpisodeCount: task.EpisodeCount,
		ArtStyle:     task.ArtStyle,
		VisualEffect: task.VisualEffect,
		AspectRatio:  task.AspectRatio,
		WriterID:     task.InitiatorID,
		ProducerID:   *task.ProducerID,
	}

	var copyrights []string
	for _, f := range delivery.Files {
		if f.FileType == "版权证明" {
			copyrights = append(copyrights, f.FileURL)
		}
	}
	comic.CopyrightImages = copyrights

	model.DB.Create(&comic)

	for _, f := range delivery.Files {
		if f.FileType == "有字幕视频" {
			model.DB.Create(&model.ComicEpisode{
				ComicID:      comic.ID,
				EpisodeNum:   f.EpisodeNum,
				SubtitledURL: f.FileURL,
				FileSize:     f.FileSize,
			})
		}
	}
	for _, f := range delivery.Files {
		if f.FileType == "无字幕视频" {
			model.DB.Model(&model.ComicEpisode{}).
				Where("comic_id = ? AND episode_num = ?", comic.ID, f.EpisodeNum).
				Update("raw_url", f.FileURL)
		}
	}
}

func updateComicFromTask(task *model.ProductionTask, reviewTask *model.ReviewTask) {
	if task.ComicID == nil {
		return
	}
	var delivery model.TaskDelivery
	model.DB.Where("task_id = ? AND delivery_type = ?", task.ID, consts.StageRevision).Preload("Files").Order("created_at DESC").First(&delivery)

	if delivery.CoverURL != "" {
		model.DB.Model(&model.Comic{}).Where("id = ?", *task.ComicID).Update("cover_url", delivery.CoverURL)
	}
	if reviewTask.EpisodeName != "" {
		model.DB.Model(&model.Comic{}).Where("id = ?", *task.ComicID).Update("episode_name", reviewTask.EpisodeName)
	}

	for _, f := range delivery.Files {
		switch f.FileType {
		case "有字幕视频":
			model.DB.Model(&model.ComicEpisode{}).
				Where("comic_id = ? AND episode_num = ?", *task.ComicID, f.EpisodeNum).
				Update("subtitled_url", f.FileURL)
		case "无字幕视频":
			model.DB.Model(&model.ComicEpisode{}).
				Where("comic_id = ? AND episode_num = ?", *task.ComicID, f.EpisodeNum).
				Update("raw_url", f.FileURL)
		}
	}
}

func SaveComicReviewDraft(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var req struct {
		Opinions    []ReviewOpinionReq `json:"opinions"`
		EpisodeName string             `json:"episodeName"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	if req.EpisodeName != "" {
		model.DB.Model(&model.ReviewTask{}).Where("id = ?", id).Update("episode_name", req.EpisodeName)
	}

	model.DB.Where("review_task_id = ?", id).Delete(&model.ReviewOpinion{})
	for i, op := range req.Opinions {
		if strings.TrimSpace(op.Content) == "" && len(op.Images) == 0 {
			continue
		}
		model.DB.Create(&model.ReviewOpinion{
			ReviewTaskID: id,
			Content:      op.Content,
			Images:       op.Images,
			SortOrder:    i,
		})
	}

	response.OKMsg(c, "保存成功")
}

func ListComicReviewLogs(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var reviewTask model.ReviewTask
	if err := model.DB.First(&reviewTask, id).Error; err != nil {
		response.FailNotFound(c, "审核任务不存在")
		return
	}

	stageType := strings.TrimSuffix(reviewTask.TaskType, "审核")

	var logs []model.ReviewAuditLog
	model.DB.Where("production_task_id = ? AND stage_type = ? AND action != ?",
		reviewTask.ProductionTaskID, stageType, consts.ActionClaimTask).
		Order("created_at ASC").Find(&logs)

	for i := range logs {
		if logs[i].OperatorID != 0 {
			var op model.User
			if model.DB.First(&op, logs[i].OperatorID).Error == nil {
				logs[i].Operator = &op
			}
		}
	}

	response.OK(c, logs)
}
