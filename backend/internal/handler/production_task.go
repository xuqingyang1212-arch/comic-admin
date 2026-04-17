package handler

import (
	"encoding/json"
	"strings"
	"time"

	"comic-admin/internal/consts"
	"comic-admin/internal/middleware"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListProductionTaskHall(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.ProductionTask{})

	db = ApplyLike(db, c, "taskName", "task_name")
	if v := TrimQuery(c, "scriptId"); v != "" {
		db = db.Where("script_id IN (SELECT id FROM scripts WHERE script_id = ?)", v)
	}
	db = ApplyExact(db, c, "taskType", "task_type")
	db = ApplyExact(db, c, "taskProgress", "task_progress")
	db = ApplyExact(db, c, "artStyle", "art_style")
	db = ApplyExact(db, c, "visualEffect", "visual_effect")
	db = ApplyExact(db, c, "aspectRatio", "aspect_ratio")
	if v := TrimQuery(c, "initiator"); v != "" {
		db = WhereUserNameLike(db, "initiator_id", v)
	}
	if v := TrimQuery(c, "producer"); v != "" {
		db = WhereUserNameLike(db, "producer_id", v)
	}
	db = ApplyDateRange(db, c, "publish_time", "startDate", "endDate")

	var tasks []model.ProductionTask
	total, _ := pagination.CountAndFind(db, p, "publish_time DESC", &tasks, "Initiator", "Producer")

	attachScriptsToTasks(tasks)
	response.OKPage(c, total, tasks)
}

func ListProductionTaskMine(c *gin.Context) {
	p := pagination.Parse(c)
	userID := middleware.GetUserID(c)
	db := model.DB.Model(&model.ProductionTask{}).Where("producer_id = ?", userID)

	db = ApplyLike(db, c, "taskName", "task_name")
	db = ApplyExact(db, c, "taskType", "task_type")
	db = ApplyExact(db, c, "taskProgress", "task_progress")
	if v := TrimQuery(c, "reviewer"); v != "" {
		db = WhereUserNameLike(db, "reviewer_id", v)
	}

	var tasks []model.ProductionTask
	total, _ := pagination.CountAndFind(db, p, "publish_time DESC", &tasks, "Reviewer")

	attachScriptsToTasks(tasks)
	for i := range tasks {
		attachReviewEpisodeName(&tasks[i])
	}
	response.OKPage(c, total, tasks)
}

func attachScriptsToTasks(tasks []model.ProductionTask) {
	ids := make([]int64, 0, len(tasks))
	for _, t := range tasks {
		if t.ScriptID != 0 {
			ids = append(ids, t.ScriptID)
		}
	}
	if len(ids) == 0 {
		return
	}
	var scripts []model.Script
	model.DB.Select("id, script_id, script_name, pay_episode").Where("id IN ?", ids).Find(&scripts)
	sm := make(map[int64]*model.Script, len(scripts))
	for i := range scripts {
		sm[scripts[i].ID] = &scripts[i]
	}
	for i := range tasks {
		if s, ok := sm[tasks[i].ScriptID]; ok {
			tasks[i].Script = s
		}
	}
}

func GetProductionTask(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var task model.ProductionTask
	if err := model.DB.Preload("Initiator").Preload("Producer").First(&task, id).Error; err != nil {
		response.FailNotFound(c, "任务不存在")
		return
	}
	if task.ScriptID != 0 {
		var script model.Script
		if model.DB.First(&script, task.ScriptID).Error == nil {
			task.Script = &script
		}
	}
	attachReviewEpisodeName(&task)
	response.OK(c, task)
}

func attachReviewEpisodeName(task *model.ProductionTask) {
	var rt model.ReviewTask
	if model.DB.Where("production_task_id = ? AND review_status = ?", task.ID, consts.ReviewStatusRejected).
		Order("created_at DESC").First(&rt).Error == nil && rt.EpisodeName != "" {
		task.ReviewEpisodeName = rt.EpisodeName
	}
}

