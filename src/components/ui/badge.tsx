import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'outline' | 'success' | 'warning'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-[#282a2c] text-[#c4c7c5] border-[#444746]/60',
    noun: 'bg-[#004a77]/60 text-[#c2e7ff] border-[#004a77]',
    verb: 'bg-[#0f5223]/60 text-[#c4eed0] border-[#0f5223]',
    adjective: 'bg-[#381e72]/60 text-[#e8def8] border-[#4f378b]',
    adverb: 'bg-[#5c3e00]/60 text-[#ffe082] border-[#7c5800]',
    phrase: 'bg-[#5c1d32]/60 text-[#ffd8e4] border-[#7d2946]',
    outline: 'border border-[#444746] text-[#c4c7c5] bg-transparent',
    success: 'bg-[#0f5223]/70 text-[#c4eed0] border-[#1e8e3e]/50',
    warning: 'bg-[#5c3e00]/70 text-[#ffe082] border-[#f29900]/50'
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors',
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  )
}
