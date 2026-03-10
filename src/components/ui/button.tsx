import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-lg hover:shadow-primary/25 hover:from-primary/90 hover:to-primary/80 active:scale-[0.98]",
        destructive:
          "bg-gradient-to-r from-destructive to-destructive/90 text-white shadow-md hover:shadow-lg hover:shadow-destructive/25 hover:from-destructive/90 hover:to-destructive/80 active:scale-[0.98]",
        outline:
          "border border-border/50 bg-background/50 backdrop-blur-sm shadow-sm hover:bg-accent/10 hover:text-accent-foreground hover:border-accent/50 active:scale-[0.98]",
        secondary:
          "bg-secondary/80 text-secondary-foreground shadow-sm hover:bg-secondary hover:shadow-md active:scale-[0.98]",
        ghost:
          "hover:bg-accent/10 hover:text-accent-foreground active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
        cyber:
          "relative bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] text-primary-foreground shadow-lg shadow-primary/20 hover:bg-[position:100%_0] hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all duration-500",
        glow:
          "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(var(--primary)/0.3)] active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-5 py-2.5 has-[>svg]:px-4",
        xs: "h-7 gap-1 rounded-md px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 rounded-lg gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-11 rounded-lg px-7 has-[>svg]:px-5 text-base",
        xl: "h-12 rounded-xl px-8 has-[>svg]:px-6 text-base font-semibold",
        icon: "size-10",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-11 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
