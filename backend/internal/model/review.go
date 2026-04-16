package model

import "time"

type ReviewTask struct {
	ID               int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductionTaskID int64     `gorm:"index;not null" json:"productionTaskId"`
	TaskType         string    `gorm:"size:16;not null" json:"taskType"` // 初版审核 | 终版审核 | 修改版审核
	ReviewStatus     string    `gorm:"size:16;not null;default:审核中" json:"reviewStatus"`
	ReviewerID       *int64    `gorm:"index" json:"reviewerId,omitempty"`
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
	ProductionTaskID int64     `gorm:"index;not null" json:"productionTaskId"`
	Action           string    `gorm:"size:32;not null" json:"action"`
	StageType        string    `gorm:"size:16" json:"stageType"` // 初版 | 终版 | 修改版
	OperatorID       int64     `gorm:"not null" json:"operatorId"`
	OpinionSnapshot  *string   `gorm:"type:json" json:"opinionSnapshot,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`

	Operator *User `gorm:"foreignKey:OperatorID" json:"operator,omitempty"`
}
