import React from 'react'
import { cn } from '@/utils/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-lg font-semibold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-0 active:translate-y-[1px]'
    
    const variants = {
      default: 'bg-primary-600 text-white shadow-sm hover:bg-primary-500 hover:shadow-primary-600/30',
      outline: 'border border-[hsl(var(--border))] bg-transparent text-white hover:bg-[hsl(var(--muted))]',
      secondary: 'bg-[hsl(var(--secondary))] text-white hover:opacity-90',
      ghost: 'text-white/80 hover:bg-[hsl(var(--muted))]',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
    }
    
    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 px-6 text-lg',
    }

    return (
      <button
        className={cn(
          baseClasses,
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

