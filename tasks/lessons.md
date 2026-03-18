# TreasuryClaw — Lessons Learned

## Session 1 (2026-03-18)
- Initial project scaffold from Grok conversation spec
- Used real DashClaw SDK patterns (guard, createAction, updateOutcome, events SSE)
- Used Uniswap Trading API (not SDK) for backend swap execution — recommended approach
- Key: strip `permitData` from UniswapX routes before sending to `/swap` endpoint
- Key: `tokenInChainId` must be a string, not a number, in quote requests
