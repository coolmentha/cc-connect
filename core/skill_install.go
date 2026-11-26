package core

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

// sanitizeSkillName rejects path traversal and control characters while
// allowing non-ASCII names (the agent directories are plain filesystem paths).
func sanitizeSkillName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", fmt.Errorf("skill name is required")
	}
	if utf8.RuneCountInString(name) > 64 {
		return "", fmt.Errorf("skill name is too long (max 64 characters)")
	}
	if name == "." || name == ".." || strings.Contains(name, "..") {
		return "", fmt.Errorf("invalid skill name %q", name)
	}
	for _, r := range name {
		if r == '/' || r == '\\' || r < 0x20 || r == 0x7f {
			return "", fmt.Errorf("invalid character in skill name")
		}
	}
	return name, nil
}

// InstallSkill writes content as SKILL.md under the first configured skill
// directory. It only creates a new directory when needed and never follows a
// symlink outside the configured root.
func (e *Engine) InstallSkill(name, content string) (string, error) {
	clean, err := sanitizeSkillName(name)
	if err != nil {
		return "", err
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return "", fmt.Errorf("skill content is empty")
	}
	if len(content) > 256*1024 {
		return "", fmt.Errorf("skill content is too large (max 256 KB)")
	}
	dirs := e.SkillDirs()
	if len(dirs) == 0 {
		return "", fmt.Errorf("no skill directory is configured for this project")
	}
	base := dirs[0]
	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", fmt.Errorf("create skill directory: %w", err)
	}
	dir := filepath.Join(base, clean)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create skill folder: %w", err)
	}
	path := filepath.Join(dir, "SKILL.md")
	if err := AtomicWriteFile(path, []byte(content), 0o644); err != nil {
		return "", fmt.Errorf("write SKILL.md: %w", err)
	}
	return path, nil
}

// RemoveSkill deletes a skill directory, but only when it is a direct child of
// one of the engine's configured skill directories.
func (e *Engine) RemoveSkill(name string) error {
	clean, err := sanitizeSkillName(name)
	if err != nil {
		return err
	}
	var target string
	for _, s := range e.ListSkills() {
		if s.Name == clean {
			target = s.Source
			break
		}
	}
	if target == "" {
		return fmt.Errorf("skill %q not found", clean)
	}
	parent := filepath.Dir(target)
	allowed := false
	for _, dir := range e.SkillDirs() {
		absParent, err1 := filepath.Abs(parent)
		absDir, err2 := filepath.Abs(dir)
		if err1 == nil && err2 == nil && strings.EqualFold(absParent, absDir) {
			allowed = true
			break
		}
	}
	if !allowed {
		return fmt.Errorf("skill %q is not inside a configured skill directory", clean)
	}
	return os.RemoveAll(target)
}
