package handler

import (
	"comic-admin/internal/consts"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ListRegisterReviews(c *gin.Context) {
	p := pagination.Parse(c)
	q := model.DB.Model(&model.RegistrationRequest{})

	q = ApplyLike(q, c, "name", "name")
	q = ApplyLike(q, c, "email", "email")
	q = ApplyExact(q, c, "reviewStatus", "review_status")
	q = ApplyExact(q, c, "roleId", "role_id")

	var reqs []model.RegistrationRequest
	total, err := pagination.CountAndFind(q, p, "created_at DESC", &reqs)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}

	// Fill role names
	roleIDs := make([]int64, 0)
	for _, r := range reqs {
		if r.RoleID > 0 {
			roleIDs = append(roleIDs, r.RoleID)
		}
	}
	roleMap := make(map[int64]string)
	if len(roleIDs) > 0 {
		var roles []model.Role
		model.DB.Where("id IN ?", roleIDs).Find(&roles)
		for _, r := range roles {
			roleMap[r.ID] = r.Name
		}
	}
	for i := range reqs {
		reqs[i].RoleName = roleMap[reqs[i].RoleID]
	}

	response.OKPage(c, total, reqs)
}

type ReviewReq struct {
	Action string `json:"action" binding:"required"` // approve | reject
}

func ReviewRegistration(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	var req ReviewReq
	if !BindOrFail(c, &req) {
		return
	}

	var regReq model.RegistrationRequest
	if err := model.DB.First(&regReq, id).Error; err != nil {
		response.FailNotFound(c, "注册申请不存在")
		return
	}

	if regReq.ReviewStatus != consts.UserReviewPending {
		response.FailBadRequest(c, "该申请不在审核中状态")
		return
	}

	switch req.Action {
	case "approve":
		txErr := model.DB.Transaction(func(tx *gorm.DB) error {
			// Check email not taken in the meantime (inside tx to be consistent)
			var existing model.User
			if tx.Where("email = ?", regReq.Email).First(&existing).Error == nil {
				return errConflict
			}

			user := model.User{
				Name:     regReq.Name,
				Email:    regReq.Email,
				Password: regReq.Password,
				Status:   consts.UserStatusActive,
			}
			if err := tx.Create(&user).Error; err != nil {
				return err
			}
			if regReq.RoleID > 0 {
				if err := tx.Create(&model.UserRole{UserID: user.ID, RoleID: regReq.RoleID}).Error; err != nil {
					return err
				}
			}
			return tx.Model(&regReq).Update("review_status", consts.UserReviewApproved).Error
		})
		if txErr != nil {
			if txErr == errConflict {
				response.FailBadRequest(c, "该邮箱已被其他用户注册")
				return
			}
			response.FailServer(c, "创建用户失败")
			return
		}
		response.OKMsg(c, "审核通过")

	case "reject":
		if err := model.DB.Model(&regReq).Update("review_status", consts.UserReviewRejected).Error; err != nil {
			response.FailServer(c, "更新失败")
			return
		}
		response.OKMsg(c, "审核不通过")

	default:
		response.FailBadRequest(c, "无效的审核操作")
	}
}
