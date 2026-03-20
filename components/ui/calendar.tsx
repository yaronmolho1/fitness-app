"use client"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { differenceInCalendarDays } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"
import {
  DayPicker,
  labelNext,
  labelPrevious,
  useDayPicker,
  type DayPickerProps,
} from "react-day-picker"

export type CalendarProps = DayPickerProps & {
  yearRange?: number
  showYearSwitcher?: boolean
  monthsClassName?: string
  monthCaptionClassName?: string
  weekdaysClassName?: string
  weekdayClassName?: string
  monthClassName?: string
  captionClassName?: string
  captionLabelClassName?: string
  buttonNextClassName?: string
  buttonPreviousClassName?: string
  navClassName?: string
  monthGridClassName?: string
  weekClassName?: string
  dayClassName?: string
  dayButtonClassName?: string
  rangeStartClassName?: string
  rangeEndClassName?: string
  selectedClassName?: string
  todayClassName?: string
  outsideClassName?: string
  disabledClassName?: string
  rangeMiddleClassName?: string
  hiddenClassName?: string
}

type NavView = "days" | "months" | "years"

function Calendar({
  className,
  showOutsideDays = true,
  showYearSwitcher = true,
  yearRange = 12,
  numberOfMonths,
  components,
  ...props
}: CalendarProps) {
  const [navView, setNavView] = React.useState<NavView>("days")
  const [month, setMonth] = React.useState<Date>(props.defaultMonth || new Date())
  const [displayYears, setDisplayYears] = React.useState<{
    from: number
    to: number
  }>(
    React.useMemo(() => {
      const currentYear = new Date().getFullYear()
      return {
        from: currentYear - Math.floor(yearRange / 2 - 1),
        to: currentYear + Math.ceil(yearRange / 2),
      }
    }, [yearRange])
  )

  const { onNextClick, onPrevClick, startMonth, endMonth } = props

  const columnsDisplayed = navView === "days" ? numberOfMonths : 1

  const _monthsClassName = cn("relative flex", props.monthsClassName)
  const _monthCaptionClassName = cn(
    "relative mx-10 flex h-7 items-center justify-center",
    props.monthCaptionClassName
  )
  const _weekdaysClassName = cn("flex flex-row", props.weekdaysClassName)
  const _weekdayClassName = cn(
    "w-8 text-sm font-normal text-muted-foreground",
    props.weekdayClassName
  )
  const _monthClassName = cn("w-full", props.monthClassName)
  const _captionClassName = cn(
    "relative flex items-center justify-center pt-1",
    props.captionClassName
  )
  const _captionLabelClassName = cn(
    "truncate text-sm font-medium",
    props.captionLabelClassName
  )
  const buttonNavClassName = buttonVariants({
    variant: "outline",
    className:
      "absolute h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
  })
  const _buttonNextClassName = cn(
    buttonNavClassName,
    "right-0",
    props.buttonNextClassName
  )
  const _buttonPreviousClassName = cn(
    buttonNavClassName,
    "left-0",
    props.buttonPreviousClassName
  )
  const _navClassName = cn("flex items-start", props.navClassName)
  const _monthGridClassName = cn("mx-auto mt-4", props.monthGridClassName)
  const _weekClassName = cn("mt-2 flex w-max items-start", props.weekClassName)
  const _dayClassName = cn(
    "flex size-8 flex-1 items-center justify-center p-0 text-sm",
    props.dayClassName
  )
  const _dayButtonClassName = cn(
    buttonVariants({ variant: "ghost" }),
    "size-8 rounded-md p-0 font-normal transition-none aria-selected:opacity-100",
    props.dayButtonClassName
  )
  const buttonRangeClassName =
    "bg-accent [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground"
  const _rangeStartClassName = cn(
    buttonRangeClassName,
    "day-range-start rounded-s-md",
    props.rangeStartClassName
  )
  const _rangeEndClassName = cn(
    buttonRangeClassName,
    "day-range-end rounded-e-md",
    props.rangeEndClassName
  )
  const _rangeMiddleClassName = cn(
    "bg-accent !text-foreground [&>button]:bg-transparent [&>button]:!text-foreground [&>button]:hover:bg-transparent [&>button]:hover:!text-foreground",
    props.rangeMiddleClassName
  )
  const _selectedClassName = cn(
    "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
    props.selectedClassName
  )
  const _todayClassName = cn(
    "[&>button]:bg-accent [&>button]:text-accent-foreground",
    props.todayClassName
  )
  const _outsideClassName = cn(
    "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
    props.outsideClassName
  )
  const _disabledClassName = cn(
    "text-muted-foreground opacity-50",
    props.disabledClassName
  )
  const _hiddenClassName = cn("invisible flex-1", props.hiddenClassName)

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      month={month}
      onMonthChange={setMonth}
      style={{
        width: 248.8 * (columnsDisplayed ?? 1) + "px",
      }}
      classNames={{
        months: _monthsClassName,
        month_caption: _monthCaptionClassName,
        weekdays: _weekdaysClassName,
        weekday: _weekdayClassName,
        month: _monthClassName,
        caption: _captionClassName,
        caption_label: _captionLabelClassName,
        button_next: _buttonNextClassName,
        button_previous: _buttonPreviousClassName,
        nav: _navClassName,
        month_grid: _monthGridClassName,
        week: _weekClassName,
        day: _dayClassName,
        day_button: _dayButtonClassName,
        range_start: _rangeStartClassName,
        range_middle: _rangeMiddleClassName,
        range_end: _rangeEndClassName,
        selected: _selectedClassName,
        today: _todayClassName,
        outside: _outsideClassName,
        disabled: _disabledClassName,
        hidden: _hiddenClassName,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4" />
        },
        Nav: ({ className }) => (
          <Nav
            className={className}
            displayYears={displayYears}
            navView={navView}
            setDisplayYears={setDisplayYears}
            setMonth={setMonth}
            month={month}
            startMonth={startMonth}
            endMonth={endMonth}
            onPrevClick={onPrevClick}
            onNextClick={onNextClick}
          />
        ),
        CaptionLabel: (props) => (
          <CaptionLabel
            showYearSwitcher={showYearSwitcher}
            navView={navView}
            setNavView={setNavView}
            displayYears={displayYears}
            month={month}
            {...props}
          />
        ),
        MonthGrid: ({ className, children, ...props }) => (
          <MonthGrid
            className={className}
            displayYears={displayYears}
            setMonth={setMonth}
            startMonth={startMonth}
            endMonth={endMonth}
            navView={navView}
            setNavView={setNavView}
            month={month}
            {...props}
          >
            {children}
          </MonthGrid>
        ),
        ...components,
      }}
      numberOfMonths={columnsDisplayed}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

