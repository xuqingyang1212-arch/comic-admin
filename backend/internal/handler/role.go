package handler

import (
	"strings"

	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListRoles(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.Role{})

	db = ApplyLike(db, c, "name", "name")

	var roles []model.Role
	total, _ := pagination.CountAndFind(db, p, "created_at DESC", &roles, "Users", "Permissions")

	response.OKPage(c, total, roles)
}

type RoleReq struct {
	Name        string   `json:"name" binding:"required"`
	Remark      string   `json:"remark"`
	Permissions []string `json:"permissions"`
}

func CreateRole(c *gin.Context) {
	var req RoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "角色名称必填")
		return
	}

	role := model.Role{Name: req.Name, Remark: req.Remark}
	if err := model.DB.Create(&role).Error; err != nil {
		response.FailServer(c, "创建角色失败，名称可能重复")
		return
	}

	for _, key := range req.Permissions {
		model.DB.Create(&model.RolePermission{RoleID: role.ID, PermissionKey: key})
	}

	response.OK(c, role)
}

func UpdateRole(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var req RoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	var role model.Role
	if err := model.DB.First(&role, id).Error; err != nil {
		response.FailNotFound(c, "角色不存在")
		return
	}

	if err := model.DB.Model(&role).Updates(map[string]any{"name": req.Name, "remark": req.Remark}).Error; err != nil {
		if strings.Contains(err.Error(), "Duplicate") {
			response.Fail(c, 400, "角色名称已存在")
		} else {
			response.FailServer(c, "更新角色失败")
		}
		return
	}

	model.DB.Where("role_id = ?", id).Delete(&model.RolePermission{})
	for _, key := range req.Permissions {
		model.DB.Create(&model.RolePermission{RoleID: id, PermissionKey: key})
	}

	response.OKMsg(c, "更新成功")
}

func GetPermissionTree(c *gin.Context) {
	tree := []map[string]any{
		{"key": "resource", "label": "资源管理", "children": []map[string]any{
			{"key": "resource.book", "label": "书籍管理", "children": []map[string]any{
				{"key": "resource.book.list", "label": "列表数据"},
				{"key": "resource.book.script", "label": "创作剧本"},
				{"key": "resource.book.detail", "label": "书籍详情"},
				{"key": "resource.book.detail_script", "label": "书籍详情-创作剧本"},
			}},
			{"key": "resource.script", "label": "剧本管理", "children": []map[string]any{
				{"key": "resource.script.list", "label": "列表数据"},
				{"key": "resource.script.detail", "label": "剧本详情"},
				{"key": "resource.script.publish", "label": "发布制作任务"},
				{"key": "resource.script.remake", "label": "剧本二创"},
			}},
			{"key": "resource.comic", "label": "漫剧管理", "children": []map[string]any{
				{"key": "resource.comic.list", "label": "列表数据"},
				{"key": "resource.comic.detail", "label": "漫剧详情"},
				{"key": "resource.comic.download", "label": "下载"},
				{"key": "resource.comic.revise", "label": "发起修改"},
			}},
		}},
		{"key": "scriptCreate", "label": "剧本创作", "children": []map[string]any{
			{"key": "scriptCreate.list", "label": "列表数据"},
			{"key": "scriptCreate.edit", "label": "编辑"},
			{"key": "scriptCreate.delete", "label": "删除"},
			{"key": "scriptCreate.log", "label": "审核记录"},
		}},
		{"key": "comicMake", "label": "漫剧制作", "children": []map[string]any{
			{"key": "comicMake.hall", "label": "任务大厅", "children": []map[string]any{
				{"key": "comicMake.hall.list", "label": "列表数据"},
				{"key": "comicMake.hall.detail", "label": "任务详情"},
				{"key": "comicMake.hall.take", "label": "领取任务"},
				{"key": "comicMake.hall.cancel", "label": "取消任务"},
				{"key": "comicMake.hall.log", "label": "审核记录"},
			}},
			{"key": "comicMake.my", "label": "我的任务", "children": []map[string]any{
				{"key": "comicMake.my.list", "label": "列表数据"},
				{"key": "comicMake.my.detail", "label": "任务详情"},
				{"key": "comicMake.my.upload1", "label": "上传初版"},
				{"key": "comicMake.my.upload2", "label": "上传终版"},
				{"key": "comicMake.my.upload3", "label": "上传修改版"},
				{"key": "comicMake.my.log", "label": "审核记录"},
			}},
		}},
		{"key": "review", "label": "审核管理", "children": []map[string]any{
			{"key": "review.script", "label": "剧本审核", "children": []map[string]any{
				{"key": "review.script.hall_list", "label": "任务大厅-列表数据"},
				{"key": "review.script.hall_detail", "label": "任务大厅-剧本详情"},
				{"key": "review.script.hall_take", "label": "任务大厅-领取任务"},
				{"key": "review.script.hall_log", "label": "任务大厅-审核记录"},
				{"key": "review.script.my_list", "label": "我的审核-列表数据"},
				{"key": "review.script.my_detail", "label": "我的审核-剧本详情"},
				{"key": "review.script.my_review", "label": "我的审核-审核"},
				{"key": "review.script.my_log", "label": "我的审核-审核记录"},
			}},
			{"key": "review.comic", "label": "漫剧审核", "children": []map[string]any{
				{"key": "review.comic.list", "label": "列表数据"},
				{"key": "review.comic.detail", "label": "任务详情"},
				{"key": "review.comic.review", "label": "审核"},
				{"key": "review.comic.log", "label": "审核记录"},
			}},
		}},
		{"key": "system", "label": "系统设置", "children": []map[string]any{
			{"key": "system.user", "label": "用户管理", "children": []map[string]any{
				{"key": "system.user.list", "label": "列表数据"},
				{"key": "system.user.add", "label": "新增"},
				{"key": "system.user.edit", "label": "编辑"},
			}},
			{"key": "system.role", "label": "角色管理", "children": []map[string]any{
				{"key": "system.role.list", "label": "列表数据"},
				{"key": "system.role.add", "label": "新增"},
				{"key": "system.role.edit", "label": "编辑"},
			}},
		}},
	}
	response.OK(c, tree)
}
