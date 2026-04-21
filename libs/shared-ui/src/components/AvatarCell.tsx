'use client';

type AvatarCellProps = {
  name?: string;
  imageUrl?: string | null;
  subtitle?: string;
};

function initialsFromName(name?: string): string {
  const value = (name ?? '').trim();
  if (!value) return 'NA';
  const parts = value.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'NA';
}

export function AvatarCell({ name, imageUrl, subtitle }: AvatarCellProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name ?? 'Avatar'}
          className="h-8 w-8 rounded-full border object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
          {initialsFromName(name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name || '-'}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
