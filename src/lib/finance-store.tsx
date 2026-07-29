import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { LedgerEntry } from "./ledger";
import type { ExtractedFields } from "./matrix-mapping";


export type FinanceState = {
  // P&L rows
  revenue: number;
  discounts: number;
  cogs: number;
  salaries: number;
  marketing: number;
  otherOpex: number;
  depreciation: number;
  interest: number;
  taxRate: number;
  // Unit economics
  cac: number;
  arpu: number;
  grossMarginPct: number;
  churnRate: number;
  // AI simulator
  tokensPerInteraction: number;
  interactionsPerUser: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  mau: number;
  humanSalary: number;
  humanTasksPerHour: number;
  aiTasksReplaced: number;
  cloudCost: number;
  vectorDbCost: number;
  subscriptionPrice: number;
  // Custom grid rows
  customRows: { id: string; label: string; value: number; category: "revenue" | "cogs" | "opex" }[];
  // Uploaded files (metadata + optional extracted text preview)
  attachments: {
    id: string;
    name: string;
    type: string;
    size: number;
    addedAt: number;
    kind: "csv" | "excel" | "pdf" | "doc" | "slides" | "text" | "other";
    rowsImported?: number;
    preview?: string;
    /** Full extracted text (client-side parse) for PDF/DOCX/TXT sources. */
    text?: string;
  }[];
  // Double-entry books
  ledger: LedgerEntry[];
  /** Figures accepted from uploaded documents, used to seed the Calculator Matrix. */
  extractedFields: ExtractedFields;
  // Latest AI CFO investor narrative (persisted for PDF export)
  latestNarrative: string;
  narrativeAt: number | null;
  // Settings
  geminiApiKey: string;
};


const DEFAULT_STATE: FinanceState = {
  revenue: 1_200_000,
  discounts: 50_000,
  cogs: 420_000,
  salaries: 300_000,
  marketing: 120_000,
  otherOpex: 80_000,
  depreciation: 40_000,
  interest: 20_000,
  taxRate: 25,
  cac: 250,
  arpu: 50,
  grossMarginPct: 70,
  churnRate: 5,
  tokensPerInteraction: 3000,
  interactionsPerUser: 40,
  inputCostPer1M: 3,
  outputCostPer1M: 15,
  mau: 5000,
  humanSalary: 60000,
  humanTasksPerHour: 8,
  aiTasksReplaced: 1000,
  cloudCost: 8000,
  vectorDbCost: 2000,
  subscriptionPrice: 49,
  customRows: [],
  attachments: [],
  latestNarrative: "",
  narrativeAt: null,
  geminiApiKey: "",
};

const STORAGE_KEY = "finops_state_v1";

type Ctx = {
  state: FinanceState;
  update: (patch: Partial<FinanceState>) => void;
  set: <K extends keyof FinanceState>(key: K, value: FinanceState[K]) => void;
  reset: () => void;
};

const FinanceContext = createContext<Ctx | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinanceState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  const value: Ctx = {
    state,
    update: (patch) => setState((s) => ({ ...s, ...patch })),
    set: (key, val) => setState((s) => ({ ...s, [key]: val })),
    reset: () => setState(DEFAULT_STATE),
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used inside FinanceProvider");
  return ctx;
}

export function computePnL(s: FinanceState) {
  const customRev = s.customRows.filter((r) => r.category === "revenue").reduce((a, r) => a + r.value, 0);
  const customCogs = s.customRows.filter((r) => r.category === "cogs").reduce((a, r) => a + r.value, 0);
  const customOpex = s.customRows.filter((r) => r.category === "opex").reduce((a, r) => a + r.value, 0);

  const grossRevenue = s.revenue + customRev;
  const netSales = grossRevenue - s.discounts;
  const totalCogs = s.cogs + customCogs;
  const grossProfit = netSales - totalCogs;
  const totalOpex = s.salaries + s.marketing + s.otherOpex + customOpex;
  const ebitda = grossProfit - totalOpex;
  const ebit = ebitda - s.depreciation;
  const ebt = ebit - s.interest;
  const tax = Math.max(0, ebt) * (s.taxRate / 100);
  const pat = ebt - tax;
  const grossMarginPct = netSales ? (grossProfit / netSales) * 100 : 0;
  const ebitdaMarginPct = netSales ? (ebitda / netSales) * 100 : 0;
  const patMarginPct = netSales ? (pat / netSales) * 100 : 0;
  return {
    grossRevenue,
    netSales,
    totalCogs,
    grossProfit,
    totalOpex,
    ebitda,
    ebit,
    ebt,
    tax,
    pat,
    grossMarginPct,
    ebitdaMarginPct,
    patMarginPct,
  };
}

export function computeAICosts(s: FinanceState) {
  const tokensPerUserPerMonth = s.tokensPerInteraction * s.interactionsPerUser;
  // Assume 40% input, 60% output tokens split
  const inputTokens = tokensPerUserPerMonth * 0.4;
  const outputTokens = tokensPerUserPerMonth * 0.6;
  const costPerUser =
    (inputTokens / 1_000_000) * s.inputCostPer1M + (outputTokens / 1_000_000) * s.outputCostPer1M;
  const monthlyApiCost = costPerUser * s.mau;
  const monthlyInfraCost = s.cloudCost + s.vectorDbCost;
  const totalMonthlyCogs = monthlyApiCost + monthlyInfraCost;
  const revenue = s.subscriptionPrice * s.mau;
  const grossProfit = revenue - totalMonthlyCogs;
  const grossMarginPct = revenue ? (grossProfit / revenue) * 100 : 0;

  // Human comparison
  const humanHourlyCost = s.humanSalary / (52 * 40);
  const humanCostPerTask = humanHourlyCost / s.humanTasksPerHour;
  const aiCostPerTask = costPerUser / s.interactionsPerUser || 0;
  const crossoverUsers =
    aiCostPerTask > 0 ? (s.humanSalary / 12) / (aiCostPerTask * s.interactionsPerUser) : Infinity;

  // Price required for 75% margin
  const minPriceFor75 = costPerUser / 0.25;

  return {
    tokensPerUserPerMonth,
    costPerUser,
    monthlyApiCost,
    monthlyInfraCost,
    totalMonthlyCogs,
    revenue,
    grossProfit,
    grossMarginPct,
    humanCostPerTask,
    aiCostPerTask,
    crossoverUsers,
    minPriceFor75,
  };
}

export function fmtCurrency(n: number) {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${n < 0 ? "-" : ""}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${n < 0 ? "-" : ""}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${n < 0 ? "-" : ""}$${(abs / 1e3).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}

export function fmtPct(n: number) {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}
