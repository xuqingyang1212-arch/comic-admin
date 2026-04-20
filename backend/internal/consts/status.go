package consts

// ─── Task Progress ──────────────────────────────────────────────────────────

const (
	TaskProgressPending            = "待认领"
	TaskProgressFirstDraft         = "全集制作中"
	TaskProgressFirstReviewing     = "全集审核中"
	TaskProgressFinalDraft         = "分集制作中"
	TaskProgressFinalReviewing     = "分集审核中"
	TaskProgressRevision           = "返修版制作中"
	TaskProgressRevisionReviewing  = "返修版审核中"
	TaskProgressSecondReview       = "二审审核中"
	TaskProgressCompleted          = "已完成"
	TaskProgressCancelled          = "已取消"
)

// ─── Task Type ──────────────────────────────────────────────────────────────

const (
	TaskTypeProduce = "制作"
	TaskTypeRevise  = "修改"
)

// ─── Delivery / Stage Type ──────────────────────────────────────────────────

const (
	StageFirst        = "全集"
	StageFinal        = "分集"
	StageRevision     = "返修版"
	StageSecondReview = "二审"
)

const (
	ReviewTypeFirst        = "全集审核"
	ReviewTypeFinal        = "分集审核"
	ReviewTypeRevision     = "返修版审核"
	ReviewTypeSecondReview = "二审审核"
)

// ─── Review Status ──────────────────────────────────────────────────────────

const (
	ReviewStatusPending       = "待认领"
	ReviewStatusAuditing      = "审核中"
	ReviewStatusRejected      = "驳回修改"
	ReviewStatusCancelled     = "已取消"
	ReviewStatusApproved      = "审核通过"
	ReviewStatusPendingSubmit = "待提审"
)

// ─── Draft Audit Status ─────────────────────────────────────────────────────

const (
	DraftStatusDraft     = "待提审"
	DraftStatusPending   = "待认领"
	DraftStatusAuditing  = "审核中"
	DraftStatusRejected  = "驳回修改"
	DraftStatusFailed    = "审核不通过"
)

// ─── Download Task Status ───────────────────────────────────────────────────

const (
	DownloadStatusInProgress = "进行中"
	DownloadStatusCompleted  = "已完成"
	DownloadStatusFailed     = "已失败"
	DownloadStatusFailedAlt  = "失败"
	DownloadStatusExpired    = "已失效"
)

// ─── User Status ────────────────────────────────────────────────────────────

const (
	UserStatusActive = "启用"
)

// ─── User Review Status ─────────────────────────────────────────────────────

const (
	UserReviewPending  = "审核中"
	UserReviewApproved = "审核通过"
	UserReviewRejected = "审核不通过"
)

// ─── Audit Log Actions ──────────────────────────────────────────────────────

const (
	ActionPublishTask   = "发布任务"
	ActionClaimTask     = "领取任务"
	ActionCancelTask    = "已取消"
	ActionStartRevision = "发起成片修改"
	ActionSubmitReview  = "提交审核"
	ActionApproved      = "审核通过"
	ActionRejected      = "驳回修改"
)

// ─── Delivery File Types ────────────────────────────────────────────────────

const (
	FileTypeFullVideo      = "全集视频"
	FileTypeWithSubtitle   = "有字幕视频"
	FileTypeNoSubtitle     = "无字幕视频"
	FileTypeCover          = "封面图"
	FileTypeCopyright      = "版权证明"
)

// ─── Download Content Types ─────────────────────────────────────────────────

const (
	DownloadContentWithSubtitle = "有字幕视频"
	DownloadContentNoSubtitle   = "无字幕视频"
	DownloadContentReview       = "提审材料"
)
