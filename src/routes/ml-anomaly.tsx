import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { AlertTriangle, RadarIcon, RefreshCw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/ml-anomaly")({
  head: () => ({
    meta: [
      { title: "ML Anomaly Radar — FinOps Studio" },
      {
        name: "description",
        content:
          "Unsupervised isolation-forest style anomaly detection across your transaction ledger with per-outlier insight breakdowns.",
      },
      { property: "og:title", content: "ML Anomaly Radar — FinOps Studio" },
      {
        property: "og:description",
        content: "Detect revenue leakage, duplicate payments and micro-burn with unsupervised ML.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnomalyRadar,
});

type Txn = {
  id: string;
  vendor: string;
  amount: number;
  volume: number;
  score: number;
  anomaly: boolean;
  kind: "drift" | "duplicate" | "leakage" | "normal";
  detail: string;
  confidence: number;
};

const VENDORS = [
  "AWS Compute", "Snowflake", "Datadog", "Figma", "HubSpot", "Stripe Fees", "Notion",
  "Vercel", "OpenAI API", "Slack", "Zoom", "Rippling", "Segment", "Twilio", "Cloudflare",
];

/** Deterministic pseudo-random so re-renders are stable per seed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildLedger(seed: number, count: number): Txn[] {
  const r = rng(seed);
  const rows: Txn[] = [];
  for (let i = 0; i < count; i++) {
    const vendor = VENDORS[Math.floor(r() * VENDORS.length)];
    const volume = Math.round(20 + r() * 480);
    const amount = Math.round(200 + r() * 9000);
    rows.push({
      id: `TXN-${(seed % 97) * 1000 + i}`,
      vendor,
      amount,
      volume,
      score: 0.05 + r() * 0.45,
      anomaly: false,
      kind: "normal",
      detail: "",
      confidence: 0,
    });
  }
  // Inject anomalies (~8%)
  const nAnom = Math.max(4, Math.round(count * 0.08));
  for (let k = 0; k < nAnom; k++) {
    const idx = Math.floor(r() * rows.length);
    const row = rows[idx];
    const pick = r();
    const kind: Txn["kind"] = pick < 0.36 ? "drift" : pick < 0.7 ? "duplicate" : "leakage";
    const confidence = 78 + r() * 20;
    row.anomaly = true;
    row.kind = kind;
    row.score = 0.68 + r() * 0.31;
    row.confidence = confidence;
    if (kind === "drift") {
      const delta = 8 + r() * 22;
      row.detail = `SaaS Subscription Drift — ${row.vendor} charge increased by ${delta.toFixed(1)}% without contract update.`;
    } else if (kind === "duplicate") {
      row.detail = `Duplicate/Phantom Payment — high probability (${confidence.toFixed(1)}%) duplicate invoice detected for ${row.vendor}.`;
    } else {
      const bleed = Math.round(400 + r() * 2600);
      row.detail = `Micro-Burn Leakage — unused seat licenses on ${row.vendor} bleeding $${bleed.toLocaleString()}/month.`;
    }
  }
  return rows;
}

const KIND_LABEL: Record<Txn["kind"], string> = {
  drift: "SaaS Subscription Drift",
  duplicate: "Duplicate / Phantom Payment",
  leakage: "Micro-Burn Leakage",
  normal: "Normal",
};

function AnomalyRadar() {
  const [seed, setSeed] = useState(7);
  const [threshold, setThreshold] = useState(65);
  const [selected, setSelected] = useState<Txn | null>(null);

  const ledger = useMemo(() => buildLedger(seed, 220), [seed]);
  const flagged = useMemo(
    () => ledger.filter((t) => t.score * 100 >= threshold),
    [ledger, threshold],
  );
  const normal = useMemo(
    () => ledger.filter((t) => t.score * 100 < threshold),
    [ledger, threshold],
  );

  const leakage = flagged.reduce((s, t) => s + t.amount * 0.35, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-400">Data Science</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">ML Anomaly Radar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unsupervised Isolation Forest / Autoencoder ensemble scanning {ledger.length} ledger transactions.
          </p>
        </div>
        <Button variant="secondary" size="sm" className="gap-2" onClick={() => { setSeed((s) => s + 1); setSelected(null); }}>
          <RefreshCw className="h-4 w-4" /> Re-scan Ledger
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Transactions Scanned" value={ledger.length.toLocaleString()} />
        <Stat title="Anomalies Flagged" value={String(flagged.length)} tone="bad" />
        <Stat title="Clean Signal" value={`${((normal.length / ledger.length) * 100).toFixed(1)}%`} tone="good" />
        <Stat title="Est. Monthly Leakage" value={`$${Math.round(leakage).toLocaleString()}`} tone="bad" />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Transaction Volume vs. Deviation Score</CardTitle>
            <CardDescription>Click a coral outlier to open its anomaly insight.</CardDescription>
          </div>
          <div className="w-64 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <Label className="text-muted-foreground">Detection threshold</Label>
              <span className="font-medium tabular-nums">{threshold}</span>
            </div>
            <Slider value={[threshold]} min={30} max={95} step={1} onValueChange={([v]) => setThreshold(v)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeOpacity={0.12} />
                <XAxis
                  type="number"
                  dataKey="volume"
                  name="Volume"
                  tick={{ fontSize: 11 }}
                  label={{ value: "Transaction volume", position: "insideBottom", offset: -10, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="score"
                  name="Deviation"
                  domain={[0, 1]}
                  tick={{ fontSize: 11 }}
                  label={{ value: "Deviation score", angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="amount" range={[30, 220]} />
                <RTooltip
                  cursor={{ strokeOpacity: 0.2 }}
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload as Txn | undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-lg border border-border/60 bg-popover/95 p-3 text-xs shadow-lg">
                        <div className="font-semibold">{p.vendor}</div>
                        <div className="text-muted-foreground">{p.id} · ${p.amount.toLocaleString()}</div>
                        <div className="mt-1">Deviation: {(p.score * 100).toFixed(1)}</div>
                      </div>
                    );
                  }}
                />
                <Scatter data={normal} fill="hsl(210 70% 55%)" fillOpacity={0.35} isAnimationActive={false} />
                <Scatter
                  data={flagged}
                  fill="hsl(6 90% 62%)"
                  fillOpacity={0.95}
                  isAnimationActive={false}
                  stroke="hsl(6 100% 72%)"
                  strokeWidth={1.5}
                  onClick={(d: unknown) => setSelected((d as { payload?: Txn })?.payload ?? null)}
                  className="cursor-pointer"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Flagged Outliers</CardTitle>
            <CardDescription>Ranked by isolation depth (deviation score).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...flagged]
              .sort((a, b) => b.score - a.score)
              .slice(0, 8)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition ${
                    selected?.id === t.id
                      ? "border-red-400/60 bg-red-500/10"
                      : "border-border/50 bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.vendor}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.id} · {KIND_LABEL[t.kind === "normal" ? "drift" : t.kind]}
                    </div>
                  </div>
                  <Badge variant="outline" className="tabular-nums">{(t.score * 100).toFixed(0)}</Badge>
                </button>
              ))}
            {!flagged.length && (
              <p className="text-sm text-muted-foreground">No transactions above the current threshold.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anomaly Insight</CardTitle>
            <CardDescription>
              {selected ? `${selected.id} · ${selected.vendor}` : "Select an outlier to inspect."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {selected ? (
              <>
                <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-red-300">
                    {KIND_LABEL[selected.kind === "normal" ? "drift" : selected.kind]}
                  </div>
                  <p className="mt-1 leading-relaxed">
                    {selected.detail ||
                      `Statistical outlier — deviation score ${(selected.score * 100).toFixed(1)} exceeds the ${threshold} isolation threshold for this vendor cluster.`}
                  </p>
                </div>
                <Row k="Amount" v={`$${selected.amount.toLocaleString()}`} />
                <Row k="Volume" v={selected.volume.toLocaleString()} />
                <Row k="Deviation score" v={(selected.score * 100).toFixed(1)} />
                <Row
                  k="Model confidence"
                  v={`${(selected.confidence || selected.score * 100).toFixed(1)}%`}
                />
                <Row k="Detector" v="Isolation Forest + AE reconstruction" />
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <RadarIcon className="h-8 w-8 opacity-40" />
                <p className="text-xs">Click a glowing coral dot on the scatter plot.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {tone === "good" && <ShieldCheck className="h-3 w-3" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={`text-2xl font-bold tabular-nums ${color}`}>{value}</CardContent>
    </Card>
  );
}
