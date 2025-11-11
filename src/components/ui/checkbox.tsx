"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox@1.1.4";
import { Check, Minus } from "lucide-react";

import { cn } from "./utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-5 w-5 shrink-0 rounded border-2 transition-all duration-200",
      "border-gray-300 bg-white",
      "hover:border-gray-400 hover:bg-gray-50",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
      "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white data-[state=checked]:shadow-sm",
      "data-[state=indeterminate]:bg-blue-600 data-[state=indeterminate]:border-blue-600 data-[state=indeterminate]:text-white data-[state=indeterminate]:shadow-sm",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-white")}>
      {props.checked === "indeterminate" ? (
        <Minus className="h-4 w-4 stroke-[3]" />
      ) : (
        <Check className="h-4 w-4 stroke-[3]" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };