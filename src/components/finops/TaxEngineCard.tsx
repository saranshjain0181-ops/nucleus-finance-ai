import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark } from "lucide-react";
import { computePnL, fmtCurrency, fmtPct, useFinance } from "@/lib/finance-store";
import {
  computeTax,
  GST_RATES,
  JURISDICTIONS,
  taxBase,
  US_STATES,
  type JurisdictionId,
  type TaxSettings,
} from "@/lib/tax-engine";
import { useMemo } from "react";

export function TaxEngineCard() {
  const { state, set } = useFinance();
  const s = state.tax;
  const patch = (p: Partial<TaxSettings>) => set("tax", { ...s, ...p });

  const pnl = useMemo(() => computePnL(state), [state]);
  const base = useMemo(
    () => taxBase(state.ledger, { revenue: pnl.netSales, expenses: pnl.totalCogs + pnl.totalOpex }),
    [state.ledger, pnl],
  );
  const result = useMemo(() => computeTax(s, base), [s, base]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-emerald-400" /> Tax Summary — {result.jurisdictionLabel}
          </CardTitle>
          <CardDescription>
            Provisions derived from your ledger (falling back to the P&amp;L when the books are empty).
          </CardDescription>
        </div>
        <Select value={s.jurisdiction} onValueChange={(v) => patch({ jurisdiction: v as JurisdictionId })}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Tax jurisdiction" />
          </SelectTrigger>
          <SelectContent>
            {JURISDICTIONS.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.flag} {j.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Headline figures */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Gross Invoiced Revenue" value={fmtCurrency(result.grossRevenue)} />
          <Stat label={`Estimated Output Tax — ${result.outputTaxLabel}`} value={fmtCurrency(result.outputTax)} />
          <Stat label="Corporate Tax Provision" value={fmtCurrency(result.corporateTax)} tone="warn" />
          <Stat
            label="Net Post-Tax Cash Flow"
            value={fmtCurrency(result.netPostTaxCashFlow)}
            tone={result.netPostTaxCashFlow >= 0 ? "good" : "bad"}
          />
        </div>

        {/* Jurisdiction controls */}
        <div className="grid gap-4 rounded-lg border border-border/60 p-4 md:grid-cols-3">
          {s.jurisdiction === "IN" && (
            <>
              <Wrap label="GST rate">
                <Select value={String(s.gstRate)} onValueChange={(v) => patch({ gstRate: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((r) => (
                      <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Wrap>
              <Toggle label="Inter-state supply (IGST)" checked={s.interState} onChange={(v) => patch({ interState: v })} />
              <Toggle
                label="New domestic manufacturing (15%)"
                checked={s.indiaNewManufacturing}
                onChange={(v) => patch({ indiaNewManufacturing: v })}
              />
              <Toggle
                label="Section 80-IAC startup holiday"
                checked={s.section80IAC}
                onChange={(v) => patch({ section80IAC: v })}
              />
            </>
          )}

          {s.jurisdiction === "US" && (
            <>
              <Wrap label="State corporate tax">
                <Select value={s.usState} onValueChange={(v) => patch({ usState: v as TaxSettings["usState"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.label} — {st.rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Wrap>
              <Toggle label="R&D credit (Form 6765)" checked={s.rdCredit} onChange={(v) => patch({ rdCredit: v })} />
              <Wrap label="R&D credit amount ($)">
                <Input
                  type="number"
                  value={s.rdCreditAmount}
                  disabled={!s.rdCredit}
                  onChange={(e) => patch({ rdCreditAmount: Number(e.target.value) || 0 })}
                />
              </Wrap>
            </>
          )}

          {s.jurisdiction === "GB" && (
            <>
              <Toggle label="VAT Flat Rate Scheme" checked={s.ukFlatRateVat} onChange={(v) => patch({ ukFlatRateVat: v })} />
              <Toggle label="Claim RDEC on R&D" checked={s.ukRdec} onChange={(v) => patch({ ukRdec: v })} />
              <p className="self-center text-xs text-muted-foreground">
                19% under £50k profits, tapering to 25% above £250k.
              </p>
            </>
          )}

          {s.jurisdiction === "SG" && (
            <p className="text-xs text-muted-foreground md:col-span-3">
              17% flat corporate tax with Partial Tax Exemption (75% on the first $10k, 50% on the next $190k) and 9% GST
              applied automatically.
            </p>
          )}

          {s.jurisdiction === "AE" && (
            <>
              <Toggle label="Free Zone qualifying entity" checked={s.uaeFreeZone} onChange={(v) => patch({ uaeFreeZone: v })} />
              <p className="self-center text-xs text-muted-foreground md:col-span-2">
                0% up to AED 375,000 of profit, 9% above the threshold.
              </p>
            </>
          )}

          {s.jurisdiction === "EE" && (
            <>
              <Wrap label="Profit distributed as dividends ($)">
                <Input
                  type="number"
                  value={s.euDistributedProfit}
                  onChange={(e) => patch({ euDistributedProfit: Number(e.target.value) || 0 })}
                />
              </Wrap>
              <Wrap label="EU OSS VAT rate (%)">
                <Input
                  type="number"
                  value={s.euOssVatRate}
                  onChange={(e) => patch({ euOssVatRate: Number(e.target.value) || 0 })}
                />
              </Wrap>
              <p className="self-center text-xs text-muted-foreground">
                Retained and reinvested profit is untaxed; 20% applies on distribution only.
              </p>
            </>
          )}
        </div>

        {/* Breakdown */}
        <div className="divide-y divide-border/50">
          {result.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="text-muted-foreground">
                {l.label}
                {l.note ? <span className="ml-2 text-[11px] opacity-70">{l.note}</span> : null}
              </span>
              <span className="tabular-nums">{fmtCurrency(l.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 text-sm font-semibold">
            <span>Profit before tax</span>
            <span className="tabular-nums">{fmtCurrency(result.profitBeforeTax)}</span>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">Effective corporate tax rate</span>
            <Badge variant="outline" className="text-emerald-400">{fmtPct(result.effectiveRate)}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : tone === "warn" ? "text-amber-400" : "";
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Wrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
