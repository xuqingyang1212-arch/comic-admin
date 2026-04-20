package config

import (
	"os"
	"strconv"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	JWT      JWTConfig      `yaml:"jwt"`
	Invite   InviteConfig   `yaml:"invite"`
	Storage  StorageConfig  `yaml:"storage"`
	COS      COSConfig      `yaml:"cos"`
}

type InviteConfig struct {
	Secret string `yaml:"secret"`
}

type StorageConfig struct {
	LocalDir string `yaml:"local_dir"`
}

type ServerConfig struct {
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
}

type DatabaseConfig struct {
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	User         string `yaml:"user"`
	Password     string `yaml:"password"`
	DBName       string `yaml:"dbname"`
	Charset      string `yaml:"charset"`
	MaxIdleConns int    `yaml:"max_idle_conns"`
	MaxOpenConns int    `yaml:"max_open_conns"`
}

type JWTConfig struct {
	Secret      string `yaml:"secret"`
	ExpireHours int    `yaml:"expire_hours"`
}

type COSConfig struct {
	SecretID  string `yaml:"secret_id"`
	SecretKey string `yaml:"secret_key"`
	Bucket    string `yaml:"bucket"`
	Region    string `yaml:"region"`
	BaseURL   string `yaml:"base_url"`
}

func (d *DatabaseConfig) DSN() string {
	return d.User + ":" + d.Password + "@tcp(" + d.Host + ":" + itoa(d.Port) + ")/" + d.DBName + "?charset=" + d.Charset + "&parseTime=True&loc=Local"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 5)
	for n > 0 {
		buf = append(buf, byte('0'+n%10))
		n /= 10
	}
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	return string(buf)
}

var Global Config

func LocalUploadDir() string {
	if Global.Storage.LocalDir != "" {
		return Global.Storage.LocalDir
	}
	return "./uploads"
}

func Load(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := yaml.Unmarshal(data, &Global); err != nil {
		return err
	}
	applyEnvOverrides(&Global)
	return nil
}

// applyEnvOverrides lets deployments override sensitive / host-dependent fields
// without committing them into config.yaml. Env values take precedence over YAML.
// Naming convention: <SECTION>_<FIELD> (e.g. DB_PASSWORD, JWT_SECRET, COS_SECRET_KEY).
func applyEnvOverrides(c *Config) {
	// Server
	if v := os.Getenv("SERVER_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.Server.Port = n
		}
	}
	if v := os.Getenv("SERVER_MODE"); v != "" {
		c.Server.Mode = v
	}

	// Database
	if v := os.Getenv("DB_HOST"); v != "" {
		c.Database.Host = v
	}
	if v := os.Getenv("DB_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.Database.Port = n
		}
	}
	if v := os.Getenv("DB_USER"); v != "" {
		c.Database.User = v
	}
	if v := os.Getenv("DB_PASSWORD"); v != "" {
		c.Database.Password = v
	}
	if v := os.Getenv("DB_NAME"); v != "" {
		c.Database.DBName = v
	}

	// JWT
	if v := os.Getenv("JWT_SECRET"); v != "" {
		c.JWT.Secret = v
	}
	if v := os.Getenv("JWT_EXPIRE_HOURS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.JWT.ExpireHours = n
		}
	}

	// Invite
	if v := os.Getenv("INVITE_SECRET"); v != "" {
		c.Invite.Secret = v
	}

	// COS
	if v := os.Getenv("COS_SECRET_ID"); v != "" {
		c.COS.SecretID = v
	}
	if v := os.Getenv("COS_SECRET_KEY"); v != "" {
		c.COS.SecretKey = v
	}
	if v := os.Getenv("COS_BUCKET"); v != "" {
		c.COS.Bucket = v
	}
	if v := os.Getenv("COS_REGION"); v != "" {
		c.COS.Region = v
	}
	if v := os.Getenv("COS_BASE_URL"); v != "" {
		c.COS.BaseURL = v
	}

	// Storage
	if v := os.Getenv("STORAGE_LOCAL_DIR"); v != "" {
		c.Storage.LocalDir = v
	}
}
