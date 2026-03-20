"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string // YYYY-MM-DD format
  onChange: (date: string) => void
  placeholder?: string
  disabled?: boolean
  disabledDates?: (date: Date) => boolean
}

export function DatePicker({ value, onChange, placeholder = "DD/MM/YYYY", disabled = false, disabledDates }: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value + 'T00:00:00') : undefined
  )

  React.useEffect(() => {
    setDate(value ? new Date(value + 'T00:00:00') : undefined)
  }, [value])

  const handleSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
    if (selectedDate) {
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      onChange(`${year}-${month}-${day}`)
    } else {
      onChange('')
    }
  }

  const displayValue = date
    ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
    : placeholder

  return (
    <Popover modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 z-[200]"
        align="start"
        side="bottom"
        sideOffset={8}
        avoidCollisions={false}
        sticky="always"
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          defaultMonth={date}
          disabled={disabledDates}
          autoFocus
          className="rounded-md border"
        />
      </PopoverContent>
    </Popover>
  )
}
