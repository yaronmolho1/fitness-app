# UI Polish: Headers & Padding
**Status:** planned
**Epic:** Navigation & Discoverability
**Depends:** specs/layout-system.md

## Description
Audit and improve header spacing, padding, and typography consistency across all pages for a polished, cohesive feel.

## Acceptance Criteria

### Header consistency
- [ ] All page titles use `PageHeader` component with consistent `text-2xl font-bold tracking-tight`
- [ ] Page header has consistent bottom margin relative to first content block (standardize on `mb-6`)
- [ ] H2 section headings within pages use consistent `text-lg font-semibold tracking-tight` with `mt-8 mb-4` spacing
- [ ] No raw `<h1>` or `<h2>` tags outside of `PageHeader` and section heading patterns

### Page container padding
- [ ] All pages use `PageContainer` with appropriate variant (narrow for forms, wide for lists/grids)
- [ ] Container horizontal padding is `px-4 sm:px-6 lg:px-8` (responsive)
- [ ] Container vertical padding is `py-6` minimum
- [ ] Content within cards has `p-4` minimum (no cramped text)

### Mobile spacing
- [ ] Mobile top padding (`pt-14`) correctly offsets the fixed TopHeader on all pages
- [ ] No content is clipped or hidden behind the mobile header
- [ ] Touch targets (buttons, links) have minimum 44px hit area on mobile
- [ ] Form fields have adequate spacing (`space-y-4`) for thumb-friendly input

### Visual rhythm
- [ ] Card sections use consistent `space-y-4` or `space-y-6` gaps
- [ ] Dividers between list items are consistent (either all `divide-y` or all gap-based)
- [ ] Empty states are vertically centered with appropriate padding
- [ ] Action buttons (create, edit, delete) have consistent sizing and placement

### Typography scale
- [ ] Page title: `text-2xl` (24px)
- [ ] Section heading: `text-lg` (18px)
- [ ] Card title: `text-base font-semibold` (16px)
- [ ] Body text: `text-sm` (14px) for secondary, `text-base` for primary
- [ ] Muted text: `text-muted-foreground` for all secondary/helper text

## Test Requirements
- Visual regression: all pages render without layout shifts
- Mobile viewport (375px): no horizontal overflow, no clipped content
- All pages use PageContainer (grep for raw `<main>` or `<div className="max-w-...">` outside PageContainer)
