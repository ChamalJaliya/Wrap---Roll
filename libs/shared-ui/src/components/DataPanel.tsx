import * as React from "react"
import { cn } from "../lib/utils"

export interface DataPanelProps extends React.HTMLAttributes<HTMLDivElement> {}

function DataPanel({ className, ...props }: DataPanelProps) {
  return <div className={cn("stat-card", className)} {...props} />
}

export { DataPanel }
