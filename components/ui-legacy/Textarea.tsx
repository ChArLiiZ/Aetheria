import React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, helperText, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    const textareaClasses = cn(
      'w-full px-4 py-2 border rounded-lg',
      'focus:outline-none focus:ring-2 focus:ring-offset-0',
      'transition-colors resize-none',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'dark:bg-gray-700 dark:text-white',
      error
        ? 'border-error-600 focus:ring-error-500 focus:border-error-600'
        : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-600',
      className
    );

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {label}
          </label>
        )}
        <textarea ref={ref} id={textareaId} className={textareaClasses} {...props} />
        {error && (
          <p className="mt-1 text-sm text-error-600 dark:text-error-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
