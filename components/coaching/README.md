# components/coaching/

Coaching Summary UI — pre-workout subjective state capture and coaching insights.

## Files
- `subjective-state-form.tsx` — `SubjectiveStateForm` ephemeral controlled form: 1-5 radio groups for fatigue/soreness/sleep quality (toggle-deselectable), injuries text input, notes textarea; exports `SubjectiveState` type
- `summary-preview.tsx` — `SummaryPreview` client component: POSTs subjective state to `/api/coaching/summary`, renders markdown response in `<pre>` block, copy-to-clipboard with check icon feedback, loading/error states
- `coaching-client.tsx` — `CoachingClient` orchestrator: composes ProfileForm, SubjectiveStateForm, and SummaryPreview; manages shared SubjectiveState, receives server-loaded profile as prop
