import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm px-4 py-3 text-base shadow-sm transition-all duration-200 outline-none",
        "hover:border-border focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:shadow-[0_0_15px_rgba(var(--primary)/0.1)]",
        "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
