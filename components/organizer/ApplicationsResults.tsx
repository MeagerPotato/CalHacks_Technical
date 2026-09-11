import { AppLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/Badge";
import { Timestamp } from "@/components/ui/Timestamp";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import type {
  ApplicationColumnKey,
  ApplicationRowView,
  ApplicationsResultsView,
  PaginationView,
  TableColumnView,
} from "@/lib/view-models/organizer-types";

export interface ApplicationsResultsProps {
  results: ApplicationsResultsView;
}

const CELL_CLASSES = "px-3 py-3.5 align-top";

const ROW_STATE_CLASSES = {
  complete: "border-l-success",
  "in-progress": "border-l-highlight",
  none: "border-l-accent",
} as const;

function columnLabels(columns: readonly TableColumnView[]): Record<ApplicationColumnKey, string> {
  return Object.fromEntries(columns.map((column) => [column.key, column.label])) as Record<ApplicationColumnKey, string>;
}

function ReviewSummary({ row }: { row: ApplicationRowView }) {
  return (
    <span className="flex flex-col">
      <span>{row.reviewStateLabel}</span>
      {row.recommendationLabel ? <span className="text-sm">{row.recommendationLabel}</span> : null}
    </span>
  );
}

function ColumnHeader({ column }: { column: TableColumnView }) {
  const { sort } = column;
  return (
    <th
      scope="col"
      aria-sort={sort?.direction ?? undefined}
      data-column={column.key}
      data-sorted={sort ? (sort.direction ?? "none") : undefined}
      className="border-b-2 border-border bg-accent px-3 py-3 font-bold whitespace-nowrap data-[sorted=ascending]:bg-highlight data-[sorted=descending]:bg-highlight"
    >
      {sort ? (
        <AppLink href={sort.href} data-testid={`sort-${column.key}`}>
          {column.label}
          <VisuallyHidden>{` ${sort.actionText}`}</VisuallyHidden>
        </AppLink>
      ) : (
        column.label
      )}
    </th>
  );
}

function ResultsTable({ results }: ApplicationsResultsProps) {
  return (
    <div className="workshop-card hidden overflow-x-auto rounded-card border-2 border-border bg-surface text-ink shadow-card md:block">
      <table data-testid="applications-table" className="w-full border-collapse text-left">
        <caption className="px-3 pt-3 text-left font-semibold">{results.caption}</caption>
        <thead>
          <tr>
            {results.columns.map((column) => (
              <ColumnHeader key={column.key} column={column} />
            ))}
          </tr>
        </thead>
        <tbody>
          {results.rows.map((row) => (
            <tr
              key={row.id}
              data-testid={`application-row-${row.id}`}
              data-status={row.status}
              data-review-state={row.reviewState}
              className={`border-b-2 border-l-4 border-border hover:bg-page last:border-b-0 ${ROW_STATE_CLASSES[row.reviewState]}`}
            >
              <th scope="row" className={`${CELL_CLASSES} font-normal`}>
                <span className="flex flex-col">
                  <AppLink href={row.href}>{row.name}</AppLink>
                  <span className="text-sm wrap-anywhere">{row.email}</span>
                  {row.affiliation ? <span className="text-sm">{row.affiliation}</span> : null}
                </span>
              </th>
              <td className={`${CELL_CLASSES} whitespace-nowrap`}>{row.reference}</td>
              <td className={CELL_CLASSES}>{row.typeLabel}</td>
              <td className={CELL_CLASSES}>
                <StatusBadge status={row.status} label={row.statusLabel} />
              </td>
              <td className={CELL_CLASSES}>
                <Timestamp value={row.submitted} fallback={row.submittedFallback} />
              </td>
              <td className={CELL_CLASSES}>{row.scoreText}</td>
              <td className={CELL_CLASSES}>
                <ReviewSummary row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultCards({ results }: ApplicationsResultsProps) {
  const labels = columnLabels(results.columns);
  return (
    <ul role="list" data-testid="application-cards" className="flex flex-col gap-4 md:hidden">
      {results.rows.map((row) => (
        <li
          key={row.id}
          data-testid={`application-card-${row.id}`}
          data-status={row.status}
          data-review-state={row.reviewState}
          className={`workshop-card rounded-card border-2 border-l-8 border-border bg-surface p-4 text-ink shadow-card ${ROW_STATE_CLASSES[row.reviewState]}`}
        >
          <h3 className="text-lg font-bold">
            <AppLink href={row.href}>{row.name}</AppLink>
          </h3>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
            <dt className="font-semibold">{labels.reference}</dt>
            <dd>{row.reference}</dd>
            <dt className="font-semibold">{results.cardLabels.email}</dt>
            <dd className="wrap-anywhere">{row.email}</dd>
            {row.affiliation ? (
              <>
                <dt className="font-semibold">{results.cardLabels.affiliation}</dt>
                <dd>{row.affiliation}</dd>
              </>
            ) : null}
            <dt className="font-semibold">{labels.type}</dt>
            <dd>{row.typeLabel}</dd>
            <dt className="font-semibold">{labels.status}</dt>
            <dd>
              <StatusBadge status={row.status} label={row.statusLabel} />
            </dd>
            <dt className="font-semibold">{labels.submitted}</dt>
            <dd>
              <Timestamp value={row.submitted} fallback={row.submittedFallback} />
            </dd>
            <dt className="font-semibold">{labels.score}</dt>
            <dd>{row.scoreText}</dd>
            <dt className="font-semibold">{labels.review}</dt>
            <dd>
              <ReviewSummary row={row} />
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Pagination({ pagination }: { pagination: PaginationView }) {
  return (
    <nav aria-label={pagination.label} data-testid="pagination" className="flex flex-wrap items-center gap-3">
      {pagination.previous ? (
        <AppLink href={pagination.previous.href} variant="secondary" data-testid="pagination-previous">
          {pagination.previous.label}
        </AppLink>
      ) : null}
      <p data-testid="pagination-status">{pagination.statusText}</p>
      {pagination.next ? (
        <AppLink href={pagination.next.href} variant="secondary" data-testid="pagination-next">
          {pagination.next.label}
        </AppLink>
      ) : null}
    </nav>
  );
}

/**
 * Application results: a named region with the result count as its `h2` and `data-state` (`results`, `empty`,
 * `no-results`, `past-end`). With results it renders a captioned `table` from the `md` breakpoint (column headers with
 * `scope="col"`, row headers with `scope="row"`, `aria-sort` and `data-sorted` on sortable columns) and the same rows
 * as stacked cards below it, then pagination. Otherwise it renders the state message and its action.
 */
export function ApplicationsResults({ results }: ApplicationsResultsProps) {
  return (
    <section
      aria-labelledby="application-results-title"
      data-testid="application-results"
      data-state={results.state}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="application-results-title" className="text-xl font-bold">
          {results.countText}
        </h2>
        {results.rangeText ? <p className="text-sm">{results.rangeText}</p> : null}
      </div>
      {results.message ? (
        <div
          data-testid="application-results-message"
          className="workshop-card flex flex-col items-start gap-2 rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card"
        >
          <h3 className="text-lg font-bold">{results.message.title}</h3>
          <p>{results.message.body}</p>
          {results.message.action ? (
            <AppLink href={results.message.action.href} variant="secondary">
              {results.message.action.label}
            </AppLink>
          ) : null}
        </div>
      ) : (
        <>
          <ResultsTable results={results} />
          <ResultCards results={results} />
          {results.pagination ? <Pagination pagination={results.pagination} /> : null}
        </>
      )}
    </section>
  );
}
