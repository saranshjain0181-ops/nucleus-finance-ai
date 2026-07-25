import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Upload, Plus, Trash2, FileText, FileSpreadsheet, FileType, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance, type FinanceState } from "@/lib/finance-store";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data Ingestion — FinOps Studio" },
      { name: "description", content: "Upload CSV, Excel, PDF, docs & slides or manually edit raw revenue, COGS, and opex." },
    ],
  }),
  component: DataView,
});

type AttachmentKind = FinanceState["attachments"][number]["kind"];

function classifyFile(file: File): AttachmentKind {
  const n = file.name.toLowerCase();
  if (n.endsWith(".csv")) return "csv";
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".ods")) return "excel";
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".doc") || n.endsWith(".docx")) return "doc";
  if (n.endsWith(".ppt") || n.endsWith(".pptx") || n.endsWith(".key")) return "slides";
  if (n.endsWith(".txt") || n.endsWith(".md")) return "text";
  return "other";
}

function iconFor(kind: AttachmentKind) {
  if (kind === "excel" || kind === "csv") return FileSpreadsheet;
  if (kind === "pdf" || kind === "doc" || kind === "text") return FileText;
  if (kind === "slides") return FileType;
  return Paperclip;
}

function DataView() {
  const { state, update, set } = useFinance();
  const [drag, setDrag] = useState(false);

  const parseCsvText = useCallback(
    (text: string, source: string) => {
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
      toast.success(`Imported ${rows.length} rows from ${source}`);
      return rows.length;
    },
    [state.customRows, set],
  );

  const parseWorkbook = useCallback(
    async (file: File) => {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const rows = json.map((r, i) => {
        const keys = Object.keys(r);
        const label = String(r["label"] ?? r["Label"] ?? r[keys[0]] ?? `Row ${i + 1}`);
        const value = Number(r["value"] ?? r["Value"] ?? r[keys[1]] ?? 0) || 0;
        const cat = String(r["category"] ?? r["Category"] ?? r[keys[2]] ?? "opex").toLowerCase();
        const category: "revenue" | "cogs" | "opex" =
          cat === "revenue" || cat === "cogs" ? (cat as "revenue" | "cogs") : "opex";
        return { id: `xls-${Date.now()}-${i}`, label, value, category };
      });
      set("customRows", [...state.customRows, ...rows]);
      toast.success(`Imported ${rows.length} rows from ${file.name}`);
      return rows.length;
    },
    [state.customRows, set],
  );

  const addAttachment = (file: File, kind: AttachmentKind, rowsImported?: number, preview?: string) => {
    set("attachments", [
      ...state.attachments,
      {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: file.type || kind,
        size: file.size,
        addedAt: Date.now(),
        kind,
        rowsImported,
        preview,
      },
    ]);
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      const kind = classifyFile(file);
      try {
        if (kind === "csv" || kind === "text") {
          const text = await file.text();
          const imported = kind === "csv" ? parseCsvText(text, file.name) : 0;
          addAttachment(file, kind, imported, text.slice(0, 400));
        } else if (kind === "excel") {
          const imported = await parseWorkbook(file);
          addAttachment(file, kind, imported);
        } else {
          // pdf / doc / slides / other — store as reference attachment
          addAttachment(file, kind);
          toast.message(`Attached ${file.name}`, {
            description:
              kind === "pdf" || kind === "doc" || kind === "slides"
                ? "Stored as reference. Add key figures manually below."
                : "Attached to this workspace.",
          });
        }
      } catch (e) {
        toast.error(`Failed to import ${file.name}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }
  };

  const removeAttachment = (id: string) =>
    set("attachments", state.attachments.filter((a) => a.id !== id));


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
