package core

import (
	"errors"
	"testing"
)

func TestCronStoreRunHistory(t *testing.T) {
	store, err := NewCronStore(t.TempDir())
	if err != nil {
		t.Fatalf("NewCronStore: %v", err)
	}
	job := &CronJob{ID: "job-1", Project: "demo", CronExpr: "* * * * *", Prompt: "hi", Enabled: true}
	if err := store.Add(job); err != nil {
		t.Fatalf("Add: %v", err)
	}

	store.MarkRun("job-1", nil)
	store.MarkRun("job-1", errors.New("boom"))

	hist := store.History("job-1")
	if len(hist) != 2 {
		t.Fatalf("history len = %d, want 2", len(hist))
	}
	if !hist[0].Success || hist[0].Error != "" {
		t.Fatalf("first record = %+v", hist[0])
	}
	if hist[1].Success || hist[1].Error != "boom" {
		t.Fatalf("second record = %+v", hist[1])
	}
	if got := store.History("missing"); len(got) != 0 {
		t.Fatalf("missing history = %+v", got)
	}
}

func TestCronStoreHistoryTrims(t *testing.T) {
	store, err := NewCronStore(t.TempDir())
	if err != nil {
		t.Fatalf("NewCronStore: %v", err)
	}
	job := &CronJob{ID: "job-2", Project: "demo", CronExpr: "* * * * *", Prompt: "hi", Enabled: true}
	if err := store.Add(job); err != nil {
		t.Fatalf("Add: %v", err)
	}
	for i := 0; i < 60; i++ {
		store.MarkRun("job-2", nil)
	}
	if got := len(store.History("job-2")); got != 50 {
		t.Fatalf("history len = %d, want 50", got)
	}
}
