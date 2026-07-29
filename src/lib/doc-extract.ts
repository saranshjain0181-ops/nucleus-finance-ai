import * as XLSX from "xlsx";
import { normalizeAccountType, type LedgerEntry } from "./ledger";

/* ------------------------------------------------------------------ */
/* Text extraction (browser-only, nothing leaves the device)           */
/* ------------------------------------------------------------------ */

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((i) => ("str" in i ? (i as { str: string }).str : ""))
          .join(" ")
          .replace(/\s{2,}/g, " "),
      );
    }
    return pages.join("\n");
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return res.value;
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".ods")) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
  }

  // csv / txt / md / anything else readable as text
  return await file.text();
}

/* ------------------------------------------------------------------ */
/* Number parsing                                                      */
/* ------------------------------------------------------------------ */

export function parseFinancialNumber(raw: string): number | null {
  let s = raw.trim().replace(/[$€£₹,\s]/g, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  const m = s.match(/^(\d+(?:\.\d+)?)([kKmMbB%]?)/);
  if (!m) return null;
  let n = Number(m[1]);
  const suffix = m[2].toLowerCase();
  if (suffix === "k") n *= 1_000;
  if (suffix === "m") n *= 1_000_000;
  if (suffix === "b") n *= 1_000_000_000;
  return negative ? -n : n;
}

/* ------------------------------------------------------------------ */
/* Field dictionary                                                    */
/* ------------------------------------------------------------------ */

export type FieldKey =
  | "revenue"
  | "discounts"
  | "cogs"
  | "salaries"
  | "marketing"
  | "otherOpex"
  | "depreciation"
  | "interest"
  | "taxRate"
  | "cac"
  | "arpu"
  | "grossMarginPct"
  | "churnRate"
  | "cash"
  | "monthlyBurn"
  | "arr"
  | "newArr"
  | "headcount"
  | "growthRate"
  | "mau"
  | "subscriptionPrice";

type FieldDef = { key: FieldKey; label: string; aliases: string[]; unit: "currency" | "percent" | "count" };

export const FIELD_DEFS: FieldDef[] = [
  { key: "revenue", label: "Revenue", unit: "currency", aliases: ["total revenue", "gross revenue", "net revenue", "revenue", "total sales", "turnover"] },
  { key: "discounts", label: "Discounts & Returns", unit: "currency", aliases: ["discounts and returns", "discounts", "returns and allowances", "sales returns"] },
  { key: "cogs", label: "Cost of Goods Sold", unit: "currency", aliases: ["cost of goods sold", "cost of revenue", "cost of sales", "cogs"] },
  { key: "salaries", label: "Salaries", unit: "currency", aliases: ["salaries and wages", "payroll", "salaries", "personnel costs", "wages"] },
  { key: "marketing", label: "Marketing", unit: "currency", aliases: ["sales and marketing", "marketing expense", "marketing spend", "marketing", "s&m"] },
  { key: "otherOpex", label: "Other OpEx", unit: "currency", aliases: ["other operating expenses", "general and administrative", "other opex", "g&a", "admin expenses"] },
  { key: "depreciation", label: "Depreciation & Amortization", unit: "currency", aliases: ["depreciation and amortization", "depreciation & amortisation", "depreciation", "amortization"] },
  { key: "interest", label: "Interest Expense", unit: "currency", aliases: ["interest expense", "finance costs", "interest paid", "interest"] },
  { key: "taxRate", label: "Tax Rate", unit: "percent", aliases: ["effective tax rate", "tax rate"] },
  { key: "cac", label: "CAC", unit: "currency", aliases: ["customer acquisition cost", "cac"] },
  { key: "arpu", label: "ARPU", unit: "currency", aliases: ["average revenue per user", "arpu", "arpa"] },
  { key: "grossMarginPct", label: "Gross Margin %", unit: "percent", aliases: ["gross margin percentage", "gross margin %", "gross margin"] },
  { key: "churnRate", label: "Churn Rate", unit: "percent", aliases: ["monthly churn", "churn rate", "logo churn", "churn"] },
  { key: "cash", label: "Cash Balance", unit: "currency", aliases: ["cash and cash equivalents", "cash balance", "cash on hand", "cash"] },
  { key: "monthlyBurn", label: "Monthly Burn", unit: "currency", aliases: ["net monthly burn", "monthly burn", "net burn", "burn rate", "cash burn"] },
  { key: "arr", label: "ARR", unit: "currency", aliases: ["annual recurring revenue", "arr"] },
  { key: "newArr", label: "New ARR", unit: "currency", aliases: ["new arr", "net new arr", "new bookings"] },
  { key: "headcount", label: "Headcount", unit: "count", aliases: ["headcount", "employees", "fte"] },
  { key: "growthRate", label: "Growth Rate", unit: "percent", aliases: ["yoy growth", "revenue growth", "growth rate"] },
  { key: "mau", label: "Monthly Active Users", unit: "count", aliases: ["monthly active users", "mau", "active users"] },
  { key: "subscriptionPrice", label: "Subscription Price", unit: "currency", aliases: ["subscription price", "price per seat", "monthly price", "list price"] },
];

export type DetectedValue = {
  id: string;
  key: FieldKey;
  label: string;
  value: number;
  unit: FieldDef["unit"];
  source: string;
  context: string;
};

const NUM = /\(?-?[$€£₹]?\s?\d[\d,]*(?:\.\d+)?\s?[kKmMbB%]?\)?/;

/** Scan raw document text for "<label> ... <number>" pairs. */
export function detectFields(text: string, source: string): DetectedValue[] {
  const lines = text
    .split(/[\n\r]+/)
    .map((l) => l.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  const found = new Map<FieldKey, DetectedValue>();

  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const def of FIELD_DEFS) {
      if (found.has(def.key)) continue;
      for (const alias of def.aliases) {
        const idx = lower.indexOf(alias);
        if (idx === -1) continue;
        const after = line.slice(idx + alias.length);
        const m = after.match(NUM);
        if (!m) continue;
        const value = parseFinancialNumber(m[0]);
        if (value === null || !isFinite(value)) continue;
        if (def.unit === "percent" && Math.abs(value) > 100) continue;
        found.set(def.key, {
          id: `${source}-${def.key}`,
          key: def.key,
          label: def.label,
          value,
          unit: def.unit,
          source,
          context: line.slice(0, 140),
        });
        break;
      }
    }
  }

  return Array.from(found.values());
}

