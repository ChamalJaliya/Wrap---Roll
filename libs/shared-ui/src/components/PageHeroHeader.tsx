import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type PageHeroHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function PageHeroHeader({
  title,
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
}: PageHeroHeaderProps) {
  return (
    <header className={cn('mb-16 max-w-4xl text-center md:mx-auto', className)}>
      <h1
        className={cn(
          'mb-6 font-display text-[clamp(2.5rem,9vw,4.75rem)] font-black leading-[0.95] tracking-tighter text-neutral-900',
          titleClassName,
        )}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className={cn('mx-auto max-w-2xl text-lg font-medium leading-snug text-neutral-600 sm:text-xl', subtitleClassName)}>
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
