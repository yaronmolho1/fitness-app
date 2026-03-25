import { test, expect } from '@playwright/test'

// Compute dates relative to today for stable tests
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 0=Monday..6=Sunday
function isoDow(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getDay() + 6) % 7
}

function monthStr(dateStr: string): string {
  return dateStr.slice(0, 7)
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatBannerDate(dateStr: string): string {
  const [year, monthNum, day] = dateStr.split('-')
  return `${day}/${MONTH_ABBR[parseInt(monthNum, 10) - 1]}/${year}`
}

function formatToastDate(dateStr: string): string {
  const [, monthNum, day] = dateStr.split('-')
  return `${day}/${MONTH_ABBR[parseInt(monthNum, 10) - 1]}`
}

// Build seed data: a mesocycle that spans 4 weeks around today,
// with workouts on every day except Sunday (day_of_week=6 = rest).
// This ensures we always have a past projected day, a rest day, and a future day.
function buildSeedData() {
  const today = todayStr()
  const todayDow = isoDow(today)

  // Past projected date: yesterday (or 2 days ago if yesterday was Sunday/rest)
  let pastProjectedOffset = -1
  while (isoDow(addDays(today, pastProjectedOffset)) === 6) {
    pastProjectedOffset--
  }
  const pastProjectedDate = addDays(today, pastProjectedOffset)

  // Already-logged date: a different past day
  let loggedOffset = pastProjectedOffset - 1
  while (isoDow(addDays(today, loggedOffset)) === 6) {
    loggedOffset--
  }
  const loggedDate = addDays(today, loggedOffset)

  // Rest day: find most recent Sunday
  let restOffset = 0
  for (let i = -1; i >= -7; i--) {
    if (isoDow(addDays(today, i)) === 6) {
      restOffset = i
      break
    }
  }
  const restDate = addDays(today, restOffset)

  // Future date: tomorrow (or day after if Sunday)
  let futureOffset = 1
  while (isoDow(addDays(today, futureOffset)) === 6) {
    futureOffset++
  }
  const futureDate = addDays(today, futureOffset)

  // Mesocycle covers 3 weeks before to 3 weeks after today
  const startDate = addDays(today, -21)
  const endDate = addDays(today, 21)

  // Schedule: Mon-Sat have a workout, Sunday is rest
  const schedule = []
  for (let dow = 0; dow <= 5; dow++) {
    schedule.push({
      day_of_week: dow,
      template_name: 'Push Day',
      week_type: 'normal' as const,
      period: 'morning' as const,
    })
  }
  // Sunday = rest (no template)
  schedule.push({
    day_of_week: 6,
    week_type: 'normal' as const,
    period: 'morning' as const,
  })

  return {
    today,
    pastProjectedDate,
    loggedDate,
    restDate,
    futureDate,
    startDate,
    endDate,
    seed: [
      { name: 'Bench Press', modality: 'resistance' },
      { name: 'Overhead Press', modality: 'resistance' },
    ],
    mesocycle: {
      name: 'E2E Test Meso',
      start_date: startDate,
      end_date: endDate,
      work_weeks: 4,
      has_deload: false,
      status: 'active' as const,
      templates: [
        {
          name: 'Push Day',
          canonical_name: 'push-day',
          modality: 'resistance' as const,
          slots: [
            {
              exercise_name: 'Bench Press',
              sets: 3,
              reps: '8-10',
              weight: 80,
              rpe: 8,
              rest_seconds: 120,
              order: 1,
              is_main: true,
            },
            {
              exercise_name: 'Overhead Press',
              sets: 3,
              reps: '10-12',
              weight: 40,
              order: 2,
              is_main: false,
            },
          ],
        },
      ],
      schedule,
      logged_workouts: [
        {
          template_name: 'Push Day',
          log_date: loggedDate,
          rating: 4,
          notes: 'Good session',
          exercises: [
            {
              exercise_name: 'Bench Press',
              order: 1,
              actual_rpe: 8,
              sets: [
                { set_number: 1, actual_reps: 10, actual_weight: 80 },
                { set_number: 2, actual_reps: 9, actual_weight: 80 },
                { set_number: 3, actual_reps: 8, actual_weight: 80 },
              ],
            },
          ],
        },
      ],
    },
  }
}

test.describe('Retroactive logging flow', () => {
  let data: ReturnType<typeof buildSeedData>

  test.beforeEach(async ({ request }) => {
    data = buildSeedData()
    await request.post('/api/test/reset', {
      data: {
        seed: data.seed,
        mesocycle: data.mesocycle,
      },
    })
  })

  test('happy path: calendar → past day → Log Workout → fill → save → redirect', async ({ page }) => {
    const targetDate = data.pastProjectedDate
    const targetMonth = monthStr(targetDate)

    // Navigate to calendar for the target month
    await page.goto(`/calendar?month=${targetMonth}`)
    await expect(page.locator('[data-testid^="calendar-day-"]').first()).toBeVisible()

    // Click on the past projected day
    const dayCell = page.locator(`[data-testid="calendar-day-${targetDate}"]`)
    await expect(dayCell).toBeVisible()
    await expect(dayCell).toHaveAttribute('data-status', 'projected')
    await dayCell.click()

    // Day detail panel opens
    const panel = page.locator('[data-testid="day-detail-panel"]')
    await expect(panel).toBeVisible()

    // Log Workout button visible on projected card
    const logBtn = panel.locator('[data-testid="log-workout-button"]')
    await expect(logBtn).toBeVisible()

    // Click Log Workout → navigates to /?date=YYYY-MM-DD
    await logBtn.click()
    await page.waitForURL(`**/?date=${targetDate}`, { timeout: 15_000 })

    // Verify retroactive date banner
    const banner = page.locator('[data-testid="retroactive-banner"]')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(`Logging for ${formatBannerDate(targetDate)}`)
    await expect(banner.locator('a')).toContainText('Back to Calendar')

    // Verify workout display loaded
    await expect(page.locator('[data-testid="workout-display"]')).toBeVisible()

    // Click "Log Workout" to enter logging mode
    await page.locator('[data-testid="start-logging-btn"]').click()

    // Fill the logging form — each exercise has set inputs
    // The form pre-fills with target values; we just need to save
    // Wait for the form to render with exercise inputs
    await expect(page.getByText('Bench Press').first()).toBeVisible()

    // Click Save Workout
    await page.getByRole('button', { name: 'Save Workout' }).click()

    // Verify toast
    await expect(page.locator('[data-sonner-toast]')).toContainText(
      `Workout logged for ${formatToastDate(targetDate)}`
    )

    // Verify redirect to calendar (month param may be present)
    await page.waitForURL('**/calendar**', { timeout: 15_000 })

    // Verify the day now shows completed marker
    const updatedCell = page.locator(`[data-testid="calendar-day-${targetDate}"]`)
    await expect(updatedCell).toHaveAttribute('data-status', 'completed')
  })

  test('future date: no Log Workout button', async ({ page }) => {
    const futureDate = data.futureDate
    const futureMonth = monthStr(futureDate)

    await page.goto(`/calendar?month=${futureMonth}`)
    await expect(page.locator('[data-testid^="calendar-day-"]').first()).toBeVisible()

    const dayCell = page.locator(`[data-testid="calendar-day-${futureDate}"]`)
    await expect(dayCell).toBeVisible()
    await dayCell.click()

    const panel = page.locator('[data-testid="day-detail-panel"]')
    await expect(panel).toBeVisible()

    // No Log Workout button for future dates
    await expect(panel.locator('[data-testid="log-workout-button"]')).not.toBeVisible()
  })

  test('rest day: no Log Workout button', async ({ page }) => {
    const restDate = data.restDate
    const restMonth = monthStr(restDate)

    await page.goto(`/calendar?month=${restMonth}`)
    await expect(page.locator('[data-testid^="calendar-day-"]').first()).toBeVisible()

    const dayCell = page.locator(`[data-testid="calendar-day-${restDate}"]`)
    await expect(dayCell).toBeVisible()
    await dayCell.click()

    const panel = page.locator('[data-testid="day-detail-panel"]')
    await expect(panel).toBeVisible()

    // Rest day shows rest message, no Log Workout
    await expect(panel.locator('[data-testid="rest-day-message"]')).toBeVisible()
    await expect(panel.locator('[data-testid="log-workout-button"]')).not.toBeVisible()
  })

  test('already-logged day: shows summary, no Log Workout button', async ({ page }) => {
    const loggedDate = data.loggedDate
    const loggedMonth = monthStr(loggedDate)

    await page.goto(`/calendar?month=${loggedMonth}`)
    await expect(page.locator('[data-testid^="calendar-day-"]').first()).toBeVisible()

    const dayCell = page.locator(`[data-testid="calendar-day-${loggedDate}"]`)
    await expect(dayCell).toBeVisible()
    // Should show completed status
    await expect(dayCell).toHaveAttribute('data-status', 'completed')
    await dayCell.click()

    const panel = page.locator('[data-testid="day-detail-panel"]')
    await expect(panel).toBeVisible()

    // No Log Workout button for already-logged days
    await expect(panel.locator('[data-testid="log-workout-button"]')).not.toBeVisible()
  })

  test('no retroactive banner when navigating to today page without date', async ({ page }) => {
    await page.goto('/')
    // Wait for page to load (either workout display or no-meso state)
    await page.waitForLoadState('networkidle')

    // No retroactive banner
    await expect(page.locator('[data-testid="retroactive-banner"]')).not.toBeVisible()
  })
})
