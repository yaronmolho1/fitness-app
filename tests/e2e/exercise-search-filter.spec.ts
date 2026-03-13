import { test, expect } from '@playwright/test'

const SEED_EXERCISES = [
  { name: 'Bench Press', modality: 'resistance' },
  { name: 'Overhead Press', modality: 'resistance' },
  { name: 'Squat', modality: 'resistance' },
  { name: '5K Tempo Run', modality: 'running' },
  { name: 'Heavy Bag Rounds', modality: 'mma' },
]

test.describe('Exercise search & filter', () => {
  test('shows empty state when no exercises exist', async ({ page, request }) => {
    await request.post('/api/test/reset')
    await page.goto('/exercises')
    await expect(page.getByText('No exercises yet')).toBeVisible()
  })

  test('search input and modality filter are visible', async ({ page, request }) => {
    await request.post('/api/test/reset')
    await page.goto('/exercises')
    await expect(page.getByPlaceholder('Search exercises...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resistance' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Running' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'MMA' })).toBeVisible()
  })

  test.describe('with exercises', () => {
    test.beforeEach(async ({ page, request }) => {
      await request.post('/api/test/reset', {
        data: { seed: SEED_EXERCISES },
      })
      await page.goto('/exercises')
      await expect(page.locator('.divide-y')).toBeVisible()
    })

    test('search filters exercises by name as-you-type', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search exercises...')

      await searchInput.fill('press')
      await expect(page.getByText('Bench Press')).toBeVisible()
      await expect(page.getByText('Overhead Press')).toBeVisible()
      await expect(page.getByText('Squat')).not.toBeVisible()
      await expect(page.getByText('5K Tempo Run')).not.toBeVisible()
      await expect(page.getByText('Heavy Bag Rounds')).not.toBeVisible()
    })

    test('search is case-insensitive', async ({ page }) => {
      await page.getByPlaceholder('Search exercises...').fill('SQUAT')
      await expect(page.getByText('Squat')).toBeVisible()
    })

    test('clearing search restores full list', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search exercises...')

      await searchInput.fill('press')
      await expect(page.getByText('Squat')).not.toBeVisible()

      await searchInput.clear()
      await expect(page.getByText('Squat')).toBeVisible()
      await expect(page.getByText('Bench Press')).toBeVisible()
      await expect(page.getByText('5K Tempo Run')).toBeVisible()
    })

    test('modality filter shows only matching exercises', async ({ page }) => {
      await page.getByRole('button', { name: 'Running' }).click()
      await expect(page.getByText('5K Tempo Run')).toBeVisible()
      await expect(page.getByText('Bench Press')).not.toBeVisible()
      await expect(page.getByText('Squat')).not.toBeVisible()
    })

    test('modality filter "All" shows everything', async ({ page }) => {
      await page.getByRole('button', { name: 'Running' }).click()
      await expect(page.getByText('Bench Press')).not.toBeVisible()

      await page.getByRole('button', { name: 'All' }).click()
      await expect(page.getByText('Bench Press')).toBeVisible()
      await expect(page.getByText('5K Tempo Run')).toBeVisible()
      await expect(page.getByText('Heavy Bag Rounds')).toBeVisible()
    })

    test('combined search + modality filter', async ({ page }) => {
      await page.getByPlaceholder('Search exercises...').fill('press')
      await page.getByRole('button', { name: 'Resistance' }).click()

      await expect(page.getByText('Bench Press')).toBeVisible()
      await expect(page.getByText('Overhead Press')).toBeVisible()
      await expect(page.getByText('5K Tempo Run')).not.toBeVisible()
    })

    test('shows no-match empty state when search has no results', async ({ page }) => {
      await page.getByPlaceholder('Search exercises...').fill('deadlift')
      await expect(page.getByText('No matching exercises')).toBeVisible()
      await expect(page.getByText('Try adjusting your search or filter')).toBeVisible()
    })

    test('shows no-match empty state for combined filter with no results', async ({ page }) => {
      await page.getByPlaceholder('Search exercises...').fill('press')
      await page.getByRole('button', { name: 'Running' }).click()

      await expect(page.getByText('No matching exercises')).toBeVisible()
    })
  })
})
