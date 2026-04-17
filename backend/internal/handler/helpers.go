package handler

import (
	"fmt"
	"strconv"
	"strings"

	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

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
