import { useMemo, useState } from "react";
import { AlertTriangle, FileSearch, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinance } from "@/lib/finance-store";

const SAMPLE = `MASTER SERVICES AGREEMENT — Amazon Web Services EDP Addendum

1. Commitment. Customer commits to a minimum annual spend of $1,200,000 over a 36-month term.
2. Discount. A promotional discount of 32% applies to all compute usage. The discount expires in 4 months from the Effective Date, after which list pricing applies.
3. Payment Terms. Invoices are payable Net-15. Late payments incur a 2% late fee per month on outstanding balances.
4. Auto-Renewal. This agreement automatically renews for successive 12-month periods unless terminated with 90 days written notice.
5. Price Adjustment. Provider may increase fees by up to 7% annually upon renewal.
6. Termination. Early termination requires payment of 100% of the remaining commitment.
7. Liability. Provider liability is capped at fees paid in the preceding 3 months.`;

type Finding = { title: string; detail: string; severity: "high" | "medium" | "low"; quote: string };

function mine(text: string): Finding[] {
  const out: Finding[] = [];
  const find = (re: RegExp) => text.match(re);
  const disc = find(/discount[^.]*?(\d+)%[^.]*\.[^.]*?expires in (\d+) months?/i);
  if (disc) {
    const d = Number(disc[1]);
    const uplift = (1 / (1 - d / 100) - 1) * 100;
    out.push({
      title: "Pricing Cliff Detected",
      detail: `Discount expires in ${disc[2]} months, resulting in a projected ${uplift.toFixed(0)}% compute cost increase.`,
      severity: "high",
      quote: disc[0],
    });
  }
  const net = find(/Net-?(\d+)[^.]*\.[^.]*?(\d+(?:\.\d+)?)% late fee/i);
  if (net)
    out.push({
      title: "Hidden Liability",
      detail: `Net-${net[1]} payment terms enforced with a ${net[2]}% late fee penalty.`,
      severity: "medium",
      quote: net[0],
    });
  const commit = find(/minimum annual spend of \$([\d,]+)/i);
  if (commit)
    out.push({
      title: "Committed Spend Obligation",
      detail: `$${commit[1]} minimum annual spend — an off-balance-sheet commitment to disclose.`,
      severity: "high",
      quote: commit[0],
    });
  const renew = find(/automatically renews[^.]*?(\d+) days/i);
  if (renew)
    out.push({
      title: "Auto-Renewal Trap",
      detail: `Termination notice of ${renew[1]} days required — add a calendar trigger.`,
      severity: "medium",
      quote: renew[0],
    });
  const esc = find(/increase fees by up to (\d+)%/i);
  if (esc)
    out.push({ title: "Price Escalator", detail: `Up to ${esc[1]}% annual uplift on renewal.`, severity: "low", quote: esc[0] });
  const term = find(/early termination[^.]*?(\d+)% of the remaining/i);
  if (term)
    out.push({
      title: "Termination Penalty",
      detail: `Exit costs ${term[1]}% of remaining commitment.`,
      severity: "high",
      quote: term[0],
    });
  return out;
}

const SEV = {
  high: "border-rose-500/50 bg-rose-500/5 text-rose-300",
  medium: "border-amber-500/50 bg-amber-500/5 text-amber-300",
  low: "border-cyan-500/50 bg-cyan-500/5 text-cyan-300",
};

export function ContractMining() {
  const { state } = useFinance();
  const docs = state.attachments.filter((a) => a.text && a.text.length > 50);
  const [source, setSource] = useState("sample");
  const [ran, setRan] = useState(false);
  const text = source === "sample" ? SAMPLE : (docs.find((d) => d.id === source)?.text ?? "");
  const findings = useMemo(() => (ran ? mine(text) : []), [ran, text]);

  return (
    <Card className="border-cyan-500/30">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSearch className="h-4 w-4 text-cyan-400" /> Contract Mining
          </CardTitle>
          <CardDescription>NLP reads MSAs and SaaS contracts to surface hidden financial liabilities.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select
            value={source}
            onValueChange={(v) => {
              setSource(v);
              setRan(false);
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sample">Sample: AWS EDP Addendum</SelectItem>
              {docs.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="bg-cyan-500 text-black hover:bg-cyan-400" onClick={() => setRan(true)}>
            <ScanText className="mr-2 h-4 w-4" /> Mine Contract
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="h-[460px] overflow-auto rounded-md border border-border/60 bg-muted/20 p-6">
          <div className="mx-auto max-w-prose rounded bg-card p-6 shadow-lg">
            <pre className="whitespace-pre-wrap font-serif text-[12px] leading-relaxed text-foreground/90">{text}</pre>
          </div>
        </div>
        <div className="h-[460px] space-y-3 overflow-auto">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Extracted Financial Metadata</p>
          {!ran && <p className="text-sm text-muted-foreground">Run “Mine Contract” to extract clauses.</p>}
          {ran && findings.length === 0 && (
            <p className="text-sm text-muted-foreground">No financial liabilities detected in this document.</p>
          )}
          {findings.map((f) => (
            <div key={f.title} className={`rounded-lg border p-4 ${SEV[f.severity]}`}>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4" /> {f.title}
                </p>
                <Badge variant="outline" className="uppercase">
                  {f.severity}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-foreground/90">{f.detail}</p>
              <p className="mt-2 border-l-2 border-current/40 pl-2 text-[11px] italic text-muted-foreground">“{f.quote}”</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
