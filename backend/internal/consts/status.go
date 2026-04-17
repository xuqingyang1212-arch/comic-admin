package consts

// ─── Task Progress ──────────────────────────────────────────────────────────

const (
	TaskProgressPending        = "待认领"
	TaskProgressFirstDraft     = "初版制作中"
	TaskProgressFinalDraft     = "终版制作中"
	TaskProgressRevision       = "修改版制作中"
	TaskProgressCompleted      = "已完成"
	TaskProgressCancelled      = "已取消"
)

// ─── Task Type ──────────────────────────────────────────────────────────────

const (
	TaskTypeProduce = "制作"
	TaskTypeRevise  = "修改"
)

// ─── Delivery / Stage Type ──────────────────────────────────────────────────

const (
	StageFirst    = "初版"
	StageFinal    = "终版"
	StageRevision = "修改版"
)

// ─── Review Status ──────────────────────────────────────────────────────────

const (
	ReviewStatusPending   = "待认领"
	ReviewStatusAuditing  = "审核中"
	ReviewStatusRejected  = "驳回修改"
	ReviewStatusCancelled = "已取消"
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

// ─── Audit Log Actions ──────────────────────────────────────────────────────

const (
	ActionClaimTask     = "领取任务"
	ActionCancelTask    = "已取消"
	ActionStartRevision = "发起成片修改"
)
