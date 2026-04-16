package handler

import (
	"time"

	"comic-admin/internal/config"
	"comic-admin/internal/middleware"
	"comic-admin/internal/model"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(mode string) *gin.Engine {
	if mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:  []string{"*"},
		AllowMethods:  []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:  []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders: []string{"Content-Length"},
	}))

	api := r.Group("/api/v1")

	// Public routes
	api.POST("/auth/login", AuthLogin)
	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Protected routes — global dedup middleware prevents double-submit within 3s window
	auth := api.Group("", middleware.JWTAuth(), middleware.LoadPermissions(model.DB), middleware.PreventDuplicateSubmit(3*time.Second))
	{
		// --- User Management ---
		auth.GET("/users/me", GetCurrentUser)
		auth.GET("/users", ListUsers)
		auth.PUT("/users/:id", UpdateUser)

		// --- Role Management ---
		auth.GET("/roles", ListRoles)
		auth.POST("/roles", CreateRole)
		auth.PUT("/roles/:id", UpdateRole)
		auth.GET("/permissions/tree", GetPermissionTree)

		// --- Books ---
		auth.GET("/books", ListBooks)
		auth.GET("/books/:id", GetBook)

		// --- Script Drafts (creation) ---
		auth.GET("/script-drafts", ListScriptDrafts)
		auth.GET("/script-drafts/:id", GetScriptDraft)
		auth.POST("/script-drafts", CreateScriptDraft)
		auth.PUT("/script-drafts/:id", UpdateScriptDraft)
		auth.POST("/script-drafts/:id/submit", SubmitScriptDraft)
		auth.DELETE("/script-drafts/:id", DeleteScriptDraft)
		auth.GET("/script-drafts/:id/audit-logs", ListScriptAuditLogs)

		// --- Script Audit ---
		auth.GET("/script-audit/hall", ListScriptAuditHall)
		auth.GET("/script-audit/mine", ListScriptAuditMine)
		auth.POST("/script-audit/:id/claim", ClaimScriptAudit)
		auth.POST("/script-audit/:id/review", ReviewScriptAudit)
		auth.PUT("/script-audit/:id/save", SaveScriptAuditDraft)

		// --- Scripts (library) ---
		auth.GET("/scripts", ListScripts)
		auth.GET("/scripts/:id", GetScript)
		auth.POST("/scripts/:id/production-tasks", PublishProductionTask)
		auth.POST("/scripts/:id/remakes", CreateScriptRemake)

		// --- Production Tasks ---
		auth.GET("/production-tasks/hall", ListProductionTaskHall)
		auth.GET("/production-tasks/mine", ListProductionTaskMine)
		auth.GET("/production-tasks/:id", GetProductionTask)
		auth.POST("/production-tasks/:id/claim", ClaimProductionTask)
		auth.POST("/production-tasks/:id/cancel", CancelProductionTask)
		auth.GET("/production-tasks/:id/audit-logs", ListProductionAuditLogs)
		auth.GET("/production-tasks/:id/deliveries", ListDeliveries)
		auth.POST("/production-tasks/:id/deliveries", SubmitDelivery)
		auth.PUT("/production-tasks/:id/deliveries/draft", SaveDeliveryDraft)

		// --- Comic Review ---
		auth.GET("/comic-review/tasks", ListComicReviewTasks)
		auth.GET("/comic-review/tasks/:id", GetComicReviewTask)
		auth.POST("/comic-review/tasks/:id/review", ReviewComicTask)
		auth.PUT("/comic-review/tasks/:id/save", SaveComicReviewDraft)
		auth.GET("/comic-review/tasks/:id/logs", ListComicReviewLogs)

		// --- Comics ---
		auth.GET("/comics", ListComics)
		auth.GET("/comics/:id", GetComic)
		auth.POST("/comics/:id/download", CreateDownloadTask)
		auth.POST("/comics/:id/revisions", CreateRevision)

		// --- Download Center ---
		auth.GET("/download/tasks", ListDownloadTasks)
		auth.GET("/download/tasks/:id/url", GetDownloadURL)
		auth.POST("/download/tasks/:id/retry", RetryDownloadTask)

		// --- Upload ---
		auth.POST("/upload/presign", GetPresignURL)
	}

	// Local upload route (no auth — the presigned-style URL acts as a token)
	api.PUT("/upload/local/*key", LocalUpload)

	// ZIP download with Content-Disposition header (supports Range / resume)
	r.GET("/dl/*filepath", ServeDownloadFile)

	// Serve local uploaded files
	r.Static("/uploads", config.LocalUploadDir())

	return r
}