/* ------------------------------------------------------------------ */
/* Ledger detection from tabular files                                 */
/* ------------------------------------------------------------------ */

const pick = (row: Record<string, unknown>, names: string[]) => {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase().trim() === n);
    if (k !== undefined) return row[k];
  }
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase().includes(n));
    if (k !== undefined) return row[k];
  }
  return undefined;
};

/** True when a tabular file looks like a ledger / trial balance export. */
export function looksLikeLedger(rows: Record<string, unknown>[]): boolean {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]).map((k) => k.toLowerCase());
  const hasAccount = keys.some((k) => k.includes("account"));
  const hasDr = keys.some((k) => k.includes("debit") || k === "dr");
  const hasCr = keys.some((k) => k.includes("credit") || k === "cr");
  return hasAccount && hasDr && hasCr;
}

export function rowsToLedger(rows: Record<string, unknown>[], source: string): LedgerEntry[] {
  return rows
    .map((r, i) => {
      const account = String(pick(r, ["account", "account name", "particulars", "ledger"]) ?? "").trim();
      const debit = parseFinancialNumber(String(pick(r, ["debit", "dr"]) ?? "0")) ?? 0;
      const credit = parseFinancialNumber(String(pick(r, ["credit", "cr"]) ?? "0")) ?? 0;
      const rawType = String(pick(r, ["type", "account type", "class", "category"]) ?? "");
      const date = String(pick(r, ["date", "posting date"]) ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
      const description = String(pick(r, ["description", "memo", "narration", "details"]) ?? "");
      return {
        id: `led-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        date,
        account: account || `Account ${i + 1}`,
        type: normalizeAccountType(rawType || account),
        description,
        debit,
        credit,
        source,
      } satisfies LedgerEntry;
    })
    .filter((e) => e.account && (e.debit !== 0 || e.credit !== 0));
}

/** Parse a workbook/CSV buffer into plain row objects. */
export async function fileToRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: file.name.toLowerCase().endsWith(".csv") ? "binary" : "array", raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}
