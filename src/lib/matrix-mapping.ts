import type { FinanceState } from "./finance-store";
import { computeBalanceSheet, type LedgerEntry } from "./ledger";
import type { MatrixPatch } from "./calc-live-store";
import type { FieldKey } from "./doc-extract";

export type ExtractedFields = Partial<Record<FieldKey, number>>;

/**
 * Turn the user's own data (documents → extracted fields, P&L inputs, ledger)
 * into a Calculator Matrix patch keyed by calculator id → input key.
 */
export function buildMatrixPatchFromData(
  state: FinanceState,
  ledger: LedgerEntry[],
  extracted: ExtractedFields,
): { patch: MatrixPatch; used: { label: string; value: number }[] } {
  const bs = ledger.length ? computeBalanceSheet(ledger) : null;

  const customRev = state.customRows.filter((r) => r.category === "revenue").reduce((a, r) => a + r.value, 0);
  const customCogs = state.customRows.filter((r) => r.category === "cogs").reduce((a, r) => a + r.value, 0);
  const customOpex = state.customRows.filter((r) => r.category === "opex").reduce((a, r) => a + r.value, 0);

  const revenue = extracted.revenue ?? state.revenue + customRev;
  const cogs = extracted.cogs ?? state.cogs + customCogs;
  const opex = state.salaries + state.marketing + state.otherOpex + customOpex;
  const marketing = extracted.marketing ?? state.marketing;
  const ebitda = revenue - state.discounts - cogs - opex;

  const cash =
    extracted.cash ??
    (bs && bs.totalAssets > 0 ? bs.totalAssets : undefined) ??
    Math.max(0, revenue / 4);
  const monthlyBurn = extracted.monthlyBurn ?? Math.max(1000, Math.round((opex + cogs - revenue) / 12) || opex / 12);
  const arr = extracted.arr ?? revenue;
  const newArr = extracted.newArr ?? Math.max(1000, Math.round(arr * 0.25));
  const cac = extracted.cac ?? state.cac;
  const arpu = extracted.arpu ?? state.arpu;
  const grossMarginPct = extracted.grossMarginPct ?? (revenue ? ((revenue - cogs) / revenue) * 100 : state.grossMarginPct);
  const churn = extracted.churnRate ?? state.churnRate;
  const growth = extracted.growthRate ?? 30;
  const ebitdaMargin = revenue ? (ebitda / revenue) * 100 : 0;
  const ltv = churn > 0 ? (arpu * (grossMarginPct / 100)) / (churn / 100) : arpu * 24;
  const monthlyGrossProfit = arpu * (grossMarginPct / 100);

  const patch: MatrixPatch = {
    runway: { cash: round(cash), burn: round(Math.max(1000, monthlyBurn)) },
    "burn-multiple": { burn: round(Math.max(0, monthlyBurn)), arr: round(Math.max(1000, newArr / 12)) },
    "rule-of-40": { g: clamp(growth, -20, 200), e: clamp(ebitdaMargin, -80, 80) },
    "magic-number": { arr: round(Math.max(0, newArr / 4)), sm: round(Math.max(10000, marketing / 4)) },
    "cac-payback": { cac: round(cac), mgp: round(Math.max(5, monthlyGrossProfit)) },
    "ltv-cac": { ltv: round(Math.max(100, ltv)), cac: round(cac) },
    "net-burn": { g: round(Math.max(0, (opex + cogs) / 12)), r: round(Math.max(0, revenue / 12)) },
    "contribution-margin": { p: round(Math.max(1, arpu)), v: round(Math.max(0, arpu * (1 - grossMarginPct / 100))) },
  };

  const used = [
    { label: "Revenue", value: revenue },
    { label: "COGS", value: cogs },
    { label: "Cash", value: cash },
    { label: "Monthly burn", value: monthlyBurn },
    { label: "ARR", value: arr },
    { label: "CAC", value: cac },
    { label: "Gross margin %", value: grossMarginPct },
  ];

  return { patch, used };
}

const round = (n: number) => (isFinite(n) ? Math.round(n) : 0);
const clamp = (n: number, min: number, max: number) =>
  isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
