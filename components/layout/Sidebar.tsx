'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: 'left' | 'right';
  width?: 'sm' | 'md' | 'lg' | 'xl';
  mobileBehavior?: 'overlay' | 'push';
  children: React.ReactNode;
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      className,
      isOpen,
      onClose,
      title,
      position = 'right',
      width = 'md',
      mobileBehavior = 'overlay',
      children,
      ...props
    },
    ref
  ) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
      if (isOpen && isMobile) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen, isMobile]);

    const widths = {
      sm: 'w-64',
      md: 'w-96',
      lg: 'w-[28rem]',
      xl: 'w-[32rem]',
    };

    if (!isOpen && !isMobile) return null;

    return (
      <>
        {/* Backdrop for mobile overlay */}
        {isOpen && isMobile && mobileBehavior === 'overlay' && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          ref={ref}
          className={cn(
            'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
            'overflow-y-auto',
            // Mobile
            isMobile && mobileBehavior === 'overlay'
              ? 'fixed inset-y-0 z-50'
              : isMobile && mobileBehavior === 'push'
              ? 'fixed inset-y-0 z-50'
              : '',
            // Desktop
            !isMobile && 'relative',
            // Position
            position === 'right'
              ? isMobile
                ? 'right-0 border-l'
                : 'border-l'
              : isMobile
              ? 'left-0 border-r'
              : 'border-r',
            // Width
            isMobile ? 'w-full sm:w-80' : widths[width],
            className
          )}
          {...props}
        >
          {/* Header */}
          {title && (
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              {isMobile && (
                <Button variant="ghost" size="sm" onClick={onClose} aria-label="關閉">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6">{children}</div>
        </aside>
      </>
    );
  }
);

Sidebar.displayName = 'Sidebar';

export default Sidebar;
