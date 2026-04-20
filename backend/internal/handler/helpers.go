package handler

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"comic-admin/internal/model"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// errConflict is a sentinel error returned from inside a transaction to signal
// a CAS / optimistic-concurrency conflict. Callers should map this to a 400
// "task already processed" response instead of a generic 500.
var errConflict = errors.New("conflict: resource already modified")

// BindOrFail binds JSON body into dest and sends 400 on failure. Returns false if binding failed.
func BindOrFail(c *gin.Context, dest any) bool {
	if err := c.ShouldBindJSON(dest); err != nil {
		response.FailBadRequest(c, "参数错误")
		return false
	}
	return true
}

// ParseID extracts and validates an int64 path parameter.
// Returns 0 and sends a 400 response if the parameter is missing or invalid.
func ParseID(c *gin.Context, param string) (int64, bool) {
	raw := c.Param(param)
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		response.FailBadRequest(c, "无效的"+param)
		return 0, false
	}
	return id, true
}

// TrimQuery returns a trimmed query parameter (empty string if not present).
func TrimQuery(c *gin.Context, key string) string {
	return strings.TrimSpace(c.Query(key))
}

// ApplyDateRange reads startKey/endKey from query params and applies a WHERE clause on column.
func ApplyDateRange(db *gorm.DB, c *gin.Context, column, startKey, endKey string) *gorm.DB {
	if v := TrimQuery(c, startKey); v != "" {
		db = db.Where(fmt.Sprintf("%s >= ?", column), v)
	}
	if v := TrimQuery(c, endKey); v != "" {
		db = db.Where(fmt.Sprintf("%s <= ?", column), v+" 23:59:59")
	}
	return db
}

// WhereUserNameLike filters rows whose column (e.g. "creator_id") matches users with a LIKE name.
func WhereUserNameLike(db *gorm.DB, column, name string) *gorm.DB {
	return db.Where(fmt.Sprintf("%s IN (SELECT id FROM users WHERE name LIKE ?)", column), "%"+name+"%")
}

// ApplyLike reads queryKey from the request, trims it, and applies a LIKE filter on column.
func ApplyLike(db *gorm.DB, c *gin.Context, queryKey, column string) *gorm.DB {
	if v := TrimQuery(c, queryKey); v != "" {
		db = db.Where(fmt.Sprintf("%s LIKE ?", column), "%"+v+"%")
	}
	return db
}

// ApplyExact reads queryKey from the request, trims it, and applies an exact-match filter on column.
func ApplyExact(db *gorm.DB, c *gin.Context, queryKey, column string) *gorm.DB {
	if v := TrimQuery(c, queryKey); v != "" {
		db = db.Where(fmt.Sprintf("%s = ?", column), v)
	}
	return db
}

// BatchLoadUsers loads users by IDs in a single query and returns a map[id]*User.
func BatchLoadUsers(ids []int64) map[int64]*model.User {
	if len(ids) == 0 {
		return nil
	}
	var users []model.User
	model.DB.Where("id IN ?", ids).Find(&users)
	m := make(map[int64]*model.User, len(users))
	for i := range users {
		m[users[i].ID] = &users[i]
	}
	return m
}

// BatchLoadScripts loads scripts by IDs in a single query and returns a map[id]*Script.
func BatchLoadScripts(ids []int64) map[int64]*model.Script {
	if len(ids) == 0 {
		return nil
	}
	var scripts []model.Script
	model.DB.Where("id IN ?", ids).Find(&scripts)
	m := make(map[int64]*model.Script, len(scripts))
	for i := range scripts {
		m[scripts[i].ID] = &scripts[i]
	}
	return m
}

// LoadByIDOr404 loads a record by primary key into dest; if not found, responds 404
// with the supplied label (e.g. "任务不存在") and returns false.
func LoadByIDOr404(c *gin.Context, id int64, dest any, notFoundMsg string) bool {
	if err := model.DB.First(dest, id).Error; err != nil {
		response.FailNotFound(c, notFoundMsg)
		return false
	}
	return true
}

// RequireEq sends 400 with msg and returns false when actual != expected.
// Useful for simple state guards like "task must be in X state to transition".
func RequireEq[T comparable](c *gin.Context, actual, expected T, msg string) bool {
	if actual != expected {
		response.Fail(c, 400, msg)
		return false
	}
	return true
}
