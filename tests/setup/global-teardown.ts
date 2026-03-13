import fs from 'fs'
import path from 'path'
import { E2E_DB_PATH } from '../e2e/e2e-config'

export default async function globalTeardown() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = E2E_DB_PATH + suffix
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      console.log(`✓ Cleaned up: ${file}`)
    }
  }

  const authStatePath = path.resolve(__dirname, '../../playwright/.auth/user.json')
  if (fs.existsSync(authStatePath)) {
    fs.unlinkSync(authStatePath)
    console.log('✓ Cleaned up auth state')
  }

  console.log('✓ Global teardown complete')
}
