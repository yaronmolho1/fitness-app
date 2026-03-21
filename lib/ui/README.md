# ui/

Shared UI utilities for consistent styling across components.

## Files
- `modality-colors.ts` — `getModalityAccentClass()` and `getModalityBadgeClasses()` return Tailwind classes for modality-specific styling (resistance, running, MMA, mixed)
- `superset-grouping.ts` — `groupSlotsByGroupId()`, `getGroupLabel()`, `formatRest()` — shared superset display logic: groups contiguous slots by group_id, labels (superset/tri-set/giant set), rest formatting
