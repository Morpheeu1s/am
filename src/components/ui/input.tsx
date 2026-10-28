import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  warning?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, warning, style, ...props }, ref) => {
    return (
      <input
        type={type}
        style={{
          borderRadius: 9999,
          backgroundColor: '#282a2c',
          border: error
            ? '1.5px solid #f2b8b5'
            : warning
            ? '1.5px solid #fbbc04'
            : '1.5px solid #444746',
          ...style
        }}
        className={cn(
          'flex h-13 w-full px-6 py-3 text-base text-[#e3e3e3] placeholder:text-[#8e918f] transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40',
          error
            ? 'focus-visible:ring-[#f2b8b5]/30 text-[#f2b8b5]'
            : warning
            ? 'focus-visible:ring-[#fbbc04]/30 text-[#ffe082]'
            : 'focus-visible:border-[#a8c7fa] focus-visible:ring-[#a8c7fa]/30',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
