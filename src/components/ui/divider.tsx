import * as React from 'react';
import { cn } from '@/lib/utils';

const Divider = React.forwardRef<
  HTMLHRElement,
  React.HTMLAttributes<HTMLHRElement>
>(({ className, ...props }, ref) => (
  <hr
    ref={ref}
    className={cn('border-t border-border', className)}
    {...props}
  />
));
Divider.displayName = 'Divider';

export { Divider };
