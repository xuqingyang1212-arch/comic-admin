package service

import (
	"comic-admin/internal/model"

	"gorm.io/gorm"
)

type ScriptService interface {
	ListDrafts(filter ScriptDraftFilter) ([]model.ScriptDraft, int64, error)
	GetDraft(id int64) (*model.ScriptDraft, error)
	CreateDraft(draft *model.ScriptDraft) error
	UpdateDraft(draft *model.ScriptDraft) error
	DeleteDraft(id int64) error
	ListScripts(filter ScriptFilter) ([]model.Script, int64, error)
	GetScript(id int64) (*model.Script, error)
}

type ScriptDraftFilter struct {
	ScriptName  string
	AuditStatus string
	ScriptType  string
	WriterID    int64
	Page        int
	PageSize    int
}

type ScriptFilter struct {
	ScriptName string
	ScriptType string
	StartDate  string
	EndDate    string
	Page       int
	PageSize   int
}

type scriptService struct {
	db *gorm.DB
}

func (s *scriptService) ListDrafts(f ScriptDraftFilter) ([]model.ScriptDraft, int64, error) {
	q := s.db.Model(&model.ScriptDraft{})

	if f.ScriptName != "" {
		q = q.Where("script_name LIKE ?", "%"+f.ScriptName+"%")
	}
	if f.AuditStatus != "" {
		q = q.Where("audit_status = ?", f.AuditStatus)
	}
	if f.ScriptType != "" {
		q = q.Where("script_type = ?", f.ScriptType)
	}
	if f.WriterID > 0 {
		q = q.Where("writer_id = ?", f.WriterID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var drafts []model.ScriptDraft
	err := q.Order("id DESC").
		Offset((f.Page - 1) * f.PageSize).
		Limit(f.PageSize).
		Find(&drafts).Error

	return drafts, total, err
}

func (s *scriptService) GetDraft(id int64) (*model.ScriptDraft, error) {
	var draft model.ScriptDraft
	err := s.db.Preload("Writer").Preload("Reviewer").First(&draft, id).Error
	return &draft, err
}

func (s *scriptService) CreateDraft(draft *model.ScriptDraft) error {
	return s.db.Create(draft).Error
}

func (s *scriptService) UpdateDraft(draft *model.ScriptDraft) error {
	return s.db.Save(draft).Error
}

func (s *scriptService) DeleteDraft(id int64) error {
	return s.db.Delete(&model.ScriptDraft{}, id).Error
}

func (s *scriptService) ListScripts(f ScriptFilter) ([]model.Script, int64, error) {
	q := s.db.Model(&model.Script{})

	if f.ScriptName != "" {
		q = q.Where("script_name LIKE ?", "%"+f.ScriptName+"%")
	}
	if f.ScriptType != "" {
		q = q.Where("script_type = ?", f.ScriptType)
	}
	if f.StartDate != "" {
		q = q.Where("created_at >= ?", f.StartDate)
	}
	if f.EndDate != "" {
		q = q.Where("created_at <= ?", f.EndDate+" 23:59:59")
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var scripts []model.Script
	err := q.Order("id DESC").
		Offset((f.Page - 1) * f.PageSize).
		Limit(f.PageSize).
		Find(&scripts).Error

	return scripts, total, err
}

func (s *scriptService) GetScript(id int64) (*model.Script, error) {
	var script model.Script
	err := s.db.Preload("Writer").Preload("Reviewer").First(&script, id).Error
	return &script, err
}
