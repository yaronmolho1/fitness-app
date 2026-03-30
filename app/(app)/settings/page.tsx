import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { isGoogleConnected } from '@/lib/google/queries'
import { getAthleteTimezone, getSyncStatus } from '@/lib/google/queries'
import { GoogleCalendarSettings } from './google-calendar-settings'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const connected = await isGoogleConnected()
  const timezone = await getAthleteTimezone()
  const syncStatus = connected ? await getSyncStatus() : undefined

  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <PageHeader title="Settings" />
        <GoogleCalendarSettings
          connected={connected}
          timezone={timezone}
          error={error}
          syncStatus={syncStatus}
        />
      </div>
    </PageContainer>
  )
}
