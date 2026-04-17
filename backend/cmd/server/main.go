package main

import (
	"fmt"
	"log"

	"comic-admin/internal/config"
	"comic-admin/internal/handler"
	"comic-admin/internal/model"
	cosUtil "comic-admin/internal/pkg/cos"
	"comic-admin/internal/service"
)

func main() {
	if err := config.Load("config.yaml"); err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	model.InitDB()
	model.AutoMigrate()

	cosUtil.Init()

	handler.Svc = service.New(model.DB)

	r := handler.SetupRouter(config.Global.Server.Mode)

	addr := fmt.Sprintf(":%d", config.Global.Server.Port)
	log.Printf("server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
