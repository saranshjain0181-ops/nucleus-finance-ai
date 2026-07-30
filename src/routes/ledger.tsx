import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BookOpen, Plus, Trash2, Scale, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance, fmtCurrency } from "@/lib/finance-store";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_MAP,
  computeBalanceSheet,
  computeTrialBalance,
  emptyEntry,
  type AccountType,
  type LedgerEntry,
  type TrialBalanceRow,
} from "@/lib/ledger";
import { TaxEngineCard } from "@/components/finops/TaxEngineCard";
import { toast } from "sonner";


export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Ledger, Trial Balance & Balance Sheet — FinOps Studio" },
      {
        name: "description",
        content:
          "Build a double-entry general ledger and get an auto-derived trial balance and balance sheet from your own uploaded books.",
      },
      { property: "og:title", content: "Ledger, Trial Balance & Balance Sheet — FinOps Studio" },
      {
        property: "og:description",
        content: "Double-entry ledger with auto-derived trial balance and balance sheet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LedgerView,
});

function LedgerView() {
  const { state, set } = useFinance();
  const entries = state.ledger;

  const trial = useMemo(() => computeTrialBalance(entries), [entries]);
  const sheet = useMemo(() => computeBalanceSheet(entries), [entries]);

  const setEntries = (next: LedgerEntry[]) => set("ledger", next);
  const addRow = () => setEntries([...entries, emptyEntry()]);
  const patchRow = (id: string, patch: Partial<LedgerEntry>) =>
    setEntries(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeRow = (id: string) => setEntries(entries.filter((e) => e.id !== id));

  const exportCsv = () => {
    const header = "date,account,type,subtype,description,debit,credit";
    const body = entries
      .map((e) => [e.date, e.account, e.type, e.subtype ?? "", e.description, e.debit, e.credit].join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `general-ledger-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Ledger exported");
  };

  const difference = trial.totalDebit - trial.totalCredit;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Books</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Ledger &amp; Books</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Post journal entries once — the trial balance and balance sheet derive themselves.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={trial.balanced ? "text-emerald-400" : "text-red-400"}>
            {trial.balanced ? "Balanced" : `Out by ${fmtCurrency(Math.abs(difference))}`}
          </Badge>
          <Button size="sm" variant="outline" className="gap-2" onClick={exportCsv} disabled={!entries.length}>
            <FileDown className="h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={addRow}>
            <Plus className="h-4 w-4" /> Add entry
          </Button>
        </div>
      </header>

      <Tabs defaultValue="ledger" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ledger" className="gap-2">
            <BookOpen className="h-4 w-4" /> General Ledger
          </TabsTrigger>
          <TabsTrigger value="trial" className="gap-2">
            <Scale className="h-4 w-4" /> Trial Balance
          </TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
        </TabsList>

        {/* ---------------- General ledger ---------------- */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Journal entries ({entries.length})</CardTitle>
              <CardDescription>
                Rows detected in uploaded ledger/trial-balance files land here automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Date</TableHead>
                    <TableHead className="min-w-40">Account</TableHead>
                    <TableHead className="w-36">Type</TableHead>
                    <TableHead className="min-w-40">Description</TableHead>
                    <TableHead className="w-32 text-right">Debit</TableHead>
                    <TableHead className="w-32 text-right">Credit</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-xs text-muted-foreground">
                        No entries yet — add one, or upload a ledger file in Data Ingestion.
                      </TableCell>
                    </TableRow>
                  )}
                  {entries.map((e) => (
                    <TableRow key={e.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Input
                          type="date"
                          value={e.date}
                          className="h-8"
                          onChange={(ev) => patchRow(e.id, { date: ev.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={e.account}
                          className="h-8"
                          placeholder="Cash / Accounts payable"
                          onChange={(ev) => patchRow(e.id, { account: ev.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={e.type}
                          onValueChange={(v) => patchRow(e.id, { type: v as AccountType })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_TYPES.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={e.description}
                          className="h-8"
                          onChange={(ev) => patchRow(e.id, { description: ev.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={e.debit}
                          className="h-8 text-right"
                          onChange={(ev) => patchRow(e.id, { debit: Number(ev.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={e.credit}
                          className="h-8 text-right"
                          onChange={(ev) => patchRow(e.id, { credit: Number(ev.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeRow(e.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {entries.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-6 text-sm">
                  <span className="text-muted-foreground">
                    Total debits <span className="font-semibold text-foreground">{fmtCurrency(trial.totalDebit)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Total credits <span className="font-semibold text-foreground">{fmtCurrency(trial.totalCredit)}</span>
                  </span>
                  <span className={trial.balanced ? "text-emerald-400" : "text-red-400"}>
                    Difference {fmtCurrency(difference)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Trial balance ---------------- */}
        <TabsContent value="trial">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trial Balance</CardTitle>
              <CardDescription>Grouped by account, debit/credit totals with a balance check.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trial.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">
                        Nothing posted yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {trial.rows.map((r) => (
                    <TableRow key={`${r.type}-${r.account}`}>
                      <TableCell className="font-medium">{r.account}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtCurrency(r.debit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtCurrency(r.credit)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmtCurrency(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {trial.rows.length > 0 && (
                    <TableRow className="border-t-2 border-border">
                      <TableCell colSpan={2} className="font-semibold">
                        Totals
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmtCurrency(trial.totalDebit)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmtCurrency(trial.totalCredit)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={trial.balanced ? "text-emerald-400" : "text-red-400"}>
                          {trial.balanced ? "Balanced" : "Out of balance"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Balance sheet ---------------- */}
        <TabsContent value="balance">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <SectionRows rows={sheet.assets} />
                <TotalRow label="Total assets" value={sheet.totalAssets} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Liabilities &amp; Equity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Liabilities</p>
                  <SectionRows rows={sheet.liabilities} />
                  <TotalRow label="Total liabilities" value={sheet.totalLiabilities} />
                </div>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Equity</p>
                  <SectionRows rows={sheet.equity} />
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-muted-foreground">
                      Retained earnings (revenue {fmtCurrency(sheet.totalRevenue)} − expenses{" "}
                      {fmtCurrency(sheet.totalExpenses)})
                    </span>
                    <span className="tabular-nums">{fmtCurrency(sheet.retainedEarnings)}</span>
                  </div>
                  <TotalRow label="Total equity" value={sheet.totalEquity} />
                </div>
                <TotalRow label="Liabilities + Equity" value={sheet.liabilitiesPlusEquity} />
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span className="text-muted-foreground">
                Assets {fmtCurrency(sheet.totalAssets)} vs Liabilities + Equity {fmtCurrency(sheet.liabilitiesPlusEquity)}
              </span>
              <Badge variant="outline" className={sheet.balanced ? "text-emerald-400" : "text-red-400"}>
                {sheet.balanced ? "Balance sheet balances" : `Out by ${fmtCurrency(sheet.totalAssets - sheet.liabilitiesPlusEquity)}`}
              </Badge>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionRows({ rows }: { rows: TrialBalanceRow[] }) {
  if (!rows.length) return <p className="py-2 text-xs text-muted-foreground">No accounts posted.</p>;
  return (
    <div className="divide-y divide-border/50">
      {rows.map((r) => (
        <div key={`${r.type}-${r.account}`} className="flex items-center justify-between py-1.5 text-sm">
          <span>{r.account}</span>
          <span className="tabular-nums">{fmtCurrency(r.balance)}</span>
        </div>
      ))}
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
      <span>{label}</span>
      <span className="tabular-nums">{fmtCurrency(value)}</span>
    </div>
  );
}
