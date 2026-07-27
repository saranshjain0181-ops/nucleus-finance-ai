import { useMemo } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { GitBranch } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ShapInput = { key: string; name: string; baseline: number; current: number };

type Props = {
  title: string;
  metricLabel: string;
  inputs: ShapInput[];
  /** Pure function of input values -> the numeric metric being explained. */
  evaluate: (values: Record<string, number>) => number;
  format?: (n: number) => string;
};

/** Shapley values via exact marginal averaging over a sampled set of coalitions. */
function shapley(inputs: ShapInput[], evaluate: (v: Record<string, number>) => number) {
  const n = inputs.length;
  const keys = inputs.map((i) => i.key);
  const base = Object.fromEntries(inputs.map((i) => [i.key, i.baseline]));
  const full = Object.fromEntries(inputs.map((i) => [i.key, i.current]));

  const safe = (v: Record<string, number>) => {
    const r = evaluate(v);
    return Number.isFinite(r) ? r : 0;
  };

  const baseValue = safe(base);
  const fullValue = safe(full);

  // Enumerate all 2^n coalitions (n is small: 2-4 inputs per calculator).
  const contrib: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  const total = 1 << n;
  const fact = (x: number): number => (x <= 1 ? 1 : x * fact(x - 1));
  for (let mask = 0; mask < total; mask++) {
    const S = keys.filter((_, i) => mask & (1 << i));
    const vS = safe({ ...base, ...Object.fromEntries(S.map((k) => [k, full[k]])) });
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) continue;
      const k = keys[i];
      const vSi = safe({ ...base, ...Object.fromEntries([...S, k].map((kk) => [kk, full[kk]])) });
      const w = (fact(S.length) * fact(n - S.length - 1)) / fact(n);
      contrib[k] += w * (vSi - vS);
    }
  }

  const totalAbs = keys.reduce((s, k) => s + Math.abs(contrib[k]), 0) || 1;
  const rows = inputs
    .map((i) => ({
      key: i.key,
      name: i.name,
      value: contrib[i.key],
      share: (Math.abs(contrib[i.key]) / totalAbs) * 100,
      changed: i.current !== i.baseline,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return { baseValue, fullValue, rows, delta: fullValue - baseValue };
}

export function CausalAttributionDialog({ title, metricLabel, inputs, evaluate, format }: Props) {
  const fmt = format ?? ((n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(2)));
  const { baseValue, fullValue, rows, delta } = useMemo(
    () => shapley(inputs, evaluate),
    [inputs, evaluate],
  );

  // Build waterfall data: cumulative base -> contributions -> final.
  let running = baseValue;
  const waterfall = [
    { name: "Baseline", start: 0, end: baseValue, value: baseValue, type: "base" as const },
    ...rows.map((r) => {
      const start = running;
      running += r.value;
      return { name: r.name, start, end: running, value: r.value, type: "step" as const };
    }),
    { name: "Current", start: 0, end: fullValue, value: fullValue, type: "base" as const },
  ].map((d) => ({ ...d, range: [Math.min(d.start, d.end), Math.max(d.start, d.end)] as [number, number] }));

  const top = rows[0];
  const narrative = rows.some((r) => r.changed)
    ? `${metricLabel} moved from ${fmt(baseValue)} to ${fmt(fullValue)} (${delta >= 0 ? "+" : ""}${fmt(delta)}). ` +
      rows
        .filter((r) => Math.abs(r.value) > 1e-9)
        .slice(0, 3)
        .map(
          (r) =>
            `${r.share.toFixed(0)}% of the movement is attributable to ${r.name}, which ${
              r.value >= 0 ? "added" : "removed"
            } ${fmt(Math.abs(r.value))}`,
        )
        .join("; ") +
      `. Holding ${top?.name ?? "the top driver"} at its baseline would recover roughly ${fmt(Math.abs(top?.value ?? 0))} of the change.`
    : `All inputs are still at their baseline values, so ${metricLabel} sits at ${fmt(fullValue)} with no attributed drivers yet. Move a slider to generate a causal decomposition.`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground">
          <GitBranch className="h-3 w-3" /> Causal Attribution
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title} — SHAP Causal Waterfall</DialogTitle>
          <DialogDescription>
            Exact Shapley decomposition of {metricLabel} across every input variable.
          </DialogDescription>
        </DialogHeader>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfall} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} height={44} angle={-15} textAnchor="end" />
              <YAxis tick={{ fontSize: 10 }} />
              <Bar dataKey="range" radius={4}>
                <LabelList
                  dataKey="value"
                  position="top"
                  fontSize={10}
                  formatter={(v: number) => fmt(v)}
                />
                {waterfall.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.type === "base"
                        ? "hsl(190 80% 50%)"
                        : d.value >= 0
                          ? "hsl(152 65% 45%)"
                          : "hsl(6 85% 60%)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Feature importance ranking</div>
          {rows.map((r) => (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>{r.name}</span>
                <span className={`tabular-nums ${r.value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {r.value >= 0 ? "+" : "−"}{fmt(Math.abs(r.value))} · {r.share.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${r.value >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                  style={{ width: `${Math.max(2, r.share)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Root cause: </span>
          {narrative}
        </div>
      </DialogContent>
    </Dialog>
  );
}
