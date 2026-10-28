import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  indicatorColor?: string
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, indicatorColor, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))

    return (
      <div
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-[#333538]', className)}
        {...props}
      >
        <div
          className={cn(
            'h-full w-full flex-1 transition-all duration-400 ease-out rounded-full',
            indicatorColor || 'bg-gradient-to-r from-[#1a73e8] via-[#8ab4f8] to-[#c084fc] shadow-sm shadow-blue-500/30'
          )}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'
