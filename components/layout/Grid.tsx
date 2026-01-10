import React from 'react';
import { cn } from '@/lib/utils';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  responsive?: {
    sm?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
    md?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
    lg?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
    xl?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  };
}

const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols = 1, gap = 'md', responsive, children, ...props }, ref) => {
    const gaps = {
      none: 'gap-0',
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-8',
    };

    const getColsClass = (cols: number) => {
      const colsMap: Record<number, string> = {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
        5: 'grid-cols-5',
        6: 'grid-cols-6',
        12: 'grid-cols-12',
      };
      return colsMap[cols] || 'grid-cols-1';
    };

    const responsiveClasses = responsive
      ? Object.entries(responsive)
          .map(([breakpoint, cols]) => {
            const breakpointMap: Record<string, string> = {
              sm: 'sm:',
              md: 'md:',
              lg: 'lg:',
              xl: 'xl:',
            };
            return `${breakpointMap[breakpoint]}${getColsClass(cols)}`;
          })
          .join(' ')
      : '';

    return (
      <div
        ref={ref}
        className={cn(
          'grid',
          getColsClass(cols),
          gaps[gap],
          responsiveClasses,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';

export default Grid;
