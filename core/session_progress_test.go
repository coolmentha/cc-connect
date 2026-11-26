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

func TestSessionProgressEntryKeepsToolMetadata(t *testing.T) {
	s := &Session{}
	exit := 1
	success := false
	s.AddProgressEntry(ProgressEvent{
		Kind:      "tool_result",
		Content:   "boom",
		ToolName:  "Bash",
		ToolInput: `{"command":"ls"}`,
		ToolIndex: 2,
		Status:    "failed",
		ExitCode:  &exit,
		Success:   &success,
	})
	got := s.GetProgress(1)[0]
	if got.Kind != "tool_result" || got.ToolName != "Bash" || got.ToolInput != `{"command":"ls"}` {
		t.Fatalf("unexpected entry: %+v", got)
	}
	if got.ToolIndex != 2 || got.Status != "failed" {
		t.Fatalf("unexpected metadata: %+v", got)
	}
	if got.ExitCode == nil || *got.ExitCode != 1 || got.Success == nil || *got.Success {
		t.Fatalf("unexpected status: %+v", got)
	}
	// Identical adjacent entries are deduplicated.
	s.AddProgressEntry(ProgressEvent{Kind: "tool_result", Content: "boom", ToolName: "Bash", ToolInput: `{"command":"ls"}`})
	if len(s.GetProgress(0)) != 1 {
		t.Fatal("duplicate entry was not deduplicated")
	}
}
