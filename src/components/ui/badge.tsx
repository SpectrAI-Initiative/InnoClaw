import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-sm [a&]:hover:bg-primary/90",
        secondary:
          "border-border/50 bg-secondary/80 text-secondary-foreground [a&]:hover:bg-secondary",
        destructive:
          "border-transparent bg-destructive text-white shadow-sm [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border/50 text-foreground [a&]:hover:bg-accent/10 [a&]:hover:border-accent/50",
        ghost: "border-transparent [a&]:hover:bg-accent/10 [a&]:hover:text-accent-foreground",
        link: "border-transparent text-primary underline-offset-4 [a&]:hover:underline",
        glow: "border-primary/30 bg-primary/10 text-primary [a&]:hover:bg-primary/20 [a&]:hover:border-primary/50",
        success: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        warning: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
        info: "border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
