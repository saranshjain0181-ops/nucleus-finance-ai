import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";


export const Route = createFileRoute("/calculators")({
  head: () => ({
    meta: [
      { title: "Calculator Matrix — FinOps Studio" },
      { name: "description", content: "50+ finance calculators across VC, Corporate Finance, Micro, Capex, and Treasury." },
    ],
  }),
  component: CalcMatrix,
});

// ---------- Types ----------
type Tone = "default" | "good" | "bad";
type ResultItem = { label: string; value: string; tone?: Tone };
type CalcInput = {
  name: string;
  key: string;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
};
type CalcConfig = {
  id: string;
  title: string;
  description: string;
  category: CategoryId;
  inputs: CalcInput[];
  compute: (v: Record<string, number>) => ResultItem[];
};
type CategoryId = "vc" | "corp" | "micro" | "capex" | "treasury";

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "vc", label: "VC Metrics" },
  { id: "corp", label: "Corporate Finance" },
  { id: "micro", label: "Microeconomics" },
  { id: "capex", label: "Capital Budgeting" },
  { id: "treasury", label: "Treasury" },
];

// ---------- Formatters ----------
const money = (n: number) =>
  isFinite(n)
    ? `$${Math.round(n).toLocaleString()}`
    : "—";
const pct = (n: number, d = 1) => (isFinite(n) ? `${n.toFixed(d)}%` : "—");
const num = (n: number, d = 2) => (isFinite(n) ? n.toFixed(d) : "—");

