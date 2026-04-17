package handler

import (
	"strings"

	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListBooks(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.Book{})

	if v := strings.TrimSpace(c.Query("bookId")); v != "" {
		db = db.Where("book_id = ?", v)
	}
	if v := strings.TrimSpace(c.Query("bookName")); v != "" {
		db = db.Where("book_name LIKE ?", "%"+v+"%")
	}
	if v := c.Query("contentType"); v != "" {
		db = db.Where("content_type = ?", v)
	}
	if v := c.Query("startDate"); v != "" {
		db = db.Where("listing_time >= ?", v)
	}
	if v := c.Query("endDate"); v != "" {
		db = db.Where("listing_time <= ?", v+" 23:59:59")
	}
	if v := c.Query("hasScript"); v != "" {
		sub := model.DB.Table("scripts").Select("book_id").Group("book_id")
		if v == "是" {
			db = db.Where("id IN (?)", sub)
		} else {
			db = db.Where("id NOT IN (?)", sub)
		}
	}

	var total int64
	db.Count(&total)

	type BookListItem struct {
		model.Book
		RelatedScriptCount int64 `json:"relatedScriptCount"`
	}

	var books []model.Book
	db.Select("id, book_id, book_name, content_type, category, tags, word_count, listing_time, created_at").
		Order("id DESC").Scopes(pagination.Paginate(p)).Find(&books)

	items := make([]BookListItem, len(books))
	for i, b := range books {
		var cnt int64
		model.DB.Model(&model.Script{}).Where("book_id = ?", b.ID).Count(&cnt)
		items[i] = BookListItem{Book: b, RelatedScriptCount: cnt}
	}

	response.OKPage(c, total, items)
}

func GetBook(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	var book model.Book
	if err := model.DB.First(&book, id).Error; err != nil {
		response.FailNotFound(c, "书籍不存在")
		return
	}

	response.OK(c, book)
}
