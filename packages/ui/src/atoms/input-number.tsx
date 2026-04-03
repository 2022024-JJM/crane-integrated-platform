import { useCallback, useRef, useState, type InputHTMLAttributes } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { cn } from '@crane/core/lib/utils'

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

  const increment = useCallback(() => {
    onChange(clamp(value + step))
  }, [onChange, clamp, value, step])

  const decrement = useCallback(() => {
    onChange(clamp(value - step))
  }, [onChange, clamp, value, step])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commit(e.currentTarget.value)
      e.currentTarget.blur()
    } else if (e.key === "Escape") {
      setDraft(null)
      e.currentTarget.blur()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      increment()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      decrement()
    }
    onKeyDown?.(e)
  }

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-lg border border-border bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
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
        className="min-w-0 flex-1 bg-transparent px-2.5 text-sm tabular-nums outline-none disabled:pointer-events-none disabled:opacity-50"
        {...props}
      />
      <div className="flex flex-col border-l border-border">
        <button
          type="button"
          tabIndex={-1}
          onClick={increment}
          className="flex flex-1 items-center justify-center px-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
        >
          <ChevronUp className="size-3" />
        </button>
        <div className="border-t border-border" />
        <button
          type="button"
          tabIndex={-1}
          onClick={decrement}
          className="flex flex-1 items-center justify-center px-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  )
}

export { InputNumber }
export type { InputNumberProps }
