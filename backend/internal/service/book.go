package service

import (
	"comic-admin/internal/model"

	"gorm.io/gorm"
)

type BookService interface {
	List(filter BookFilter) ([]model.Book, int64, error)
	GetByID(id int64) (*model.Book, error)
}

type BookFilter struct {
	BookID      string
	BookName    string
	ContentType string
	Category    string
	StartDate   string
	EndDate     string
	Page        int
	PageSize    int
}

type bookService struct {
	db *gorm.DB
}

func (s *bookService) List(f BookFilter) ([]model.Book, int64, error) {
	q := s.db.Model(&model.Book{})

	if f.BookID != "" {
		q = q.Where("book_id = ?", f.BookID)
	}
	if f.BookName != "" {
		q = q.Where("book_name LIKE ?", "%"+f.BookName+"%")
	}
	if f.ContentType != "" {
		q = q.Where("content_type = ?", f.ContentType)
	}
	if f.Category != "" {
		q = q.Where("category = ?", f.Category)
	}
	if f.StartDate != "" {
		q = q.Where("listing_time >= ?", f.StartDate)
	}
	if f.EndDate != "" {
		q = q.Where("listing_time <= ?", f.EndDate+" 23:59:59")
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var books []model.Book
	err := q.Order("id DESC").
		Offset((f.Page - 1) * f.PageSize).
		Limit(f.PageSize).
		Find(&books).Error

	return books, total, err
}

func (s *bookService) GetByID(id int64) (*model.Book, error) {
	var book model.Book
	err := s.db.First(&book, id).Error
	return &book, err
}
