package core

import "testing"

func TestBridgePlatformWantsProgress(t *testing.T) {
	bs := newBridgeServer(0, "secret", "", nil, false)
	bp := bs.NewPlatform("demo")
	rc := &bridgeReplyCtx{Platform: "web-test", SessionKey: "web-test:scope:demo"}

	if bp.WantsProgress(rc) {
		t.Fatal("WantsProgress true without a registered adapter")
	}
	bs.adapters["web-test"] = &bridgeAdapter{
		platform:     "web-test",
		capabilities: map[string]bool{"progress": true},
	}
	if !bp.WantsProgress(rc) {
		t.Fatal("WantsProgress false after progress capability registered")
	}
	bs.adapters["web-test"].capabilities = map[string]bool{}
	if bp.WantsProgress(rc) {
		t.Fatal("WantsProgress true without progress capability")
	}
}
