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
};

// ---------- UI ----------
function CalcMatrix() {
  const [sampleTick, setSampleTick] = useState(0);
  const autoFill = () => setSampleTick((t) => t + 1);


  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Toolkit</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Calculator Matrix</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {calculatorConfig.length} calculators across {CATEGORIES.length} categories · config-driven
        </p>
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
                    <DynamicCalcCard key={calc.id} calc={calc} />
                  ))}
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}

function DynamicCalcCard({ calc }: { calc: CalcConfig }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(calc.inputs.map((i) => [i.key, i.default])),
  );
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

