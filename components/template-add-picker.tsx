'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'

export type PickerSelection = 'resistance' | 'running' | 'mma' | 'mixed' | 'from-existing'

type Props = {
  onSelect: (selection: PickerSelection) => void
}

const OPTIONS: { value: PickerSelection; label: string }[] = [
  { value: 'resistance', label: 'Resistance' },
  { value: 'running', label: 'Running' },
  { value: 'mma', label: 'MMA/BJJ' },
  { value: 'mixed', label: 'Mixed Workout' },
  { value: 'from-existing', label: 'From Existing' },
]

export function TemplateAddPicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  function handleSelect(value: PickerSelection) {
    setOpen(false)
    onSelect(value)
  }

  const optionButtons = OPTIONS.map((opt) => (
    <Button
      key={opt.value}
      variant="ghost"
      className="w-full justify-start min-h-[44px]"
      onClick={() => handleSelect(opt.value)}
    >
      {opt.label}
    </Button>
  ))

  if (isMobile) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Template
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle>Add Template</SheetTitle>
              <SheetDescription className="sr-only">Choose a template type to add</SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-1">
              {optionButtons}
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add Template
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <div className="flex flex-col gap-0.5">
          {optionButtons}
        </div>
      </PopoverContent>
    </Popover>
  )
}
