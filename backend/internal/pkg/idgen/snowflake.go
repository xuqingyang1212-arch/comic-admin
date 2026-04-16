package idgen

import (
	"fmt"
	"sync"
	"time"
)

// epoch: 2024-01-01 00:00:00 UTC
const epoch int64 = 1704067200000

var (
	mu       sync.Mutex
	lastMs   int64
	sequence int64
)

// NextID returns a snowflake-style string ID: 18-digit numeric string.
// Layout: 41-bit timestamp | 12-bit sequence | 10-bit machine (fixed 1).
func NextID() string {
	mu.Lock()
	defer mu.Unlock()

	now := time.Now().UnixMilli() - epoch
	if now == lastMs {
		sequence++
		if sequence > 4095 {
			for now <= lastMs {
				now = time.Now().UnixMilli() - epoch
			}
			sequence = 0
		}
	} else {
		sequence = 0
	}
	lastMs = now

	id := (now << 22) | (1 << 12) | sequence
	return fmt.Sprintf("%d", id)
}
