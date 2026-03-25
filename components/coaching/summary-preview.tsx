'use client'

import { useState, useCallback } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SubjectiveState } from './subjective-state-form'

type Props = {
  subjectiveState: SubjectiveState
}

export function SummaryPreview({ subjectiveState }: Props) {
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/coaching/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fatigue: subjectiveState.fatigue,
          soreness: subjectiveState.soreness,
          sleep: subjectiveState.sleepQuality,
          injuries: subjectiveState.currentInjuries,
          notes: subjectiveState.notes,
        }),
      })

      if (!res.ok) {
        setError('Failed to generate summary')
        return
      }

      const data = await res.json()
      setMarkdown(data.markdown)
    } catch {
      setError('Failed to generate summary')
    } finally {
      setLoading(false)
    }
  }, [subjectiveState])

  const [copyError, setCopyError] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!markdown) return
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setCopyError(false)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 3000)
    }
  }, [markdown])

  return (
    <div className="space-y-4">
      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            Generating...
          </>
        ) : (
          'Generate Summary'
        )}
      </Button>

      {error && (
        <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {markdown && (
        <div className="relative">
          <div className="flex items-center justify-end pb-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check data-testid="copy-check-icon" />
                  Copied
                </>
              ) : (
                <>
                  <Copy />
                  Copy
                </>
              )}
            </Button>
          </div>
          {copyError && (
            <div role="alert" className="mb-2 rounded-md border border-destructive bg-destructive/10 p-2 text-sm text-destructive">
              Failed to copy to clipboard
            </div>
          )}
          <pre
            data-testid="summary-preview"
            className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted p-4 text-sm"
          >
            {markdown}
          </pre>
        </div>
      )}
    </div>
  )
}
