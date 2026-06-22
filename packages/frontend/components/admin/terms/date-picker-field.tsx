"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { parseDateString } from "@/components/admin/terms/term-types"

interface DatePickerFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  fromDate?: Date
  toDate?: Date
  className?: string
}

export function DatePickerField({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  fromDate,
  toDate,
  className,
}: DatePickerFieldProps) {
  const selectedDate = parseDateString(value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full min-w-0 justify-start gap-2 text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="truncate">
            {selectedDate ? format(selectedDate, "PPP") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return
            onChange(format(date, "yyyy-MM-dd"))
          }}
          disabled={(date) => {
            if (fromDate && date < fromDate) return true
            if (toDate && date > toDate) return true
            return false
          }}
          defaultMonth={selectedDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
