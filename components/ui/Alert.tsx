import React from 'react';
import { cn } from '@/lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  icon?: React.ReactNode;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, icon, children, ...props }, ref) => {
    const baseStyles = 'rounded-lg p-4 border';

    const variants = {
      success:
        'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800 text-success-800 dark:text-success-200',
      error:
        'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800 text-error-800 dark:text-error-200',
      warning:
        'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800 text-warning-800 dark:text-warning-200',
      info: 'bg-info-50 dark:bg-info-900/20 border-info-200 dark:border-info-800 text-info-800 dark:text-info-200',
    };

    const defaultIcons = {
      success: '✓',
      error: '⚠',
      warning: '⚠',
      info: 'ℹ',
    };

    const displayIcon = icon || defaultIcons[variant];

    return (
      <div ref={ref} className={cn(baseStyles, variants[variant], className)} {...props}>
        <div className="flex items-start gap-3">
          {displayIcon && (
            <div className="flex-shrink-0 text-lg">{displayIcon}</div>
          )}
          <div className="flex-1">
            {title && (
              <h4 className="font-semibold mb-1">{title}</h4>
            )}
            <div className="text-sm">{children}</div>
          </div>
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export default Alert;
