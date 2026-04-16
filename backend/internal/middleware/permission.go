package middleware

import (
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

// UserPermissions is populated after JWT validation by the auth service.
// Stored in gin context as "permissions" ([]string).

func RequirePerm(permKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		perms, exists := c.Get("permissions")
		if !exists {
			response.FailForbidden(c, "无权限信息")
			c.Abort()
			return
		}
		permList, ok := perms.([]string)
		if !ok {
			response.FailForbidden(c, "权限数据异常")
			c.Abort()
			return
		}
		for _, p := range permList {
			if p == permKey {
				c.Next()
				return
			}
		}
		response.FailForbidden(c, "无操作权限")
		c.Abort()
	}
}
