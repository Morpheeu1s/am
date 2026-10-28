import * as React from 'react'
import { cn } from '@/lib/utils'
import { playFeedback, type FeedbackSound } from '@/lib/audio'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'glass' | 'labs' | 'tonal'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  feedback?: FeedbackSound
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', feedback = 'click', onClick, children, disabled, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled) {
        playFeedback(feedback)
      }
      onClick?.(e)
    }

    // Material 3 / Google Labs button shape: Pill rounded-full, subtle ripple scale
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 select-none cursor-pointer focus:outline-none disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.97]'

    const variants = {
      default:
        'bg-[#282a2c] text-[#e3e3e3] hover:bg-[#333538] border border-[#444746]/50 shadow-sm active:bg-[#3c4043] rounded-full',
      primary:
        'bg-[#a8c7fa] text-[#041e49] hover:bg-[#c2e7ff] shadow-md shadow-blue-500/20 active:bg-[#8ab4f8] font-semibold rounded-full',
      secondary:
        'bg-[#1e1f20] text-[#c4c7c5] hover:bg-[#282a2c] hover:text-[#e3e3e3] border border-[#3c4043]/60 active:bg-[#333538] rounded-full',
      tonal:
        'bg-[#394457] text-[#c2e7ff] hover:bg-[#435166] active:bg-[#2e3747] font-medium rounded-full',
      outline:
        'border border-[#444746] bg-transparent text-[#e3e3e3] hover:bg-[#282a2c]/80 hover:border-[#8ab4f8] active:bg-[#333538] rounded-full',
      ghost:
        'text-[#c4c7c5] hover:text-[#e3e3e3] hover:bg-[#282a2c]/60 active:bg-[#333538] rounded-full',
      destructive:
        'bg-[#f2b8b5] text-[#601410] hover:bg-[#f9dedc] active:bg-[#ec928e] font-semibold rounded-full',
      glass:
        'bg-[#1e1f20]/90 backdrop-blur-md text-[#e3e3e3] border border-[#444746]/60 hover:bg-[#282a2c] active:bg-[#333538] shadow-sm rounded-full',
      labs:
        'bg-gradient-to-r from-[#1a73e8] via-[#7c3aed] to-[#d946ef] text-white hover:opacity-95 shadow-lg shadow-purple-500/25 active:scale-95 font-semibold rounded-full'
    }

    const sizes = {
      sm: 'h-8 px-3.5 text-xs rounded-full gap-1.5',
      md: 'h-11 px-5 text-sm rounded-full gap-2',
      lg: 'h-13 px-6 text-base rounded-full gap-2.5 font-semibold',
      icon: 'h-10 w-10 p-0 rounded-full flex items-center justify-center'
    }

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
