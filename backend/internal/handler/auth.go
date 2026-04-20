package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"comic-admin/internal/config"
	"comic-admin/internal/consts"
	"comic-admin/internal/middleware"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
var passwordRe = regexp.MustCompile(`^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~` + "`" + `]{6,24}$`)

// ─── Invite Code (HMAC-SHA256 signed, tamper-proof) ─────────────────────────

func inviteSign(payload string) string {
	mac := hmac.New(sha256.New, []byte(config.Global.Invite.Secret))
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func EncodeInviteCode(roleID int64) string {
	payload := strconv.FormatInt(roleID, 10)
	sig := inviteSign(payload)
	raw := payload + "." + sig
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func DecodeInviteCode(code string) (int64, error) {
	data, err := base64.RawURLEncoding.DecodeString(code)
	if err != nil {
		return 0, err
	}
	parts := strings.SplitN(string(data), ".", 2)
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid invite code")
	}
	payload, sig := parts[0], parts[1]
	if inviteSign(payload) != sig {
		return 0, fmt.Errorf("signature mismatch")
	}
	return strconv.ParseInt(payload, 10, 64)
}

// GET /auth/invite-info?code=xxx — public, resolve invite code to role name
func GetInviteInfo(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		response.FailBadRequest(c, "缺少邀请码")
		return
	}
	roleID, err := DecodeInviteCode(code)
	if err != nil || roleID <= 0 {
		response.FailBadRequest(c, "邀请码无效")
		return
	}
	var role model.Role
	if err := model.DB.First(&role, roleID).Error; err != nil {
		response.FailBadRequest(c, "邀请码对应的角色不存在")
		return
	}
	response.OK(c, gin.H{
		"roleId":   role.ID,
		"roleName": role.Name,
	})
}

// GET /roles/:id/invite-code — protected, generate invite code for a role
func GetRoleInviteCode(c *gin.Context) {
	roleID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || roleID <= 0 {
		response.FailBadRequest(c, "角色ID无效")
		return
	}
	var role model.Role
	if err := model.DB.First(&role, roleID).Error; err != nil {
		response.FailNotFound(c, "角色不存在")
		return
	}
	response.OK(c, gin.H{
		"code": EncodeInviteCode(roleID),
	})
}

// ─── Register ────────────────────────────────────────────────────────────────

type RegisterReq struct {
	Email    string `json:"email"    binding:"required"`
	Code     string `json:"code"     binding:"required"`
	Password string `json:"password" binding:"required"`
	Name     string `json:"name"     binding:"required"`
	RoleID   int64  `json:"roleId"`
}

func AuthRegister(c *gin.Context) {
	var req RegisterReq
	if !BindOrFail(c, &req) {
		return
	}

	if !emailRe.MatchString(req.Email) {
		response.FailBadRequest(c, "邮箱格式不正确")
		return
	}
	if utf8.RuneCountInString(req.Name) < 1 || utf8.RuneCountInString(req.Name) > 32 {
		response.FailBadRequest(c, "用户名长度需在 1~32 位")
		return
	}
	if !passwordRe.MatchString(req.Password) {
		response.FailBadRequest(c, "密码需 6~24 位，可由数字、字母、常规符号任意组合")
		return
	}
	if req.Code != "000000" {
		response.FailBadRequest(c, "验证码错误")
		return
	}

	if req.RoleID > 0 {
		var role model.Role
		if err := model.DB.First(&role, req.RoleID).Error; err != nil {
			response.FailBadRequest(c, "指定的角色不存在")
			return
		}
	}

	// Check if email already exists in users table
	var existingUser model.User
	if err := model.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		response.FailBadRequest(c, "该邮箱已注册")
		return
	}

	// Block if a pending request already exists for this email
	var existingReq model.RegistrationRequest
	if err := model.DB.Where("email = ? AND review_status = ?", req.Email, consts.UserReviewPending).First(&existingReq).Error; err == nil {
		response.FailBadRequest(c, "该邮箱已提交注册申请，请等待审核")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.FailServer(c, "密码加密失败")
		return
	}

	regReq := model.RegistrationRequest{
		Name:         req.Name,
		Email:        req.Email,
		Password:     string(hash),
		RoleID:       req.RoleID,
		ReviewStatus: consts.UserReviewPending,
	}
	if err := model.DB.Create(&regReq).Error; err != nil {
		response.FailServer(c, "注册失败")
		return
	}

	response.OKMsg(c, "注册成功，请等待管理员审核")
}

// ─── Login ───────────────────────────────────────────────────────────────────

type LoginReq struct {
	Email    string `json:"email"    binding:"required"`
	Password string `json:"password" binding:"required"`
}

func AuthLogin(c *gin.Context) {
	var req LoginReq
	if !BindOrFail(c, &req) {
		return
	}

	var user model.User
	if err := model.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			var regReq model.RegistrationRequest
			if model.DB.Where("email = ? AND review_status = ?", req.Email, consts.UserReviewPending).First(&regReq).Error == nil {
				response.Fail(c, 403, "账号正在审核中，请等待管理员审核通过后再登录")
				return
			}
			response.FailBadRequest(c, "账号或密码有误，请重新输入")
			return
		}
		response.FailServer(c, "查询用户失败")
		return
	}

	if user.Password == "" || bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
		response.FailBadRequest(c, "账号或密码有误，请重新输入")
		return
	}

	if user.Status != consts.UserStatusActive {
		response.Fail(c, 403, "账号已禁用")
		return
	}

	sessionToken := middleware.GenerateSessionToken()
	model.DB.Model(&user).Update("session_token", sessionToken)

	token, err := middleware.GenerateToken(user.ID, user.Name, sessionToken)
	if err != nil {
		response.FailServer(c, "生成令牌失败")
		return
	}

	response.OK(c, gin.H{
		"token": token,
		"user":  user,
	})
}

// ─── Check Email ─────────────────────────────────────────────────────────────

type CheckEmailReq struct {
	Email string `json:"email" binding:"required"`
}

func AuthCheckEmail(c *gin.Context) {
	var req CheckEmailReq
	if !BindOrFail(c, &req) {
		return
	}
	if !emailRe.MatchString(req.Email) {
		response.FailBadRequest(c, "邮箱格式不正确")
		return
	}
	var user model.User
	if err := model.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			response.FailBadRequest(c, "该邮箱未注册")
			return
		}
		response.FailServer(c, "查询失败")
		return
	}
	response.OKMsg(c, "邮箱验证通过")
}

// ─── Reset Password ──────────────────────────────────────────────────────────

type ResetPasswordReq struct {
	Email    string `json:"email"    binding:"required"`
	Code     string `json:"code"     binding:"required"`
	Password string `json:"password" binding:"required"`
}

func AuthResetPassword(c *gin.Context) {
	var req ResetPasswordReq
	if !BindOrFail(c, &req) {
		return
	}

	if !emailRe.MatchString(req.Email) {
		response.FailBadRequest(c, "邮箱格式不正确")
		return
	}
	if !passwordRe.MatchString(req.Password) {
		response.FailBadRequest(c, "密码需 6~24 位，可由数字、字母、常规符号任意组合")
		return
	}
	if req.Code != "000000" {
		response.FailBadRequest(c, "验证码错误")
		return
	}

	var user model.User
	if err := model.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			response.FailBadRequest(c, "该邮箱未注册")
			return
		}
		response.FailServer(c, "查询用户失败")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.FailServer(c, "密码加密失败")
		return
	}

	model.DB.Model(&user).Update("password", string(hash))
	response.OKMsg(c, "密码重置成功")
}

// ─── Current User ────────────────────────────────────────────────────────────

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
