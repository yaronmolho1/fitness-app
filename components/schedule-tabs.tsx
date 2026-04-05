'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { SectionHeading } from '@/components/layout/section-heading'
import { ScheduleGrid } from '@/components/schedule-grid'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { copyNormalToDeload } from '@/lib/schedule/actions'
import type { ScheduleEntry, TemplateOption } from '@/lib/schedule/queries'

type Props = {
  mesocycleId: number
  templates: TemplateOption[]
  normalSchedule: ScheduleEntry[]
  deloadSchedule: ScheduleEntry[]
  hasDeload: boolean
  isCompleted: boolean
}

export function ScheduleTabs({
  mesocycleId,
  templates,
  normalSchedule,
  deloadSchedule,
  hasDeload,
  isCompleted,
}: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleCopyNormal() {
    startTransition(async () => {
      const result = await copyNormalToDeload(mesocycleId)
      if (!result.success) {
        alert(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <SectionHeading>Weekly Schedule</SectionHeading>
      </div>

      {hasDeload ? (
        <Tabs defaultValue="normal">
          <TabsList>
            <TabsTrigger value="normal" data-testid="tab-normal">
              Normal
            </TabsTrigger>
            <TabsTrigger value="deload" data-testid="tab-deload">
              Deload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="normal">
            <ScheduleGrid
              mesocycleId={mesocycleId}
              templates={templates}
              schedule={normalSchedule}
              isCompleted={isCompleted}
              variant="normal"
            />
          </TabsContent>

          <TabsContent value="deload">
            {!isCompleted && normalSchedule.length > 0 && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={handleCopyNormal}
                  data-testid="copy-normal-to-deload"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {pending ? 'Copying...' : 'Copy from Normal'}
                </Button>
              </div>
            )}
            <ScheduleGrid
              mesocycleId={mesocycleId}
              templates={templates}
              schedule={deloadSchedule}
              isCompleted={isCompleted}
              variant="deload"
            />
          </TabsContent>
        </Tabs>
      ) : (
        <ScheduleGrid
          mesocycleId={mesocycleId}
          templates={templates}
          schedule={normalSchedule}
          isCompleted={isCompleted}
          variant="normal"
        />
      )}
    </div>
  )
}
