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

type Props = {
  connected: boolean
  timezone: string | null
  error?: string
}

export function GoogleCalendarSettings({ connected, timezone, error }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectGoogle()
      router.refresh()
    })
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
            <Button
              variant="destructive"
              onClick={() => setShowConfirm(true)}
              disabled={isPending}
            >
              Disconnect
            </Button>
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
