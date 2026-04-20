package model

import "time"

type ReviewTask struct {
	ID               int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductionTaskID int64     `gorm:"not null;index:idx_rt_ptid_status" json:"productionTaskId"`
	TaskType         string    `gorm:"size:16;not null" json:"taskType"` // 全集审核 | 分集审核 | 返修版审核 | 二审审核
	ReviewStatus     string    `gorm:"size:16;not null;default:审核中;index:idx_rt_ptid_status;index:idx_rt_reviewer_status" json:"reviewStatus"`
	ReviewerID       *int64    `gorm:"index:idx_rt_reviewer_status" json:"reviewerId,omitempty"`
	EpisodeName      string    `gorm:"size:255" json:"episodeName"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`

	ProductionTask *ProductionTask `gorm:"foreignKey:ProductionTaskID" json:"productionTask,omitempty"`
	Reviewer       *User           `gorm:"foreignKey:ReviewerID" json:"reviewer,omitempty"`
	Opinions       []ReviewOpinion `gorm:"foreignKey:ReviewTaskID" json:"opinions,omitempty"`
	Delivery       *TaskDelivery   `gorm:"-" json:"delivery,omitempty"`
}

type ReviewOpinion struct {
	ID           int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	ReviewTaskID int64       `gorm:"index;not null" json:"reviewTaskId"`
	Content      string      `gorm:"type:text" json:"content"`
	Images       StringSlice `gorm:"type:json" json:"images"`
	SortOrder    int         `gorm:"default:0" json:"sortOrder"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

type ReviewAuditLog struct {
	ID               int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductionTaskID int64     `gorm:"not null;index:idx_ral_ptid_action" json:"productionTaskId"`
	Action           string    `gorm:"size:32;not null;index:idx_ral_ptid_action;index:idx_ral_op_action" json:"action"`
	StageType        string    `gorm:"size:16" json:"stageType"` // 全集 | 分集 | 返修版 | 二审
	OperatorID       int64     `gorm:"not null;index:idx_ral_op_action" json:"operatorId"`
	OpinionSnapshot  *string   `gorm:"type:json" json:"opinionSnapshot,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`

	Operator *User `gorm:"foreignKey:OperatorID" json:"operator,omitempty"`
}
