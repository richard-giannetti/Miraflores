import { requireAccess } from "@/lib/auth";
import { buildReport } from "@/lib/reports";
import { addDaysStr, today } from "@/lib/dates";
import { money, pct, SOURCE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireAccess("reports");
  const sp = await searchParams;
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : addDaysStr(today(), -29);
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today();

  const r = await buildReport(from, to);

  const kpis = [
    { label: "Occupancy", value: pct(r.occupancy), sub: `${r.roomNightsSold}/${r.roomNightsAvailable} room-nights` },
    { label: "ADR", value: money(r.adr), sub: "avg. daily rate" },
    { label: "RevPAR", value: money(r.revpar), sub: "rev / available room" },
    { label: "Room revenue", value: money(r.roomRevenue), sub: `${r.nightsInRange} nights` },
  ];

  const maxRev = Math.max(1, ...r.revenueBySource.map((s) => s.revenue));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Owner reports</h1>
        <a href={`/reports/csv?from=${from}&to=${to}`} className="btn-secondary">Export CSV</a>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">From</label>
          <input type="date" name="from" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" name="to" defaultValue={to} className="input" />
        </div>
        <button className="btn-primary" type="submit">Update</button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k.label}</div>
            <div className="mt-1 text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-slate-400">{k.sub}</div>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Revenue by source</h2>
        {r.revenueBySource.length === 0 ? (
          <p className="text-sm text-slate-400">No revenue in this period.</p>
        ) : (
          <div className="space-y-2">
            {r.revenueBySource.map((s) => (
              <div key={s.source} className="flex items-center gap-3">
                <div className="w-28 text-sm text-slate-600">{SOURCE_LABEL[s.source] ?? s.source}</div>
                <div className="h-5 flex-1 rounded bg-slate-100">
                  <div className="h-5 rounded bg-brand-500" style={{ width: `${(s.revenue / maxRev) * 100}%` }} />
                </div>
                <div className="w-24 text-right text-sm font-medium">{money(s.revenue)}</div>
                <div className="w-16 text-right text-xs text-slate-400">{s.nights} nts</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
