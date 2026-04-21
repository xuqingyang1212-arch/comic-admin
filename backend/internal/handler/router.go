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
	api.POST("/auth/register", AuthRegister)
	api.POST("/auth/check-email", AuthCheckEmail)
	api.POST("/auth/reset-password", AuthResetPassword)
	api.GET("/auth/invite-info", GetInviteInfo)
	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	perm := middleware.RequirePerm
	permAny := middleware.RequireAnyPerm

	// Protected routes — session guard enforces single-device login; dedup prevents double-submit
	auth := api.Group("", middleware.JWTAuth(), middleware.SessionGuard(), middleware.LoadPermissions(model.DB), middleware.PreventDuplicateSubmit(3*time.Second))
	{
		// --- User Management ---
		auth.GET("/users/me", GetCurrentUser)
		auth.GET("/users", perm("system.user.list"), ListUsers)
		auth.PUT("/users/:id", perm("system.user.edit"), UpdateUser)

		// --- Role Management ---
		auth.GET("/roles", perm("system.role.list"), ListRoles)
		auth.POST("/roles", perm("system.role.add"), CreateRole)
		auth.PUT("/roles/:id", perm("system.role.edit"), UpdateRole)
		auth.GET("/roles/:id/invite-code", perm("system.role.invite"), GetRoleInviteCode)
		auth.GET("/permissions/tree", GetPermissionTree)

		// --- Books ---
		auth.GET("/books", perm("resource.book.list"), ListBooks)
		auth.GET("/books/:id", GetBook)

		// --- Script Drafts (creation) ---
		auth.GET("/script-drafts", perm("scriptCreate.list"), ListScriptDrafts)
		auth.GET("/script-drafts/:id", perm("scriptCreate.detail"), GetScriptDraft)
		auth.POST("/script-drafts", perm("scriptCreate.edit"), CreateScriptDraft)
		auth.PUT("/script-drafts/:id", perm("scriptCreate.edit"), UpdateScriptDraft)
		auth.POST("/script-drafts/:id/submit", perm("scriptCreate.edit"), SubmitScriptDraft)
		auth.DELETE("/script-drafts/:id", perm("scriptCreate.delete"), DeleteScriptDraft)
		auth.GET("/script-drafts/:id/audit-logs", perm("scriptCreate.log"), ListScriptAuditLogs)

		// --- Script Audit ---
		auth.GET("/script-audit/hall", perm("review.script.hall_list"), ListScriptAuditHall)
		auth.GET("/script-audit/mine", perm("review.script.my_list"), ListScriptAuditMine)
		auth.POST("/script-audit/:id/claim", perm("review.script.hall_take"), ClaimScriptAudit)
		auth.POST("/script-audit/:id/review", perm("review.script.my_review"), ReviewScriptAudit)
		auth.PUT("/script-audit/:id/save", perm("review.script.my_review"), SaveScriptAuditDraft)

		// --- Scripts (library) ---
		auth.GET("/scripts", perm("resource.script.list"), ListScripts)
		auth.GET("/scripts/:id", perm("resource.script.detail"), GetScript)
		auth.POST("/scripts/:id/production-tasks", perm("resource.script.publish"), PublishProductionTask)
		auth.POST("/scripts/:id/remakes", perm("resource.script.remake"), CreateScriptRemake)

		// --- Production Tasks ---
		auth.GET("/production-tasks/hall", perm("comicMake.hall.list"), ListProductionTaskHall)
		auth.GET("/production-tasks/mine", perm("comicMake.my.list"), ListProductionTaskMine)
		auth.GET("/production-tasks/:id", permAny("comicMake.hall.detail", "comicMake.my.detail"), GetProductionTask)
		auth.POST("/production-tasks/:id/claim", perm("comicMake.hall.take"), ClaimProductionTask)
		auth.POST("/production-tasks/:id/cancel", perm("comicMake.hall.cancel"), CancelProductionTask)
		auth.GET("/production-tasks/:id/audit-logs", permAny("comicMake.hall.log", "comicMake.my.log"), ListProductionAuditLogs)
		auth.GET("/production-tasks/:id/deliveries", permAny("comicMake.my.upload1", "comicMake.my.upload2", "comicMake.my.upload3"), ListDeliveries)
		auth.POST("/production-tasks/:id/deliveries", permAny("comicMake.my.upload1", "comicMake.my.upload2", "comicMake.my.upload3"), SubmitDelivery)
		auth.PUT("/production-tasks/:id/deliveries/draft", permAny("comicMake.my.upload1", "comicMake.my.upload2", "comicMake.my.upload3"), SaveDeliveryDraft)

		// --- Comic Review ---
		// `list` dispatches my_list / join_list inside the handler based on ?scope=.
		auth.GET("/comic-review/tasks", ListComicReviewTasks)
		auth.GET("/comic-review/tasks/:id", permAny("review.comic.my_detail", "review.comic.join_detail"), GetComicReviewTask)
		auth.POST("/comic-review/tasks/:id/review", perm("review.comic.my_review"), ReviewComicTask)
		auth.PUT("/comic-review/tasks/:id/save", perm("review.comic.my_review"), SaveComicReviewDraft)
		auth.GET("/comic-review/tasks/:id/logs", permAny("review.comic.my_log", "review.comic.join_log"), ListComicReviewLogs)

		// --- Comics ---
		auth.GET("/comics", perm("resource.comic.list"), ListComics)
		auth.GET("/comics/:id", perm("resource.comic.detail"), GetComic)
		auth.POST("/comics/:id/download", perm("resource.comic.download"), CreateDownloadTask)
		auth.POST("/comics/:id/revisions", perm("resource.comic.revise"), CreateRevision)

		// --- Download Center ---
		auth.GET("/download/tasks", perm("resource.downloadCenter.list"), ListDownloadTasks)
		auth.GET("/download/tasks/:id/url", perm("resource.downloadCenter.download"), GetDownloadURL)
		auth.POST("/download/tasks/:id/retry", perm("resource.downloadCenter.retry"), RetryDownloadTask)

		// --- Register Review ---
		auth.GET("/register-reviews", perm("system.registerReview.list"), ListRegisterReviews)
		// `review` dispatches approve / reject inside the handler based on action.
		auth.POST("/register-reviews/:id/review", ReviewRegistration)

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
