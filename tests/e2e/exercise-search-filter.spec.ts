import { test, expect } from '@playwright/test'

test.describe('Exercise search & filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/exercises')
  })

  test('shows empty state when no exercises exist', async ({ page }) => {
    await expect(page.getByText('No exercises yet')).toBeVisible()
  })

  test('search input and modality filter are visible', async ({ page }) => {
    await expect(page.getByPlaceholder('Search exercises...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resistance' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Running' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'MMA' })).toBeVisible()
  })

  test.describe('with exercises', () => {
    test.beforeEach(async ({ page }) => {
      // Create test exercises via the form
      const exercises = [
        { name: 'Bench Press', modality: 'resistance' },
        { name: 'Overhead Press', modality: 'resistance' },
        { name: 'Squat', modality: 'resistance' },
        { name: '5K Tempo Run', modality: 'running' },
        { name: 'Heavy Bag Rounds', modality: 'mma' },
      ]

      for (const ex of exercises) {
        await page.getByPlaceholder('e.g. Bench Press').fill(ex.name)
        await page.locator('#exercise-modality').selectOption(ex.modality)
        await page.getByRole('button', { name: 'Create Exercise' }).click()
        // Wait for exercise to appear in the list
        await expect(page.getByText(ex.name)).toBeVisible()
      }
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
