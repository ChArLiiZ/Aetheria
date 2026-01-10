import React from 'react';
import { cn } from '@/lib/utils';
import Stack from '@/components/layout/Stack';

export interface FormGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  direction?: 'row' | 'column';
}

const FormGroup: React.FC<FormGroupProps> = ({
  children,
  spacing = 'md',
  direction = 'column',
  className,
  ...props
}) => {
  return (
    <Stack
      direction={direction}
      spacing={spacing}
      className={cn('w-full', className)}
      {...props}
    >
      {children}
    </Stack>
  );
};

export default FormGroup;
