import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export type SearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  containerClassName?: string;
};

export function SearchInput({
  className,
  containerClassName,
  placeholder = 'Search…',
  ...props
}: SearchInputProps) {
  return (
    <div className={cn('relative min-w-0 flex-1', containerClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        placeholder={placeholder}
        className={cn(
          'h-11 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        {...props}
      />
    </div>
  );
}
