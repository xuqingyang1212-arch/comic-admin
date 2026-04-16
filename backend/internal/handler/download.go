package handler

import (
	"archive/zip"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"comic-admin/internal/config"
	cosUtil "comic-admin/internal/pkg/cos"
	"comic-admin/internal/middleware"
	"comic-admin/internal/model"
	"comic-admin/internal/pkg/pagination"
	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListDownloadTasks(c *gin.Context) {
	p := pagination.Parse(c)
	userID := middleware.GetUserID(c)
	db := model.DB.Model(&model.DownloadTask{}).Where("creator_id = ?", userID)

	if v := strings.TrimSpace(c.Query("comicName")); v != "" {
		db = db.Where("comic_name LIKE ?", "%"+v+"%")
	}
	if v := c.Query("downloadContent"); v != "" {
		db = db.Where("download_content = ?", v)
	}
	if v := c.Query("status"); v != "" {
		db = db.Where("status = ?", v)
	}
	if v := c.Query("startDate"); v != "" {
		db = db.Where("created_at >= ?", v)
	}
	if v := c.Query("endDate"); v != "" {
		db = db.Where("created_at <= ?", v+" 23:59:59")
	}

	var total int64
	db.Count(&total)

	var tasks []model.DownloadTask
	db.Order("created_at DESC").Scopes(pagination.Paginate(p)).Find(&tasks)

	response.OKPage(c, total, tasks)
}

func GetDownloadURL(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var task model.DownloadTask
	if err := model.DB.First(&task, id).Error; err != nil {
		response.FailNotFound(c, "下载任务不存在")
		return
	}

	if task.Status != "已完成" {
		response.Fail(c, 400, "任务未完成")
		return
	}

	if task.ExpiresAt != nil && task.ExpiresAt.Before(time.Now()) {
		model.DB.Model(&task).Update("status", "已失效")
		response.Fail(c, 400, "下载链接已过期")
		return
	}

	fileURL := task.FileURL
	if config.Global.COS.Bucket != "" {
		presigned, err := cosUtil.PresignGet(fileURL, 60)
		if err != nil {
			response.FailServer(c, "生成下载链接失败")
			return
		}
		fileURL = presigned
	} else {
		dlPath := strings.Replace(fileURL, "/uploads/downloads/", "/dl/", 1)
		if !strings.HasPrefix(dlPath, "http") {
			fileURL = fmt.Sprintf("http://%s%s", c.Request.Host, dlPath)
		} else {
			fileURL = dlPath
		}
	}

	response.OK(c, gin.H{"url": fileURL})
}

func RetryDownloadTask(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var task model.DownloadTask
	if err := model.DB.First(&task, id).Error; err != nil {
		response.FailNotFound(c, "下载任务不存在")
		return
	}

	if task.Status != "已失败" && task.Status != "失败" {
		response.Fail(c, 400, "仅失败任务可重试")
		return
	}

	res := model.DB.Model(&task).Where("status IN ?", []string{"已失败", "失败"}).Update("status", "进行中")
	if res.RowsAffected == 0 {
		response.Fail(c, 400, "该任务已在处理中，请勿重复操作")
		return
	}
	go packDownloadTask(task.ID)

	response.OKMsg(c, "重试已发起")
}

// packDownloadTask collects files from a comic and creates a ZIP archive.
func packDownloadTask(taskID int64) {
	var task model.DownloadTask
	if model.DB.First(&task, taskID).Error != nil {
		return
	}

	var comic model.Comic
	if model.DB.Preload("Episodes").First(&comic, task.ComicID).Error != nil {
		model.DB.Model(&task).Update("status", "已失败")
		return
	}

	now := time.Now()
	datePart := now.Format("20060102_1504")
	folderName := fmt.Sprintf("%s_%s_%s", comic.EpisodeName, task.DownloadContent, datePart)
	zipFileName := folderName + ".zip"

	zipDir := filepath.Join(".", "uploads", "downloads")
	os.MkdirAll(zipDir, 0o755)
	zipPath := filepath.Join(zipDir, zipFileName)

	if err := buildZip(zipPath, folderName, &comic, task.DownloadContent); err != nil {
		log.Printf("[download] pack failed task=%d: %v", taskID, err)
		model.DB.Model(&task).Update("status", "已失败")
		return
	}

	expires := now.Add(72 * time.Hour)
	model.DB.Model(&task).Updates(map[string]any{
		"status":     "已完成",
		"file_url":   "/uploads/downloads/" + zipFileName,
		"expires_at": expires,
	})
	log.Printf("[download] pack done task=%d file=%s", taskID, zipFileName)
}

func buildZip(zipPath, folderName string, comic *model.Comic, content string) error {
	f, err := os.Create(zipPath)
	if err != nil {
		return err
	}
	defer f.Close()

	w := zip.NewWriter(f)
	defer w.Close()

	type fileEntry struct {
		name string
		path string
	}
	var entries []fileEntry

	switch content {
	case "有字幕视频":
		for _, ep := range comic.Episodes {
			if ep.SubtitledURL == "" {
				continue
			}
			ext := extFromURL(ep.SubtitledURL)
			entries = append(entries, fileEntry{
				name: fmt.Sprintf("第%d集%s", ep.EpisodeNum, ext),
				path: localPathFromURL(ep.SubtitledURL),
			})
		}
	case "无字幕视频":
		for _, ep := range comic.Episodes {
			if ep.RawURL == "" {
				continue
			}
			ext := extFromURL(ep.RawURL)
			entries = append(entries, fileEntry{
				name: fmt.Sprintf("第%d集%s", ep.EpisodeNum, ext),
				path: localPathFromURL(ep.RawURL),
			})
		}
	case "提审材料":
		if comic.CoverURL != "" {
			ext := extFromURL(comic.CoverURL)
			entries = append(entries, fileEntry{
				name: "封面图" + ext,
				path: localPathFromURL(comic.CoverURL),
			})
		}
		copyrightCount := map[string]int{}
		for _, img := range comic.CopyrightImages {
			if img == "" {
				continue
			}
			ext := extFromURL(img)
			base := "版权证明"
			copyrightCount[base]++
			n := copyrightCount[base]
			name := base
			if n > 1 || len(comic.CopyrightImages) > 1 {
				name = fmt.Sprintf("%s%d", base, n)
			}
			entries = append(entries, fileEntry{
				name: name + ext,
				path: localPathFromURL(img),
			})
		}
	}

	for _, entry := range entries {
		if err := addFileToZip(w, folderName+"/"+entry.name, entry.path); err != nil {
			log.Printf("[download] skip file %s: %v", entry.name, err)
		}
	}

	return nil
}

func addFileToZip(w *zip.Writer, zipName, localPath string) error {
	src, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer src.Close()

	info, err := src.Stat()
	if err != nil {
		return err
	}

	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	header.Name = zipName
	header.Method = zip.Store // no compression, just archive

	dst, err := w.CreateHeader(header)
	if err != nil {
		return err
	}

	_, err = io.Copy(dst, src)
	return err
}

func localPathFromURL(rawURL string) string {
	// http://localhost:8080/uploads/videos/final/xxx.mp4 -> ./uploads/videos/final/xxx.mp4
	u, err := url.Parse(rawURL)
	if err != nil {
		if strings.HasPrefix(rawURL, "/uploads/") {
			return "." + rawURL
		}
		return rawURL
	}
	p := u.Path
	if strings.HasPrefix(p, "/uploads/") {
		return "." + p
	}
	return p
}

func extFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return filepath.Ext(rawURL)
	}
	return filepath.Ext(u.Path)
}

func ServeDownloadFile(c *gin.Context) {
	filePath := c.Param("filepath")
	fullPath := filepath.Join(".", "uploads", "downloads", filePath)

	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		c.Status(http.StatusNotFound)
		return
	}

	c.Header("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(filepath.Base(fullPath)))
	c.Header("Accept-Ranges", "bytes")
	c.File(fullPath)
}
