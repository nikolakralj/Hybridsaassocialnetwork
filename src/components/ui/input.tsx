import * as React from "react";

import { cn } from "./utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-gray-400 placeholder:font-normal selection:bg-blue-200 selection:text-gray-900 dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-lg border px-3 py-1 text-base text-gray-900 bg-white transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-blue-500 focus-visible:ring-blue-500/30 focus-visible:ring-3 focus-visible:bg-white",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          "hover:border-gray-500 hover:bg-white cursor-text",
          "border-gray-300",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };