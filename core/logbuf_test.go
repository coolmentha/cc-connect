package core

import (
	"log/slog"
	"testing"
)

func TestLogBufferRetainsAndTrims(t *testing.T) {
	buf := NewLogBuffer(2)
	logger := slog.New(buf.Wrap(nil))

	logger.Info("one")
	logger.Warn("two", "key", "value")
	logger.Error("three")

	lines, total := buf.Snapshot(0)
	if total != 2 || len(lines) != 2 {
		t.Fatalf("snapshot len=%d total=%d, want 2/2", len(lines), total)
	}
	if lines[0].Message != "two" || lines[1].Message != "three" {
		t.Fatalf("unexpected retained lines: %+v", lines)
	}
	if lines[0].Attrs != "key=value" {
		t.Fatalf("attrs = %q, want key=value", lines[0].Attrs)
	}
	if lines[0].Level != "WARN" || lines[1].Level != "ERROR" {
		t.Fatalf("levels = %q/%q", lines[0].Level, lines[1].Level)
	}

	limited, _ := buf.Snapshot(1)
	if len(limited) != 1 || limited[0].Message != "three" {
		t.Fatalf("limited snapshot = %+v", limited)
	}
}

func TestLogBufferWithAttrs(t *testing.T) {
	buf := NewLogBuffer(5)
	logger := slog.New(buf.Wrap(nil)).With("project", "demo")
	logger.Info("hello")

	lines, _ := buf.Snapshot(0)
	if len(lines) != 1 || lines[0].Attrs != "project=demo" {
		t.Fatalf("attrs = %+v", lines)
	}
}

func TestDefaultLogBuffer(t *testing.T) {
	prev := DefaultLogBuffer()
	buf := NewLogBuffer(3)
	SetDefaultLogBuffer(buf)
	t.Cleanup(func() { SetDefaultLogBuffer(prev) })
	if DefaultLogBuffer() != buf {
		t.Fatal("default buffer not installed")
	}
}
