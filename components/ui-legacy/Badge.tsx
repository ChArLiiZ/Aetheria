import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center font-medium rounded-full';

    const variants = {
      default:
        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      primary:
        'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
      success:
        'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200',
      error:
        'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-200',
      warning:
        'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200',
      info: 'bg-info-100 text-info-800 dark:bg-info-900 dark:text-info-200',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-sm',
      lg: 'px-3 py-1 text-base',
    };

    return (
      <span
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
