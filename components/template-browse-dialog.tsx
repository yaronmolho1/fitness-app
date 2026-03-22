'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { BrowseTemplate } from '@/lib/templates/browse-queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCopy: (templateId: number) => void
  templates: BrowseTemplate[]
  isPending: boolean
}

export function TemplateBrowseDialog({ open, onOpenChange, onCopy, templates, isPending }: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return templates
    const q = search.toLowerCase()
    return templates.filter((t) => t.name.toLowerCase().includes(q))
  }, [templates, search])

  // Group filtered templates by mesocycle
  const groups = useMemo(() => {
    const map = new Map<number, { name: string; templates: BrowseTemplate[] }>()
    for (const t of filtered) {
      let group = map.get(t.mesocycle_id)
      if (!group) {
        group = { name: t.mesocycle_name, templates: [] }
        map.set(t.mesocycle_id, group)
      }
      group.templates.push(t)
    }
    return Array.from(map.values())
  }, [filtered])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy from Existing</DialogTitle>
          <DialogDescription className="sr-only">
            Browse and copy an existing template
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />

        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No other templates available
          </p>
        )}

        {templates.length > 0 && groups.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No templates match your search
          </p>
        )}

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.name}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {group.name}
              </h4>
              <div className="space-y-1">
                {group.templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">{t.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {t.modality}
                        </Badge>
                        {t.modality === 'resistance' && t.exercise_count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t.exercise_count} exercise{t.exercise_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 shrink-0"
                      disabled={isPending}
                      onClick={() => onCopy(t.id)}
                    >
                      Copy
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
