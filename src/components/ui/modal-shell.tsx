import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function ModalShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ModalShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-[60] flex max-h-[88vh] flex-col overflow-hidden rounded-t-[2rem] border border-border bg-card shadow-[0_-24px_80px_rgba(15,23,42,0.28)] sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[min(720px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem]',
            className
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-border sm:hidden" />
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div>
              <Dialog.Title className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/80 text-muted-foreground transition hover:border-border/80 hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