// ---------- Config ----------
const calculatorConfig: CalcConfig[] = [
  // ========== VC METRICS ==========
  {
    id: "cac-payback", title: "CAC Payback Period", description: "Months to recoup customer acquisition cost", category: "vc",
    inputs: [
      { name: "CAC ($)", key: "cac", default: 300, min: 10, max: 5000, step: 10, suffix: "$" },
      { name: "Monthly Gross Profit / customer ($)", key: "mgp", default: 60, min: 5, max: 2000, step: 5, suffix: "$" },
    ],
    compute: ({ cac, mgp }) => {
      const p = cac / mgp;
      return [{ label: "Payback", value: `${num(p, 1)} months`, tone: p < 12 ? "good" : "bad" }];
    },
  },
  {
    id: "ltv-cac", title: "LTV : CAC Ratio", description: "Health of unit economics", category: "vc",
    inputs: [
      { name: "LTV ($)", key: "ltv", default: 2400, min: 100, max: 20000, step: 100, suffix: "$" },
      { name: "CAC ($)", key: "cac", default: 300, min: 10, max: 5000, step: 10, suffix: "$" },
    ],
    compute: ({ ltv, cac }) => {
      const r = ltv / cac;
      return [{ label: "Ratio", value: `${num(r)}x`, tone: r >= 3 ? "good" : "bad" }];
    },
  },
  {
    id: "magic-number", title: "Magic Number", description: "Efficiency of go-to-market spend", category: "vc",
    inputs: [
      { name: "Net New ARR (quarter, $)", key: "arr", default: 1_200_000, min: 0, max: 10_000_000, step: 10000, suffix: "$" },
      { name: "Prior Q Sales & Mktg ($)", key: "sm", default: 400_000, min: 10000, max: 5_000_000, step: 10000, suffix: "$" },
    ],
    compute: ({ arr, sm }) => {
      const m = arr / sm;
      return [{ label: "Magic #", value: num(m), tone: m > 0.75 ? "good" : "bad" }];
    },
  },
  {
    id: "rule-of-40", title: "Rule of 40", description: "Growth% + EBITDA Margin% ≥ 40", category: "vc",
    inputs: [
      { name: "Growth Rate (%)", key: "g", default: 60, min: -20, max: 200, step: 1, suffix: "%" },
      { name: "EBITDA Margin (%)", key: "e", default: -10, min: -80, max: 80, step: 1, suffix: "%" },
    ],
    compute: ({ g, e }) => [{ label: "Score", value: `${g + e}`, tone: g + e >= 40 ? "good" : "bad" }],
  },
  {
    id: "burn-multiple", title: "Burn Multiple", description: "Capital efficiency (lower is better)", category: "vc",
    inputs: [
      { name: "Net Burn ($/mo)", key: "burn", default: 200_000, min: 0, max: 5_000_000, step: 10000, suffix: "$" },
      { name: "Net New ARR ($/mo)", key: "arr", default: 80_000, min: 1000, max: 5_000_000, step: 1000, suffix: "$" },
    ],
    compute: ({ burn, arr }) => {
      const m = burn / arr;
      return [{ label: "Burn Multiple", value: num(m), tone: m < 1.5 ? "good" : "bad" }];
    },
  },
  {
    id: "dilution", title: "Founder Dilution", description: "Post-money ownership after a round", category: "vc",
    inputs: [
      { name: "Pre-Money Valuation ($M)", key: "pre", default: 40, min: 1, max: 500, step: 1, suffix: "M" },
      { name: "Round Size ($M)", key: "size", default: 10, min: 0.5, max: 200, step: 0.5, suffix: "M" },
      { name: "Founder Ownership Pre (%)", key: "own", default: 60, min: 1, max: 100, step: 1, suffix: "%" },
    ],
    compute: ({ pre, size, own }) => {
      const dilution = size / (pre + size);
      const post = own * (1 - dilution);
      return [
        { label: "Dilution", value: pct(dilution * 100) },
        { label: "Founder Post %", value: pct(post), tone: post > 40 ? "good" : "bad" },
      ];
    },
  },
  {
    id: "runway", title: "Runway", description: "Months until cash runs out", category: "vc",
    inputs: [
      { name: "Cash ($)", key: "cash", default: 5_000_000, min: 0, max: 200_000_000, step: 50000, suffix: "$" },
      { name: "Net Burn ($/mo)", key: "burn", default: 250_000, min: 1000, max: 5_000_000, step: 1000, suffix: "$" },
    ],
    compute: ({ cash, burn }) => {
      const m = cash / burn;
      return [{ label: "Runway", value: `${num(m, 1)} months`, tone: m > 18 ? "good" : "bad" }];
    },
  },
  {
    id: "net-dollar-retention", title: "Net Dollar Retention", description: "Expansion + retention performance", category: "vc",
    inputs: [
      { name: "Starting ARR ($)", key: "start", default: 1_000_000, min: 10000, max: 100_000_000, step: 10000, suffix: "$" },
      { name: "Expansion ($)", key: "exp", default: 200_000, min: 0, max: 50_000_000, step: 5000, suffix: "$" },
      { name: "Churn ($)", key: "churn", default: 80_000, min: 0, max: 50_000_000, step: 5000, suffix: "$" },
    ],
    compute: ({ start, exp, churn }) => {
      const ndr = ((start + exp - churn) / start) * 100;
      return [{ label: "NDR", value: pct(ndr), tone: ndr >= 110 ? "good" : ndr >= 100 ? "default" : "bad" }];
    },
  },
  {
    id: "quick-ratio", title: "SaaS Quick Ratio", description: "(New + Expansion) / (Churn + Contraction)", category: "vc",
    inputs: [
      { name: "New MRR ($)", key: "n", default: 50000, min: 0, max: 5_000_000, step: 1000, suffix: "$" },
      { name: "Expansion MRR ($)", key: "e", default: 20000, min: 0, max: 5_000_000, step: 1000, suffix: "$" },
      { name: "Churned MRR ($)", key: "c", default: 10000, min: 0, max: 5_000_000, step: 1000, suffix: "$" },
      { name: "Contraction MRR ($)", key: "d", default: 5000, min: 0, max: 5_000_000, step: 1000, suffix: "$" },
    ],
    compute: ({ n, e, c, d }) => {
      const q = (n + e) / (c + d || 1);
      return [{ label: "Quick Ratio", value: num(q), tone: q >= 4 ? "good" : "bad" }];
    },
  },

  // ========== CORPORATE FINANCE ==========
  {
    id: "wacc", title: "WACC", description: "Weighted average cost of capital", category: "corp",
    inputs: [
      { name: "Equity Weight (%)", key: "we", default: 60, min: 0, max: 100, step: 1, suffix: "%" },
      { name: "Cost of Equity (%)", key: "ke", default: 12, min: 0, max: 40, step: 0.1, suffix: "%" },
      { name: "Cost of Debt (%)", key: "kd", default: 6, min: 0, max: 20, step: 0.1, suffix: "%" },
      { name: "Tax Rate (%)", key: "t", default: 25, min: 0, max: 50, step: 1, suffix: "%" },
    ],
    compute: ({ we, ke, kd, t }) => {
      const wd = 100 - we;
      const w = (we / 100) * ke + (wd / 100) * kd * (1 - t / 100);
      return [{ label: "WACC", value: pct(w, 2) }];
    },
  },
  {
    id: "dcf-simple", title: "DCF Valuation", description: "Perpetuity growth model", category: "corp",
    inputs: [
      { name: "FCF Year 1 ($M)", key: "fcf", default: 100, min: 1, max: 10000, step: 1, suffix: "M" },
      { name: "WACC (%)", key: "wacc", default: 10, min: 1, max: 30, step: 0.1, suffix: "%" },
      { name: "Terminal Growth (%)", key: "g", default: 2.5, min: 0, max: 6, step: 0.1, suffix: "%" },
    ],
    compute: ({ fcf, wacc, g }) => {
      const val = fcf / ((wacc - g) / 100);
      return [{ label: "Enterprise Value", value: `$${num(val)}M`, tone: "good" }];
    },
  },
  {
    id: "dupont", title: "DuPont ROE Analysis", description: "Margin × Turnover × Leverage", category: "corp",
    inputs: [
      { name: "Net Margin (%)", key: "m", default: 12, min: -50, max: 50, step: 0.5, suffix: "%" },
      { name: "Asset Turnover", key: "t", default: 1.2, min: 0.1, max: 5, step: 0.1 },
      { name: "Equity Multiplier", key: "l", default: 2, min: 1, max: 10, step: 0.1 },
    ],
    compute: ({ m, t, l }) => {
      const roe = (m / 100) * t * l * 100;
      return [{ label: "ROE", value: pct(roe), tone: roe > 15 ? "good" : "bad" }];
    },
  },
  {
    id: "altman-z", title: "Altman Z-Score", description: "Bankruptcy risk (>2.99 safe)", category: "corp",
    inputs: [
      { name: "Working Capital / Assets", key: "a", default: 0.2, min: -1, max: 1, step: 0.01 },
      { name: "Retained Earnings / Assets", key: "b", default: 0.3, min: -1, max: 1, step: 0.01 },
      { name: "EBIT / Assets", key: "c", default: 0.15, min: -1, max: 1, step: 0.01 },
      { name: "Mkt Cap / Total Liab", key: "d", default: 1.5, min: 0, max: 20, step: 0.1 },
      { name: "Sales / Assets", key: "e", default: 1.2, min: 0, max: 5, step: 0.1 },
    ],
    compute: ({ a, b, c, d, e }) => {
      const z = 1.2 * a + 1.4 * b + 3.3 * c + 0.6 * d + 1.0 * e;
      return [{ label: "Z-Score", value: num(z), tone: z >= 2.99 ? "good" : z >= 1.81 ? "default" : "bad" }];
    },
  },
  {
    id: "cash-conv", title: "Cash Conversion Cycle", description: "DIO + DSO − DPO", category: "corp",
    inputs: [
      { name: "Days Inventory (DIO)", key: "dio", default: 40, min: 0, max: 365, step: 1 },
      { name: "Days Sales Outstanding (DSO)", key: "dso", default: 45, min: 0, max: 365, step: 1 },
      { name: "Days Payable Outstanding (DPO)", key: "dpo", default: 30, min: 0, max: 365, step: 1 },
    ],
    compute: ({ dio, dso, dpo }) => {
      const c = dio + dso - dpo;
      return [{ label: "CCC", value: `${c} days`, tone: c < 60 ? "good" : "bad" }];
    },
  },
  {
    id: "gordon", title: "Gordon Growth Model", description: "Dividend discount valuation", category: "corp",
    inputs: [
      { name: "Next Div ($)", key: "d", default: 2, min: 0.1, max: 100, step: 0.1, suffix: "$" },
      { name: "Required Return (%)", key: "r", default: 10, min: 1, max: 30, step: 0.1, suffix: "%" },
      { name: "Div Growth (%)", key: "g", default: 4, min: 0, max: 15, step: 0.1, suffix: "%" },
    ],
    compute: ({ d, r, g }) => [{ label: "Price", value: `$${num(d / ((r - g) / 100))}`, tone: "good" }],
  },
  {
    id: "eva", title: "Economic Value Added", description: "NOPAT − (Capital × WACC)", category: "corp",
    inputs: [
      { name: "NOPAT ($M)", key: "n", default: 50, min: -500, max: 5000, step: 1, suffix: "M" },
      { name: "Invested Capital ($M)", key: "c", default: 300, min: 1, max: 20000, step: 1, suffix: "M" },
      { name: "WACC (%)", key: "w", default: 10, min: 1, max: 30, step: 0.1, suffix: "%" },
    ],
    compute: ({ n, c, w }) => {
      const eva = n - c * (w / 100);
      return [{ label: "EVA", value: `$${num(eva)}M`, tone: eva > 0 ? "good" : "bad" }];
    },
  },
  {
    id: "current-ratio", title: "Current Ratio", description: "Short-term liquidity", category: "corp",
    inputs: [
      { name: "Current Assets ($M)", key: "a", default: 200, min: 0, max: 10000, step: 1, suffix: "M" },
      { name: "Current Liabilities ($M)", key: "l", default: 100, min: 1, max: 10000, step: 1, suffix: "M" },
    ],
    compute: ({ a, l }) => {
      const r = a / l;
      return [{ label: "Ratio", value: num(r), tone: r >= 1.5 ? "good" : "bad" }];
    },
  },
  {
    id: "de-ratio", title: "Debt / Equity Ratio", description: "Leverage snapshot", category: "corp",
    inputs: [
      { name: "Total Debt ($M)", key: "d", default: 100, min: 0, max: 10000, step: 1, suffix: "M" },
      { name: "Total Equity ($M)", key: "e", default: 200, min: 1, max: 10000, step: 1, suffix: "M" },
    ],
    compute: ({ d, e }) => {
      const r = d / e;
      return [{ label: "D/E", value: num(r), tone: r <= 1 ? "good" : "bad" }];
    },
  },

  // ========== MICROECONOMICS ==========
  {
    id: "price-elasticity", title: "Price Elasticity of Demand", description: "%ΔQ / %ΔP", category: "micro",
    inputs: [
      { name: "% Change Quantity", key: "q", default: -10, min: -100, max: 100, step: 1, suffix: "%" },
      { name: "% Change Price", key: "p", default: 5, min: -100, max: 100, step: 1, suffix: "%" },
    ],
    compute: ({ q, p }) => {
      const e = q / p;
      return [{ label: "Elasticity", value: num(e), tone: Math.abs(e) > 1 ? "good" : "default" }];
    },
  },
  {
    id: "cross-price", title: "Cross-Price Elasticity", description: "Substitute vs complement test", category: "micro",
    inputs: [
      { name: "% Change Qty of A", key: "qa", default: 8, min: -100, max: 100, step: 1, suffix: "%" },
      { name: "% Change Price of B", key: "pb", default: 10, min: -100, max: 100, step: 1, suffix: "%" },
    ],
    compute: ({ qa, pb }) => {
      const e = qa / pb;
      return [
        { label: "Cross Elasticity", value: num(e) },
        { label: "Relationship", value: e > 0 ? "Substitutes" : "Complements", tone: "default" },
      ];
    },
  },
  {
    id: "income-elasticity", title: "Income Elasticity", description: "Normal vs inferior good", category: "micro",
    inputs: [
      { name: "% Change Qty", key: "q", default: 15, min: -100, max: 100, step: 1, suffix: "%" },
      { name: "% Change Income", key: "i", default: 10, min: -100, max: 100, step: 1, suffix: "%" },
    ],
    compute: ({ q, i }) => {
      const e = q / i;
      return [
        { label: "Elasticity", value: num(e) },
        { label: "Good Type", value: e > 1 ? "Luxury" : e > 0 ? "Normal" : "Inferior" },
      ];
    },
  },
  {
    id: "break-even", title: "Break-Even Units", description: "Fixed / (Price − Variable)", category: "micro",
    inputs: [
      { name: "Fixed Costs ($)", key: "f", default: 50000, min: 0, max: 10_000_000, step: 500, suffix: "$" },
      { name: "Price / Unit ($)", key: "p", default: 50, min: 1, max: 10000, step: 1, suffix: "$" },
      { name: "Variable Cost / Unit ($)", key: "v", default: 20, min: 0, max: 10000, step: 1, suffix: "$" },
    ],
    compute: ({ f, p, v }) => {
      const u = f / (p - v);
      return [{ label: "Break-Even Units", value: `${Math.ceil(u).toLocaleString()}`, tone: "good" }];
    },
  },
  {
    id: "consumer-surplus", title: "Consumer Surplus", description: "Triangle area estimate", category: "micro",
    inputs: [
      { name: "Max Willingness ($)", key: "wtp", default: 100, min: 1, max: 10000, step: 1, suffix: "$" },
      { name: "Market Price ($)", key: "p", default: 40, min: 0, max: 10000, step: 1, suffix: "$" },
      { name: "Quantity", key: "q", default: 500, min: 1, max: 100000, step: 1 },
    ],
    compute: ({ wtp, p, q }) => [{ label: "Surplus", value: money(0.5 * (wtp - p) * q), tone: "good" }],
  },
  {
    id: "marginal-revenue", title: "Marginal Revenue", description: "ΔRevenue / ΔQuantity", category: "micro",
    inputs: [
      { name: "Δ Revenue ($)", key: "r", default: 500, min: -100000, max: 1_000_000, step: 10, suffix: "$" },
      { name: "Δ Quantity", key: "q", default: 10, min: 1, max: 100000, step: 1 },
    ],
    compute: ({ r, q }) => [{ label: "MR", value: money(r / q) }],
  },

  // ========== CAPITAL BUDGETING ==========
  {
    id: "npv-project", title: "NPV — Uniform Cash Flows", description: "Annuity present value − initial", category: "capex",
    inputs: [
      { name: "Initial Outlay ($)", key: "i", default: 500000, min: 1000, max: 100_000_000, step: 1000, suffix: "$" },
      { name: "Annual CF ($)", key: "cf", default: 120000, min: 100, max: 50_000_000, step: 1000, suffix: "$" },
      { name: "Years", key: "n", default: 5, min: 1, max: 30, step: 1 },
      { name: "Discount Rate (%)", key: "r", default: 10, min: 1, max: 30, step: 0.1, suffix: "%" },
    ],
    compute: ({ i, cf, n, r }) => {
      const rate = r / 100;
      const pv = cf * ((1 - Math.pow(1 + rate, -n)) / rate);
      const npv = pv - i;
      return [{ label: "NPV", value: money(npv), tone: npv > 0 ? "good" : "bad" }];
    },
  },
  {
    id: "irr", title: "IRR (uniform CF)", description: "Rate where NPV = 0", category: "capex",
    inputs: [
      { name: "Initial Outlay ($)", key: "i", default: 500000, min: 1000, max: 100_000_000, step: 1000, suffix: "$" },
      { name: "Annual CF ($)", key: "cf", default: 120000, min: 100, max: 50_000_000, step: 1000, suffix: "$" },
      { name: "Years", key: "n", default: 5, min: 1, max: 30, step: 1 },
    ],
    compute: ({ i, cf, n }) => {
      let lo = -0.99, hi = 5;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        const npv = cf * ((1 - Math.pow(1 + mid, -n)) / mid) - i;
        if (npv > 0) lo = mid; else hi = mid;
      }
      const irr = ((lo + hi) / 2) * 100;
      return [{ label: "IRR", value: pct(irr, 2), tone: irr > 10 ? "good" : "bad" }];
    },
  },
  {
    id: "mirr", title: "Modified IRR", description: "Reinvestment-adjusted IRR", category: "capex",
    inputs: [
      { name: "Initial Outlay ($)", key: "i", default: 500000, min: 1000, max: 100_000_000, step: 1000, suffix: "$" },
      { name: "Annual CF ($)", key: "cf", default: 120000, min: 100, max: 50_000_000, step: 1000, suffix: "$" },
      { name: "Years", key: "n", default: 5, min: 1, max: 30, step: 1 },
      { name: "Finance Rate (%)", key: "f", default: 8, min: 1, max: 30, step: 0.1, suffix: "%" },
      { name: "Reinvest Rate (%)", key: "rr", default: 10, min: 1, max: 30, step: 0.1, suffix: "%" },
    ],
    compute: ({ i, cf, n, rr }) => {
      const fv = cf * ((Math.pow(1 + rr / 100, n) - 1) / (rr / 100));
      const mirr = (Math.pow(fv / i, 1 / n) - 1) * 100;
      return [{ label: "MIRR", value: pct(mirr, 2), tone: mirr > 10 ? "good" : "bad" }];
    },
  },
  {
    id: "payback", title: "Payback Period", description: "Years to recover capex", category: "capex",
    inputs: [
      { name: "Initial Outlay ($)", key: "i", default: 500000, min: 1000, max: 100_000_000, step: 1000, suffix: "$" },
      { name: "Annual CF ($)", key: "cf", default: 120000, min: 100, max: 50_000_000, step: 1000, suffix: "$" },
    ],
    compute: ({ i, cf }) => {
      const y = i / cf;
      return [{ label: "Payback", value: `${num(y, 2)} yrs`, tone: y < 5 ? "good" : "bad" }];
    },
  },
  {
    id: "profitability-index", title: "Profitability Index", description: "PV of inflows / Outlay", category: "capex",
    inputs: [
      { name: "PV of Cash Inflows ($)", key: "pv", default: 700000, min: 0, max: 200_000_000, step: 1000, suffix: "$" },
      { name: "Initial Outlay ($)", key: "i", default: 500000, min: 1, max: 100_000_000, step: 1000, suffix: "$" },
    ],
    compute: ({ pv, i }) => {
      const p = pv / i;
      return [{ label: "PI", value: num(p), tone: p > 1 ? "good" : "bad" }];
    },
  },
  {
    id: "depreciation", title: "Straight-Line Depreciation", description: "Annual depreciation charge", category: "capex",
    inputs: [
      { name: "Cost ($)", key: "c", default: 100000, min: 1, max: 100_000_000, step: 1000, suffix: "$" },
      { name: "Salvage ($)", key: "s", default: 10000, min: 0, max: 100_000_000, step: 500, suffix: "$" },
      { name: "Useful Life (yrs)", key: "n", default: 5, min: 1, max: 40, step: 1 },
    ],
    compute: ({ c, s, n }) => [{ label: "Annual Depreciation", value: money((c - s) / n) }],
  },
  {
    id: "eaa", title: "Equivalent Annual Annuity", description: "Annualize project NPV", category: "capex",
    inputs: [
      { name: "NPV ($)", key: "npv", default: 200000, min: -10_000_000, max: 100_000_000, step: 1000, suffix: "$" },
      { name: "Rate (%)", key: "r", default: 10, min: 1, max: 30, step: 0.1, suffix: "%" },
      { name: "Years", key: "n", default: 5, min: 1, max: 40, step: 1 },
    ],
    compute: ({ npv, r, n }) => {
      const rate = r / 100;
      const eaa = (npv * rate) / (1 - Math.pow(1 + rate, -n));
      return [{ label: "EAA", value: money(eaa) }];
    },
  },

  // ========== TREASURY ==========
  {
    id: "loan-payment", title: "Loan Monthly Payment", description: "Fixed-rate amortization", category: "treasury",
    inputs: [
      { name: "Principal ($)", key: "p", default: 250000, min: 1000, max: 10_000_000, step: 1000, suffix: "$" },
      { name: "Annual Rate (%)", key: "r", default: 6, min: 0.1, max: 25, step: 0.1, suffix: "%" },
      { name: "Term (yrs)", key: "n", default: 15, min: 1, max: 40, step: 1 },
    ],
    compute: ({ p, r, n }) => {
      const i = r / 100 / 12;
      const N = n * 12;
      const pmt = (p * i) / (1 - Math.pow(1 + i, -N));
      const total = pmt * N;
      return [
        { label: "Monthly Payment", value: money(pmt) },
        { label: "Total Interest", value: money(total - p), tone: "bad" },
      ];
    },
  },
  {
    id: "bond-price", title: "Bond Price", description: "Present value of coupons + face", category: "treasury",
    inputs: [
      { name: "Face Value ($)", key: "f", default: 1000, min: 100, max: 100000, step: 100, suffix: "$" },
      { name: "Coupon (%)", key: "c", default: 5, min: 0, max: 20, step: 0.1, suffix: "%" },
      { name: "Yield (%)", key: "y", default: 6, min: 0.1, max: 25, step: 0.1, suffix: "%" },
      { name: "Years", key: "n", default: 10, min: 1, max: 30, step: 1 },
    ],
    compute: ({ f, c, y, n }) => {
      const coupon = f * (c / 100);
      const yr = y / 100;
      const pv = coupon * ((1 - Math.pow(1 + yr, -n)) / yr) + f / Math.pow(1 + yr, n);
      return [{ label: "Price", value: money(pv), tone: pv > f ? "good" : "bad" }];
    },
  },
  {
    id: "bond-duration", title: "Bond Modified Duration", description: "Interest-rate sensitivity", category: "treasury",
    inputs: [
      { name: "Macaulay Duration (yrs)", key: "d", default: 7, min: 0.1, max: 30, step: 0.1 },
      { name: "Yield (%)", key: "y", default: 5, min: 0.1, max: 25, step: 0.1, suffix: "%" },
    ],
    compute: ({ d, y }) => [{ label: "Modified Duration", value: num(d / (1 + y / 100)) }],
  },
  {
    id: "fx-forward", title: "FX Forward Rate", description: "Covered interest parity", category: "treasury",
    inputs: [
      { name: "Spot Rate", key: "s", default: 1.1, min: 0.01, max: 500, step: 0.01 },
      { name: "Domestic Rate (%)", key: "rd", default: 5, min: 0, max: 30, step: 0.1, suffix: "%" },
      { name: "Foreign Rate (%)", key: "rf", default: 3, min: 0, max: 30, step: 0.1, suffix: "%" },
      { name: "Days", key: "t", default: 90, min: 1, max: 720, step: 1 },
    ],
    compute: ({ s, rd, rf, t }) => {
      const fwd = s * ((1 + (rd / 100) * (t / 360)) / (1 + (rf / 100) * (t / 360)));
      return [{ label: "Forward", value: num(fwd, 4) }];
    },
  },
  {
    id: "ytm", title: "Yield to Maturity (Approx)", description: "Approximate YTM", category: "treasury",
    inputs: [
      { name: "Coupon ($)", key: "c", default: 60, min: 0, max: 5000, step: 1, suffix: "$" },
      { name: "Face Value ($)", key: "f", default: 1000, min: 100, max: 100000, step: 100, suffix: "$" },
      { name: "Price ($)", key: "p", default: 950, min: 1, max: 100000, step: 1, suffix: "$" },
      { name: "Years", key: "n", default: 8, min: 1, max: 40, step: 1 },
    ],
    compute: ({ c, f, p, n }) => {
      const ytm = ((c + (f - p) / n) / ((f + p) / 2)) * 100;
      return [{ label: "YTM", value: pct(ytm, 2) }];
    },
  },
  {
    id: "cash-ratio", title: "Cash Ratio", description: "Cash / Current Liabilities", category: "treasury",
    inputs: [
      { name: "Cash & Equivalents ($M)", key: "c", default: 60, min: 0, max: 10000, step: 1, suffix: "M" },
      { name: "Current Liabilities ($M)", key: "l", default: 100, min: 1, max: 10000, step: 1, suffix: "M" },
    ],
    compute: ({ c, l }) => {
      const r = c / l;
      return [{ label: "Cash Ratio", value: num(r), tone: r >= 0.5 ? "good" : "bad" }];
    },
  },
  {
    id: "interest-coverage", title: "Interest Coverage", description: "EBIT / Interest expense", category: "treasury",
    inputs: [
      { name: "EBIT ($M)", key: "e", default: 120, min: -1000, max: 10000, step: 1, suffix: "M" },
      { name: "Interest ($M)", key: "i", default: 20, min: 0.1, max: 10000, step: 0.1, suffix: "M" },
    ],
    compute: ({ e, i }) => {
      const c = e / i;
      return [{ label: "Coverage", value: `${num(c)}x`, tone: c >= 3 ? "good" : "bad" }];
    },
  },
  {
    id: "future-value", title: "Future Value", description: "PV × (1+r)^n", category: "treasury",
    inputs: [
      { name: "Present Value ($)", key: "pv", default: 10000, min: 1, max: 10_000_000, step: 100, suffix: "$" },
      { name: "Rate (%)", key: "r", default: 7, min: 0, max: 30, step: 0.1, suffix: "%" },
      { name: "Years", key: "n", default: 10, min: 1, max: 60, step: 1 },
    ],
    compute: ({ pv, r, n }) => [{ label: "Future Value", value: money(pv * Math.pow(1 + r / 100, n)), tone: "good" }],
  },

  // ========== VC METRICS (expansion) ==========
  {
    id: "arr-per-employee", title: "ARR per Employee", description: "Revenue productivity of headcount", category: "vc",
    inputs: [
      { name: "ARR ($)", key: "arr", default: 4_000_000, min: 100_000, max: 200_000_000, step: 100_000, suffix: "$" },
      { name: "Employees", key: "e", default: 30, min: 1, max: 2000, step: 1 },
    ],
    compute: ({ arr, e }) => {
      const v = arr / e;
      return [{ label: "ARR / Employee", value: money(v), tone: v >= 150_000 ? "good" : "bad" }];
    },
  },
  {
    id: "logo-retention", title: "Logo Retention", description: "Customers retained over the period", category: "vc",
    inputs: [
      { name: "Customers at start", key: "s", default: 400, min: 1, max: 100_000, step: 1 },
      { name: "Customers churned", key: "c", default: 24, min: 0, max: 50_000, step: 1 },
    ],
    compute: ({ s, c }) => {
      const r = ((s - c) / s) * 100;
      return [
        { label: "Logo Retention", value: pct(r), tone: r >= 90 ? "good" : "bad" },
        { label: "Gross Logo Churn", value: pct(100 - r) },
      ];
    },
  },
  {
    id: "blended-cac", title: "Blended CAC", description: "Total S&M / new customers", category: "vc",
    inputs: [
      { name: "S&M Spend ($)", key: "sm", default: 300_000, min: 1000, max: 20_000_000, step: 1000, suffix: "$" },
      { name: "New Customers", key: "n", default: 240, min: 1, max: 50_000, step: 1 },
    ],
    compute: ({ sm, n }) => [{ label: "Blended CAC", value: money(sm / n) }],
  },
  {
    id: "ltv-model", title: "Customer LTV", description: "ARPU × GM% ÷ monthly churn", category: "vc",
    inputs: [
      { name: "ARPU ($/mo)", key: "a", default: 120, min: 1, max: 20_000, step: 1, suffix: "$" },
      { name: "Gross Margin (%)", key: "gm", default: 78, min: 1, max: 99, step: 1, suffix: "%" },
      { name: "Monthly Churn (%)", key: "c", default: 2, min: 0.1, max: 30, step: 0.1, suffix: "%" },
    ],
    compute: ({ a, gm, c }) => {
      const life = 1 / (c / 100);
      return [
        { label: "LTV", value: money(a * (gm / 100) * life), tone: "good" },
        { label: "Avg Lifetime", value: `${num(life, 1)} mo` },
      ];
    },
  },
  {
    id: "net-burn", title: "Net Burn Rate", description: "Gross burn − monthly revenue", category: "vc",
    inputs: [
      { name: "Gross Burn ($/mo)", key: "g", default: 400_000, min: 0, max: 10_000_000, step: 5000, suffix: "$" },
      { name: "Revenue ($/mo)", key: "r", default: 150_000, min: 0, max: 10_000_000, step: 5000, suffix: "$" },
    ],
    compute: ({ g, r }) => {
      const n = g - r;
      return [{ label: "Net Burn", value: money(n), tone: n <= 0 ? "good" : "bad" }];
    },
  },
  {
    id: "bessemer-efficiency", title: "Capital Efficiency Score", description: "Net new ARR ÷ net burn", category: "vc",
    inputs: [
      { name: "Net New ARR ($)", key: "arr", default: 1_200_000, min: 0, max: 50_000_000, step: 50_000, suffix: "$" },
      { name: "Net Burn ($)", key: "burn", default: 1_000_000, min: 1000, max: 50_000_000, step: 50_000, suffix: "$" },
    ],
    compute: ({ arr, burn }) => {
      const s = arr / burn;
      return [{ label: "Efficiency Score", value: num(s), tone: s >= 1 ? "good" : "bad" }];
    },
  },
  {
    id: "expansion-share", title: "Expansion ARR Share", description: "% of new ARR from existing accounts", category: "vc",
    inputs: [
      { name: "Expansion ARR ($)", key: "e", default: 400_000, min: 0, max: 20_000_000, step: 10_000, suffix: "$" },
      { name: "New Logo ARR ($)", key: "n", default: 800_000, min: 0, max: 20_000_000, step: 10_000, suffix: "$" },
    ],
    compute: ({ e, n }) => {
      const s = e + n ? (e / (e + n)) * 100 : 0;
      return [{ label: "Expansion Share", value: pct(s), tone: s >= 30 ? "good" : "default" }];
    },
  },
  {
    id: "arr-multiple", title: "ARR Valuation Multiple", description: "Implied enterprise value", category: "vc",
    inputs: [
      { name: "ARR ($)", key: "arr", default: 5_000_000, min: 100_000, max: 500_000_000, step: 100_000, suffix: "$" },
      { name: "Multiple (×)", key: "m", default: 8, min: 1, max: 40, step: 0.5, suffix: "×" },
    ],
    compute: ({ arr, m }) => [{ label: "Implied Valuation", value: money(arr * m), tone: "good" }],
  },

  // ========== CORPORATE FINANCE (expansion) ==========
  {
    id: "roic", title: "ROIC", description: "NOPAT ÷ invested capital", category: "corp",
    inputs: [
      { name: "NOPAT ($M)", key: "n", default: 14, min: -100, max: 1000, step: 0.5, suffix: "M" },
      { name: "Invested Capital ($M)", key: "c", default: 90, min: 1, max: 5000, step: 1, suffix: "M" },
    ],
    compute: ({ n, c }) => {
      const r = (n / c) * 100;
      return [{ label: "ROIC", value: pct(r), tone: r >= 10 ? "good" : "bad" }];
    },
  },
  {
    id: "asset-turnover", title: "Asset Turnover", description: "Revenue ÷ total assets", category: "corp",
    inputs: [
      { name: "Revenue ($M)", key: "r", default: 120, min: 1, max: 5000, step: 1, suffix: "M" },
      { name: "Total Assets ($M)", key: "a", default: 95, min: 1, max: 5000, step: 1, suffix: "M" },
    ],
    compute: ({ r, a }) => [{ label: "Asset Turnover", value: `${num(r / a)}×` }],
  },
  {
    id: "fcf", title: "Free Cash Flow", description: "EBIT(1−t) + D&A − Capex − ΔNWC", category: "corp",
    inputs: [
      { name: "EBIT ($M)", key: "ebit", default: 25, min: -200, max: 2000, step: 0.5, suffix: "M" },
      { name: "Tax Rate (%)", key: "t", default: 25, min: 0, max: 60, step: 1, suffix: "%" },
      { name: "D&A ($M)", key: "da", default: 8, min: 0, max: 500, step: 0.5, suffix: "M" },
      { name: "Capex ($M)", key: "cx", default: 10, min: 0, max: 500, step: 0.5, suffix: "M" },
      { name: "Δ NWC ($M)", key: "nwc", default: 3, min: -100, max: 300, step: 0.5, suffix: "M" },
    ],
    compute: ({ ebit, t, da, cx, nwc }) => {
      const f = ebit * (1 - t / 100) + da - cx - nwc;
      return [{ label: "Free Cash Flow", value: `$${num(f)}M`, tone: f > 0 ? "good" : "bad" }];
    },
  },
  {
    id: "quick-ratio-corp", title: "Acid-Test Ratio", description: "(Current assets − inventory) / CL", category: "corp",
    inputs: [
      { name: "Current Assets ($M)", key: "a", default: 18, min: 0, max: 2000, step: 0.5, suffix: "M" },
      { name: "Inventory ($M)", key: "i", default: 4, min: 0, max: 1000, step: 0.5, suffix: "M" },
      { name: "Current Liabilities ($M)", key: "l", default: 9, min: 0.5, max: 2000, step: 0.5, suffix: "M" },
    ],
    compute: ({ a, i, l }) => {
      const q = (a - i) / l;
      return [{ label: "Acid-Test", value: num(q), tone: q >= 1 ? "good" : "bad" }];
    },
  },
  {
    id: "inventory-turnover", title: "Inventory Turnover", description: "COGS ÷ average inventory", category: "corp",
    inputs: [
      { name: "COGS ($M)", key: "c", default: 60, min: 1, max: 3000, step: 1, suffix: "M" },
      { name: "Avg Inventory ($M)", key: "i", default: 8, min: 0.5, max: 500, step: 0.5, suffix: "M" },
    ],
    compute: ({ c, i }) => {
      const t = c / i;
      return [
        { label: "Turnover", value: `${num(t)}×` },
        { label: "Days Inventory", value: `${num(365 / t, 0)} days` },
      ];
    },
  },
  {
    id: "eps", title: "Earnings per Share", description: "Net income ÷ diluted shares", category: "corp",
    inputs: [
      { name: "Net Income ($M)", key: "ni", default: 18, min: -200, max: 2000, step: 0.5, suffix: "M" },
      { name: "Diluted Shares (M)", key: "s", default: 24, min: 0.5, max: 2000, step: 0.5, suffix: "M" },
    ],
    compute: ({ ni, s }) => [{ label: "EPS", value: `$${num(ni / s)}`, tone: ni > 0 ? "good" : "bad" }],
  },
  {
    id: "pe-ratio", title: "P/E Ratio", description: "Share price ÷ EPS", category: "corp",
    inputs: [
      { name: "Share Price ($)", key: "p", default: 42, min: 1, max: 2000, step: 1, suffix: "$" },
      { name: "EPS ($)", key: "e", default: 2.1, min: 0.05, max: 100, step: 0.05, suffix: "$" },
    ],
    compute: ({ p, e }) => [{ label: "P/E", value: `${num(p / e)}×` }],
  },
  {
    id: "enterprise-value", title: "Enterprise Value", description: "Market cap + debt − cash", category: "corp",
    inputs: [
      { name: "Market Cap ($M)", key: "mc", default: 400, min: 1, max: 100_000, step: 5, suffix: "M" },
      { name: "Total Debt ($M)", key: "d", default: 80, min: 0, max: 50_000, step: 5, suffix: "M" },
      { name: "Cash ($M)", key: "c", default: 45, min: 0, max: 50_000, step: 5, suffix: "M" },
    ],
    compute: ({ mc, d, c }) => [{ label: "Enterprise Value", value: `$${num(mc + d - c, 0)}M`, tone: "good" }],
  },

  // ========== MICROECONOMICS (expansion) ==========
  {
    id: "contribution-margin", title: "Contribution Margin", description: "Per-unit and ratio", category: "micro",
    inputs: [
      { name: "Price ($)", key: "p", default: 99, min: 1, max: 5000, step: 1, suffix: "$" },
      { name: "Variable Cost ($)", key: "v", default: 28, min: 0, max: 5000, step: 1, suffix: "$" },
    ],
    compute: ({ p, v }) => {
      const cm = p - v;
      const r = (cm / p) * 100;
      return [
        { label: "CM / Unit", value: money(cm) },
        { label: "CM Ratio", value: pct(r), tone: r >= 60 ? "good" : "bad" },
      ];
    },
  },
  {
    id: "operating-leverage", title: "Degree of Operating Leverage", description: "Contribution ÷ operating income", category: "micro",
    inputs: [
      { name: "Contribution Margin ($K)", key: "cm", default: 800, min: 1, max: 100_000, step: 10, suffix: "K" },
      { name: "Fixed Costs ($K)", key: "f", default: 500, min: 0, max: 100_000, step: 10, suffix: "K" },
    ],
    compute: ({ cm, f }) => {
      const op = cm - f;
      const dol = op !== 0 ? cm / op : Infinity;
      return [
        { label: "Operating Income", value: `$${num(op, 0)}K`, tone: op > 0 ? "good" : "bad" },
        { label: "DOL", value: `${num(dol)}×` },
      ];
    },
  },
  {
    id: "margin-of-safety", title: "Margin of Safety", description: "Cushion above break-even sales", category: "micro",
    inputs: [
      { name: "Actual Sales ($K)", key: "s", default: 1200, min: 1, max: 100_000, step: 10, suffix: "K" },
      { name: "Break-Even Sales ($K)", key: "b", default: 850, min: 1, max: 100_000, step: 10, suffix: "K" },
    ],
    compute: ({ s, b }) => {
      const m = ((s - b) / s) * 100;
      return [{ label: "Margin of Safety", value: pct(m), tone: m >= 20 ? "good" : "bad" }];
    },
  },
  {
    id: "lerner-index", title: "Lerner Index / Markup", description: "Pricing power vs marginal cost", category: "micro",
    inputs: [
      { name: "Price ($)", key: "p", default: 60, min: 1, max: 5000, step: 1, suffix: "$" },
      { name: "Marginal Cost ($)", key: "mc", default: 22, min: 0, max: 5000, step: 1, suffix: "$" },
    ],
    compute: ({ p, mc }) => {
      const l = (p - mc) / p;
      return [
        { label: "Lerner Index", value: num(l), tone: l >= 0.4 ? "good" : "default" },
        { label: "Markup over MC", value: pct(((p - mc) / mc) * 100) },
      ];
    },
  },
  {
    id: "eoq", title: "Economic Order Quantity", description: "√(2DS / H)", category: "micro",
    inputs: [
      { name: "Annual Demand (units)", key: "d", default: 12_000, min: 10, max: 1_000_000, step: 10 },
      { name: "Order Cost ($)", key: "s", default: 150, min: 1, max: 10_000, step: 1, suffix: "$" },
      { name: "Holding Cost ($/unit/yr)", key: "h", default: 6, min: 0.1, max: 500, step: 0.1, suffix: "$" },
    ],
    compute: ({ d, s, h }) => {
      const q = Math.sqrt((2 * d * s) / h);
      return [
        { label: "EOQ", value: `${Math.round(q).toLocaleString()} units`, tone: "good" },
        { label: "Orders / Year", value: num(d / q, 1) },
      ];
    },
  },
  {
    id: "producer-surplus", title: "Producer Surplus", description: "½ × (P − min accepted) × Q", category: "micro",
    inputs: [
      { name: "Market Price ($)", key: "p", default: 80, min: 1, max: 5000, step: 1, suffix: "$" },
      { name: "Min Accepted Price ($)", key: "m", default: 35, min: 0, max: 5000, step: 1, suffix: "$" },
      { name: "Quantity", key: "q", default: 1500, min: 1, max: 500_000, step: 10 },
    ],
    compute: ({ p, m, q }) => [{ label: "Producer Surplus", value: money(0.5 * Math.max(0, p - m) * q), tone: "good" }],
  },
  {
    id: "learning-curve", title: "Learning Curve Cost", description: "Unit cost after cumulative volume", category: "micro",
    inputs: [
      { name: "First Unit Cost ($)", key: "c", default: 1000, min: 1, max: 1_000_000, step: 10, suffix: "$" },
      { name: "Learning Rate (%)", key: "lr", default: 85, min: 50, max: 100, step: 1, suffix: "%" },
      { name: "Cumulative Units", key: "n", default: 64, min: 1, max: 100_000, step: 1 },
    ],
    compute: ({ c, lr, n }) => {
      const b = Math.log(lr / 100) / Math.log(2);
      const cost = c * Math.pow(n, b);
      return [
        { label: "Nth Unit Cost", value: money(cost), tone: "good" },
        { label: "Cost Reduction", value: pct((1 - cost / c) * 100) },
      ];
    },
  },

  // ========== CAPITAL BUDGETING (expansion) ==========
  {
    id: "discounted-payback", title: "Discounted Payback", description: "Years to recover capex, discounted", category: "capex",
    inputs: [
      { name: "Initial Investment ($)", key: "i", default: 500_000, min: 1000, max: 50_000_000, step: 10_000, suffix: "$" },
      { name: "Annual Cash Flow ($)", key: "cf", default: 150_000, min: 1000, max: 20_000_000, step: 5000, suffix: "$" },
      { name: "Discount Rate (%)", key: "r", default: 10, min: 0.5, max: 40, step: 0.5, suffix: "%" },
    ],
    compute: ({ i, cf, r }) => {
      let cum = 0;
      let year = 0;
      for (let y = 1; y <= 60; y++) {
        cum += cf / Math.pow(1 + r / 100, y);
        if (cum >= i) { year = y; break; }
      }
      return [{ label: "Discounted Payback", value: year ? `${year} yrs` : ">60 yrs", tone: year && year <= 5 ? "good" : "bad" }];
    },
  },
  {
    id: "exit-multiple-tv", title: "Exit Multiple Terminal Value", description: "Terminal EBITDA × multiple, discounted", category: "capex",
    inputs: [
      { name: "Terminal EBITDA ($M)", key: "e", default: 20, min: 0.5, max: 2000, step: 0.5, suffix: "M" },
      { name: "Exit Multiple (×)", key: "m", default: 10, min: 1, max: 40, step: 0.5, suffix: "×" },
      { name: "Discount Rate (%)", key: "r", default: 12, min: 1, max: 40, step: 0.5, suffix: "%" },
      { name: "Years to Exit", key: "n", default: 5, min: 1, max: 20, step: 1 },
    ],
    compute: ({ e, m, r, n }) => {
      const tv = e * m;
      return [
        { label: "Terminal Value", value: `$${num(tv, 0)}M` },
        { label: "PV of TV", value: `$${num(tv / Math.pow(1 + r / 100, n), 1)}M`, tone: "good" },
      ];
    },
  },
  {
    id: "capital-recovery", title: "Capital Recovery Factor", description: "Annual payment per $ of capital", category: "capex",
    inputs: [
      { name: "Capital ($)", key: "c", default: 500_000, min: 1000, max: 50_000_000, step: 10_000, suffix: "$" },
      { name: "Rate (%)", key: "r", default: 10, min: 0.5, max: 40, step: 0.5, suffix: "%" },
      { name: "Years", key: "n", default: 7, min: 1, max: 40, step: 1 },
    ],
    compute: ({ c, r, n }) => {
      const i = r / 100;
      const crf = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
      return [
        { label: "CRF", value: num(crf, 4) },
        { label: "Annual Recovery", value: money(c * crf), tone: "good" },
      ];
    },
  },
  {
    id: "ddb-depreciation", title: "Double-Declining Depreciation", description: "Year-1 accelerated charge", category: "capex",
    inputs: [
      { name: "Asset Cost ($)", key: "c", default: 500_000, min: 1000, max: 50_000_000, step: 10_000, suffix: "$" },
      { name: "Useful Life (yrs)", key: "n", default: 5, min: 1, max: 40, step: 1 },
    ],
    compute: ({ c, n }) => {
      const rate = 2 / n;
      const y1 = c * rate;
      return [
        { label: "Year 1 Depreciation", value: money(y1) },
        { label: "Year 2 Depreciation", value: money((c - y1) * rate) },
      ];
    },
  },
  {
    id: "equivalent-annual-cost", title: "Equivalent Annual Cost", description: "Annualized cost of owning an asset", category: "capex",
    inputs: [
      { name: "Purchase Cost ($)", key: "c", default: 300_000, min: 1000, max: 20_000_000, step: 5000, suffix: "$" },
      { name: "Annual Opex ($)", key: "o", default: 25_000, min: 0, max: 5_000_000, step: 1000, suffix: "$" },
      { name: "Rate (%)", key: "r", default: 9, min: 0.5, max: 40, step: 0.5, suffix: "%" },
      { name: "Life (yrs)", key: "n", default: 8, min: 1, max: 40, step: 1 },
    ],
    compute: ({ c, o, r, n }) => {
      const i = r / 100;
      const crf = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
      return [{ label: "Equivalent Annual Cost", value: money(c * crf + o), tone: "bad" }];
    },
  },
  {
    id: "arr-accounting", title: "Accounting Rate of Return", description: "Avg profit ÷ avg investment", category: "capex",
    inputs: [
      { name: "Avg Annual Profit ($)", key: "p", default: 80_000, min: 0, max: 10_000_000, step: 1000, suffix: "$" },
      { name: "Initial Investment ($)", key: "i", default: 500_000, min: 1000, max: 50_000_000, step: 10_000, suffix: "$" },
    ],
    compute: ({ p, i }) => {
      const a = (p / (i / 2)) * 100;
      return [{ label: "ARR (accounting)", value: pct(a), tone: a >= 15 ? "good" : "bad" }];
    },
  },
  {
    id: "terminal-value-gordon", title: "Terminal Value (Gordon)", description: "FCF × (1+g) / (WACC − g)", category: "capex",
    inputs: [
      { name: "Final-Year FCF ($M)", key: "fcf", default: 30, min: 0.5, max: 2000, step: 0.5, suffix: "M" },
      { name: "WACC (%)", key: "w", default: 11, min: 2, max: 40, step: 0.5, suffix: "%" },
      { name: "Perpetual Growth (%)", key: "g", default: 2.5, min: 0, max: 10, step: 0.1, suffix: "%" },
    ],
    compute: ({ fcf, w, g }) => {
      if (w <= g) return [{ label: "Terminal Value", value: "—", tone: "bad" }];
      return [{ label: "Terminal Value", value: `$${num((fcf * (1 + g / 100)) / ((w - g) / 100), 0)}M`, tone: "good" }];
    },
  },

  // ========== TREASURY (expansion) ==========
  {
    id: "annuity-pv", title: "Annuity Present Value", description: "PV of level payments", category: "treasury",
    inputs: [
      { name: "Payment ($)", key: "pmt", default: 25_000, min: 100, max: 5_000_000, step: 500, suffix: "$" },
      { name: "Rate (%)", key: "r", default: 8, min: 0.1, max: 40, step: 0.1, suffix: "%" },
      { name: "Periods", key: "n", default: 10, min: 1, max: 60, step: 1 },
    ],
    compute: ({ pmt, r, n }) => {
      const i = r / 100;
      return [{ label: "Present Value", value: money((pmt * (1 - Math.pow(1 + i, -n))) / i), tone: "good" }];
    },
  },
  {
    id: "effective-annual-rate", title: "Effective Annual Rate", description: "Compounding-adjusted rate", category: "treasury",
    inputs: [
      { name: "Nominal Rate (%)", key: "r", default: 12, min: 0.1, max: 60, step: 0.1, suffix: "%" },
      { name: "Compounds / Year", key: "m", default: 12, min: 1, max: 365, step: 1 },
    ],
    compute: ({ r, m }) => {
      const ear = (Math.pow(1 + r / 100 / m, m) - 1) * 100;
      return [
        { label: "EAR", value: pct(ear, 2), tone: "good" },
        { label: "Spread vs Nominal", value: pct(ear - r, 2) },
      ];
    },
  },
  {
    id: "working-capital", title: "Working Capital Requirement", description: "Receivables + inventory − payables", category: "treasury",
    inputs: [
      { name: "Receivables ($K)", key: "ar", default: 450, min: 0, max: 100_000, step: 10, suffix: "K" },
      { name: "Inventory ($K)", key: "inv", default: 200, min: 0, max: 100_000, step: 10, suffix: "K" },
      { name: "Payables ($K)", key: "ap", default: 260, min: 0, max: 100_000, step: 10, suffix: "K" },
    ],
    compute: ({ ar, inv, ap }) => {
      const w = ar + inv - ap;
      return [{ label: "Working Capital Need", value: `$${num(w, 0)}K`, tone: w <= 0 ? "good" : "bad" }];
    },
  },
  {
    id: "dscr", title: "Debt Service Coverage", description: "NOI ÷ annual debt service", category: "treasury",
    inputs: [
      { name: "Net Operating Income ($K)", key: "noi", default: 900, min: 0, max: 100_000, step: 10, suffix: "K" },
      { name: "Annual Debt Service ($K)", key: "ds", default: 650, min: 1, max: 100_000, step: 10, suffix: "K" },
    ],
    compute: ({ noi, ds }) => {
      const d = noi / ds;
      return [{ label: "DSCR", value: `${num(d)}×`, tone: d >= 1.25 ? "good" : "bad" }];
    },
  },
  {
    id: "net-debt-ebitda", title: "Net Debt / EBITDA", description: "Leverage covenant check", category: "treasury",
    inputs: [
      { name: "Total Debt ($M)", key: "d", default: 60, min: 0, max: 5000, step: 1, suffix: "M" },
      { name: "Cash ($M)", key: "c", default: 15, min: 0, max: 5000, step: 1, suffix: "M" },
      { name: "EBITDA ($M)", key: "e", default: 18, min: 0.5, max: 2000, step: 0.5, suffix: "M" },
    ],
    compute: ({ d, c, e }) => {
      const x = (d - c) / e;
      return [{ label: "Net Debt / EBITDA", value: `${num(x)}×`, tone: x <= 3 ? "good" : "bad" }];
    },
  },
  {
    id: "current-yield", title: "Bond Current Yield", description: "Annual coupon ÷ market price", category: "treasury",
    inputs: [
      { name: "Face Value ($)", key: "f", default: 1000, min: 100, max: 100_000, step: 100, suffix: "$" },
      { name: "Coupon Rate (%)", key: "c", default: 6, min: 0, max: 25, step: 0.1, suffix: "%" },
      { name: "Market Price ($)", key: "p", default: 950, min: 50, max: 100_000, step: 10, suffix: "$" },
    ],
    compute: ({ f, c, p }) => [{ label: "Current Yield", value: pct((f * (c / 100)) / p * 100, 2), tone: "good" }],
  },
  {
    id: "sharpe-ratio", title: "Sharpe Ratio", description: "Excess return per unit of risk", category: "treasury",
    inputs: [
      { name: "Portfolio Return (%)", key: "r", default: 14, min: -50, max: 100, step: 0.5, suffix: "%" },
      { name: "Risk-Free Rate (%)", key: "rf", default: 4, min: 0, max: 20, step: 0.1, suffix: "%" },
      { name: "Std Deviation (%)", key: "sd", default: 12, min: 0.5, max: 100, step: 0.5, suffix: "%" },
    ],
    compute: ({ r, rf, sd }) => {
      const s = (r - rf) / sd;
      return [{ label: "Sharpe Ratio", value: num(s), tone: s >= 1 ? "good" : "bad" }];
    },
  },
];

