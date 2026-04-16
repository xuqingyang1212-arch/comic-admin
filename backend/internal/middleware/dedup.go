package middleware

import (
	"crypto/sha256"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"comic-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

var skipPrefixes = []string{
	"/api/v1/upload/",
}

var skipSuffixes = []string{
	"/save",
	"/draft",
}

type dedupEntry struct {
	expireAt time.Time
}

var (
	dedupMu    sync.Mutex
	dedupStore = make(map[string]*dedupEntry)
)

func init() {
	go func() {
		for range time.Tick(30 * time.Second) {
			dedupMu.Lock()
			now := time.Now()
			for k, v := range dedupStore {
				if now.After(v.expireAt) {
					delete(dedupStore, k)
				}
			}
			dedupMu.Unlock()
		}
	}()
}

// PreventDuplicateSubmit rejects duplicate write requests (POST/PUT/DELETE)
// from the same user to the same path within a short time window.
func PreventDuplicateSubmit(window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "GET" || c.Request.Method == "OPTIONS" || c.Request.Method == "HEAD" {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		for _, prefix := range skipPrefixes {
			if strings.HasPrefix(path, prefix) {
				c.Next()
				return
			}
		}
		for _, suffix := range skipSuffixes {
			if strings.HasSuffix(path, suffix) {
				c.Next()
				return
			}
		}

		userID := GetUserID(c)
		if userID == 0 {
			c.Next()
			return
		}

		bodyBytes, _ := io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytesReader(bodyBytes))

		bodyHash := sha256.Sum256(bodyBytes)
		key := fmt.Sprintf("%d:%s:%s:%x", userID, c.Request.Method, c.Request.URL.Path, bodyHash[:8])

		dedupMu.Lock()
		entry, exists := dedupStore[key]
		now := time.Now()
		if exists && now.Before(entry.expireAt) {
			dedupMu.Unlock()
			response.Fail(c, 429, "请勿重复提交")
			c.Abort()
			return
		}
		dedupStore[key] = &dedupEntry{expireAt: now.Add(window)}
		dedupMu.Unlock()

		c.Next()
	}
}

type bytesReaderCloser struct {
	*bytesReaderImpl
}

type bytesReaderImpl struct {
	data []byte
	pos  int
}

func (r *bytesReaderImpl) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

func bytesReader(data []byte) io.ReadCloser {
	return io.NopCloser(&bytesReaderImpl{data: data})
}
