import type { KpiView } from "@/lib/view-models/organizer-types";

export interface KpiCardsProps {
  title: string;
  kpis: readonly KpiView[];
}

/**
 * The dashboard's key numbers as a named region holding one description list: each card is a `div[data-kpi]` with a
 * `dt` label and a `dd` value, so each number is read with its label.
 */
export function KpiCards({ title, kpis }: KpiCardsProps) {
  return (
    <section aria-labelledby="kpis-title" data-testid="kpi-cards">
      <h2 id="kpis-title" className="sr-only">
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.id}
            data-kpi={kpi.id}
            data-testid={`kpi-${kpi.id}`}
            className="flex flex-col-reverse gap-1 rounded-card border-2 border-border bg-surface p-4 text-ink shadow-card"
          >
            <dt className="font-semibold">{kpi.label}</dt>
            <dd className="font-display text-4xl font-extrabold">{kpi.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
