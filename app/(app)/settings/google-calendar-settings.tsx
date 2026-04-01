'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { disconnectGoogle } from '@/lib/google/actions'
import type { SyncStatusResult } from '@/lib/google/queries'

type Props = {
  connected: boolean
  timezone: string | null
  error?: string
  syncStatus?: SyncStatusResult
}

export function GoogleCalendarSettings({ connected, timezone, error, syncStatus }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectGoogle()
      router.refresh()
    })
  }

  async function handleRetryFailed() {
    setIsSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' })
      const data = await res.json()
      if (data.created > 0 || data.failed === 0) {
        setSyncResult(`Retried ${data.created} event${data.created !== 1 ? 's' : ''}`)
      } else {
        setSyncResult(`${data.failed} event${data.failed !== 1 ? 's' : ''} still failing`)
      }
      router.refresh()
    } catch {
      setSyncResult('Retry failed')
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleFullResync() {
    setIsSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'full' }),
      })
      const data = await res.json()
      setSyncResult(
        `Full re-sync: ${data.created} created, ${data.deleted} deleted${data.failed > 0 ? `, ${data.failed} failed` : ''}`
      )
      router.refresh()
    } catch {
      setSyncResult('Full re-sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Google Calendar</CardTitle>
          {connected && (
            <Badge className="bg-green-600 hover:bg-green-600 text-white">
              Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          Sync your training schedule with Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className="text-sm text-destructive">
            {error}
          </div>
        )}

        {connected ? (
          <>
            {timezone && (
              <div className="text-sm">
                <span className="text-muted-foreground">Timezone: </span>
                <span>{timezone}</span>
              </div>
            )}

            {syncStatus && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-3 text-sm">
                  <span>
                    <span className="font-medium">{syncStatus.synced}</span>{' '}
                    <span className="text-muted-foreground">synced</span>
                  </span>
                  {syncStatus.pending > 0 && (
                    <span>
                      <span className="font-medium">{syncStatus.pending}</span>{' '}
                      <span className="text-muted-foreground">pending</span>
                    </span>
                  )}
                  {syncStatus.error > 0 && (
                    <span>
                      <span className="font-medium text-destructive">{syncStatus.error}</span>{' '}
                      <span className="text-muted-foreground">failed</span>
                    </span>
                  )}
                </div>
                {syncStatus.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {new Date(syncStatus.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {syncResult && (
              <p className="text-sm text-muted-foreground">{syncResult}</p>
            )}

            <div className="flex gap-2">
              {syncStatus && syncStatus.error > 0 && (
                <Button
                  variant="outline"
                  onClick={handleRetryFailed}
                  disabled={isSyncing}
                >
                  {isSyncing ? 'Retrying...' : 'Retry failed'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleFullResync}
                disabled={isSyncing}
              >
                {isSyncing ? 'Re-syncing...' : 'Full re-sync'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowConfirm(true)}
                disabled={isPending}
              >
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Button asChild>
            <a href="/api/auth/google">Connect Google Calendar</a>
          </Button>
        )}

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will disconnect your Google Calendar. Synced events will remain but no new events will be created.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisconnect} disabled={isPending}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
