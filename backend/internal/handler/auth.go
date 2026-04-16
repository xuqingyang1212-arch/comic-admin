package handler

import (
	"comic-admin/internal/middleware"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

type LoginReq struct {
	Email string `json:"email" binding:"required"`
	Name  string `json:"name"`
}

func AuthLogin(c *gin.Context) {
	var req LoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	var user model.User
	result := model.DB.Where("email = ?", req.Email).First(&user)
	if result.Error != nil {
		// Auto-create user on first login (per PRD 7.7)
		user = model.User{
			Name:   req.Name,
			Email:  req.Email,
			Status: "启用",
		}
		if err := model.DB.Create(&user).Error; err != nil {
			response.FailServer(c, "创建用户失败")
			return
		}
	}

	if user.Status != "启用" {
		response.Fail(c, 403, "账号已禁用")
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Name)
	if err != nil {
		response.FailServer(c, "生成令牌失败")
		return
	}

	response.OK(c, gin.H{
		"token": token,
		"user":  user,
	})
}

func GetCurrentUser(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var user model.User
	if err := model.DB.Preload("Roles").First(&user, userID).Error; err != nil {
		response.FailNotFound(c, "用户不存在")
		return
	}

	perms, _ := c.Get("permissions")
	response.OK(c, gin.H{
		"user":        user,
		"permissions": perms,
	})
}
