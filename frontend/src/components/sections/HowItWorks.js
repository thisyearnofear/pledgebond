/**
 * HowItWorks — the mechanic in three steps, for first-time visitors.
 * Replaces the explainer the auto-opening tour used to give.
 */

const STEPS = [
  {
    n: "01",
    title: "Anchor the win",
    body: "Your hackathon result is verified and written on-chain — public, timestamped, permanent."
  },
  {
    n: "02",
    title: "Bridge the wait",
    body: "A lender fronts you USDC against the unpaid prize. You keep building instead of waiting on the wire."
  },
  {
    n: "03",
    title: "Repay when it lands",
    body: "When the organizer pays, the loan repays. Every step is visible on the explorer."
  }
];

export default function HowItWorks() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-6">
        How it works
      </p>
      <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="rounded-xl border border-border-primary bg-surface-primary p-5 sm:p-6"
          >
            <div className="text-xs font-mono text-tertiary mb-3">{s.n}</div>
            <h3 className="text-lg font-bold text-primary mb-2">{s.title}</h3>
            <p className="text-sm text-secondary leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
