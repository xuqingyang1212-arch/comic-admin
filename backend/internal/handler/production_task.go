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
	"gorm.io/gorm"
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
	attachReviewEpisodeNameBatch(tasks)
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

// attachReviewEpisodeNameBatch batch-loads the latest rejected ReviewTask.EpisodeName
// for each production task (N+1 → 1 query).
func attachReviewEpisodeNameBatch(tasks []model.ProductionTask) {
	if len(tasks) == 0 {
		return
	}
	ids := make([]int64, 0, len(tasks))
	for i := range tasks {
		ids = append(ids, tasks[i].ID)
	}
	var rows []model.ReviewTask
	// Select only the fields we need; grab the most recent rejected record per production task
	subQ := model.DB.Model(&model.ReviewTask{}).
		Select("MAX(id) AS id").
		Where("production_task_id IN ? AND review_status = ? AND episode_name <> ''", ids, consts.ReviewStatusRejected).
		Group("production_task_id")
	model.DB.Select("id, production_task_id, episode_name").
		Where("id IN (?)", subQ).
		Find(&rows)
	m := make(map[int64]string, len(rows))
	for _, r := range rows {
		m[r.ProductionTaskID] = r.EpisodeName
	}
	for i := range tasks {
		if name, ok := m[tasks[i].ID]; ok {
			tasks[i].ReviewEpisodeName = name
		}
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

	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&task).Where("task_progress = ?", consts.TaskProgressPending).Updates(map[string]any{
			"task_progress": consts.TaskProgressFirstDraft,
			"producer_id":   userID,
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errConflict
		}
		// 领取任务 is a cross-stage event (occurs before 全集/分集 splits),
		// record with empty StageType so the timeline shows it as a neutral node.
		return tx.Create(&model.ReviewAuditLog{
			ProductionTaskID: id,
			Action:           consts.ActionClaimTask,
			StageType:        "",
			OperatorID:       userID,
			CreatedAt:        time.Now(),
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
	userID := middleware.GetUserID(c)
	now := time.Now()

	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&task).Where("task_progress NOT IN ?", []string{consts.TaskProgressCompleted, consts.TaskProgressCancelled}).Update("task_progress", consts.TaskProgressCancelled)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errConflict
		}

		if err := tx.Model(&model.ReviewTask{}).Where("production_task_id = ? AND review_status = ?", id, consts.ReviewStatusAuditing).
			Update("review_status", consts.ReviewStatusCancelled).Error; err != nil {
			return err
		}

		// Write a cancellation log for every stage that has existing audit records,
		// so the cancel node appears in all relevant audit-record views.
		// Ignore cross-stage actions (发布任务 / 领取任务) which have StageType == "".
		var rawStages []string
		if err := tx.Model(&model.ReviewAuditLog{}).Where("production_task_id = ?", id).
			Distinct("stage_type").Pluck("stage_type", &rawStages).Error; err != nil {
			return err
		}
		existingStages := make([]string, 0, len(rawStages))
		for _, s := range rawStages {
			if s != "" {
				existingStages = append(existingStages, s)
			}
		}

		if len(existingStages) == 0 {
			// Fallback: determine from task progress (task cancelled before any
			// stage-specific log was written, e.g. cancelled right after 领取任务).
			st := consts.StageFirst
			if strings.Contains(oldProgress, consts.StageFinal) {
				st = consts.StageFinal
			} else if strings.Contains(oldProgress, consts.StageRevision) {
				st = consts.StageRevision
			}
			existingStages = []string{st}
		}

		for _, st := range existingStages {
			if err := tx.Create(&model.ReviewAuditLog{
				ProductionTaskID: id,
				Action:           consts.ActionCancelTask,
				StageType:        st,
				OperatorID:       userID,
				CreatedAt:        now,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if txErr != nil {
		if txErr == errConflict {
			response.Fail(c, 400, "该任务已被处理，请勿重复操作")
			return
		}
		response.Fail(c, 500, "取消失败，请重试")
		return
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

	opIDs := make([]int64, 0, len(logs))
	for _, l := range logs {
		if l.OperatorID != 0 {
			opIDs = append(opIDs, l.OperatorID)
		}
	}
	opMap := BatchLoadUsers(opIDs)
	for i := range logs {
		logs[i].Operator = opMap[logs[i].OperatorID]
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
	if !BindOrFail(c, &req) {
		return
	}

	// Update task progress and create review task
	var newProgress, expectedProgress, reviewType, stageType string
	switch req.DeliveryType {
	case consts.StageFirst:
		newProgress = consts.TaskProgressFirstReviewing
		expectedProgress = consts.TaskProgressFirstDraft
		reviewType = consts.ReviewTypeFirst
		stageType = consts.StageFirst
	case consts.StageFinal:
		newProgress = consts.TaskProgressFinalReviewing
		expectedProgress = consts.TaskProgressFinalDraft
		reviewType = consts.ReviewTypeFinal
		stageType = consts.StageFinal
	case consts.StageRevision:
		newProgress = consts.TaskProgressRevisionReviewing
		expectedProgress = consts.TaskProgressRevision
		reviewType = consts.ReviewTypeRevision
		stageType = consts.StageRevision
	}

	userID := middleware.GetUserID(c)

	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		if _, err := upsertDeliveryTx(tx, id, req.DeliveryType, req.EpisodeName, req.CoverURL, req.Files); err != nil {
			return err
		}

		upRes := tx.Model(&task).Where("task_progress = ?", expectedProgress).Update("task_progress", newProgress)
		if upRes.Error != nil {
			return upRes.Error
		}
		if upRes.RowsAffected == 0 {
			return errConflict
		}

		// 1:1 upsert: find existing ReviewTask for this ProductionTask, or create one
		var reviewTask model.ReviewTask
		epName := req.EpisodeName
		existingFound := tx.Where("production_task_id = ?", id).First(&reviewTask).Error == nil

		if existingFound {
			if epName == "" && reviewTask.EpisodeName != "" {
				epName = reviewTask.EpisodeName
			}
			if err := tx.Model(&reviewTask).Updates(map[string]any{
				"task_type":     reviewType,
				"review_status": consts.ReviewStatusAuditing,
				"reviewer_id":   task.ReviewerID,
				"episode_name":  epName,
			}).Error; err != nil {
				return err
			}
		} else {
			reviewTask = model.ReviewTask{
				ProductionTaskID: id,
				TaskType:         reviewType,
				ReviewStatus:     consts.ReviewStatusAuditing,
				ReviewerID:       task.ReviewerID,
				EpisodeName:      epName,
			}
			if err := tx.Create(&reviewTask).Error; err != nil {
				return err
			}

			if stageType == consts.StageRevision {
				var initLog model.ReviewAuditLog
				if tx.Where("production_task_id = ? AND action = ?", id, consts.ActionStartRevision).
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
							if err := tx.Create(&model.ReviewOpinion{
								ReviewTaskID: reviewTask.ID,
								Content:      op.Content,
								Images:       op.Images,
								SortOrder:    i,
							}).Error; err != nil {
								return err
							}
						}
					}
				}
			}
		}

		return tx.Create(&model.ReviewAuditLog{
			ProductionTaskID: id,
			Action:           consts.ActionSubmitReview,
			StageType:        stageType,
			OperatorID:       userID,
			CreatedAt:        time.Now(),
		}).Error
	})

	if txErr != nil {
		if txErr == errConflict {
			response.Fail(c, 400, "当前任务状态不允许提交，请勿重复操作")
			return
		}
		response.Fail(c, 500, "提交失败，请重试")
		return
	}

	response.OKMsg(c, "提交成功")
}

type TaskDeliveryFileReq struct {
	FileType   string `json:"fileType"`
	EpisodeNum int    `json:"episodeNum"`
	FileURL    string `json:"fileUrl"`
	FileName   string `json:"fileName"`
	FileSize   int64  `json:"fileSize"`
}

// upsertDeliveryTx replaces any existing delivery of the same type and creates a new one with files.
// Must run inside a transaction (pass tx). Returns the newly created delivery.
func upsertDeliveryTx(tx *gorm.DB, taskID int64, deliveryType, episodeName, coverURL string, files []TaskDeliveryFileReq) (*model.TaskDelivery, error) {
	var oldIDs []int64
	if err := tx.Model(&model.TaskDelivery{}).Where("task_id = ? AND delivery_type = ?", taskID, deliveryType).Pluck("id", &oldIDs).Error; err != nil {
		return nil, err
	}
	if len(oldIDs) > 0 {
		if err := tx.Where("delivery_id IN ?", oldIDs).Delete(&model.TaskDeliveryFile{}).Error; err != nil {
			return nil, err
		}
		if err := tx.Where("id IN ?", oldIDs).Delete(&model.TaskDelivery{}).Error; err != nil {
			return nil, err
		}
	}

	delivery := model.TaskDelivery{
		TaskID:       taskID,
		DeliveryType: deliveryType,
		EpisodeName:  episodeName,
		CoverURL:     coverURL,
	}
	if err := tx.Create(&delivery).Error; err != nil {
		return nil, err
	}

	for _, f := range files {
		if err := tx.Create(&model.TaskDeliveryFile{
			DeliveryID: delivery.ID,
			FileType:   f.FileType,
			EpisodeNum: f.EpisodeNum,
			FileURL:    f.FileURL,
			FileName:   f.FileName,
			FileSize:   f.FileSize,
		}).Error; err != nil {
			return nil, err
		}
	}
	return &delivery, nil
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
	if !BindOrFail(c, &req) {
		return
	}

	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := upsertDeliveryTx(tx, id, req.DeliveryType, req.EpisodeName, req.CoverURL, req.Files)
		return err
	})
	if txErr != nil {
		response.Fail(c, 500, "保存失败，请重试")
		return
	}
	response.OKMsg(c, "保存成功")
}
