package handler

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"comic-admin/internal/config"
	cosUtil "comic-admin/internal/pkg/cos"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

type PresignReq struct {
	FileName string `json:"fileName" binding:"required"`
	FileType string `json:"fileType" binding:"required"` // video | image
	Scene    string `json:"scene"`                       // covers | copyright | review | drafts | final
}

func buildKey(req PresignReq) (dir, key string) {
	ext := filepath.Ext(req.FileName)
	ts := time.Now().UnixMilli()
	scene := req.Scene
	if scene == "" {
		scene = "uploads"
	}
	switch req.FileType {
	case "video":
		dir = fmt.Sprintf("videos/%s", scene)
	case "image":
		dir = fmt.Sprintf("images/%s", scene)
	default:
		dir = "files"
	}
	key = fmt.Sprintf("%s/%d%s", dir, ts, ext)
	return
}

func GetPresignURL(c *gin.Context) {
	var req PresignReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	_, key := buildKey(req)

	if config.Global.COS.Bucket == "" {
		baseURL := fmt.Sprintf("http://%s/uploads", c.Request.Host)
		response.OK(c, gin.H{
			"uploadUrl": fmt.Sprintf("http://%s/api/v1/upload/local/%s", c.Request.Host, key),
			"fileKey":   key,
			"fileUrl":   baseURL + "/" + key,
		})
		return
	}

	url, err := cosUtil.PresignPut(key, 30)
	if err != nil {
		response.FailServer(c, "生成上传链接失败")
		return
	}

	response.OK(c, gin.H{
		"uploadUrl": url,
		"fileKey":   key,
		"fileUrl":   cosUtil.FileURL(key),
	})
}

func LocalUpload(c *gin.Context) {
	key := c.Param("key")
	if key == "" {
		response.FailBadRequest(c, "缺少文件路径")
		return
	}

	dest := filepath.Join(config.LocalUploadDir(), key)
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		response.FailServer(c, "创建目录失败")
		return
	}

	f, err := os.Create(dest)
	if err != nil {
		response.FailServer(c, "创建文件失败")
		return
	}

	if _, err := io.Copy(f, c.Request.Body); err != nil {
		f.Close()
		response.FailServer(c, "写入文件失败")
		return
	}

	if err := f.Sync(); err != nil {
		f.Close()
		response.FailServer(c, "写入文件失败")
		return
	}
	f.Close()

	c.Status(200)
}
