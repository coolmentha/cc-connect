package core

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestBridgeTicketAuthenticates(t *testing.T) {
	bs := newBridgeServer(0, "secret", "", nil, false)
	ticket := bs.IssueTicket(time.Minute)
	if ticket == "" {
		t.Fatal("IssueTicket returned empty ticket")
	}
	req := httptest.NewRequest("GET", "/bridge/ws?token="+ticket, nil)
	if !bs.authenticate(req) {
		t.Fatal("ticket did not authenticate")
	}
	// The long-lived token still works.
	req2 := httptest.NewRequest("GET", "/bridge/ws?token=secret", nil)
	if !bs.authenticate(req2) {
		t.Fatal("long-lived token did not authenticate")
	}
	// Unknown tickets are rejected.
	req3 := httptest.NewRequest("GET", "/bridge/ws?token=bogus", nil)
	if bs.authenticate(req3) {
		t.Fatal("bogus ticket authenticated")
	}
}

func TestBridgeTicketExpires(t *testing.T) {
	bs := newBridgeServer(0, "secret", "", nil, false)
	ticket := bs.IssueTicket(time.Nanosecond)
	time.Sleep(time.Millisecond)
	if bs.validTicket(ticket) {
		t.Fatal("expired ticket accepted")
	}
}
