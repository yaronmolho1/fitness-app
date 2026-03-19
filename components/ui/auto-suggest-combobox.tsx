'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface AutoSuggestComboboxProps {
  items: string[]
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  className?: string
}

export function AutoSuggestCombobox({
  items,
  value,
  onChange,
  label,
  placeholder,
  className,
}: AutoSuggestComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()

  // Filter out empty/null values
  const validItems = React.useMemo(
    () => items.filter((item) => item.length > 0),
    [items]
  )

  // Sync external value changes
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  const filtered = React.useMemo(() => {
    if (!inputValue) return validItems
    const lower = inputValue.toLowerCase()
    return validItems.filter((item) => item.toLowerCase().includes(lower))
  }, [inputValue, validItems])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value
    setInputValue(newVal)
    onChange(newVal)
    if (!open) setOpen(true)
  }

  function handleSelect(item: string) {
    setInputValue(item)
    onChange(item)
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleFocus() {
    setOpen(true)
  }

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on Escape
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && filtered.length > 0

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        autoComplete="off"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'min-h-[44px]' // mobile touch target
        )}
      />
      {showDropdown && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          className={cn(
            'absolute z-50 mt-1 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            'max-h-[200px]'
          )}
        >
          {filtered.map((item) => (
            <li
              key={item}
              role="option"
              aria-selected={item === inputValue}
              onMouseDown={(e) => {
                // Prevent input blur before selection fires
                e.preventDefault()
              }}
              onClick={() => handleSelect(item)}
              className={cn(
                'relative flex cursor-pointer select-none items-center rounded-sm px-2 text-sm outline-none',
                'min-h-[44px]', // mobile touch target
                'hover:bg-accent hover:text-accent-foreground',
                'truncate',
                item === inputValue && 'bg-accent text-accent-foreground'
              )}
            >
              {item === inputValue && (
                <Check className="mr-2 h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
