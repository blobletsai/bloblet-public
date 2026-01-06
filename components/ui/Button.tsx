import React from 'react'
import { useSound } from '@/src/hooks/useSound'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-br from-fantasy-accent to-fantasy-border
    text-white
    border border-white/30
    shadow-[0_12px_28px_rgba(255,45,215,0.45)]
    hover:brightness-110 hover:-translate-y-0.5
    active:translate-y-0
  `,
  secondary: `
    bg-gradient-to-br from-fantasy-border to-fantasy-card
    text-fantasy-primary
    border border-fantasy-border/50
    shadow-[0_8px_20px_rgba(107,61,204,0.3)]
    hover:border-fantasy-border hover:brightness-110
  `,
  ghost: `
    bg-fantasy-card/70
    text-fantasy-primary
    border border-fantasy-border/50
    hover:border-fantasy-accent/80 hover:bg-fantasy-card/90
  `,
  danger: `
    bg-gradient-to-br from-fantasy-danger to-[#cc1560]
    text-white
    border border-white/30
    shadow-[0_12px_28px_rgba(255,26,117,0.4)]
    hover:brightness-110 hover:-translate-y-0.5
    active:translate-y-0
  `,
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs-game',
  md: 'px-4 py-2 text-sm-game',
  lg: 'px-6 py-3 text-base-game',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      className = '',
      children,
      onClick,
      onMouseEnter,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading
    const { play } = useSound()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        play('ui_select')
        onClick?.(e)
      }
    }

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        play('ui_hover', 0.15) // Subtle hover volume
        onMouseEnter?.(e)
      }
    }

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        className={`
          inline-flex items-center justify-center
          rounded-full
          font-game
          letter-spacing-[0.04em]
          transition-all duration-200
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-pulse">•••</span>
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
