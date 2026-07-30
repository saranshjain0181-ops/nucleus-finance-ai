/** Subscription/customer records parsed from ingested files, plus cohort & NRR derivations. */

export type SubStatus = "active" | "upgraded" | "downgraded" | "churned";

export type SubRecord = {
  customerId: string;
  cohort: string; // YYYY-MM join month
  plan: string;
  mrr: number;
  status: SubStatus;
  month: string; // YYYY-MM activity month
};

export type CohortData = {
  records: SubRecord[];
  source: string;
  importedAt: number;
};

const monthKey = (raw: unknown): string => {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // Excel serial date
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) as unknown as number);
    d.setUTCDate(d.getUTCDate() + Number(s));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return s.slice(0, 7);
};

const normStatus = (raw: unknown): SubStatus => {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("churn") || s.includes("cancel") || s.includes("lost")) return "churned";
  if (s.includes("upgrad") || s.includes("expan")) return "upgraded";
  if (s.includes("downgrad") || s.includes("contract")) return "downgraded";
  return "active";
};

const num = (raw: unknown): number => {
  const n = Number(String(raw ?? "").replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};

const pick = (row: Record<string, unknown>, names: string[]) => {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase().trim() === n);
    if (k !== undefined) return row[k];
  }
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase().replace(/[_\s]/g, "").includes(n.replace(/[_\s]/g, "")));
    if (k !== undefined) return row[k];
  }
  return undefined;
};

/** True when a tabular file looks like customer subscription data. */
export function looksLikeSubscriptions(rows: Record<string, unknown>[]): boolean {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]).map((k) => k.toLowerCase().replace(/[_\s]/g, ""));
  const hasCustomer = keys.some((k) => k.includes("customer") || k.includes("userid") || k.includes("accountid"));
  const hasMrr = keys.some((k) => k.includes("mrr") || k.includes("revenue"));
  const hasMonth = keys.some((k) => k.includes("month") || k.includes("period") || k.includes("date"));
  return hasCustomer && hasMrr && hasMonth;
}

export function rowsToSubRecords(rows: Record<string, unknown>[]): SubRecord[] {
  return rows
    .map((r) => {
      const customerId = String(pick(r, ["customer id", "customerid", "customer", "user id", "account id"]) ?? "").trim();
      const cohort = monthKey(pick(r, ["cohort join date", "cohort", "join date", "signup date", "start date"]));
      const month = monthKey(pick(r, ["activity month", "month", "period", "date"]));
      return {
        customerId,
        cohort: cohort || month,
        plan: String(pick(r, ["subscription plan", "plan", "tier", "product"]) ?? "—"),
        mrr: num(pick(r, ["monthly recurring revenue", "mrr", "revenue", "amount"])),
        status: normStatus(pick(r, ["status", "state", "event"])),
        month,
      } satisfies SubRecord;
    })
    .filter((r) => r.customerId && r.month);
}

/* ------------------------------------------------------------------ */
/* Cohort retention                                                     */
/* ------------------------------------------------------------------ */

export type CohortRow = {
  label: string; // cohort month
  size: number; // customers in month 0
  baseMrr: number;
  cells: { retention: number; nrr: number; customers: number; mrr: number }[];
};

const monthDiff = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (!fy || !ty) return -1;
  return (ty - fy) * 12 + (tm - fm);
};

export function computeCohorts(records: SubRecord[], maxPeriods = 12): CohortRow[] {
  const cohortMap = new Map<string, Map<number, { customers: Set<string>; mrr: number }>>();

  for (const r of records) {
    if (r.status === "churned") continue;
    const offset = monthDiff(r.cohort, r.month);
    if (offset < 0 || offset >= maxPeriods) continue;
    const byOffset = cohortMap.get(r.cohort) ?? new Map();
    const cell = byOffset.get(offset) ?? { customers: new Set<string>(), mrr: 0 };
    cell.customers.add(r.customerId);
    cell.mrr += r.mrr;
    byOffset.set(offset, cell);
    cohortMap.set(r.cohort, byOffset);
  }

  return Array.from(cohortMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, byOffset]) => {
      const zero = byOffset.get(0);
      const size = zero?.customers.size ?? 0;
      const baseMrr = zero?.mrr ?? 0;
      const cells = Array.from({ length: maxPeriods }, (_, i) => {
        const c = byOffset.get(i);
        const customers = c?.customers.size ?? 0;
        const mrr = c?.mrr ?? 0;
        return {
          customers,
          mrr,
          retention: size ? (customers / size) * 100 : 0,
          nrr: baseMrr ? (mrr / baseMrr) * 100 : 0,
        };
      });
      return { label, size, baseMrr, cells };
    });
}

/* ------------------------------------------------------------------ */
/* Net revenue retention time series                                    */
/* ------------------------------------------------------------------ */

export type NrrPoint = {
  month: string;
  startingMrr: number;
  expansion: number;
  contraction: number;
  churn: number;
  endingMrr: number;
  nrr: number;
};

export function computeNrrSeries(records: SubRecord[]): NrrPoint[] {
  const months = Array.from(new Set(records.map((r) => r.month))).sort();
  const mrrByMonth = new Map<string, Map<string, SubRecord>>();
  for (const r of records) {
    const m = mrrByMonth.get(r.month) ?? new Map<string, SubRecord>();
    m.set(r.customerId, r);
    mrrByMonth.set(r.month, m);
  }

  const points: NrrPoint[] = [];
  for (let i = 1; i < months.length; i++) {
    const prev = mrrByMonth.get(months[i - 1])!;
    const cur = mrrByMonth.get(months[i])!;
    let startingMrr = 0;
    let expansion = 0;
    let contraction = 0;
    let churn = 0;

    prev.forEach((prevRec, id) => {
      if (prevRec.status === "churned") return;
      startingMrr += prevRec.mrr;
      const curRec = cur.get(id);
      if (!curRec || curRec.status === "churned") {
        churn += prevRec.mrr;
        return;
      }
      const delta = curRec.mrr - prevRec.mrr;
      if (delta > 0) expansion += delta;
      else contraction += -delta;
    });

    const endingMrr = startingMrr + expansion - contraction - churn;
    points.push({
      month: months[i],
      startingMrr,
      expansion,
      contraction,
      churn,
      endingMrr,
      nrr: startingMrr ? (endingMrr / startingMrr) * 100 : 0,
    });
  }
  return points;
}

/** Synthetic cohorts used before any customer file is ingested. */
export function syntheticCohorts(churnRatePct: number, maxPeriods = 12): CohortRow[] {
  const seed = churnRatePct / 100;
  return Array.from({ length: 8 }, (_, ci) => {
    const cells = Array.from({ length: maxPeriods }, (_, mi) => {
      const retention = Math.max(0, Math.pow(1 - seed - ci * 0.005, mi)) * 100;
      return { retention, nrr: retention * (1 + mi * 0.015), customers: 0, mrr: 0 };
    });
    return { label: `M${ci + 1}`, size: 0, baseMrr: 0, cells };
  });
}
