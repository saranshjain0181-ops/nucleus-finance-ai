import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Upload, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance-store";
import { toast } from "sonner";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data Ingestion — FinOps Studio" },
      { name: "description", content: "Upload CSV/Excel or manually edit raw revenue, COGS, and opex." },
    ],
  }),
  component: DataView,
});

function DataView() {
  const { state, update, set } = useFinance();
  const [drag, setDrag] = useState(false);

  const parseCsv = useCallback(
    (text: string) => {
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines
        .slice(1)
        .map((l, i) => {
          const [label, value, category] = l.split(",");
          return {
            id: `csv-${Date.now()}-${i}`,
            label: label?.trim() || `Row ${i + 1}`,
            value: Number(value) || 0,
            category: ((category?.trim() as "revenue" | "cogs" | "opex") || "opex") as
              | "revenue"
              | "cogs"
              | "opex",
          };
        });
      set("customRows", [...state.customRows, ...rows]);
      toast.success(`Imported ${rows.length} rows`);
    },
    [state.customRows, set],
  );

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => parseCsv(String(reader.result || ""));
    reader.readAsText(file);
  };

  const addRow = () => {
    set("customRows", [
      ...state.customRows,
      { id: `row-${Date.now()}`, label: "New line item", value: 0, category: "opex" },
    ]);
  };

  const updateRow = (id: string, patch: Partial<(typeof state.customRows)[number]>) => {
    set(
      "customRows",
      state.customRows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const removeRow = (id: string) => set("customRows", state.customRows.filter((r) => r.id !== id));

  const coreFields: { key: keyof typeof state; label: string; category: string }[] = [
    { key: "revenue", label: "Gross Revenue", category: "Revenue" },
    { key: "discounts", label: "Discounts & Returns", category: "Revenue" },
    { key: "cogs", label: "Cost of Goods Sold", category: "COGS" },
    { key: "salaries", label: "Salaries", category: "OpEx" },
    { key: "marketing", label: "Marketing", category: "OpEx" },
    { key: "otherOpex", label: "Other OpEx", category: "OpEx" },
    { key: "depreciation", label: "Depreciation & Amort.", category: "Non-cash" },
    { key: "interest", label: "Interest Expense", category: "Finance" },
    { key: "taxRate", label: "Tax Rate (%)", category: "Tax" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 1</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Data Ingestion</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop a CSV of your line items or edit the grid below. All values feed the P&L, unit economics, and AI CFO.
        </p>
      </header>

      <Card
        className={`border-dashed transition ${drag ? "border-emerald-500 bg-emerald-500/5" : "border-border/60"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium">Drop CSV / Excel here</p>
            <p className="text-xs text-muted-foreground">
              Format: <code>label,value,category</code> where category ∈ revenue|cogs|opex
            </p>
          </div>
          <label>
            <input
              type="file"
              accept=".csv,.txt,.xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">Browse file</span>
            </Button>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Core P&L inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {coreFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {f.label} <span className="text-[10px]">· {f.category}</span>
                </Label>
                <Input
                  type="number"
                  value={state[f.key] as number}
                  onChange={(e) => update({ [f.key]: Number(e.target.value) } as never)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Custom line items</CardTitle>
          <Button size="sm" variant="outline" onClick={addRow} className="gap-1">
            <Plus className="h-4 w-4" /> Add row
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.customRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground">
                    No custom rows yet
                  </TableCell>
                </TableRow>
              )}
              {state.customRows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Input
                      value={r.label}
                      onChange={(e) => updateRow(r.id, { label: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.category}
                      onValueChange={(v) => updateRow(r.id, { category: v as never })}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="cogs">COGS</SelectItem>
                        <SelectItem value="opex">OpEx</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={r.value}
                      onChange={(e) => updateRow(r.id, { value: Number(e.target.value) })}
                      className="h-8 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
