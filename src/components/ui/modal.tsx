import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, description, children, className }: ModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal / Material 3 Surface */}
      <div
        style={{
          borderRadius: 32,
          backgroundColor: '#282a2c',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 16px 48px -8px rgba(0, 0, 0, 0.7)'
        }}
        className={cn(
          'relative z-50 w-full max-w-lg p-6 text-[#e3e3e3] transition-all duration-300 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-5',
          className
        )}
      >
        {/* Material 3 Drag Handle on mobile */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#444746] sm:hidden" />

        <div className="flex items-center justify-between pb-3">
          <div>
            {title && <h2 className="text-xl font-bold tracking-tight text-[#e3e3e3] font-outfit">{title}</h2>}
            {description && <p className="text-xs text-[#c4c7c5] mt-0.5">{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-full text-[#c4c7c5] hover:bg-[#333538] hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  )
}