// ---------- Sample startup benchmark overrides (per calc id + input key) ----------
const SAMPLE_OVERRIDES: Record<string, Record<string, number>> = {
  "cac-payback": { cac: 500, mgp: 75 },
  "ltv-cac": { ltv: 3600, cac: 500 },
  "magic-number": { arr: 900_000, sm: 750_000 },
  "rule-of-40": { g: 80, e: -20 },
  "burn-multiple": { burn: 250_000, arr: 200_000 },
  "dilution": { pre: 25, size: 8, own: 65 },
  "runway": { cash: 4_500_000, burn: 275_000 },
  "net-dollar-retention": { start: 1_500_000, exp: 300_000, churn: 90_000 },
  "quick-ratio": { n: 80_000, e: 40_000, c: 15_000, d: 8_000 },
  "wacc": { we: 70, ke: 14, kd: 7, t: 25 },
  "dcf-simple": { fcf: 25, wacc: 10, g: 3 },
  "dupont": { m: 15, t: 1.3, l: 2.2 },
  "altman-z": { a: 0.25, b: 0.35, c: 0.18, d: 2.0, e: 1.4 },
  "cash-conv": { dio: 35, dso: 42, dpo: 28 },
  "gordon": { d: 2.5, r: 10, g: 4 },
  "eva": { n: 12, c: 60, w: 10 },
  "current-ratio": { a: 15, l: 8 },
  "de-ratio": { d: 20, e: 40 },
  "price-elasticity": { q: -15, p: 10 },
  "cross-price": { qa: 12, pb: 10 },
  "income-elasticity": { q: 18, i: 12 },
  "break-even": { f: 120_000, p: 79, v: 22 },
  "consumer-surplus": { wtp: 149, p: 49, q: 2000 },
  "marginal-revenue": { r: 4900, q: 100 },
  "npv-project": { i: 500_000, cf: 150_000, n: 5, r: 10 },
  "irr": { i: 500_000, cf: 150_000, n: 5 },
  "mirr": { i: 500_000, cf: 150_000, n: 5 },
  "payback": { i: 500_000, cf: 150_000 },
  "profitability-index": { pv: 700_000, i: 500_000 },
  "depreciation": { cost: 500_000, salvage: 50_000, life: 5 },
  "eaa": { npv: 250_000, r: 10, n: 5 },
  // expansion set — realistic seed/Series-A benchmarks
  "arr-per-employee": { arr: 4_000_000, e: 25 },
  "logo-retention": { s: 400, c: 20 },
  "blended-cac": { sm: 300_000, n: 240 },
  "ltv-model": { a: 120, gm: 78, c: 2 },
  "net-burn": { g: 400_000, r: 150_000 },
  "bessemer-efficiency": { arr: 1_200_000, burn: 1_000_000 },
  "expansion-share": { e: 400_000, n: 800_000 },
  "arr-multiple": { arr: 5_000_000, m: 8 },
  "roic": { n: 14, c: 90 },
  "asset-turnover": { r: 120, a: 95 },
  "fcf": { ebit: 25, t: 25, da: 8, cx: 10, nwc: 3 },
  "quick-ratio-corp": { a: 18, i: 4, l: 9 },
  "inventory-turnover": { c: 60, i: 8 },
  "eps": { ni: 18, s: 24 },
  "pe-ratio": { p: 42, e: 2.1 },
  "enterprise-value": { mc: 400, d: 80, c: 45 },
  "contribution-margin": { p: 99, v: 28 },
  "operating-leverage": { cm: 800, f: 500 },
  "margin-of-safety": { s: 1200, b: 850 },
  "lerner-index": { p: 60, mc: 22 },
  "eoq": { d: 12_000, s: 150, h: 6 },
  "producer-surplus": { p: 80, m: 35, q: 1500 },
  "learning-curve": { c: 1000, lr: 85, n: 64 },
  "discounted-payback": { i: 500_000, cf: 150_000, r: 10 },
  "exit-multiple-tv": { e: 20, m: 10, r: 12, n: 5 },
  "capital-recovery": { c: 500_000, r: 10, n: 7 },
  "ddb-depreciation": { c: 500_000, n: 5 },
  "equivalent-annual-cost": { c: 300_000, o: 25_000, r: 9, n: 8 },
  "arr-accounting": { p: 80_000, i: 500_000 },
  "terminal-value-gordon": { fcf: 30, w: 11, g: 2.5 },
  "annuity-pv": { pmt: 25_000, r: 8, n: 10 },
  "effective-annual-rate": { r: 12, m: 12 },
  "working-capital": { ar: 450, inv: 200, ap: 260 },
  "dscr": { noi: 900, ds: 650 },
  "net-debt-ebitda": { d: 60, c: 15, e: 18 },
  "current-yield": { f: 1000, c: 6, p: 950 },
  "sharpe-ratio": { r: 14, rf: 4, sd: 12 },
  "loan-payment": { p: 350_000, r: 6.5, n: 30 },
};

