import { useCallback, useRef, useState, type InputHTMLAttributes } from "react"

import { cn } from "@/shared/lib/utils"

interface InputNumberProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

function InputNumber({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  onBlur,
  onKeyDown,
  ...props
}: InputNumberProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const clamp = useCallback(
    (v: number) => {
      let result = v
      if (min !== undefined) result = Math.max(min, result)
      if (max !== undefined) result = Math.min(max, result)
      return result
    },
    [min, max],
  )

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw)
      if (!Number.isNaN(parsed)) {
        onChange(clamp(parsed))
      }
      setDraft(null)
    },
    [onChange, clamp],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commit(e.currentTarget.value)
      e.currentTarget.blur()
    } else if (e.key === "Escape") {
      setDraft(null)
      e.currentTarget.blur()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      onChange(clamp(value + step))
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      onChange(clamp(value - step))
    }
    onKeyDown?.(e)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={draft ?? value}
      onChange={(e) => {
        const v = e.target.value
        if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) {
          setDraft(v)
        }
      }}
      onBlur={(e) => {
        if (draft !== null) commit(draft)
        onBlur?.(e)
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm tabular-nums outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { InputNumber }
export type { InputNumberProps }
