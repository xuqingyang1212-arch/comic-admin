package service

import (
	"comic-admin/internal/model"

	"gorm.io/gorm"
)

type UserService interface {
	List(filter UserFilter) ([]model.User, int64, error)
	GetByID(id int64) (*model.User, error)
	GetByEmail(email string) (*model.User, error)
	Update(user *model.User) error
}

type UserFilter struct {
	Name   string
	Email  string
	Status string
	Page   int
	PageSize int
}

type userService struct {
	db *gorm.DB
}

func (s *userService) List(f UserFilter) ([]model.User, int64, error) {
	q := s.db.Model(&model.User{})

	if f.Name != "" {
		q = q.Where("name LIKE ?", "%"+f.Name+"%")
	}
	if f.Email != "" {
		q = q.Where("email LIKE ?", "%"+f.Email+"%")
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []model.User
	err := q.Order("id DESC").
		Offset((f.Page - 1) * f.PageSize).
		Limit(f.PageSize).
		Preload("Roles").
		Find(&users).Error

	return users, total, err
}

func (s *userService) GetByID(id int64) (*model.User, error) {
	var user model.User
	err := s.db.Preload("Roles").First(&user, id).Error
	return &user, err
}

func (s *userService) GetByEmail(email string) (*model.User, error) {
	var user model.User
	err := s.db.Where("email = ?", email).First(&user).Error
	return &user, err
}

func (s *userService) Update(user *model.User) error {
	return s.db.Save(user).Error
}
