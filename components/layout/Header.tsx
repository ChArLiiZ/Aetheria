import React from 'react';
import { cn } from '@/lib/utils';
import Container from './Container';

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backButton?: React.ReactNode;
  sticky?: boolean;
}

const Header = React.forwardRef<HTMLElement, HeaderProps>(
  (
    { className, title, subtitle, actions, backButton, sticky = false, ...props },
    ref
  ) => {
    return (
      <header
        ref={ref}
        className={cn(
          'bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
          sticky && 'sticky top-0 z-40',
          className
        )}
        {...props}
      >
        <Container>
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {backButton && <div className="flex-shrink-0">{backButton}</div>}
              {(title || subtitle) && (
                <div className="flex-1 min-w-0">
                  {title && (
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>
            {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
          </div>
        </Container>
      </header>
    );
  }
);

Header.displayName = 'Header';

export default Header;
