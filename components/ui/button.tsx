import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#00B4D8] text-white hover:bg-[#00a3c4] shadow-lg shadow-[#00B4D8]/20",
        destructive:
          "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20",
        outline:
          "border border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white",
        secondary:
          "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-white/10",
        ghost: "hover:bg-white/5 hover:text-white text-slate-400",
        link: "text-[#00B4D8] underline-offset-4 hover:underline",
        success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20",
        warning: "bg-amber-500 text-white hover:bg-amber-400 shadow-lg shadow-amber-500/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
