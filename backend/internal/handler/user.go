package handler

import (
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ListUsers(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.User{})

	db = ApplyLike(db, c, "name", "name")
	db = ApplyLike(db, c, "email", "email")
	db = ApplyExact(db, c, "status", "status")
	if v := c.Query("role"); v != "" {
		db = db.Where("id IN (SELECT user_id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name = ?)", v)
	}

	var users []model.User
	total, _ := pagination.CountAndFind(db, p, "created_at DESC", &users, "Roles", "Reviewer")

	response.OKPage(c, total, users)
}

type UpdateUserReq struct {
	RoleIDs    []int64 `json:"roleIds"`
	Status     string  `json:"status"`
	ReviewerID *int64  `json:"reviewerId"`
}

func UpdateUser(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var req UpdateUserReq
	if !BindOrFail(c, &req) {
		return
	}

	var user model.User
	if err := model.DB.First(&user, id).Error; err != nil {
		response.FailNotFound(c, "用户不存在")
		return
	}

	updates := map[string]interface{}{}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.ReviewerID != nil {
		if *req.ReviewerID == 0 {
			updates["reviewer_id"] = nil
		} else {
			updates["reviewer_id"] = *req.ReviewerID
		}
	}

	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			if err := tx.Model(&user).Updates(updates).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("user_id = ?", id).Delete(&model.UserRole{}).Error; err != nil {
			return err
		}
		for _, roleID := range req.RoleIDs {
			if err := tx.Create(&model.UserRole{UserID: id, RoleID: roleID}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if txErr != nil {
		response.FailServer(c, "更新用户失败")
		return
	}

	model.DB.Preload("Roles").Preload("Reviewer").First(&user, id)
	response.OK(c, user)
}