// ---------- UI ----------
function CalcMatrix() {
  const [sampleTick, setSampleTick] = useState(0);
  const autoFill = () => setSampleTick((t) => t + 1);


  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Toolkit</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Calculator Matrix</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {calculatorConfig.length} calculators across {CATEGORIES.length} categories · config-driven
          </p>
        </div>
        <Button onClick={autoFill} variant="secondary" size="sm" className="gap-2">
          <Wand2 className="h-4 w-4" />
          Auto-Fill Sample Data
        </Button>
      </header>

      <Tabs defaultValue="vc" orientation="vertical" className="flex flex-col gap-6 lg:flex-row">
        <TabsList className="flex h-auto flex-row overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:justify-start lg:bg-transparent lg:p-0">
          {CATEGORIES.map((c) => {
            const n = calculatorConfig.filter((x) => x.category === c.id).length;
            return (
              <TabsTrigger key={c.id} value={c.id} className="justify-start lg:w-full">
                <span>{c.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{n}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>


        <div className="flex-1 space-y-6">
          {CATEGORIES.map((c) => (
            <TabsContent key={c.id} value={c.id} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {calculatorConfig
                  .filter((x) => x.category === c.id)
                  .map((calc) => (
                    <DynamicCalcCard key={calc.id} calc={calc} sampleTick={sampleTick} />
                  ))}

              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}

function DynamicCalcCard({ calc, sampleTick }: { calc: CalcConfig; sampleTick: number }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(calc.inputs.map((i) => [i.key, i.default])),
  );
  useEffect(() => {
    if (sampleTick === 0) return;
    const overrides = SAMPLE_OVERRIDES[calc.id] ?? {};
    setValues(
      Object.fromEntries(calc.inputs.map((i) => [i.key, overrides[i.key] ?? i.default])),
    );
  }, [sampleTick, calc]);

  const results = useMemo(() => {
    try {
      return calc.compute(values);
    } catch {
      return [{ label: "Result", value: "—" }];
    }
  }, [calc, values]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{calc.title}</CardTitle>
        <CardDescription>{calc.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {calc.inputs.map((input) => (
          <div key={input.key} className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <Label className="text-muted-foreground">{input.name}</Label>
              <span className="tabular-nums font-medium">
                {values[input.key].toLocaleString()}
                {input.suffix ?? ""}
              </span>
            </div>
            <Slider
              value={[values[input.key]]}
              onValueChange={([v]) => setValues((prev) => ({ ...prev, [input.key]: v }))}
              min={input.min ?? 0}
              max={input.max ?? 100}
              step={input.step ?? 1}
            />
          </div>
        ))}

        <div className="grid gap-2">
          {results.map((r, i) => (
            <Result key={i} label={r.label} value={r.value} tone={r.tone} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Result({ label, value, tone = "default" }: { label: string; value: string; tone?: Tone }) {
  const color = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

