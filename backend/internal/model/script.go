package model

import "time"

// Script represents an approved script in the script library.
type Script struct {
	ID                int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ScriptID          string    `gorm:"type:varchar(32);uniqueIndex;not null" json:"scriptId"`
	ScriptName        string    `gorm:"size:255;not null" json:"scriptName"`
	Content           string    `gorm:"type:longtext" json:"content,omitempty"`
	EpisodeCount      int       `gorm:"default:0" json:"episodeCount"`
	PayEpisode        string    `gorm:"size:32" json:"payEpisode"`
	PayBreakpointData *string   `gorm:"type:json" json:"payBreakpointData,omitempty"`
	BookID            int64     `gorm:"index" json:"bookId"`
	ScriptType        string    `gorm:"size:16;not null" json:"scriptType"`
	OriginalScriptID  *int64    `gorm:"index" json:"originalScriptId,omitempty"`
	WriterID          int64     `gorm:"index" json:"writerId"`
	ReviewerID        *int64    `gorm:"index" json:"reviewerId,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`

	Book           *Book   `gorm:"foreignKey:BookID;references:ID" json:"book,omitempty"`
	Writer         *User   `gorm:"foreignKey:WriterID" json:"writer,omitempty"`
	Reviewer       *User   `gorm:"foreignKey:ReviewerID" json:"reviewer,omitempty"`
	OriginalScript *Script `gorm:"-" json:"originalScript,omitempty"`
}

// ScriptDraft represents a script in creation/review stage.
type ScriptDraft struct {
	ID               int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ScriptName       string    `gorm:"size:255;not null" json:"scriptName"`
	Content          string    `gorm:"type:longtext" json:"content,omitempty"`
	BookID           int64     `gorm:"index" json:"bookId"`
	ScriptType       string    `gorm:"size:16;not null" json:"scriptType"`
	OriginalScriptID *int64    `gorm:"index" json:"originalScriptId,omitempty"`
	AuditStatus      string    `gorm:"size:16;not null;default:待提审;index:idx_sd_reviewer_status" json:"auditStatus"`
	WriterID         int64     `gorm:"index" json:"writerId"`
	ReviewerID       *int64    `gorm:"index:idx_sd_reviewer_status" json:"reviewerId,omitempty"`
	AuditOpinion     string    `gorm:"type:text" json:"auditOpinion,omitempty"`
	EpisodeCount     int       `gorm:"default:0" json:"episodeCount"`
	PayEpisode       string    `gorm:"size:32" json:"payEpisode,omitempty"`
	PayBreakpointData *string   `gorm:"type:json" json:"payBreakpointData,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`

	Book           *Book   `gorm:"foreignKey:BookID;references:ID" json:"book,omitempty"`
	Writer         *User   `gorm:"foreignKey:WriterID" json:"writer,omitempty"`
	Reviewer       *User   `gorm:"foreignKey:ReviewerID" json:"reviewer,omitempty"`
	OriginalScript *Script `gorm:"-" json:"originalScript,omitempty"`
}

type ScriptAuditLog struct {
	ID            int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ScriptDraftID int64     `gorm:"index;not null" json:"scriptDraftId"`
	Action        string    `gorm:"size:32;not null" json:"action"`
	OperatorID    int64     `gorm:"not null" json:"operatorId"`
	Opinion       string    `gorm:"type:text" json:"opinion,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`

	Operator *User `gorm:"foreignKey:OperatorID" json:"operator,omitempty"`
}
