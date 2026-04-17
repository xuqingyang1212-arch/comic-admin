package service

import (
	"comic-admin/internal/model"

	"gorm.io/gorm"
)

type ReviewService interface {
	ListTasks(filter ReviewFilter) ([]model.ReviewTask, int64, error)
	GetTask(id int64) (*model.ReviewTask, error)
}

type ReviewFilter struct {
	TaskType     string
	ReviewStatus string
	ReviewerID   int64
	Page         int
	PageSize     int
}

type reviewService struct {
	db *gorm.DB
}

func (s *reviewService) ListTasks(f ReviewFilter) ([]model.ReviewTask, int64, error) {
	q := s.db.Model(&model.ReviewTask{})

	if f.TaskType != "" {
		q = q.Where("task_type = ?", f.TaskType)
	}
	if f.ReviewStatus != "" {
		q = q.Where("review_status = ?", f.ReviewStatus)
	}
	if f.ReviewerID > 0 {
		q = q.Where("reviewer_id = ?", f.ReviewerID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var tasks []model.ReviewTask
	err := q.Order("id DESC").
		Offset((f.Page - 1) * f.PageSize).
		Limit(f.PageSize).
		Preload("Reviewer").
		Find(&tasks).Error

	return tasks, total, err
}

func (s *reviewService) GetTask(id int64) (*model.ReviewTask, error) {
	var task model.ReviewTask
	err := s.db.Preload("Reviewer").Preload("Opinions").First(&task, id).Error
	return &task, err
}
