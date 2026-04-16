package model

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *StringSlice) Scan(value any) error {
	if value == nil {
		*s = nil
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case string:
		bytes = []byte(v)
	case []byte:
		bytes = v
	}
	return json.Unmarshal(bytes, s)
}

type Book struct {
	ID            int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	BookID        string      `gorm:"type:varchar(32);uniqueIndex;not null" json:"bookId"`
	BookName      string      `gorm:"size:255;not null" json:"bookName"`
	ContentType   string      `gorm:"size:16;not null" json:"contentType"` // 原作 | 多版本
	Category      string      `gorm:"size:64" json:"category"`
	Tags          StringSlice `gorm:"type:json" json:"tags"`
	Content       string      `gorm:"type:longtext" json:"content,omitempty"`
	WordCount     int         `gorm:"default:0" json:"wordCount"`
	PayBreakpoint string      `gorm:"type:text" json:"payBreakpoint"`
	ListingTime   time.Time   `json:"listingTime"`
	SourceBookID  string      `gorm:"size:64;index" json:"sourceBookId"`
	CreatedAt     time.Time   `json:"createdAt"`
	UpdatedAt     time.Time   `json:"updatedAt"`
}
