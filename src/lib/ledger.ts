export type AccountType =
  // Core financial
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense"
  // Engineering economics & cost accounting
  | "direct-labor"
  | "direct-material"
  | "capex"
  | "depreciation"
  | "overhead"
  | "salvage"
  | "sinking-fund"
  | "tax-provision"
  | "deferred-revenue";

/** Where each account type lands on the balance sheet / P&L. */
export type AccountGroup = "asset" | "liability" | "equity" | "revenue" | "expense";

export type LedgerEntry = {
  id: string;
  date: string;
  account: string;
  type: AccountType;
  /** Optional finer classification, e.g. "Fixed Asset", "Subscription MRR". */
  subtype?: string;
  description: string;
  debit: number;
  credit: number;
  /** Tax treatment of the line, used by the jurisdiction engine. */
  taxable?: boolean;
  source?: string;
};

export type AccountTypeDef = {
  id: AccountType;
  label: string;
  group: AccountGroup;
  section: "Core Financial" | "Engineering Economics & Cost Accounting";
  subtypes: string[];
};

export const ACCOUNT_TYPES: AccountTypeDef[] = [
  {
    id: "asset",
    label: "Asset",
    group: "asset",
    section: "Core Financial",
    subtypes: ["Current Asset", "Fixed Asset", "Intangible Asset"],
  },
  {
    id: "liability",
    label: "Liability",
    group: "liability",
    section: "Core Financial",
    subtypes: ["Current Liability", "Long-Term Liability", "Accrued Liability"],
  },
  {
    id: "equity",
    label: "Equity",
    group: "equity",
    section: "Core Financial",
    subtypes: ["Common Stock", "Paid-in Capital", "Retained Earnings"],
  },
  {
    id: "revenue",
    label: "Revenue",
    group: "revenue",
    section: "Core Financial",
    subtypes: ["Operating Revenue", "Subscription MRR", "Service Income"],
  },
  {
    id: "expense",
    label: "Expense (OpEx)",
    group: "expense",
    section: "Core Financial",
    subtypes: ["Operating Expense", "General & Administrative"],
  },
  {
    id: "direct-labor",
    label: "Direct Labor",
    group: "expense",
    section: "Engineering Economics & Cost Accounting",
    subtypes: ["Engineering Payroll", "R&D Payroll", "Contract Engineering"],
  },
  {
    id: "direct-material",
    label: "Direct Material / COGS",
    group: "expense",
    section: "Engineering Economics & Cost Accounting",
    subtypes: ["Hosting", "API Compute", "Cloud Infrastructure"],
  },
  {
    id: "capex",
    label: "Capital Expenditure (CapEx)",
    group: "asset",
    section: "Engineering Economics & Cost Accounting",
    subtypes: ["Equipment", "Server Hardware", "Intellectual Property"],
  },
  {
    id: "depreciation",
    label: "Depreciation & Amortization",
    group: "expense",
    section: "Engineering Economics & Cost Accounting",
    subtypes: ["Straight-Line Decay", "Declining Balance", "Sinking Fund Depreciation"],
  },
  {
    id: "overhead",
    label: "Overhead / SG&A",
    group: "expense",
    section: "Engineering Economics & Cost Accounting",
    subtypes: ["Rent", "Software Subscriptions", "Legal & Compliance"],
  },
  {
    id: "salvage",
    label: "Salvage Value / Asset Disposal",
    group: "asset",
    section: "Engineering Economics & Cost Accounting",
    subtypes: ["Terminal Value Recovery", "Scrap Proceeds"],
  },
  {
    id: "sinking-fund",
    label: "Sinking Fund / Capital Reserve",
    group: "asset",
    section: "Engineering Economics & Cost Accounting",
    subtypes: ["Equipment Replacement Reserve", "Capital Replacement Fund"],
  },
  {
    id: "tax-provision",
    label: "Tax Provision / Liability",
    group: "liability",
    section: "Engineering Economics & Cost Accounting",
    subtypes: ["Corporate Income Tax", "VAT / GST Payable"],
  },
  {
    id: "deferred-revenue",
    label: "Deferred / Unearned Revenue",
    group: "liability",
    section: "Engineering Economics & Cost Accounting",
    subtypes: ["Upfront Annual Subscription", "Prepaid Services"],
  },
];

export const ACCOUNT_TYPE_MAP: Record<AccountType, AccountTypeDef> = Object.fromEntries(
  ACCOUNT_TYPES.map((t) => [t.id, t]),
) as Record<AccountType, AccountTypeDef>;

export function accountGroup(type: AccountType): AccountGroup {
  return ACCOUNT_TYPE_MAP[type]?.group ?? "expense";
}

export function accountLabel(type: AccountType): string {
  return ACCOUNT_TYPE_MAP[type]?.label ?? type;
}

/** Debit-positive groups (assets & expenses increase with debits). */
const DEBIT_NORMAL: AccountGroup[] = ["asset", "expense"];

export function normalizeAccountType(raw: string): AccountType {
  const s = raw.toLowerCase().trim();
  if (!s) return "expense";
  if (s.includes("deferred") || s.includes("unearned")) return "deferred-revenue";
  if (s.includes("tax")) return "tax-provision";
  if (s.includes("sinking") || s.includes("reserve")) return "sinking-fund";
  if (s.includes("salvage") || s.includes("disposal")) return "salvage";
  if (s.includes("capex") || s.includes("capital expenditure")) return "capex";
  if (s.includes("deprec") || s.includes("amort")) return "depreciation";
  if (s.includes("overhead") || s.includes("sg&a") || s.includes("g&a")) return "overhead";
  if (s.includes("direct labor") || s.includes("direct labour") || s.includes("payroll")) return "direct-labor";
  if (s.includes("cogs") || s.includes("direct material") || s.includes("hosting") || s.includes("compute"))
    return "direct-material";
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
  group: AccountGroup;
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
      ({
        account: e.account.trim() || "Unnamed account",
        type: e.type,
        group: accountGroup(e.type),
        debit: 0,
        credit: 0,
        balance: 0,
      } as TrialBalanceRow);
    row.debit += Number(e.debit) || 0;
    row.credit += Number(e.credit) || 0;
    map.set(key, row);
  }
  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    balance: DEBIT_NORMAL.includes(r.group) ? r.debit - r.credit : r.credit - r.debit,
  }));
  rows.sort((a, b) => a.group.localeCompare(b.group) || a.account.localeCompare(b.account));
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
  const byGroup = (g: AccountGroup) => rows.filter((r) => r.group === g);
  const sum = (list: TrialBalanceRow[]) => list.reduce((a, r) => a + r.balance, 0);

  const assets = byGroup("asset");
  const liabilities = byGroup("liability");
  const equity = byGroup("equity");
  const totalRevenue = sum(byGroup("revenue"));
  const totalExpenses = sum(byGroup("expense"));
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
    subtype: "",
    description: "",
    debit: 0,
    credit: 0,
    taxable: true,
    source,
  };
}
