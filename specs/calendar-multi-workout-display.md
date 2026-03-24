# Calendar Multi-Workout Display

## Description

Fix the calendar day detail to show all workouts scheduled on the same day (e.g., morning strength + evening run) and render each as an expandable card with full exercise details. Currently only the first workout is returned and displayed.

## Acceptance Criteria

1. **Given** a day with two workouts scheduled in different periods (e.g., morning resistance + evening run), **When** the day detail data is fetched, **Then** all scheduled workouts for that day are returned — not just the first.

2. **Given** a day with multiple workouts, **When** the day detail API endpoint is called, **Then** the response contains an array of workout entries, each with its period label and full template/slot data.

3. **Given** a day with multiple workouts, **When** the user taps a day cell in the calendar grid, **Then** the detail panel shows one card per workout, each labeled with its period (Morning / Afternoon / Evening).

4. **Given** a day detail panel with multiple workout cards, **When** the panel first opens, **Then** all cards are collapsed showing only the template name, modality badge, and period label.

5. **Given** a collapsed workout card in the day detail panel, **When** the user taps the card, **Then** it expands to show full details: exercise list with sets/reps/weight/RPE for resistance, run details for running, duration for MMA.

6. **Given** an expanded workout card, **When** the user taps it again, **Then** it collapses back to the summary view.

7. **Given** a day with only one workout scheduled, **When** the detail panel opens, **Then** that single workout card is shown expanded by default (no change from current UX flow, just wrapped in a card).

8. **Given** a day with both projected (future) and completed (logged) workouts, **When** the detail panel opens, **Then** projected workouts show planned targets and completed workouts show actual logged values — each rendered with the appropriate display treatment.

9. **Given** a day with multiple logged workouts, **When** the detail panel opens, **Then** all logged workouts are shown as separate cards with their respective exercise actuals, ratings, and notes.

10. **Given** a day with a rest period (no workout in one period but workouts in others), **When** the detail panel opens, **Then** only periods with actual workouts are shown — rest periods are not rendered as empty cards.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Day with 3 workouts (all periods filled) | All three cards render in period order: morning, afternoon, evening |
| Day with workout but no period data (legacy schedule entries) | Card renders without a period label; displayed as a single workout |
| Multiple logged workouts on same date (logged at different times) | Each logged workout gets its own card with its own snapshot and actuals |
| Day at mesocycle boundary (two mesocycles overlap) | Each mesocycle's scheduled workout appears as a separate card |
| Day with mixed template + separate single-modality template | Both render: mixed template card shows sections, single-modality card shows its content |
| API called for a date with no mesocycle | Returns rest-day result (array with single rest entry or empty array) |

## Test Requirements

- AC1: Integration — schedule 2 workouts on same day with different periods → fetch day detail → verify both returned
- AC2: Integration — API returns array with correct structure per entry (period, template, slots/snapshot)
- AC3: Visual — multi-workout day opens panel with correct number of cards
- AC4: Visual — cards start collapsed showing summary only
- AC5: Visual — tapping card toggles expansion with full details
- AC7: Visual — single-workout day shows card expanded by default
- AC8: Integration — mix of projected + completed entries on same day renders correctly
- AC9: Integration — multiple logged workouts on same date each get their own card

## Dependencies

- `specs/projected-calendar.md` — parent calendar spec; this extends the day detail feature
- `specs/mixed-modality-templates.md` — mixed templates may appear as one of multiple workouts

## Out of Scope

- Reordering workouts within a day
- Adding/removing workouts from the day detail panel (use schedule page)
- Calendar grid changes (multi-pill rendering already works)
- Inline logging from the day detail panel

## Open Questions

- When collapsed, should cards show exercise count (e.g., "5 exercises") or just template name + modality?
