import { test as setup } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('testuser')
  await page.getByLabel('Password').fill('testpass123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/')
  await page.context().storageState({ path: authFile })
})
