package model

import "time"

type DownloadTask struct {
	ID              int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	ComicID         int64      `gorm:"index;not null" json:"comicId"`
	ComicName       string     `gorm:"size:255" json:"comicName"`
	DownloadContent string     `gorm:"size:32;not null" json:"downloadContent"` // 有字幕视频 | 无字幕视频 | 提审材料
	Status          string     `gorm:"size:16;not null;default:进行中" json:"status"`
	FileURL         string     `gorm:"size:512" json:"fileUrl,omitempty"`
	ExpiresAt       *time.Time `json:"expiresAt,omitempty"`
	CreatorID       int64      `gorm:"index" json:"creatorId"`
	CreatedAt       time.Time  `json:"createdAt"`
}