func ClaimProductionTask(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var task model.ProductionTask
	if err := model.DB.First(&task, id).Error; err != nil {
		response.FailNotFound(c, "任务不存在")
		return
	}

	if task.TaskProgress != consts.TaskProgressPending {
		response.Fail(c, 400, "当前状态不可领取")
		return
	}

	userID := middleware.GetUserID(c)
	res := model.DB.Model(&task).Where("task_progress = ?", consts.TaskProgressPending).Updates(map[string]any{
		"task_progress": consts.TaskProgressFirstDraft,
		"producer_id":   userID,
	})
	if res.RowsAffected == 0 {
		response.Fail(c, 400, "该任务已被领取")
		return
	}

	model.DB.Create(&model.ReviewAuditLog{
		ProductionTaskID: id,
		Action:           consts.ActionClaimTask,
		StageType:        consts.StageFirst,
		OperatorID:       userID,
		CreatedAt:        time.Now(),
	})

	response.OKMsg(c, "领取成功")
}

func CancelProductionTask(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var task model.ProductionTask
	if err := model.DB.First(&task, id).Error; err != nil {
		response.FailNotFound(c, "任务不存在")
		return
	}

	if task.TaskProgress == consts.TaskProgressCompleted || task.TaskProgress == consts.TaskProgressCancelled {
		response.Fail(c, 400, "当前状态不可取消")
		return
	}

	oldProgress := task.TaskProgress
	res := model.DB.Model(&task).Where("task_progress NOT IN ?", []string{consts.TaskProgressCompleted, consts.TaskProgressCancelled}).Update("task_progress", consts.TaskProgressCancelled)
	if res.RowsAffected == 0 {
		response.Fail(c, 400, "该任务已被处理，请勿重复操作")
		return
	}

	// Cancel related review tasks
	model.DB.Model(&model.ReviewTask{}).Where("production_task_id = ? AND review_status = ?", id, consts.ReviewStatusAuditing).
		Update("review_status", consts.TaskProgressCancelled)

	userID := middleware.GetUserID(c)
	now := time.Now()

	// Write a cancellation log for every stage that has existing audit records,
	// so the cancel node appears in all relevant audit-record views.
	var existingStages []string
	model.DB.Model(&model.ReviewAuditLog{}).Where("production_task_id = ?", id).
		Distinct("stage_type").Pluck("stage_type", &existingStages)

	if len(existingStages) == 0 {
		// Fallback: determine from task progress
		st := consts.StageFirst
		if strings.Contains(oldProgress, consts.StageFinal) {
			st = consts.StageFinal
		} else if strings.Contains(oldProgress, consts.StageRevision) {
			st = consts.StageRevision
		}
		existingStages = []string{st}
	}

	for _, st := range existingStages {
		model.DB.Create(&model.ReviewAuditLog{
			ProductionTaskID: id,
			Action:           consts.ActionCancelTask,
			StageType:        st,
			OperatorID:       userID,
			CreatedAt:        now,
		})
	}

	response.OKMsg(c, "取消成功")
}

