import type { ReactNode } from 'react';

export type OrderQueueColumnConfig = {
  key: string;
  title: string;
  count?: number;
  children: ReactNode;
};

type OrderQueueBoardProps = {
  columns: OrderQueueColumnConfig[];
};

export function OrderQueueBoard({ columns }: OrderQueueBoardProps) {
  return (
    <section className="w-full overflow-x-auto pb-1">
      <div className="flex min-w-max gap-4">
        {columns.map((column) => (
          <div
            key={column.key}
            className="w-[300px] shrink-0 rounded-xl border border-border bg-card p-3 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">{column.title}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {column.count ?? 0}
              </span>
            </div>
            <div className="space-y-2">{column.children}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