function Nav({
  className,
  navView,
  month,
  startMonth,
  endMonth,
  displayYears,
  setDisplayYears,
  setMonth,
  onPrevClick,
  onNextClick,
}: {
  className?: string
  navView: NavView
  month: Date
  startMonth?: Date
  endMonth?: Date
  displayYears: { from: number; to: number }
  setDisplayYears: React.Dispatch<
    React.SetStateAction<{ from: number; to: number }>
  >
  setMonth: React.Dispatch<React.SetStateAction<Date>>
  onPrevClick?: (date: Date) => void
  onNextClick?: (date: Date) => void
}) {
  const { nextMonth, previousMonth } = useDayPicker()

  const isPreviousDisabled = (() => {
    if (navView === "years") {
      return (
        (startMonth &&
          differenceInCalendarDays(
            new Date(displayYears.from - 1, 0, 1),
            startMonth
          ) < 0) ||
        (endMonth &&
          differenceInCalendarDays(
            new Date(displayYears.from - 1, 0, 1),
            endMonth
          ) > 0)
      )
    }
    if (navView === "months") {
      const currentYear = month.getFullYear()
      const prevYear = currentYear - 1

      return (
        (startMonth && new Date(prevYear, 11, 31) < startMonth) ||
        (endMonth && new Date(prevYear, 0, 1) > endMonth)
      )
    }
    return !previousMonth
  })()

  const isNextDisabled = (() => {
    if (navView === "years") {
      return (
        (startMonth &&
          differenceInCalendarDays(
            new Date(displayYears.to + 1, 0, 1),
            startMonth
          ) < 0) ||
        (endMonth &&
          differenceInCalendarDays(
            new Date(displayYears.to + 1, 0, 1),
            endMonth
          ) > 0)
      )
    }
    if (navView === "months") {
      const currentYear = month.getFullYear()
      const nextYear = currentYear + 1

      return (
        (startMonth && new Date(nextYear, 0, 1) < startMonth) ||
        (endMonth && new Date(nextYear, 11, 31) > endMonth)
      )
    }
    return !nextMonth
  })()

  const handlePreviousClick = React.useCallback(() => {
    if (navView === "years") {
      setDisplayYears((prev: { from: number; to: number }) => {
        const range = prev.to - prev.from + 1
        const newFrom = prev.from - range
        const newTo = prev.to - range
        onPrevClick?.(new Date(newFrom, 0, 1))
        return { from: newFrom, to: newTo }
      })
      return
    }
    if (navView === "months") {
      setMonth((prevMonth: Date) => {
        const currentYear = prevMonth.getFullYear()
        const currentMonth = prevMonth.getMonth()
        const prevYear = new Date(currentYear - 1, currentMonth, 1)
        onPrevClick?.(prevYear)
        return prevYear
      })
      return
    }
    if (!previousMonth) return
    setMonth(previousMonth)
    onPrevClick?.(previousMonth)
  }, [previousMonth, setMonth, navView, setDisplayYears, onPrevClick])

  const handleNextClick = React.useCallback(() => {
    if (navView === "years") {
      setDisplayYears((prev: { from: number; to: number }) => {
        const range = prev.to - prev.from + 1
        const newFrom = prev.from + range
        const newTo = prev.to + range
        onNextClick?.(new Date(newFrom, 0, 1))
        return { from: newFrom, to: newTo }
      })
      return
    }
    if (navView === "months") {
      setMonth((prevMonth: Date) => {
        const currentYear = prevMonth.getFullYear()
        const currentMonth = prevMonth.getMonth()
        const nextYear = new Date(currentYear + 1, currentMonth, 1)
        onNextClick?.(nextYear)
        return nextYear
      })
      return
    }
    if (!nextMonth) return
    setMonth(nextMonth)
    onNextClick?.(nextMonth)
  }, [setMonth, nextMonth, navView, setDisplayYears, onNextClick])
  return (
    <nav className={cn("flex items-center", className)}>
      <Button
        variant="outline"
        className="absolute left-0 h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100"
        type="button"
        tabIndex={isPreviousDisabled ? undefined : -1}
        disabled={isPreviousDisabled}
        aria-label={
          navView === "years"
            ? `Go to the previous ${
                displayYears.to - displayYears.from + 1
              } years`
            : labelPrevious(previousMonth)
        }
        onClick={handlePreviousClick}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        className="absolute right-0 h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100"
        type="button"
        tabIndex={isNextDisabled ? undefined : -1}
        disabled={isNextDisabled}
        aria-label={
          navView === "years"
            ? `Go to the next ${displayYears.to - displayYears.from + 1} years`
            : labelNext(nextMonth)
        }
        onClick={handleNextClick}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

function CaptionLabel({
  children,
  showYearSwitcher,
  navView,
  setNavView,
  displayYears,
  month,
  ...props
}: {
  showYearSwitcher?: boolean
  navView: NavView
  setNavView: React.Dispatch<React.SetStateAction<NavView>>
  displayYears: { from: number; to: number }
  month: Date
} & React.HTMLAttributes<HTMLSpanElement>) {
  if (!showYearSwitcher) return <span {...props}>{children}</span>

  const currentYear = month.getFullYear()

  const handleClick = () => {
    if (navView === "days") {
      setNavView("months")
    } else if (navView === "months") {
      setNavView("years")
    } else {
      setNavView("days")
    }
  }

  return (
    <Button
      className="h-7 w-full truncate text-sm font-medium"
      variant="ghost"
      size="sm"
      onClick={handleClick}
    >
      {navView === "days"
        ? children
        : navView === "months"
        ? currentYear
        : displayYears.from + " - " + displayYears.to}
    </Button>
  )
}

function MonthGrid({
  className,
  children,
  displayYears,
  startMonth,
  endMonth,
  navView,
  setNavView,
  setMonth,
  month,
  ...props
}: {
  className?: string
  children: React.ReactNode
  displayYears: { from: number; to: number }
  startMonth?: Date
  endMonth?: Date
  navView: NavView
  setNavView: React.Dispatch<React.SetStateAction<NavView>>
  setMonth: React.Dispatch<React.SetStateAction<Date>>
  month: Date
} & React.TableHTMLAttributes<HTMLTableElement>) {
  if (navView === "years") {
    return (
      <YearGrid
        displayYears={displayYears}
        startMonth={startMonth}
        endMonth={endMonth}
        setNavView={setNavView}
        setMonth={setMonth}
        month={month}
        className={className}
        {...props}
      />
    )
  }
  if (navView === "months") {
    return (
      <MonthsGrid
        startMonth={startMonth}
        endMonth={endMonth}
        setNavView={setNavView}
        setMonth={setMonth}
        month={month}
        className={className}
        {...props}
      />
    )
  }
  return (
    <table className={className} {...props}>
      {children}
    </table>
  )
}

function YearGrid({
  className,
  displayYears,
  startMonth,
  endMonth,
  setNavView,
  setMonth,
  month,
  ...props
}: {
  className?: string
  displayYears: { from: number; to: number }
  startMonth?: Date
  endMonth?: Date
  setNavView: React.Dispatch<React.SetStateAction<NavView>>
  setMonth: React.Dispatch<React.SetStateAction<Date>>
  month: Date
} & React.HTMLAttributes<HTMLDivElement>) {

  return (
    <div className={cn("grid grid-cols-4 gap-y-2", className)} {...props}>
      {Array.from(
        { length: displayYears.to - displayYears.from + 1 },
        (_, i) => {
          const isBefore =
            differenceInCalendarDays(
              new Date(displayYears.from + i, 11, 31),
              startMonth!
            ) < 0

          const isAfter =
            differenceInCalendarDays(
              new Date(displayYears.from + i, 0, 0),
              endMonth!
            ) > 0

          const isDisabled = isBefore || isAfter
          return (
            <Button
              key={i}
              className={cn(
                "h-7 w-full text-sm font-normal text-foreground",
                displayYears.from + i === new Date().getFullYear() &&
                  "bg-accent font-medium text-accent-foreground"
              )}
              variant="ghost"
              onClick={() => {
                setMonth(
                  new Date(
                    displayYears.from + i,
                    month.getMonth(),
                    1
                  )
                )
                setNavView("months")
              }}
              disabled={isDisabled}
            >
              {displayYears.from + i}
            </Button>
          )
        }
      )}
    </div>
  )
}

function MonthsGrid({
  className,
  startMonth,
  endMonth,
  setNavView,
  setMonth,
  month,
  ...props
}: {
  className?: string
  startMonth?: Date
  endMonth?: Date
  setNavView: React.Dispatch<React.SetStateAction<NavView>>
  setMonth: React.Dispatch<React.SetStateAction<Date>>
  month: Date
} & React.HTMLAttributes<HTMLDivElement>) {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ]

  const currentYear = month.getFullYear()
  const currentMonth = new Date().getMonth()
  const currentYearNow = new Date().getFullYear()

  return (
    <div className={cn("grid grid-cols-4 gap-y-2", className)} {...props}>
      {monthNames.map((monthName, monthIndex) => {
        const monthDate = new Date(currentYear, monthIndex, 1)

        const isBefore = startMonth && differenceInCalendarDays(
          new Date(currentYear, monthIndex, 31),
          startMonth
        ) < 0

        const isAfter = endMonth && differenceInCalendarDays(
          new Date(currentYear, monthIndex, 0),
          endMonth
        ) > 0

        const isDisabled = isBefore || isAfter
        const isCurrentMonth = monthIndex === currentMonth && currentYear === currentYearNow

        return (
          <Button
            key={monthIndex}
            className={cn(
              "h-7 w-full text-sm font-normal text-foreground",
              isCurrentMonth && "bg-accent font-medium text-accent-foreground"
            )}
            variant="ghost"
            onClick={() => {
              setNavView("days")
              setMonth(monthDate)
            }}
            disabled={isDisabled}
          >
            {monthName}
          </Button>
        )
      })}
    </div>
  )
}

export { Calendar }
