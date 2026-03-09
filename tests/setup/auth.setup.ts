import { test as setup } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  // TODO: implement login flow (Wave 2)
  await page.goto('/login')
  await page.context().storageState({ path: authFile })
})
