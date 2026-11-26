package core

import (
	"fmt"
	"strings"
	"testing"
)

func TestSessionProgressRingAndLimit(t *testing.T) {
	s := &Session{}
	for i := 0; i < maxProgressEntries+5; i++ {
		s.AddProgress("thinking", fmt.Sprintf("p%d", i))
	}
	got := s.GetProgress(0)
	if len(got) != maxProgressEntries {
		t.Fatalf("progress len = %d, want %d", len(got), maxProgressEntries)
	}
	if got[0].Kind != "thinking" || got[0].Role != "progress" {
		t.Fatalf("first entry = %+v", got[0])
	}
	if got[len(got)-1].Content != fmt.Sprintf("p%d", maxProgressEntries+4) {
		t.Fatalf("last content = %q", got[len(got)-1].Content)
	}
	if limited := s.GetProgress(2); len(limited) != 2 {
		t.Fatalf("limited len = %d", len(limited))
	}
}

func TestSessionProgressTruncatesLongContent(t *testing.T) {
	s := &Session{}
	s.AddProgress("tool", strings.Repeat("x", maxProgressEntryRunes+100))
	got := s.GetProgress(1)
	if len([]rune(got[0].Content)) > maxProgressEntryRunes+3 {
		t.Fatalf("content not truncated: %d runes", len([]rune(got[0].Content)))
	}
}
