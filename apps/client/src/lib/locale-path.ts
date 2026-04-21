/** Ensure a path is prefixed with /[locale] for next/navigation. */
export function withLocalePrefix(path: string | null | undefined, locale: string): string {
  const p = path?.trim() || '/';
  if (p === '/' || p === '') {
    return `/${locale}`;
  }
  if (p.startsWith(`/${locale}/`) || p === `/${locale}`) {
    return p;
  }
  if (p.startsWith('/')) {
    return `/${locale}${p}`;
  }
  return `/${locale}/${p}`;
}
