package main

import (
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"time"
	"unicode"

	"comic-admin/internal/config"
	"comic-admin/internal/model"
)

func countWords(text string) int {
	runes := []rune(text)
	n := len(runes)
	count := 0
	i := 0
	for i < n {
		r := runes[i]
		if unicode.IsSpace(r) {
			i++
			continue
		}
		if unicode.Is(unicode.Han, r) {
			count++
			i++
			continue
		}
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			count++
			i++
			for i < n {
				c := runes[i]
				if (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
					i++
				} else {
					break
				}
			}
			continue
		}
		count++
		i++
	}
	return count
}

func main() {
	if err := config.Load("config.yaml"); err != nil {
		log.Fatalf("load config: %v", err)
	}
	model.InitDB()

	dir := "/Users/xuqingyang/Downloads/新建文件夹 (4)"
	files := []string{
		"春信不会晚.txt",
		"飞机升舱后，我杀疯了.txt",
		"婚宴儿媳要五元停车费，我撤回一百万改口费.txt",
		"婚姻这碗夹生饭，我不咽了.txt",
		"烬落七年，爱意成灰.txt",
		"老公，你就安心地去吧.txt",
		"离风吹散旧情长.txt",
		"明月昭昭照君心.txt",
		"男友的小青梅造谣我怀的不是他的孩子.txt",
		"怂恿我早恋精神小伙后，班主任悔疯了.txt",
		"相逢尽头是别离.txt",
		"以后，我是自由的.txt",
		"樱桃小姐的外卖.txt",
		"愚人节，男友官宣了别人.txt",
		"终有飞鸟不往旧林.txt",
	}

	type meta struct {
		contentType string
		category    string
		tags        []string
	}

	contentTypes := []string{"原作", "多版本"}
	categories := []string{"恋爱", "古风", "悬疑", "逆袭", "都市", "校园", "甜宠", "虐恋"}
	allTags := []string{"女频", "男频", "甜宠", "虐恋", "重生", "系统", "豪门", "逆袭", "悬疑", "婚姻", "校园"}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	pick := func(arr []string) string { return arr[rng.Intn(len(arr))] }
	pickTags := func() []string {
		n := 1 + rng.Intn(3)
		shuffled := make([]string, len(allTags))
		copy(shuffled, allTags)
		rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
		return shuffled[:n]
	}

	baseID := int64(295036297991716864)

	for i, fname := range files {
		bookName := fname[:len(fname)-4]
		data, err := os.ReadFile(filepath.Join(dir, fname))
		if err != nil {
			log.Printf("skip %s: %v", fname, err)
			continue
		}
		content := string(data)
		wc := countWords(content)

		bpPct := 25 + rng.Intn(26)
		bpWords := wc * bpPct / 100

		day := 1 + rng.Intn(15)
		hour := 8 + rng.Intn(13)
		minute := rng.Intn(60)
		listingTime := time.Date(2026, 4, day, hour, minute, 0, 0, time.Local)

		bookID := fmt.Sprintf("%d", baseID+int64(i))

		book := model.Book{
			BookID:        bookID,
			BookName:      bookName,
			ContentType:   pick(contentTypes),
			Category:      pick(categories),
			Tags:          pickTags(),
			Content:       content,
			WordCount:     wc,
			PayBreakpoint: fmt.Sprintf("第%d字（约%d%%处）", bpWords, bpPct),
			ListingTime:   listingTime,
			SourceBookID:  "SRC_" + bookID,
		}

		if err := model.DB.Create(&book).Error; err != nil {
			log.Printf("insert %s failed: %v", bookName, err)
		} else {
			log.Printf("OK: %s | %d字 | %s | %s | %v | %d%% | %s",
				bookName, wc, book.ContentType, book.Category, book.Tags, bpPct, listingTime.Format("2006-01-02 15:04"))
		}
	}

	var count int64
	model.DB.Model(&model.Book{}).Count(&count)
	log.Printf("Total books: %d", count)
}
