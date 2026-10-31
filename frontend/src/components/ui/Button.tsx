import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pipeyellow focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none rounded-sm border';

    const variants = {
      primary:
        'bg-pipeyellow border-pipeblack text-pipeblack hover:bg-pipeyellow-hover active:bg-pipeyellow-hover shadow-industrial-sm font-semibold',
      secondary:
        'bg-pipeblack border-pipeblack text-white hover:bg-pipeblack-soft active:bg-black shadow-industrial-sm',
      outline:
        'bg-white border-pipeblack text-pipeblack hover:bg-cream-200 active:bg-cream-300 shadow-industrial-sm',
      danger:
        'bg-pipestatus-critical border-pipestatus-critical text-white hover:bg-red-700 active:bg-red-800 shadow-industrial-sm',
      ghost:
        'bg-transparent border-transparent text-pipeblack hover:bg-cream-200 active:bg-cream-300',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-sm gap-2',
      lg: 'h-11 px-5 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

