package wordcount

import "unicode"

// Count implements the PRD word count rule:
// Chinese characters each count as 1. Consecutive ASCII letter/digit/symbol blocks each count as 1.
// Whitespace, newlines, tabs, and Chinese em-dashes ("——") are ignored.
func Count(text string) int {
	runes := []rune(text)
	n := len(runes)
	count := 0
	i := 0

	for i < n {
		r := runes[i]

		if r == '\u2014' { // em-dash
			j := i
			for j < n && runes[j] == '\u2014' {
				j++
			}
			i = j
			continue
		}

		if unicode.IsSpace(r) {
			i++
			continue
		}

		if isChinese(r) {
			count++
			i++
			continue
		}

		if isASCIIWordChar(r) {
			count++
			i++
			for i < n && isASCIIWordChar(runes[i]) {
				i++
			}
			continue
		}

		if isASCIISymbol(r) {
			count++
			i++
			for i < n && isASCIISymbol(runes[i]) {
				i++
			}
			continue
		}

		count++
		i++
	}

	return count
}

func isChinese(r rune) bool {
	return unicode.Is(unicode.Han, r)
}

func isASCIIWordChar(r rune) bool {
	return (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
}

func isASCIISymbol(r rune) bool {
	return r >= 33 && r <= 126 && !isASCIIWordChar(r)
}
