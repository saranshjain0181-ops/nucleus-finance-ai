import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Upload, Plus, Trash2, FileText, FileSpreadsheet, FileType, Paperclip, Check, X, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance, type FinanceState } from "@/lib/finance-store";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  detectFields,
  extractTextFromFile,
  fileToRows,
  looksLikeLedger,
  rowsToLedger,
  type DetectedValue,
  type FieldKey,
} from "@/lib/doc-extract";
import type { ExtractedFields } from "@/lib/matrix-mapping";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data Ingestion — FinOps Studio" },
      { name: "description", content: "Upload CSV, Excel, PDF, docs & slides — figures and ledger entries are read out automatically." },
      { property: "og:title", content: "Data Ingestion — FinOps Studio" },
      { property: "og:description", content: "Upload your books and let the studio read the numbers straight into your models." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DataView,
});

type AttachmentKind = FinanceState["attachments"][number]["kind"];

/** Detected field keys that map directly onto core P&L / unit-economics state. */
const STATE_FIELDS: Partial<Record<FieldKey, keyof FinanceState>> = {
  revenue: "revenue",
  discounts: "discounts",
  cogs: "cogs",
  salaries: "salaries",
  marketing: "marketing",
  otherOpex: "otherOpex",
  depreciation: "depreciation",
  interest: "interest",
  taxRate: "taxRate",
  cac: "cac",
  arpu: "arpu",
  grossMarginPct: "grossMarginPct",
  churnRate: "churnRate",
  mau: "mau",
  subscriptionPrice: "subscriptionPrice",
};

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
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState<DetectedValue[]>([]);

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

  const addAttachment = (
    file: File,
    kind: AttachmentKind,
    rowsImported?: number,
    text?: string,
  ) => {
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
        preview: text?.slice(0, 400),
        text,
      },
    ]);
  };

  const mergeDetected = (found: DetectedValue[]) =>
    setDetected((prev) => {
      const map = new Map(prev.map((d) => [d.id, d]));
      found.forEach((f) => map.set(f.id, f));
      return Array.from(map.values());
    });

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    setBusy(true);
    let ledgerAdded = 0;
    const ledgerBatch: FinanceState["ledger"] = [];

    for (const file of list) {
      const kind = classifyFile(file);
      try {
        // 1. Tabular files: ledger export or label/value rows.
        if (kind === "csv" || kind === "excel") {
          const rows = await fileToRows(file).catch(() => [] as Record<string, unknown>[]);
          if (looksLikeLedger(rows)) {
            const entries = rowsToLedger(rows, file.name);
            ledgerBatch.push(...entries);
            ledgerAdded += entries.length;
            addAttachment(file, kind, entries.length);
            toast.success(`Read ${entries.length} ledger entries from ${file.name}`);
            continue;
          }
        }

        if (kind === "csv") {
          const text = await file.text();
          const imported = parseCsvText(text, file.name);
          mergeDetected(detectFields(text, file.name));
          addAttachment(file, kind, imported, text);
        } else if (kind === "excel") {
          const imported = await parseWorkbook(file);
          const text = await extractTextFromFile(file);
          mergeDetected(detectFields(text, file.name));
          addAttachment(file, kind, imported, text);
        } else if (kind === "pdf" || kind === "doc" || kind === "text") {
          const text = await extractTextFromFile(file);
          const found = detectFields(text, file.name);
          mergeDetected(found);
          addAttachment(file, kind, 0, text);
          toast.message(`Read ${file.name}`, {
            description: found.length
              ? `${found.length} figures detected — review them below.`
              : "No recognisable figures found; text stored for the AI CFO.",
          });
        } else {
          addAttachment(file, kind);
          toast.message(`Attached ${file.name}`, {
            description: "Stored as reference. Add key figures manually below.",
          });
        }
      } catch (e) {
        toast.error(`Failed to import ${file.name}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    if (ledgerBatch.length) set("ledger", [...state.ledger, ...ledgerBatch]);
    if (ledgerAdded) toast.success(`${ledgerAdded} entries posted to the general ledger`);
    setBusy(false);
  };

  const acceptDetected = (d: DetectedValue) => {
    const stateKey = STATE_FIELDS[d.key];
    if (stateKey) update({ [stateKey]: d.value } as never);
    const nextExtracted: ExtractedFields = { ...state.extractedFields, [d.key]: d.value };
    set("extractedFields", nextExtracted);
    setDetected((prev) => prev.filter((x) => x.id !== d.id));
    toast.success(`${d.label} set to ${d.value.toLocaleString()}`);
  };

  const acceptAll = () => {
    const patch: Partial<FinanceState> = {};
    const nextExtracted: ExtractedFields = { ...state.extractedFields };
    detected.forEach((d) => {
      const stateKey = STATE_FIELDS[d.key];
      if (stateKey) (patch as Record<string, number>)[stateKey] = d.value;
      nextExtracted[d.key] = d.value;
    });
    update({ ...patch, extractedFields: nextExtracted });
    toast.success(`Applied ${detected.length} detected figures`);
    setDetected([]);
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

  const acceptedFields = Object.entries(state.extractedFields) as [FieldKey, number][];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 1</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Data Ingestion</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop your statements, ledgers or decks — figures are read out of the documents and feed the P&amp;L, books,
          calculators and AI CFO.
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
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
      >
        <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {busy ? "Reading your documents…" : "Drop any files here — multiple welcome"}
            </p>
            <p className="text-xs text-muted-foreground">
              CSV / Excel → rows or ledger entries · PDF / DOCX / TXT → text parsed for figures
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Ledger format: <code>date, account, type, description, debit, credit</code> · P&amp;L format:{" "}
              <code>label, value, category</code>
            </p>
          </div>
          <label>
            <input
              type="file"
              multiple
              accept=".csv,.txt,.md,.xlsx,.xls,.ods,.pdf,.doc,.docx,.ppt,.pptx,.key"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">Browse files</span>
            </Button>
          </label>
        </CardContent>
      </Card>

      {detected.length > 0 && (
        <Card className="border-emerald-500/40">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-emerald-400" /> Detected values ({detected.length})
              </CardTitle>
              <CardDescription>Nothing is applied until you accept it.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={acceptAll} className="gap-2">
                <Check className="h-4 w-4" /> Accept all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDetected([])}>
                Dismiss
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/50">
              {detected.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {d.label}{" "}
                      <span className="tabular-nums text-emerald-400">
                        {d.unit === "percent" ? `${d.value}%` : d.value.toLocaleString()}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.source} · “{d.context}”
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => acceptDetected(d)}>
                    <Check className="h-4 w-4 text-emerald-400" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDetected((p) => p.filter((x) => x.id !== d.id))}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {acceptedFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Figures from your documents</CardTitle>
            <CardDescription>
              These seed the Calculator Matrix — use “Fill from My Data” there to apply them.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {acceptedFields.map(([k, v]) => (
              <Badge key={k} variant="outline" className="gap-1 text-emerald-400">
                {k}: {v.toLocaleString()}
              </Badge>
            ))}
            <Button size="sm" variant="ghost" onClick={() => set("extractedFields", {})}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {state.ledger.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="h-4 w-4 text-emerald-400" />
              {state.ledger.length} ledger entries posted from your files.
            </span>
            <Button size="sm" variant="outline" asChild>
              <a href="/ledger">Open Ledger &amp; Books</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {state.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uploaded files ({state.attachments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/50">
              {state.attachments.map((a) => {
                const Icon = iconFor(a.kind);
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-muted/40 text-emerald-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.kind.toUpperCase()} · {(a.size / 1024).toFixed(1)} KB
                        {typeof a.rowsImported === "number" && a.rowsImported > 0
                          ? ` · ${a.rowsImported} rows imported`
                          : ""}
                        {a.text ? ` · ${a.text.length.toLocaleString()} chars read` : ""}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeAttachment(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Core P&amp;L inputs</CardTitle>
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
