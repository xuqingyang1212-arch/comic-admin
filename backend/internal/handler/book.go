package handler

import (
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListBooks(c *gin.Context) {
	p := pagination.Parse(c)
	db := model.DB.Model(&model.Book{})

	db = ApplyExact(db, c, "bookId", "book_id")
	db = ApplyLike(db, c, "bookName", "book_name")
	db = ApplyExact(db, c, "contentType", "content_type")
	db = ApplyDateRange(db, c, "listing_time", "startDate", "endDate")
	if v := c.Query("hasScript"); v != "" {
		sub := model.DB.Table("scripts").Select("book_id").Group("book_id")
		if v == "是" {
			db = db.Where("id IN (?)", sub)
		} else {
			db = db.Where("id NOT IN (?)", sub)
		}
	}

	type BookListItem struct {
		model.Book
		RelatedScriptCount int64 `json:"relatedScriptCount"`
	}

	var books []model.Book
	total, _ := pagination.CountAndFind(
		db.Select("id, book_id, book_name, content_type, category, tags, word_count, listing_time, created_at"),
		p, "id DESC", &books,
	)

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

	book, err := Svc.Book.GetByID(id)
	if err != nil {
		response.FailNotFound(c, "书籍不存在")
		return
	}

	response.OK(c, book)
}
