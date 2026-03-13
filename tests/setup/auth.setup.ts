import { test as setup } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  // First navigation triggers cold compilation — needs extra time
  await page.goto('/login', { timeout: 60_000 })
  await page.getByLabel('Username').fill('testuser')
  await page.getByLabel('Password').fill('testpass123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/', { timeout: 60_000 })
  await page.context().storageState({ path: authFile })
})
