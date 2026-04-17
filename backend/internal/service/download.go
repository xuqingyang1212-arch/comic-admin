package service

import (
	"comic-admin/internal/model"

	"gorm.io/gorm"
)

type DownloadService interface {
	List(filter DownloadFilter) ([]model.DownloadTask, int64, error)
	GetByID(id int64) (*model.DownloadTask, error)
	Create(task *model.DownloadTask) error
	Retry(id int64) error
}

type DownloadFilter struct {
	ComicName string
	Status    string
	CreatorID int64
	StartDate string
	EndDate   string
	Page      int
	PageSize  int
}

type downloadService struct {
	db *gorm.DB
}

func (s *downloadService) List(f DownloadFilter) ([]model.DownloadTask, int64, error) {
	q := s.db.Model(&model.DownloadTask{})

	if f.ComicName != "" {
		q = q.Where("comic_name LIKE ?", "%"+f.ComicName+"%")
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.CreatorID > 0 {
		q = q.Where("creator_id = ?", f.CreatorID)
	}
	if f.StartDate != "" {
		q = q.Where("created_at >= ?", f.StartDate)
	}
	if f.EndDate != "" {
		q = q.Where("created_at <= ?", f.EndDate+" 23:59:59")
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var tasks []model.DownloadTask
	err := q.Order("id DESC").
		Offset((f.Page - 1) * f.PageSize).
		Limit(f.PageSize).
		Find(&tasks).Error

	return tasks, total, err
}

func (s *downloadService) GetByID(id int64) (*model.DownloadTask, error) {
	var task model.DownloadTask
	err := s.db.First(&task, id).Error
	return &task, err
}

func (s *downloadService) Create(task *model.DownloadTask) error {
	return s.db.Create(task).Error
}

func (s *downloadService) Retry(id int64) error {
	return s.db.Model(&model.DownloadTask{}).Where("id = ?", id).
		Update("status", "进行中").Error
}
