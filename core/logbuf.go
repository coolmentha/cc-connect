package core

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"time"
)

// LogLine is one captured log record exposed by the management API.
type LogLine struct {
	Time    time.Time `json:"time"`
	Level   string    `json:"level"`
	Message string    `json:"message"`
	Attrs   string    `json:"attrs,omitempty"`
}

type logBufferCore struct {
	mu    sync.RWMutex
	max   int
	lines []LogLine
}

// LogBuffer is a slog.Handler that keeps the most recent records in memory for
// the management UI and forwards them to the wrapped handler.
type LogBuffer struct {
	core  *logBufferCore
	next  slog.Handler
	attrs []slog.Attr
}

// NewLogBuffer creates a buffer retaining up to max records.
func NewLogBuffer(max int) *LogBuffer {
	if max <= 0 {
		max = 1000
	}
	return &LogBuffer{core: &logBufferCore{max: max}}
}

// Wrap returns a handler that records into this buffer and forwards to next.
func (b *LogBuffer) Wrap(next slog.Handler) slog.Handler {
	return &LogBuffer{core: b.core, next: next}
}

func (b *LogBuffer) Enabled(ctx context.Context, level slog.Level) bool {
	if b.next != nil {
		return b.next.Enabled(ctx, level)
	}
	return true
}

func (b *LogBuffer) Handle(ctx context.Context, r slog.Record) error {
	var sb strings.Builder
	attrs := make([]slog.Attr, 0, len(b.attrs)+r.NumAttrs())
	attrs = append(attrs, b.attrs...)
	r.Attrs(func(a slog.Attr) bool {
		attrs = append(attrs, a)
		return true
	})
	for _, a := range attrs {
		if a.Key == "" && a.Value.Kind() == slog.KindAny && a.Value.Any() == nil {
			continue
		}
		if sb.Len() > 0 {
			sb.WriteByte(' ')
		}
		sb.WriteString(a.Key)
		sb.WriteByte('=')
		sb.WriteString(a.Value.String())
	}
	line := LogLine{
		Time:    r.Time,
		Level:   r.Level.String(),
		Message: r.Message,
		Attrs:   sb.String(),
	}
	b.core.mu.Lock()
	b.core.lines = append(b.core.lines, line)
	if len(b.core.lines) > b.core.max {
		b.core.lines = append([]LogLine(nil), b.core.lines[len(b.core.lines)-b.core.max:]...)
	}
	b.core.mu.Unlock()
	if b.next != nil {
		return b.next.Handle(ctx, r)
	}
	return nil
}

func (b *LogBuffer) WithAttrs(attrs []slog.Attr) slog.Handler {
	if len(attrs) == 0 {
		return b
	}
	merged := make([]slog.Attr, 0, len(b.attrs)+len(attrs))
	merged = append(merged, b.attrs...)
	merged = append(merged, attrs...)
	var next slog.Handler
	if b.next != nil {
		next = b.next.WithAttrs(attrs)
	}
	return &LogBuffer{core: b.core, next: next, attrs: merged}
}

func (b *LogBuffer) WithGroup(name string) slog.Handler {
	if b.next != nil {
		return &LogBuffer{core: b.core, next: b.next.WithGroup(name), attrs: b.attrs}
	}
	return b
}

// Snapshot returns up to limit recent lines (all when limit <= 0) and the total
// number retained.
func (b *LogBuffer) Snapshot(limit int) ([]LogLine, int) {
	b.core.mu.RLock()
	defer b.core.mu.RUnlock()
	total := len(b.core.lines)
	if limit <= 0 || limit > total {
		limit = total
	}
	out := make([]LogLine, limit)
	copy(out, b.core.lines[total-limit:])
	return out, total
}

var defaultLogBuffer *LogBuffer

// SetDefaultLogBuffer installs the process-wide buffer used by the management API.
func SetDefaultLogBuffer(b *LogBuffer) { defaultLogBuffer = b }

// DefaultLogBuffer returns the process-wide log buffer, if configured.
func DefaultLogBuffer() *LogBuffer { return defaultLogBuffer }
