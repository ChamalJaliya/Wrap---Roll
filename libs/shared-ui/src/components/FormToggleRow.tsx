import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/utils';

type FormToggleRowProps = {
  label: ReactNode;
  className?: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
};

export function FormToggleRow({ label, className, inputProps }: FormToggleRowProps) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700', className)}>
      <input {...inputProps} />
      {label}
    </label>
  );
}
