package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSanitizeSkillName(t *testing.T) {
	valid := []string{"demo", "team-review", "my_skill", "技能"}
	for _, name := range valid {
		if _, err := sanitizeSkillName(name); err != nil {
			t.Fatalf("sanitizeSkillName(%q) error: %v", name, err)
		}
	}
	invalid := []string{"", "..", "../escape", "a/b", `a\b`, "a\x01b", strings.Repeat("x", 65)}
	for _, name := range invalid {
		if _, err := sanitizeSkillName(name); err == nil {
			t.Fatalf("sanitizeSkillName(%q) unexpectedly succeeded", name)
		}
	}
}

func TestEngineInstallSkill(t *testing.T) {
	dir := t.TempDir()
	registry := NewSkillRegistry()
	registry.SetDirs([]string{dir})
	e := &Engine{skills: registry}

	path, err := e.InstallSkill("demo", "# Demo\n\nDo the thing.")
	if err != nil {
		t.Fatalf("InstallSkill: %v", err)
	}
	want := filepath.Join(dir, "demo", "SKILL.md")
	if path != want {
		t.Fatalf("path = %q, want %q", path, want)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read installed skill: %v", err)
	}
	if !strings.Contains(string(data), "Do the thing.") {
		t.Fatalf("content = %q", string(data))
	}
}

func TestEngineInstallSkillRejectsBadInput(t *testing.T) {
	registry := NewSkillRegistry()
	registry.SetDirs([]string{t.TempDir()})
	e := &Engine{skills: registry}

	if _, err := e.InstallSkill("../escape", "x"); err == nil {
		t.Fatal("path traversal unexpectedly accepted")
	}
	if _, err := e.InstallSkill("demo", "   "); err == nil {
		t.Fatal("empty content unexpectedly accepted")
	}
	if _, err := e.InstallSkill("demo", strings.Repeat("x", 256*1024+1)); err == nil {
		t.Fatal("oversized content unexpectedly accepted")
	}
}
