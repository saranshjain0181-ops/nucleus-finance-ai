export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type LedgerEntry = {
  id: string;
  date: string;
  account: string;
  type: AccountType;
  description: string;
  debit: number;
  credit: number;
  source?: string;
};

export const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: "asset", label: "Asset" },
  { id: "liability", label: "Liability" },
  { id: "equity", label: "Equity" },
  { id: "revenue", label: "Revenue" },
  { id: "expense", label: "Expense" },
];

/** Debit-positive account types (assets & expenses increase with debits). */
const DEBIT_NORMAL: AccountType[] = ["asset", "expense"];

export function normalizeAccountType(raw: string): AccountType {
  const s = raw.toLowerCase().trim();
  if (s.startsWith("asset")) return "asset";
  if (s.startsWith("liab")) return "liability";
  if (s.startsWith("equity") || s.includes("capital")) return "equity";
  if (s.startsWith("rev") || s.includes("income") || s.includes("sales")) return "revenue";
  if (s.startsWith("exp") || s.includes("cost")) return "expense";
  return "expense";
}

export type TrialBalanceRow = {
  account: string;
  type: AccountType;
  debit: number;
  credit: number;
  balance: number;
};

export function computeTrialBalance(entries: LedgerEntry[]): {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
} {
  const map = new Map<string, TrialBalanceRow>();
  for (const e of entries) {
    const key = `${e.type}::${e.account.trim().toLowerCase() || "unnamed"}`;
    const row =
      map.get(key) ??
      ({ account: e.account.trim() || "Unnamed account", type: e.type, debit: 0, credit: 0, balance: 0 } as TrialBalanceRow);
    row.debit += Number(e.debit) || 0;
    row.credit += Number(e.credit) || 0;
    map.set(key, row);
  }
  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    balance: DEBIT_NORMAL.includes(r.type) ? r.debit - r.credit : r.credit - r.debit,
  }));
  rows.sort((a, b) => a.type.localeCompare(b.type) || a.account.localeCompare(b.account));
  const totalDebit = rows.reduce((a, r) => a + r.debit, 0);
  const totalCredit = rows.reduce((a, r) => a + r.credit, 0);
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

export type BalanceSheet = {
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarnings: number;
  totalRevenue: number;
  totalExpenses: number;
  liabilitiesPlusEquity: number;
  balanced: boolean;
};

export function computeBalanceSheet(entries: LedgerEntry[]): BalanceSheet {
  const { rows } = computeTrialBalance(entries);
  const byType = (t: AccountType) => rows.filter((r) => r.type === t);
  const sum = (list: TrialBalanceRow[]) => list.reduce((a, r) => a + r.balance, 0);

  const assets = byType("asset");
  const liabilities = byType("liability");
  const equity = byType("equity");
  const totalRevenue = sum(byType("revenue"));
  const totalExpenses = sum(byType("expense"));
  const retainedEarnings = totalRevenue - totalExpenses;

  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = sum(equity) + retainedEarnings;
  const liabilitiesPlusEquity = totalLiabilities + totalEquity;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    retainedEarnings,
    totalRevenue,
    totalExpenses,
    liabilitiesPlusEquity,
    balanced: Math.abs(totalAssets - liabilitiesPlusEquity) < 0.01,
  };
}

export function emptyEntry(source?: string): LedgerEntry {
  return {
    id: `led-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: new Date().toISOString().slice(0, 10),
    account: "",
    type: "asset",
    description: "",
    debit: 0,
    credit: 0,
    source,
  };
}
