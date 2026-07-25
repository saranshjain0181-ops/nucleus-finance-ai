import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computePnL, fmtCurrency, fmtPct, useFinance } from "@/lib/finance-store";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

export const Route = createFileRoute("/pnl")({
  head: () => ({
    meta: [
      { title: "P&L Waterfall — FinOps Studio" },
      { name: "description", content: "Auto-computed profit and loss waterfall with margin summary." },
    ],
  }),
  component: PnLView,
});

function PnLView() {
  const { state } = useFinance();
  const p = computePnL(state);

  const rows = [
    { label: "Gross Revenue", value: p.grossRevenue, tone: "pos" as const },
    { label: "(-) Discounts", value: -state.discounts, tone: "neg" as const },
    { label: "Net Sales", value: p.netSales, tone: "sub" as const, bold: true },
    { label: "(-) COGS", value: -p.totalCogs, tone: "neg" as const },
    { label: "Gross Profit", value: p.grossProfit, tone: "sub" as const, bold: true },
    { label: "(-) Operating Expenses", value: -p.totalOpex, tone: "neg" as const },
    { label: "EBITDA", value: p.ebitda, tone: "sub" as const, bold: true },
    { label: "(-) Depreciation", value: -state.depreciation, tone: "neg" as const },
    { label: "EBIT", value: p.ebit, tone: "sub" as const, bold: true },
    { label: "(-) Interest", value: -state.interest, tone: "neg" as const },
    { label: "EBT", value: p.ebt, tone: "sub" as const },
    { label: `(-) Tax @ ${state.taxRate}%`, value: -p.tax, tone: "neg" as const },
    { label: "Profit After Tax (PAT)", value: p.pat, tone: "sub" as const, bold: true },
  ];

  const chartData = [
    { name: "Revenue", val: p.netSales, key: "pos" },
    { name: "COGS", val: -p.totalCogs, key: "neg" },
    { name: "GP", val: p.grossProfit, key: "sub" },
    { name: "OpEx", val: -p.totalOpex, key: "neg" },
    { name: "EBITDA", val: p.ebitda, key: "sub" },
    { name: "D&A", val: -state.depreciation, key: "neg" },
    { name: "EBIT", val: p.ebit, key: "sub" },
    { name: "Tax/Int", val: -(state.interest + p.tax), key: "neg" },
    { name: "PAT", val: p.pat, key: "sub" },
  ];

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Statement</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">P&L Waterfall</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Waterfall</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => fmtCurrency(v)}
                  />
                  <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.key === "pos" ? "#10b981" : d.key === "neg" ? "#ef4444" : "#06b6d4"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line-by-line</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.label}
                      className={`border-b border-border/40 transition hover:bg-muted/30 ${r.bold ? "bg-muted/20 font-semibold" : ""}`}
                    >
                      <td className="py-2 pl-3">{r.label}</td>
                      <td
                        className={`py-2 pr-3 text-right tabular-nums ${
                          r.tone === "neg" ? "text-red-400" : r.tone === "pos" ? "text-emerald-400" : ""
                        }`}
                      >
                        {fmtCurrency(r.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-emerald-300">Gross Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{fmtPct(p.grossMarginPct)}</div>
              <div className="text-xs text-muted-foreground">{fmtCurrency(p.grossProfit)} on {fmtCurrency(p.netSales)}</div>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/30 bg-cyan-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-cyan-300">EBITDA Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{fmtPct(p.ebitdaMarginPct)}</div>
              <div className="text-xs text-muted-foreground">{fmtCurrency(p.ebitda)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">PAT Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{fmtPct(p.patMarginPct)}</div>
              <div className="text-xs text-muted-foreground">{fmtCurrency(p.pat)}</div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
