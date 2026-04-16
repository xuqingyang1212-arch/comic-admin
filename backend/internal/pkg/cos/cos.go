package cos

import (
	"context"
	"net/http"
	"net/url"
	"time"

	"comic-admin/internal/config"

	cosSDK "github.com/tencentyun/cos-go-sdk-v5"
)

var client *cosSDK.Client

func Init() {
	cfg := config.Global.COS
	if cfg.Bucket == "" {
		return
	}
	bucketURL, _ := url.Parse("https://" + cfg.Bucket + ".cos." + cfg.Region + ".myqcloud.com")
	client = cosSDK.NewClient(&cosSDK.BaseURL{BucketURL: bucketURL}, &http.Client{
		Transport: &cosSDK.AuthorizationTransport{
			SecretID:  cfg.SecretID,
			SecretKey: cfg.SecretKey,
		},
	})
}

func GetClient() *cosSDK.Client {
	return client
}

// PresignPut generates a pre-signed PUT URL for client-side direct upload.
func PresignPut(key string, expireMinutes int) (string, error) {
	ctx := context.Background()
	presignedURL, err := client.Object.GetPresignedURL(ctx, http.MethodPut, key, config.Global.COS.SecretID, config.Global.COS.SecretKey, time.Duration(expireMinutes)*time.Minute, nil)
	if err != nil {
		return "", err
	}
	return presignedURL.String(), nil
}

// PresignGet generates a pre-signed GET URL for downloading.
func PresignGet(key string, expireMinutes int) (string, error) {
	ctx := context.Background()
	presignedURL, err := client.Object.GetPresignedURL(ctx, http.MethodGet, key, config.Global.COS.SecretID, config.Global.COS.SecretKey, time.Duration(expireMinutes)*time.Minute, nil)
	if err != nil {
		return "", err
	}
	return presignedURL.String(), nil
}

// FileURL returns the public/CDN URL of a COS object.
func FileURL(key string) string {
	base := config.Global.COS.BaseURL
	if base == "" {
		cfg := config.Global.COS
		base = "https://" + cfg.Bucket + ".cos." + cfg.Region + ".myqcloud.com"
	}
	return base + "/" + key
}
