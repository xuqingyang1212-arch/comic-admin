// Package service provides the business logic layer between HTTP handlers and
// the data layer. Each domain has its own service interface + implementation,
// keeping handlers thin (parse request → call service → write response).
package service

import "gorm.io/gorm"

// Services groups all domain services for dependency injection.
type Services struct {
	Book       BookService
	Script     ScriptService
	Task       TaskService
	Comic      ComicService
	Review     ReviewService
	Download   DownloadService
	User       UserService
	Role       RoleService
}

// New creates a Services instance backed by the given GORM DB.
func New(db *gorm.DB) *Services {
	return &Services{
		Book:     &bookService{db: db},
		Script:   &scriptService{db: db},
		Task:     &taskService{db: db},
		Comic:    &comicService{db: db},
		Review:   &reviewService{db: db},
		Download: &downloadService{db: db},
		User:     &userService{db: db},
		Role:     &roleService{db: db},
	}
}
