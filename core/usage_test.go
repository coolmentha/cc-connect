package core

import "testing"

func TestEngineUsageAccumulates(t *testing.T) {
	e := &Engine{}
	e.addUsage(10, 5)
	e.addUsage(0, 3)
	e.addUsage(-1, -1)

	in, out, turns := e.UsageSnapshot()
	if in != 10 || out != 8 || turns != 3 {
		t.Fatalf("usage = (%d,%d,%d), want (10,8,3)", in, out, turns)
	}
}
