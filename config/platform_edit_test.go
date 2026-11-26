package config

import (
	"fmt"
	"os"
	"strings"
	"testing"
)

func TestRemovePlatformFromProject(t *testing.T) {
	path := writeConfigFixture(t, preservedProjectFixture)
	patchConfigPath(t, path)
	if err := RemovePlatformFromProject("alpha", "telegram"); err != nil {
		t.Fatalf("RemovePlatformFromProject: %v", err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(got)
	if strings.Contains(text, `type = "telegram"`) {
		t.Fatalf("telegram platform still present:\n%s", text)
	}
	if !strings.Contains(text, `type = "slack"`) {
		t.Fatalf("other platform was removed:\n%s", text)
	}
	if !strings.Contains(text, "# operator note") {
		t.Fatalf("document comment was lost:\n%s", text)
	}
	if !strings.Contains(text, "unknown_top = \"keep\"") {
		t.Fatalf("unknown key was lost:\n%s", text)
	}
}

func TestRemovePlatformFromProjectNotFound(t *testing.T) {
	path := writeConfigFixture(t, preservedProjectFixture)
	patchConfigPath(t, path)
	if err := RemovePlatformFromProject("alpha", "discord"); err == nil {
		t.Fatal("expected error for missing platform")
	}
	if err := RemovePlatformFromProject("missing", "telegram"); err == nil {
		t.Fatal("expected error for missing project")
	}
}

func TestUpdatePlatformInProjectMergesOptions(t *testing.T) {
	path := writeConfigFixture(t, preservedProjectFixture)
	patchConfigPath(t, path)
	if err := UpdatePlatformInProject("alpha", "telegram", map[string]any{
		"allow_from":      "*",
		"group_reply_all": true,
	}); err != nil {
		t.Fatalf("UpdatePlatformInProject: %v", err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(got)
	for _, want := range []string{
		`allow_from = "*"`,
		"group_reply_all = true",
		`type = "slack"`,
		`bot_token = "beta"`,
	} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %q in config:\n%s", want, text)
		}
	}
}

func TestUpdatePlatformKeepsUnspecifiedSecret(t *testing.T) {
	fixture := fmt.Sprintf(`[[projects]]
name = "alpha"

[projects.agent]
type = "codex"

[[projects.platforms]]
type = "telegram"

[projects.platforms.options]
token = "secret-token"
allow_from = "old"
`)
	path := writeConfigFixture(t, fixture)
	patchConfigPath(t, path)
	if err := UpdatePlatformInProject("alpha", "telegram", map[string]any{"allow_from": "new"}); err != nil {
		t.Fatalf("UpdatePlatformInProject: %v", err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(got)
	if !strings.Contains(text, `token = "secret-token"`) {
		t.Fatalf("unspecified secret was lost:\n%s", text)
	}
	if !strings.Contains(text, `allow_from = "new"`) {
		t.Fatalf("updated option missing:\n%s", text)
	}
}
