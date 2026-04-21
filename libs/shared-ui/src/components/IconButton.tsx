import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const iconButtonVariants = cva(
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "hover:bg-primary/10 hover:text-primary",
        destructive: "hover:bg-red-50 hover:text-red-500",
        muted: "hover:bg-neutral-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  "aria-label": string
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, type = "button", ...props }, ref) => (
    <button
      type={type}
      ref={ref}
      className={cn(iconButtonVariants({ variant }), className)}
      {...props}
    />
  )
)
IconButton.displayName = "IconButton"

export { IconButton, iconButtonVariants }
