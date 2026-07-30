import { computeBalanceSheet, type LedgerEntry } from "./ledger";

export type JurisdictionId = "IN" | "US" | "GB" | "SG" | "AE" | "EE";

export type TaxSettings = {
  jurisdiction: JurisdictionId;
  /** India */
  gstRate: number; // 5 | 12 | 18 | 28
  interState: boolean; // true => IGST, false => CGST + SGST
  indiaNewManufacturing: boolean; // 15% vs 22%
  section80IAC: boolean; // startup tax holiday
  /** United States */
  usState: "DE" | "CA" | "TX" | "NY" | "WA";
  rdCredit: boolean; // Form 6765 payroll offset
  rdCreditAmount: number;
  /** United Kingdom */
  ukFlatRateVat: boolean;
  ukRdec: boolean;
  /** UAE */
  uaeFreeZone: boolean;
  /** Estonia / EU */
  euDistributedProfit: number; // amount distributed as dividends
  euOssVatRate: number;
};

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  jurisdiction: "US",
  gstRate: 18,
  interState: false,
  indiaNewManufacturing: false,
  section80IAC: false,
  usState: "DE",
  rdCredit: false,
  rdCreditAmount: 250_000,
  ukFlatRateVat: false,
  ukRdec: false,
  uaeFreeZone: false,
  euDistributedProfit: 0,
  euOssVatRate: 21,
};

export const JURISDICTIONS: { id: JurisdictionId; label: string; flag: string; currency: string }[] = [
  { id: "IN", label: "India", flag: "🇮🇳", currency: "INR" },
  { id: "US", label: "United States", flag: "🇺🇸", currency: "USD" },
  { id: "GB", label: "United Kingdom", flag: "🇬🇧", currency: "GBP" },
  { id: "SG", label: "Singapore", flag: "🇸🇬", currency: "SGD" },
  { id: "AE", label: "United Arab Emirates", flag: "🇦🇪", currency: "AED" },
  { id: "EE", label: "Estonia / EU", flag: "🇪🇪", currency: "EUR" },
];

export const US_STATES: { id: TaxSettings["usState"]; label: string; rate: number }[] = [
  { id: "DE", label: "Delaware", rate: 8.7 },
  { id: "CA", label: "California", rate: 8.84 },
  { id: "TX", label: "Texas (Franchise)", rate: 0 },
  { id: "NY", label: "New York", rate: 7.25 },
  { id: "WA", label: "Washington", rate: 0 },
];

export const GST_RATES = [5, 12, 18, 28];

export type TaxLine = { label: string; value: number; note?: string };

export type TaxResult = {
  jurisdiction: JurisdictionId;
  jurisdictionLabel: string;
  grossRevenue: number;
  totalExpenses: number;
  profitBeforeTax: number;
  outputTax: number;
  outputTaxLabel: string;
  corporateTax: number;
  effectiveRate: number;
  netPostTaxCashFlow: number;
  lines: TaxLine[];
};

/** Aggregate revenue / expense from ledger, falling back to supplied P&L figures. */
export function taxBase(entries: LedgerEntry[], fallback: { revenue: number; expenses: number }) {
  const sheet = computeBalanceSheet(entries);
  const revenue = sheet.totalRevenue > 0 ? sheet.totalRevenue : fallback.revenue;
  const expenses = sheet.totalExpenses > 0 ? sheet.totalExpenses : fallback.expenses;
  return { revenue, expenses };
}

