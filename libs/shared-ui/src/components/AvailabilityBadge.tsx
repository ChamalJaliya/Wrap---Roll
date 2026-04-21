import * as React from "react"
import { Badge } from "./ui/badge"
import { cn } from "../lib/utils"

export type AvailabilityStatus = "available" | "sold_out" | "limited"

const MAP: Record<
  AvailabilityStatus,
  { variant: "success" | "destructive" | "warning"; label: string }
> = {
  available: { variant: "success", label: "Available" },
  sold_out: { variant: "destructive", label: "Sold out" },
  limited: { variant: "warning", label: "Limited" },
}

export interface AvailabilityBadgeProps {
  status: AvailabilityStatus
  className?: string
}

function AvailabilityBadge({ status, className }: AvailabilityBadgeProps) {
  const { variant, label } = MAP[status]
  return (
    <Badge
      variant={variant}
      className={cn(
        "text-xs font-medium normal-case tracking-normal",
        className
      )}
    >
      {label}
    </Badge>
  )
}

export { AvailabilityBadge }
