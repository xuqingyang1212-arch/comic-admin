package model

import (
	"log"

	"comic-admin/internal/config"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	cfg := config.Global.Database
	var logLevel logger.LogLevel
	if config.Global.Server.Mode == "debug" {
		logLevel = logger.Info
	} else {
		logLevel = logger.Warn
	}

	var err error
	DB, err = gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logLevel),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	sqlDB, _ := DB.DB()
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)

	DB.Exec("SET GLOBAL sort_buffer_size = 8388608")
}

func AutoMigrate() {
	err := DB.AutoMigrate(
		&User{},
		&Role{},
		&UserRole{},
		&RolePermission{},
		&Book{},
		&Script{},
		&ScriptDraft{},
		&ScriptAuditLog{},
		&ProductionTask{},
		&TaskDelivery{},
		&TaskDeliveryFile{},
		&ReviewTask{},
		&ReviewOpinion{},
		&ReviewAuditLog{},
		&Comic{},
		&ComicEpisode{},
		&DownloadTask{},
	)
	if err != nil {
		log.Fatalf("failed to auto-migrate: %v", err)
	}
}
