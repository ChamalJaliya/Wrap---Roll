"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const nativeSelectVariants = cva(
  "flex h-12 w-full appearance-none rounded-[var(--radius-md)] border bg-muted/50 px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-[var(--transition-standard)]",
  {
    variants: {
      variant: {
        default:
          "border-white/10 bg-[hsl(var(--color-onyx-soft))] text-white focus-visible:ring-[hsl(var(--primary))]",
        surface: "border-input text-foreground focus-visible:ring-ring",
      },
    },
    defaultVariants: {
      variant: "surface",
    },
  }
)

export interface NativeSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>,
    VariantProps<typeof nativeSelectVariants> {
  label?: string
  error?: string
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, variant, label, error, id, children, ...props }, ref) => {
    const surfaceLabel = variant === "surface"
    const selectId = id ?? React.useId()

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={selectId}
            className={cn(
              surfaceLabel
                ? "text-sm font-semibold text-foreground"
                : "ml-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground"
            )}
          >
            {label}
          </label>
        ) : null}
        <div className="relative w-full">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              nativeSelectVariants({ variant }),
              error && "border-red-500 focus-visible:ring-red-500",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="opacity-60"
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        {error ? (
          <span className="ml-1 text-[11px] font-semibold text-red-500">
            {error}
          </span>
        ) : null}
      </div>
    )
  }
)
NativeSelect.displayName = "NativeSelect"

export { NativeSelect, nativeSelectVariants }
