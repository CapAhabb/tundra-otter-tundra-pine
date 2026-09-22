import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors duration-[var(--motion-fast,250ms)] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#12342f] text-white hover:bg-[#1b4c44]",
        secondary: "bg-[#eef3ed] text-[#66736f] border border-[rgba(18,52,47,0.14)] hover:bg-[#dbe6dd]",
        ghost: "bg-transparent text-[#162823] hover:bg-[#eef3ed]",
        night: "bg-[#286f98] text-white hover:bg-[#286f98]/90",
      },
      size: {
        default: "h-11 rounded-[var(--radius-md)] px-5 text-sm",
        lg: "h-12 rounded-[var(--radius-lg)] px-6 text-base",
        xl: "h-14 rounded-[var(--radius-lg)] px-7 text-base",
        sm: "h-9 rounded-[var(--radius-sm)] px-3 text-sm",
        icon: "size-11 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
