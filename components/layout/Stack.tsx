import React from 'react';
import { cn } from '@/lib/utils';

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column';
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      className,
      direction = 'column',
      spacing = 'md',
      align,
      justify,
      wrap = false,
      children,
      ...props
    },
    ref
  ) => {
    const spacings = {
      none: direction === 'row' ? 'gap-0' : 'space-y-0',
      xs: direction === 'row' ? 'gap-1' : 'space-y-1',
      sm: direction === 'row' ? 'gap-2' : 'space-y-2',
      md: direction === 'row' ? 'gap-4' : 'space-y-4',
      lg: direction === 'row' ? 'gap-6' : 'space-y-6',
      xl: direction === 'row' ? 'gap-8' : 'space-y-8',
    };

    const aligns = {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    };

    const justifies = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          direction === 'row' ? 'flex-row' : 'flex-col',
          spacings[spacing],
          align && aligns[align],
          justify && justifies[justify],
          wrap && 'flex-wrap',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Stack.displayName = 'Stack';

export default Stack;
