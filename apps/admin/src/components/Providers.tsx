'use client';

import * as React from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@wrap-roll/shared-ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </ThemeProvider>
  );
}
