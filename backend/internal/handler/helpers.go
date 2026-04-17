package handler

import (
	"strconv"
	"strings"

	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
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

// DateRangeFilter applies a date range WHERE clause to the given GORM DB scope.
// startKey/endKey are the query parameter names; column is the DB column.
func DateRangeFilter(c *gin.Context, column, startKey, endKey string) func(*gin.Context) (string, []any) {
	var conditions []string
	var args []any

	if v := TrimQuery(c, startKey); v != "" {
		conditions = append(conditions, column+" >= ?")
		args = append(args, v)
	}
	if v := TrimQuery(c, endKey); v != "" {
		conditions = append(conditions, column+" <= ?")
		args = append(args, v+" 23:59:59")
	}

	return func(_ *gin.Context) (string, []any) {
		if len(conditions) == 0 {
			return "", nil
		}
		return strings.Join(conditions, " AND "), args
	}
}
