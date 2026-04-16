package model

import "time"

type Comic struct {
	ID              int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	ComicID         string      `gorm:"size:32;uniqueIndex;not null" json:"comicId"`
	EpisodeName     string      `gorm:"size:255;not null" json:"episodeName"`
	ScriptID        int64       `gorm:"index" json:"scriptId"`
	CoverURL        string      `gorm:"size:512" json:"coverUrl,omitempty"`
	EpisodeCount    int         `gorm:"default:0" json:"episodeCount"`
	PayEpisode      string      `gorm:"size:32" json:"payEpisode,omitempty"`
	ArtStyle        string      `gorm:"size:16" json:"artStyle"`
	VisualEffect    string      `gorm:"size:16" json:"visualEffect"`
	AspectRatio     string      `gorm:"size:16" json:"aspectRatio"`
	WriterID        int64       `gorm:"index" json:"writerId"`
	ProducerID      int64       `gorm:"index" json:"producerId"`
	CopyrightImages StringSlice `gorm:"type:json" json:"copyrightImages,omitempty"`
	CreatedAt       time.Time   `json:"createdAt"`
	UpdatedAt       time.Time   `json:"updatedAt"`

	Script   *Script        `gorm:"-" json:"script,omitempty"`
	Writer   *User          `gorm:"foreignKey:WriterID" json:"writer,omitempty"`
	Producer *User          `gorm:"foreignKey:ProducerID" json:"producer,omitempty"`
	Episodes []ComicEpisode `gorm:"foreignKey:ComicID" json:"episodes,omitempty"`
}

type ComicEpisode struct {
	ID           int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	ComicID      int64  `gorm:"index;not null" json:"comicId"`
	EpisodeNum   int    `gorm:"not null" json:"episodeNum"`
	SubtitledURL string `gorm:"size:512" json:"subtitledUrl,omitempty"`
	RawURL       string `gorm:"size:512" json:"rawUrl,omitempty"`
	Duration     int    `gorm:"default:0" json:"duration"`
	FileSize     int64  `gorm:"default:0" json:"fileSize"`
	ThumbnailURL string `gorm:"size:512" json:"thumbnailUrl,omitempty"`
}
