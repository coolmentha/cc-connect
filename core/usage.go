package core

// UsageSnapshot returns the cumulative token usage for this engine.
func (e *Engine) UsageSnapshot() (input, output, turns int64) {
	e.usageMu.Lock()
	defer e.usageMu.Unlock()
	return e.usageInput, e.usageOutput, e.usageTurns
}

func (e *Engine) addUsage(input, output int) {
	e.usageMu.Lock()
	defer e.usageMu.Unlock()
	e.usageTurns++
	if input > 0 {
		e.usageInput += int64(input)
	}
	if output > 0 {
		e.usageOutput += int64(output)
	}
}
