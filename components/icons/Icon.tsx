import React from 'react';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

export type IconName = keyof typeof LucideIcons;

export interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName;
}

const Icon: React.FC<IconProps> = ({ name, size = 24, className, ...props }) => {
  const LucideIcon = LucideIcons[name] as React.ComponentType<LucideProps>;

  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return (
    <LucideIcon
      size={size}
      className={cn('flex-shrink-0', className)}
      {...props}
    />
  );
};

export default Icon;
