package service

import (
	"errors"

	"comic-admin/internal/model"

	"gorm.io/gorm"
)

var (
	ErrTaskAlreadyClaimed = errors.New("任务已被领取")
	ErrInvalidTaskStatus  = errors.New("任务状态不允许此操作")
)

type TaskService interface {
	ListHall(filter TaskFilter) ([]model.ProductionTask, int64, error)
	ListMine(userID int64, filter TaskFilter) ([]model.ProductionTask, int64, error)
	GetByID(id int64) (*model.ProductionTask, error)
	Claim(taskID, userID int64) error
	Cancel(taskID, userID int64) error
}

type TaskFilter struct {
	TaskName     string
	TaskType     string
	TaskProgress string
	ArtStyle     string
	StartDate    string
	EndDate      string
	Page         int
	PageSize     int
}

type taskService struct {
	db *gorm.DB
}

func (s *taskService) ListHall(f TaskFilter) ([]model.ProductionTask, int64, error) {
	q := s.db.Model(&model.ProductionTask{})
	q = applyTaskFilters(q, f)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var tasks []model.ProductionTask
	err := q.Order("id DESC").
		Offset((f.Page - 1) * f.PageSize).
		Limit(f.PageSize).
		Preload("Initiator").
		Find(&tasks).Error

	return tasks, total, err
}

func (s *taskService) ListMine(userID int64, f TaskFilter) ([]model.ProductionTask, int64, error) {
	q := s.db.Model(&model.ProductionTask{}).Where("producer_id = ?", userID)
	q = applyTaskFilters(q, f)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var tasks []model.ProductionTask
	err := q.Order("id DESC").
		Offset((f.Page - 1) * f.PageSize).
		Limit(f.PageSize).
		Preload("Initiator").
		Find(&tasks).Error

	return tasks, total, err
}

func (s *taskService) GetByID(id int64) (*model.ProductionTask, error) {
	var task model.ProductionTask
	err := s.db.Preload("Initiator").Preload("Producer").Preload("Reviewer").First(&task, id).Error
	return &task, err
}

func (s *taskService) Claim(taskID, userID int64) error {
	result := s.db.Model(&model.ProductionTask{}).
		Where("id = ? AND task_progress = ?", taskID, "待领取").
		Updates(map[string]any{
			"producer_id":   userID,
			"task_progress": "制作中",
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrTaskAlreadyClaimed
	}
	return nil
}

func (s *taskService) Cancel(taskID, userID int64) error {
	result := s.db.Model(&model.ProductionTask{}).
		Where("id = ? AND initiator_id = ? AND task_progress IN ?", taskID, userID, []string{"待领取", "制作中"}).
		Update("task_progress", "已取消")
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrInvalidTaskStatus
	}
	return nil
}

func applyTaskFilters(q *gorm.DB, f TaskFilter) *gorm.DB {
	if f.TaskName != "" {
		q = q.Where("task_name LIKE ?", "%"+f.TaskName+"%")
	}
	if f.TaskType != "" {
		q = q.Where("task_type = ?", f.TaskType)
	}
	if f.TaskProgress != "" {
		q = q.Where("task_progress = ?", f.TaskProgress)
	}
	if f.ArtStyle != "" {
		q = q.Where("art_style = ?", f.ArtStyle)
	}
	if f.StartDate != "" {
		q = q.Where("publish_time >= ?", f.StartDate)
	}
	if f.EndDate != "" {
		q = q.Where("publish_time <= ?", f.EndDate+" 23:59:59")
	}
	return q
}
