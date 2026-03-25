# summary/

POST endpoint that generates an AI-ready coaching summary from athlete state and training data.

## Files
- `route.ts` — accepts subjective state (fatigue/soreness/sleep/injuries/notes), aggregates athlete profile, current plan, recent sessions, progression trends, and 14-day calendar projection, returns markdown via `generateCoachingSummary`
- `route.test.ts` — integration tests for the POST handler
