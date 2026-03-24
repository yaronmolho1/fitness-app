'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { TransferTarget, TransferTargetTemplate, TransferTargetSection } from '@/lib/templates/transfer-queries'

type ConfirmPayload = {
  targetTemplateId: number
  targetSectionId: number | undefined
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payload: ConfirmPayload) => void
  targets: TransferTarget[]
  isPending: boolean
  mode: 'copy' | 'move'
  error?: string
}

type Step = 'mesocycle' | 'template' | 'section'

export function TargetPickerModal({
  open,
  onOpenChange,
  onConfirm,
  targets,
  isPending,
  mode,
  error,
}: Props) {
  const [step, setStep] = useState<Step>('mesocycle')
  const [selectedMeso, setSelectedMeso] = useState<TransferTarget | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TransferTargetTemplate | null>(null)
  const [selectedSection, setSelectedSection] = useState<TransferTargetSection | null>(null)

  const resetState = useCallback(() => {
    setStep('mesocycle')
    setSelectedMeso(null)
    setSelectedTemplate(null)
    setSelectedSection(null)
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) resetState()
    onOpenChange(nextOpen)
  }, [onOpenChange, resetState])

  const handleMesoSelect = useCallback((meso: TransferTarget) => {
    setSelectedMeso(meso)
    setStep('template')
  }, [])

  const handleTemplateSelect = useCallback((template: TransferTargetTemplate) => {
    setSelectedTemplate(template)
    // Mixed templates with sections need a section step
    if (template.modality === 'mixed' && template.sections.length > 0) {
      setStep('section')
    }
    // Otherwise stay on template step — user clicks confirm
  }, [])

  const handleSectionSelect = useCallback((section: TransferTargetSection) => {
    setSelectedSection(section)
  }, [])

  const handleBack = useCallback(() => {
    if (step === 'section') {
      setSelectedTemplate(null)
      setSelectedSection(null)
      setStep('template')
    } else if (step === 'template') {
      setSelectedMeso(null)
      setSelectedTemplate(null)
      setStep('mesocycle')
    }
  }, [step])

  const handleConfirm = useCallback(() => {
    if (!selectedTemplate) return
    onConfirm({
      targetTemplateId: selectedTemplate.id,
      targetSectionId: selectedSection?.id,
    })
  }, [selectedTemplate, selectedSection, onConfirm])

  // Can confirm when: template selected (and section if needed)
  const canConfirm =
    selectedTemplate !== null &&
    (step !== 'section' || selectedSection !== null)

  const title = mode === 'copy' ? 'Copy to...' : 'Move to...'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Select a target mesocycle, template, and section
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
        )}

        {targets.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No available targets
          </p>
        )}

        {/* Step 1: Mesocycle selection */}
        {step === 'mesocycle' && targets.length > 0 && (
          <div className="space-y-1">
            {targets.map((meso) => (
              <button
                key={meso.id}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:bg-accent transition-colors"
                onClick={() => handleMesoSelect(meso)}
              >
                <div>
                  <span className="text-sm font-medium">{meso.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {meso.templates.length} template{meso.templates.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs capitalize">
                  {meso.status}
                </Badge>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Template selection */}
        {step === 'template' && selectedMeso && (
          <div className="space-y-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back"
              onClick={handleBack}
            >
              <ChevronLeft className="h-3 w-3" />
              {selectedMeso.name}
            </button>
            <div className="space-y-1">
              {selectedMeso.templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                    selectedTemplate?.id === tpl.id
                      ? 'border-primary bg-accent'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => handleTemplateSelect(tpl)}
                >
                  <span className="text-sm font-medium">{tpl.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {tpl.modality}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Section selection (mixed templates only) */}
        {step === 'section' && selectedTemplate && (
          <div className="space-y-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back"
              onClick={handleBack}
            >
              <ChevronLeft className="h-3 w-3" />
              {selectedTemplate.name}
            </button>
            <p className="text-sm text-muted-foreground">Select a section:</p>
            <div className="space-y-1">
              {selectedTemplate.sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`flex w-full items-center rounded-lg border px-3 py-2 text-left transition-colors ${
                    selectedSection?.id === section.id
                      ? 'border-primary bg-accent'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => handleSectionSelect(section)}
                >
                  <span className="text-sm font-medium">{section.section_name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Confirm button — visible on template step (non-mixed or mixed w/o sections) and section step */}
        {(step === 'template' && selectedTemplate && (selectedTemplate.modality !== 'mixed' || selectedTemplate.sections.length === 0)) || (step === 'section') ? (
          <DialogFooter>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || isPending}
            >
              {isPending ? 'Transferring...' : 'Confirm'}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
