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
	"gorm.io/gorm"
)

func ListComicReviewTasks(c *gin.Context) {
	p := pagination.Parse(c)
	userID := middleware.GetUserID(c)
	scope := c.Query("scope")

	db := model.DB.Model(&model.ReviewTask{})

	if scope == "participated" {
		// 我参与的审核：根据审核日志反查用户以审核人身份处理过的制作任务（包含待提审等中间态）
		db = db.Where("production_task_id IN (?)",
			model.DB.Model(&model.ReviewAuditLog{}).
				Select("DISTINCT production_task_id").
				Where("operator_id = ? AND action IN ?", userID,
					[]string{consts.ActionApproved, consts.ActionRejected}))
	} else {
		// 待我审核：仅展示当前归属且审核中的任务
		db = db.
			Where("reviewer_id = ?", userID).
			Where("review_status = ?", consts.ReviewStatusAuditing)
	}

	db = ApplyExact(db, c, "taskType", "task_type")
	if scope == "participated" {
		db = ApplyExact(db, c, "reviewStatus", "review_status")
	}
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

	scriptIDs := make([]int64, 0, len(tasks))
	for _, t := range tasks {
		if pt := t.ProductionTask; pt != nil && pt.ScriptID != 0 {
			scriptIDs = append(scriptIDs, pt.ScriptID)
		}
	}
	scriptMap := BatchLoadScripts(scriptIDs)
	for i := range tasks {
		if pt := tasks[i].ProductionTask; pt != nil {
			tasks[i].ProductionTask.Script = scriptMap[pt.ScriptID]
		}
	}

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
		deliveryType := stageType
		if deliveryType == consts.StageSecondReview {
			deliveryType = consts.StageFinal
		}
		var delivery model.TaskDelivery
		if model.DB.Where("task_id = ? AND delivery_type = ?", task.ProductionTaskID, deliveryType).
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
	if !BindOrFail(c, &req) {
		return
	}

	var reviewTask model.ReviewTask
	if err := model.DB.First(&reviewTask, id).Error; err != nil {
		response.FailNotFound(c, "审核任务不存在")
		return
	}

	userID := middleware.GetUserID(c)
	if reviewTask.ReviewerID == nil || *reviewTask.ReviewerID != userID {
		response.Fail(c, 403, "您不是当前审核人，无法操作")
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
	if req.Result == consts.ReviewStatusApproved && (reviewTask.TaskType == consts.ReviewTypeFinal || reviewTask.TaskType == consts.ReviewTypeSecondReview || reviewTask.TaskType == consts.ReviewTypeRevision) {
		epName := req.EpisodeName
		if epName == "" {
			epName = reviewTask.EpisodeName
		}
		if epName != "" {
			dupQuery := model.DB.Model(&model.Comic{}).Where("episode_name = ?", epName)
			if reviewTask.TaskType == consts.ReviewTypeRevision && task.ComicID != nil {
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

	// Snapshot opinions for audit log
	snapshot, _ := json.Marshal(req.Opinions)
	snapshotStr := string(snapshot)

	stageType := strings.TrimSuffix(reviewTask.TaskType, "审核")

	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		// Atomic CAS: only update if status is still consts.ReviewStatusAuditing
		casRes := tx.Model(&reviewTask).Where("review_status = ?", consts.ReviewStatusAuditing).Updates(map[string]any{
			"review_status": req.Result,
			"episode_name":  req.EpisodeName,
		})
		if casRes.Error != nil {
			return casRes.Error
		}
		if casRes.RowsAffected == 0 {
			return errConflict
		}

		// Replace opinions (clear old saved drafts first)
		if err := tx.Where("review_task_id = ?", id).Delete(&model.ReviewOpinion{}).Error; err != nil {
			return err
		}
		for i, op := range req.Opinions {
			if strings.TrimSpace(op.Content) == "" && len(op.Images) == 0 {
				continue
			}
			if err := tx.Create(&model.ReviewOpinion{
				ReviewTaskID: id,
				Content:      op.Content,
				Images:       op.Images,
				SortOrder:    i,
			}).Error; err != nil {
				return err
			}
		}

		if req.Result == consts.ReviewStatusApproved {
			switch reviewTask.TaskType {
			case consts.ReviewTypeFirst:
				if err := tx.Model(&reviewTask).Update("review_status", consts.ReviewStatusPendingSubmit).Error; err != nil {
					return err
				}
				if err := tx.Model(&task).Update("task_progress", consts.TaskProgressFinalDraft).Error; err != nil {
					return err
				}
			case consts.ReviewTypeFinal:
				if needSecondReviewTx(tx, userID) {
					var reviewer model.User
					if err := tx.First(&reviewer, userID).Error; err != nil {
						return err
					}
					if err := tx.Model(&reviewTask).Updates(map[string]any{
						"task_type":     consts.ReviewTypeSecondReview,
						"review_status": consts.ReviewStatusAuditing,
						"reviewer_id":   reviewer.ReviewerID,
					}).Error; err != nil {
						return err
					}
					if err := tx.Model(&task).Update("task_progress", consts.TaskProgressSecondReview).Error; err != nil {
						return err
					}
				} else {
					if err := tx.Model(&task).Update("task_progress", consts.TaskProgressCompleted).Error; err != nil {
						return err
					}
					if err := createComicFromTaskTx(tx, &task, &reviewTask); err != nil {
						return err
					}
				}
			case consts.ReviewTypeSecondReview:
				if err := tx.Model(&task).Update("task_progress", consts.TaskProgressCompleted).Error; err != nil {
					return err
				}
				if err := createComicFromTaskTx(tx, &task, &reviewTask); err != nil {
					return err
				}
			case consts.ReviewTypeRevision:
				if err := tx.Model(&task).Update("task_progress", consts.TaskProgressCompleted).Error; err != nil {
					return err
				}
				if err := updateComicFromTaskTx(tx, &task, &reviewTask); err != nil {
					return err
				}
			}
		} else {
			switch reviewTask.TaskType {
			case consts.ReviewTypeFirst:
				if err := tx.Model(&task).Update("task_progress", consts.TaskProgressFirstDraft).Error; err != nil {
					return err
				}
			case consts.ReviewTypeFinal, consts.ReviewTypeSecondReview:
				if err := tx.Model(&task).Update("task_progress", consts.TaskProgressFinalDraft).Error; err != nil {
					return err
				}
			case consts.ReviewTypeRevision:
				if err := tx.Model(&task).Update("task_progress", consts.TaskProgressRevision).Error; err != nil {
					return err
				}
			}
		}

		return tx.Create(&model.ReviewAuditLog{
			ProductionTaskID: task.ID,
			Action:           req.Result,
			StageType:        stageType,
			OperatorID:       userID,
			OpinionSnapshot:  &snapshotStr,
			CreatedAt:        time.Now(),
		}).Error
	})

	if txErr != nil {
		if txErr == errConflict {
			response.Fail(c, 400, "该任务已被处理，请勿重复操作")
			return
		}
		response.Fail(c, 500, "审核失败，请重试")
		return
	}

	response.OKMsg(c, "审核完成")
}

func needSecondReviewTx(tx *gorm.DB, reviewerUserID int64) bool {
	var reviewer model.User
	if tx.First(&reviewer, reviewerUserID).Error != nil {
		return false
	}
	return reviewer.ReviewerID != nil && *reviewer.ReviewerID > 0
}

func createComicFromTaskTx(tx *gorm.DB, task *model.ProductionTask, reviewTask *model.ReviewTask) error {
	var delivery model.TaskDelivery
	if err := tx.Where("task_id = ? AND delivery_type = ?", task.ID, consts.StageFinal).Preload("Files").Order("created_at DESC").First(&delivery).Error; err != nil {
		return err
	}

	var script model.Script
	if err := tx.First(&script, task.ScriptID).Error; err != nil {
		return err
	}

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
		if f.FileType == consts.FileTypeCopyright {
			copyrights = append(copyrights, f.FileURL)
		}
	}
	comic.CopyrightImages = copyrights

	if err := tx.Create(&comic).Error; err != nil {
		return err
	}

	for _, f := range delivery.Files {
		if f.FileType == consts.FileTypeWithSubtitle {
			if err := tx.Create(&model.ComicEpisode{
				ComicID:      comic.ID,
				EpisodeNum:   f.EpisodeNum,
				SubtitledURL: f.FileURL,
				FileSize:     f.FileSize,
			}).Error; err != nil {
				return err
			}
		}
	}
	for _, f := range delivery.Files {
		if f.FileType == consts.FileTypeNoSubtitle {
			if err := tx.Model(&model.ComicEpisode{}).
				Where("comic_id = ? AND episode_num = ?", comic.ID, f.EpisodeNum).
				Update("raw_url", f.FileURL).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func updateComicFromTaskTx(tx *gorm.DB, task *model.ProductionTask, reviewTask *model.ReviewTask) error {
	if task.ComicID == nil {
		return nil
	}
	var delivery model.TaskDelivery
	if err := tx.Where("task_id = ? AND delivery_type = ?", task.ID, consts.StageRevision).Preload("Files").Order("created_at DESC").First(&delivery).Error; err != nil {
		return err
	}

	if delivery.CoverURL != "" {
		if err := tx.Model(&model.Comic{}).Where("id = ?", *task.ComicID).Update("cover_url", delivery.CoverURL).Error; err != nil {
			return err
		}
	}
	if reviewTask.EpisodeName != "" {
		if err := tx.Model(&model.Comic{}).Where("id = ?", *task.ComicID).Update("episode_name", reviewTask.EpisodeName).Error; err != nil {
			return err
		}
	}

	for _, f := range delivery.Files {
		switch f.FileType {
		case consts.FileTypeWithSubtitle:
			if err := tx.Model(&model.ComicEpisode{}).
				Where("comic_id = ? AND episode_num = ?", *task.ComicID, f.EpisodeNum).
				Update("subtitled_url", f.FileURL).Error; err != nil {
				return err
			}
		case consts.FileTypeNoSubtitle:
			if err := tx.Model(&model.ComicEpisode{}).
				Where("comic_id = ? AND episode_num = ?", *task.ComicID, f.EpisodeNum).
				Update("raw_url", f.FileURL).Error; err != nil {
				return err
			}
		}
	}
	return nil
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
	if !BindOrFail(c, &req) {
		return
	}

	var reviewTask model.ReviewTask
	if err := model.DB.First(&reviewTask, id).Error; err != nil {
		response.FailNotFound(c, "审核任务不存在")
		return
	}

	userID := middleware.GetUserID(c)
	if reviewTask.ReviewerID == nil || *reviewTask.ReviewerID != userID {
		response.Fail(c, 403, "您不是当前审核人，无法操作")
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

	// Since production task : review task is 1:1, both audit-record views show the
	// same full timeline (including 发布任务/领取任务). The frontend handles stage
	// filtering (制作 vs 修改) uniformly.
	var logs []model.ReviewAuditLog
	model.DB.Where("production_task_id = ?", reviewTask.ProductionTaskID).
		Order("created_at ASC").Find(&logs)

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
