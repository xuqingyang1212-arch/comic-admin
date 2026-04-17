package handler

import (
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
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
	total, _ := pagination.CountAndFind(db, p, "created_at DESC", &users, "Roles")

	response.OKPage(c, total, users)
}

type UpdateUserReq struct {
	RoleIDs []int64 `json:"roleIds"`
	Status  string  `json:"status"`
}

func UpdateUser(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var req UpdateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	var user model.User
	if err := model.DB.First(&user, id).Error; err != nil {
		response.FailNotFound(c, "用户不存在")
		return
	}

	if req.Status != "" {
		model.DB.Model(&user).Update("status", req.Status)
	}

	// Update roles
	model.DB.Where("user_id = ?", id).Delete(&model.UserRole{})
	for _, roleID := range req.RoleIDs {
		model.DB.Create(&model.UserRole{UserID: id, RoleID: roleID})
	}

	model.DB.Preload("Roles").First(&user, id)
	response.OK(c, user)
}