func ListProductionAuditLogs(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var logs []model.ReviewAuditLog
	model.DB.Where("production_task_id = ?", id).Order("created_at ASC").Find(&logs)

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

func ListDeliveries(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	deliveryType := c.Query("deliveryType")

	db := model.DB.Where("task_id = ?", id)
	if deliveryType != "" {
		db = db.Where("delivery_type = ?", deliveryType)
	}

	var deliveries []model.TaskDelivery
	db.Preload("Files").Order("created_at DESC").Find(&deliveries)
	response.OK(c, deliveries)
}

func SubmitDelivery(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var task model.ProductionTask
	if err := model.DB.First(&task, id).Error; err != nil {
		response.FailNotFound(c, "任务不存在")
		return
	}

	var req struct {
		DeliveryType string                   `json:"deliveryType" binding:"required"`
		EpisodeName  string                   `json:"episodeName"`
		CoverURL     string                   `json:"coverUrl"`
		Files        []TaskDeliveryFileReq    `json:"files"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	upsertDelivery(id, req.DeliveryType, req.EpisodeName, req.CoverURL, req.Files)

	// Update task progress and create review task
	var newProgress, expectedProgress, reviewType, stageType string
	switch req.DeliveryType {
	case consts.StageFirst:
		newProgress = "初版审核中"
		expectedProgress = consts.TaskProgressFirstDraft
		reviewType = "初版审核"
		stageType = consts.StageFirst
	case consts.StageFinal:
		newProgress = "终版审核中"
		expectedProgress = consts.TaskProgressFinalDraft
		reviewType = "终版审核"
		stageType = consts.StageFinal
	case consts.StageRevision:
		newProgress = "修改版审核中"
		expectedProgress = consts.TaskProgressRevision
		reviewType = "修改版审核"
		stageType = consts.StageRevision
	}

	upRes := model.DB.Model(&task).Where("task_progress = ?", expectedProgress).Update("task_progress", newProgress)
	if upRes.RowsAffected == 0 {
		response.Fail(c, 400, "当前任务状态不允许提交，请勿重复操作")
		return
	}

	// Reuse existing rejected review task of the same type, or create a new one
	var reviewTask model.ReviewTask
	existingFound := model.DB.Where("production_task_id = ? AND task_type = ? AND review_status = ?",
		id, reviewType, consts.ReviewStatusRejected).Order("created_at DESC").First(&reviewTask).Error == nil

	epName := req.EpisodeName
	if epName == "" && existingFound && reviewTask.EpisodeName != "" {
		epName = reviewTask.EpisodeName
	}

	if existingFound {
		// Reuse: update status back to 审核中, keep existing opinions
		updates := map[string]any{"review_status": consts.ReviewStatusAuditing}
		if epName != "" {
			updates["episode_name"] = epName
		}
		model.DB.Model(&reviewTask).Updates(updates)
	} else {
		// First submission: create new review task
		reviewTask = model.ReviewTask{
			ProductionTaskID: id,
			TaskType:         reviewType,
			ReviewStatus:     consts.ReviewStatusAuditing,
			ReviewerID:       task.ReviewerID,
			EpisodeName:      epName,
		}
		model.DB.Create(&reviewTask)

		// For 修改版 first submission: seed opinions from "发起成片修改" audit log
		if stageType == consts.StageRevision {
			var initLog model.ReviewAuditLog
			if model.DB.Where("production_task_id = ? AND action = ?", id, consts.ActionStartRevision).
				First(&initLog).Error == nil && initLog.OpinionSnapshot != nil {
				var snapOps []struct {
					Content string   `json:"content"`
					Images  []string `json:"images"`
				}
				if json.Unmarshal([]byte(*initLog.OpinionSnapshot), &snapOps) == nil {
					for i, op := range snapOps {
						if strings.TrimSpace(op.Content) == "" && len(op.Images) == 0 {
							continue
						}
						model.DB.Create(&model.ReviewOpinion{
							ReviewTaskID: reviewTask.ID,
							Content:      op.Content,
							Images:       op.Images,
							SortOrder:    i,
						})
					}
				}
			}
		}
	}

	model.DB.Create(&model.ReviewAuditLog{
		ProductionTaskID: id,
		Action:           "提交审核",
		StageType:        stageType,
		OperatorID:       middleware.GetUserID(c),
		CreatedAt:        time.Now(),
	})

	response.OKMsg(c, "提交成功")
}

type TaskDeliveryFileReq struct {
	FileType   string `json:"fileType"`
	EpisodeNum int    `json:"episodeNum"`
	FileURL    string `json:"fileUrl"`
	FileName   string `json:"fileName"`
	FileSize   int64  `json:"fileSize"`
}

// upsertDelivery replaces any existing delivery of the same type and creates a new one with files.
func upsertDelivery(taskID int64, deliveryType, episodeName, coverURL string, files []TaskDeliveryFileReq) *model.TaskDelivery {
	var oldIDs []int64
	model.DB.Model(&model.TaskDelivery{}).Where("task_id = ? AND delivery_type = ?", taskID, deliveryType).Pluck("id", &oldIDs)
	if len(oldIDs) > 0 {
		model.DB.Where("delivery_id IN ?", oldIDs).Delete(&model.TaskDeliveryFile{})
		model.DB.Where("id IN ?", oldIDs).Delete(&model.TaskDelivery{})
	}

	delivery := model.TaskDelivery{
		TaskID:       taskID,
		DeliveryType: deliveryType,
		EpisodeName:  episodeName,
		CoverURL:     coverURL,
	}
	model.DB.Create(&delivery)

	for _, f := range files {
		model.DB.Create(&model.TaskDeliveryFile{
			DeliveryID: delivery.ID,
			FileType:   f.FileType,
			EpisodeNum: f.EpisodeNum,
			FileURL:    f.FileURL,
			FileName:   f.FileName,
			FileSize:   f.FileSize,
		})
	}
	return &delivery
}

func SaveDeliveryDraft(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	var req struct {
		DeliveryType string                `json:"deliveryType"`
		EpisodeName  string                `json:"episodeName"`
		CoverURL     string                `json:"coverUrl"`
		Files        []TaskDeliveryFileReq `json:"files"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	upsertDelivery(id, req.DeliveryType, req.EpisodeName, req.CoverURL, req.Files)
	response.OKMsg(c, "保存成功")
}
