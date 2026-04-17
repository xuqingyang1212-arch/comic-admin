package service

import (
	"comic-admin/internal/model"

	"gorm.io/gorm"
)

type ComicService interface {
	List(filter ComicFilter) ([]model.Comic, int64, error)
	GetByID(id int64) (*model.Comic, error)
}

type ComicFilter struct {
	ComicID  string
	ArtStyle string
	Page     int
	PageSize int
}

type comicService struct {
	db *gorm.DB
}

func (s *comicService) List(f ComicFilter) ([]model.Comic, int64, error) {
	q := s.db.Model(&model.Comic{})

	if f.ComicID != "" {
		q = q.Where("comic_id = ?", f.ComicID)
	}
	if f.ArtStyle != "" {
		q = q.Where("art_style = ?", f.ArtStyle)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var comics []model.Comic
	err := q.Order("id DESC").
		Offset((f.Page - 1) * f.PageSize).
		Limit(f.PageSize).
		Preload("Writer").Preload("Producer").
		Find(&comics).Error

	return comics, total, err
}

func (s *comicService) GetByID(id int64) (*model.Comic, error) {
	var comic model.Comic
	err := s.db.Preload("Writer").Preload("Producer").Preload("Episodes").First(&comic, id).Error
	return &comic, err
}