export function computeTax(
  s: TaxSettings,
  base: { revenue: number; expenses: number },
): TaxResult {
  const grossRevenue = Math.max(0, base.revenue);
  const totalExpenses = Math.max(0, base.expenses);
  const pbt = grossRevenue - totalExpenses;
  const positive = Math.max(0, pbt);
  const lines: TaxLine[] = [];

  let outputTax = 0;
  let outputTaxLabel = "Output Tax";
  let corporateTax = 0;

  switch (s.jurisdiction) {
    case "IN": {
      outputTax = grossRevenue * (s.gstRate / 100);
      outputTaxLabel = s.interState ? `IGST @ ${s.gstRate}%` : `CGST+SGST @ ${s.gstRate}%`;
      if (s.interState) {
        lines.push({ label: `IGST @ ${s.gstRate}%`, value: outputTax, note: "Inter-state supply" });
      } else {
        lines.push({ label: `CGST @ ${s.gstRate / 2}%`, value: outputTax / 2, note: "In-state supply" });
        lines.push({ label: `SGST @ ${s.gstRate / 2}%`, value: outputTax / 2, note: "In-state supply" });
      }

      if (s.section80IAC) {
        corporateTax = 0;
        lines.push({ label: "Section 80-IAC holiday", value: 0, note: "Eligible startup — 0% on profits" });
      } else {
        const baseRate = s.indiaNewManufacturing ? 0.15 : 0.22;
        const basic = positive * baseRate;
        const surcharge = basic * 0.1;
        const cess = (basic + surcharge) * 0.04;
        corporateTax = basic + surcharge + cess;
        lines.push({ label: `Corporate tax @ ${(baseRate * 100).toFixed(0)}%`, value: basic });
        lines.push({ label: "Surcharge @ 10%", value: surcharge });
        lines.push({ label: "Health & Education Cess @ 4%", value: cess });
      }
      break;
    }

    case "US": {
      outputTax = 0;
      outputTaxLabel = "Sales tax (out of scope)";
      const federal = positive * 0.21;
      const stateDef = US_STATES.find((x) => x.id === s.usState) ?? US_STATES[0];
      const stateTax = positive * (stateDef.rate / 100);
      let credit = 0;
      if (s.rdCredit) credit = Math.min(federal + stateTax, Math.max(0, s.rdCreditAmount));
      corporateTax = Math.max(0, federal + stateTax - credit);
      lines.push({ label: "Federal corporate tax @ 21%", value: federal });
      lines.push({ label: `${stateDef.label} state tax @ ${stateDef.rate}%`, value: stateTax });
      if (s.rdCredit) lines.push({ label: "R&D credit (Form 6765) offset", value: -credit, note: "Payroll tax offset" });
      break;
    }

    case "GB": {
      const vatRate = s.ukFlatRateVat ? 0.145 : 0.2;
      outputTax = grossRevenue * vatRate;
      outputTaxLabel = s.ukFlatRateVat ? "VAT (Flat Rate 14.5%)" : "VAT @ 20%";
      lines.push({ label: outputTaxLabel, value: outputTax });

      let rate: number;
      if (positive <= 50_000) rate = 0.19;
      else if (positive >= 250_000) rate = 0.25;
      else {
        // marginal relief taper between the small profits and main rate
        const main = positive * 0.25;
        const relief = (3 / 200) * (250_000 - positive);
        rate = positive ? Math.max(0, main - relief) / positive : 0.19;
      }
      let ct = positive * rate;
      if (s.ukRdec) {
        const rdec = totalExpenses * 0.2 * 0.15; // 20% RDEC on qualifying ~15% of spend
        ct = Math.max(0, ct - rdec);
        lines.push({ label: "RDEC relief (20% of qualifying R&D)", value: -rdec });
      }
      corporateTax = ct;
      lines.push({ label: `Corporation tax @ ${(rate * 100).toFixed(1)}%`, value: positive * rate });
      break;
    }

    case "SG": {
      outputTax = grossRevenue * 0.09;
      outputTaxLabel = "GST @ 9%";
      lines.push({ label: outputTaxLabel, value: outputTax });
      // Partial tax exemption: 75% on first 10k, 50% on next 190k
      const tier1 = Math.min(positive, 10_000);
      const tier2 = Math.min(Math.max(positive - 10_000, 0), 190_000);
      const tier3 = Math.max(positive - 200_000, 0);
      const chargeable = tier1 * 0.25 + tier2 * 0.5 + tier3;
      corporateTax = chargeable * 0.17;
      lines.push({ label: "Partial Tax Exemption applied", value: -(positive - chargeable) * 0.17, note: "75% on first $10k, 50% on next $190k" });
      lines.push({ label: "Corporate income tax @ 17%", value: corporateTax });
      break;
    }

    case "AE": {
      outputTax = grossRevenue * 0.05;
      outputTaxLabel = "VAT @ 5%";
      lines.push({ label: outputTaxLabel, value: outputTax });
      if (s.uaeFreeZone) {
        corporateTax = 0;
        lines.push({ label: "Free Zone qualifying income", value: 0, note: "0% corporate tax" });
      } else {
        const taxable = Math.max(0, positive - 375_000);
        corporateTax = taxable * 0.09;
        lines.push({ label: "0% on first AED 375,000", value: 0 });
        lines.push({ label: "Corporate tax @ 9% above threshold", value: corporateTax });
      }
      break;
    }

    case "EE": {
      outputTax = grossRevenue * (s.euOssVatRate / 100);
      outputTaxLabel = `EU OSS VAT @ ${s.euOssVatRate}%`;
      lines.push({ label: outputTaxLabel, value: outputTax, note: "Cross-border digital subscriptions" });
      const distributed = Math.min(Math.max(0, s.euDistributedProfit), positive);
      corporateTax = distributed * 0.2;
      lines.push({ label: "Retained / reinvested profit @ 0%", value: 0 });
      lines.push({ label: "Distributed profit tax @ 20%", value: corporateTax });
      break;
    }
  }

  const jurisdictionLabel = JURISDICTIONS.find((j) => j.id === s.jurisdiction)?.label ?? s.jurisdiction;
  return {
    jurisdiction: s.jurisdiction,
    jurisdictionLabel,
    grossRevenue,
    totalExpenses,
    profitBeforeTax: pbt,
    outputTax,
    outputTaxLabel,
    corporateTax,
    effectiveRate: positive ? (corporateTax / positive) * 100 : 0,
    netPostTaxCashFlow: pbt - corporateTax,
    lines,
  };
}
