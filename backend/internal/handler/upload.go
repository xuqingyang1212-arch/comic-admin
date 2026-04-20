package handler

import (
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
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
	ts := time.Now().UnixNano()
	rnd, _ := rand.Int(rand.Reader, big.NewInt(99999))
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
	key = fmt.Sprintf("%s/%d_%05d%s", dir, ts, rnd.Int64(), ext)
	return
}

func GetPresignURL(c *gin.Context) {
	var req PresignReq
	if !BindOrFail(c, &req) {
		return
	}

	_, key := buildKey(req)

	if config.Global.COS.Bucket == "" {
		response.OK(c, gin.H{
			"uploadUrl": fmt.Sprintf("http://%s/api/v1/upload/local/%s", c.Request.Host, key),
			"fileKey":   key,
			"fileUrl":   "/uploads/" + key,
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
