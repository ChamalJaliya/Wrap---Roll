import { useMemo } from 'react';
import type { ClientDirectoryRow } from '../components/ClientDirectory';

export function useClientDirectoryCatalog(
  rows: ClientDirectoryRow[],
  input: { catalogType: 'all' | 'client' | 'guest'; catalogLetter: string },
) {
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const byType =
        input.catalogType === 'all'
          ? true
          : input.catalogType === 'client'
            ? Boolean(r.supabaseUserId)
            : !r.supabaseUserId;
      if (!byType) return false;
      if (input.catalogLetter === 'ALL') return true;
      const initial = String(r.name || '').trim().charAt(0).toUpperCase();
      return initial === input.catalogLetter;
    });
  }, [rows, input.catalogLetter, input.catalogType]);

  const recentRows = useMemo(
    () =>
      rows
        .filter((r) => Boolean(r.latestOrderPlacedAt))
        .sort(
          (a, b) =>
            new Date(b.latestOrderPlacedAt ?? 0).getTime() -
            new Date(a.latestOrderPlacedAt ?? 0).getTime(),
        )
        .slice(0, 6),
    [rows],
  );

  return { filteredRows, recentRows };
}
