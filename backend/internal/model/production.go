package model

import "time"

type ProductionTask struct {
	ID               int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskName         string     `gorm:"size:255;not null" json:"taskName"`
	ScriptID         int64      `gorm:"index" json:"scriptId"`
	ComicID          *int64     `gorm:"index" json:"comicId,omitempty"` // for revision tasks
	EpisodeCount     int        `gorm:"default:0" json:"episodeCount"`
	ArtStyle         string     `gorm:"size:16" json:"artStyle"`
	VisualEffect     string     `gorm:"size:16" json:"visualEffect"`
	AspectRatio      string     `gorm:"size:16" json:"aspectRatio"`
	ProductionRemark string     `gorm:"type:text" json:"productionRemark,omitempty"`
	TaskType         string     `gorm:"size:8;not null" json:"taskType"`         // 制作 | 修改
	TaskProgress     string     `gorm:"size:16;not null" json:"taskProgress"`
	InitiatorID      int64      `gorm:"index" json:"initiatorId"`
	ProducerID       *int64     `gorm:"index" json:"producerId,omitempty"`
	ReviewerID       *int64     `gorm:"index" json:"reviewerId,omitempty"`
	PublishTime      time.Time  `json:"publishTime"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`

	Reviewer  *User   `gorm:"foreignKey:ReviewerID" json:"reviewer,omitempty"`
	Script    *Script `gorm:"-" json:"script,omitempty"`
	Initiator *User   `gorm:"foreignKey:InitiatorID" json:"initiator,omitempty"`
	Producer  *User   `gorm:"foreignKey:ProducerID" json:"producer,omitempty"`

	ReviewEpisodeName string `gorm:"-" json:"reviewEpisodeName,omitempty"`
}

type TaskDelivery struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskID       int64     `gorm:"index;not null" json:"taskId"`
	DeliveryType string    `gorm:"size:16;not null" json:"deliveryType"` // 初版 | 终版 | 修改版
	EpisodeName  string    `gorm:"size:255" json:"episodeName"`
	CoverURL     string    `gorm:"size:512" json:"coverUrl,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`

	Files []TaskDeliveryFile `gorm:"foreignKey:DeliveryID" json:"files,omitempty"`
}

type TaskDeliveryFile struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DeliveryID int64     `gorm:"index;not null" json:"deliveryId"`
	FileType   string    `gorm:"size:16;not null" json:"fileType"` // 初版视频 | 有字幕视频 | 无字幕视频 | 封面图 | 版权证明
	EpisodeNum int       `gorm:"default:0" json:"episodeNum"`
	FileURL    string    `gorm:"size:512;not null" json:"fileUrl"`
	FileName   string    `gorm:"size:255" json:"fileName"`
	FileSize   int64     `gorm:"default:0" json:"fileSize"`
	CreatedAt  time.Time `json:"createdAt"`
}
