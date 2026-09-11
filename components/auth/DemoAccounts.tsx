import { Card } from "@/components/ui/Card";
import { COPY } from "@/content/copy";

const HEADING_ID = "demo-accounts-title";

/**
 * Shared demo logins, shown under the sign-in form so a reviewer can reach both sides of the product without being
 * sent credentials. The accounts hold sample data in the hosted project, so publishing them here is deliberate.
 * Remove this component from the sign-in page to hide them.
 */
export function DemoAccounts() {
  return (
    <Card labelledBy={HEADING_ID} tone="muted" data-testid="demo-accounts">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={HEADING_ID} className="text-xl font-bold">
            {COPY.auth.demo.title}
          </h2>
          <p className="text-sm">{COPY.auth.demo.body}</p>
        </div>
        {/* role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none. */}
        <ul role="list" className="flex flex-col gap-3">
          {COPY.auth.demo.accounts.map((account) => (
            <li key={account.email} className="rounded-control border-2 border-border bg-surface p-3">
              <p className="font-bold">{account.label}</p>
              <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt className="font-semibold">{COPY.auth.demo.emailLabel}</dt>
                <dd className="font-mono break-all">{account.email}</dd>
                <dt className="font-semibold">{COPY.auth.demo.passwordLabel}</dt>
                <dd className="font-mono break-all">{account.password}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
