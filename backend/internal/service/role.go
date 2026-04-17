package service

import (
	"comic-admin/internal/model"

	"gorm.io/gorm"
)

type RoleService interface {
	List() ([]model.Role, error)
	Create(role *model.Role) error
	Update(role *model.Role) error
	SyncPermissions(roleID int64, permKeys []string) error
}

type roleService struct {
	db *gorm.DB
}

func (s *roleService) List() ([]model.Role, error) {
	var roles []model.Role
	err := s.db.Preload("Permissions").Order("id ASC").Find(&roles).Error
	return roles, err
}

func (s *roleService) Create(role *model.Role) error {
	return s.db.Create(role).Error
}

func (s *roleService) Update(role *model.Role) error {
	return s.db.Save(role).Error
}

func (s *roleService) SyncPermissions(roleID int64, permKeys []string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", roleID).Delete(&model.RolePermission{}).Error; err != nil {
			return err
		}
		for _, key := range permKeys {
			perm := model.RolePermission{RoleID: roleID, PermissionKey: key}
			if err := tx.Create(&perm).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
