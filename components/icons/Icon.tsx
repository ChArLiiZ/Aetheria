import React from 'react';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

export type IconName = keyof typeof LucideIcons;

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number | string;
  className?: string;
}

const Icon: React.FC<IconProps> = ({ name, size = 24, className, ...props }) => {
  const LucideIcon = LucideIcons[name] as React.ComponentType<
    React.SVGProps<SVGSVGElement>
  >;

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
