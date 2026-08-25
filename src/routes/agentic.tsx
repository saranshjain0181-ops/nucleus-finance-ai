import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Bot, Play, Plus, Square, Terminal, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFinance } from "@/lib/finance-store";

export const Route = createFileRoute("/agentic")({
  head: () => ({
    meta: [
      { title: "Agentic Workflows — FinOps Studio" },
      {
        name: "description",
        content:
          "Design autonomous finance agents on a node canvas: triggers, OCR, tax cross-checks and vendor renegotiation, with a live execution console.",
      },
      { property: "og:title", content: "Agentic Workflows — FinOps Studio" },
      {
        property: "og:description",
        content: "Build autonomous AI agents that execute your finance ops, not just talk about them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgenticView,
});

type NodeKind = "trigger" | "action";

const TRIGGERS = [
  "Invoice Received",
  "Ledger Anomaly Detected",
  "Runway < 6 Months",
  "Contract Renewal Window",
  "Month-End Close",
];

const ACTIONS = [
  "Run OCR Extraction",
  "Cross-check SGST/CGST rules",
  "Post Journal Entry",
  "Draft Vendor Renegotiation Email",
  "Reforecast Burn Multiple",
  "Notify CFO on Slack",
];

const nodeStyle = (kind: NodeKind) => ({
  padding: "10px 14px",
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  border: `1px solid ${kind === "trigger" ? "rgb(56 189 248 / 0.6)" : "rgb(52 211 153 / 0.6)"}`,
  background: kind === "trigger" ? "rgb(8 47 73 / 0.9)" : "rgb(6 46 38 / 0.9)",
  color: kind === "trigger" ? "rgb(125 211 252)" : "rgb(110 231 183)",
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.35)",
  width: 210,
});

const initialNodes: Node[] = [
  {
    id: "t1",
    position: { x: 40, y: 120 },
    data: { label: "⚡ Invoice Received" },
    style: nodeStyle("trigger"),
    type: "input",
  },
  {
    id: "a1",
    position: { x: 320, y: 40 },
    data: { label: "🤖 Run OCR Extraction" },
    style: nodeStyle("action"),
  },
  {
    id: "a2",
    position: { x: 320, y: 200 },
    data: { label: "🤖 Cross-check SGST/CGST rules" },
    style: nodeStyle("action"),
  },
  {
    id: "a3",
    position: { x: 620, y: 120 },
    data: { label: "🤖 Draft Vendor Renegotiation Email" },
    style: nodeStyle("action"),
    type: "output",
  },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "t1", target: "a1", animated: true, style: { stroke: "#38bdf8" } },
  { id: "e2", source: "t1", target: "a2", animated: true, style: { stroke: "#38bdf8" } },
  { id: "e3", source: "a1", target: "a3", animated: true, style: { stroke: "#34d399" } },
  { id: "e4", source: "a2", target: "a3", animated: true, style: { stroke: "#34d399" } },
];

type LogLine = { id: number; text: string; tone: "info" | "warn" | "good" };

function AgenticView() {
  const { state } = useFinance();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true, style: { stroke: "#a78bfa" } }, eds)),
    [setEdges],
  );

  const addNode = (kind: NodeKind, label: string) => {
    counter.current += 1;
    const id = `${kind}-${counter.current}-${Date.now()}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        position: { x: 120 + Math.random() * 420, y: 40 + Math.random() * 300 },
        data: { label: `${kind === "trigger" ? "⚡" : "🤖"} ${label}` },
        style: nodeStyle(kind),
      },
    ]);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = () => {
    if (running) return;
    const ledgerRows = state.ledger.length || 500;
    const script: LogLine[] = [
      { id: 0, text: "[Agent] Booting FinOps agent runtime (gemini-flash · tool-calling enabled)…", tone: "info" },
      { id: 0, text: `[Agent] Trigger fired: Invoice Received · workflow has ${nodes.length} nodes / ${edges.length} edges`, tone: "info" },
      { id: 0, text: `[Agent] Analyzing ${ledgerRows} ledger rows…`, tone: "info" },
      { id: 0, text: "[Tool] ocr.extract(invoice.pdf) → vendor=AWS, amount=$48,220, terms=Net-15", tone: "info" },
      { id: 0, text: "[Agent] Flagged 3 missing tax provisions (SGST 9% / CGST 9% on 2 intra-state invoices).", tone: "warn" },
      { id: 0, text: "[Tool] ledger.post(3 correcting entries) → trial balance re-checked", tone: "info" },
      { id: 0, text: "[Agent] Corrected entries. Debits = Credits ✓", tone: "good" },
      { id: 0, text: "[Agent] Detected 12% YoY price uplift on renewal — drafting renegotiation email…", tone: "warn" },
      { id: 0, text: "[Tool] mail.draft(to=vendor-billing@aws) → saved to Outbox (awaiting human approval)", tone: "info" },
      { id: 0, text: "[Agent] Workflow complete in 4.2s · 3 fixes, 1 draft, 0 errors.", tone: "good" },
    ];
    setLogs([]);
    setRunning(true);
    let i = 0;
    const step = () => {
      if (i >= script.length) {
        setRunning(false);
        return;
      }
      const line = script[i];
      i += 1;
      setLogs((l) => [...l, { ...line, id: Date.now() + i }]);
      timer.current = setTimeout(step, 550);
    };
    step();
  };

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    setRunning(false);
    setLogs((l) => [...l, { id: Date.now(), text: "[Agent] Halted by operator.", tone: "warn" }]);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Autonomous AI</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Agentic Workflow Builder</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Wire triggers to actions and let the agent execute the close, not just describe it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={run} disabled={running} className="bg-emerald-500 text-black hover:bg-emerald-400">
            <Play className="mr-2 h-4 w-4" /> {running ? "Running…" : "Run Workflow"}
          </Button>
          <Button variant="outline" onClick={stop} disabled={!running}>
            <Square className="mr-2 h-4 w-4" /> Stop
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-cyan-400" /> Node Palette
              </CardTitle>
              <CardDescription>Click to drop a node on the canvas, then drag to connect handles.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {TRIGGERS.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant="outline"
                  className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                  onClick={() => addNode("trigger", t)}
                >
                  <Plus className="mr-1 h-3 w-3" /> {t}
                </Button>
              ))}
              {ACTIONS.map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => addNode("action", a)}
                >
                  <Plus className="mr-1 h-3 w-3" /> {a}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  setNodes([]);
                  setEdges([]);
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Clear canvas
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/60">
            <div className="h-[560px] w-full bg-[#060b14]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#1e293b" gap={18} />
                <MiniMap pannable zoomable maskColor="rgba(2,6,23,0.8)" nodeColor="#22d3ee" />
                <Controls />
              </ReactFlow>
            </div>
          </Card>
        </div>

        <Card className="flex h-fit flex-col border-border/60 xl:sticky xl:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4 text-emerald-400" /> Live Execution Monitor
            </CardTitle>
            <CardDescription>
              <Badge variant="outline" className={running ? "border-emerald-500/50 text-emerald-400" : ""}>
                {running ? "agent active" : "idle"}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[560px] rounded-md border border-border/60 bg-black/60 p-3">
              {logs.length === 0 ? (
                <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" /> Awaiting trigger. Hit “Run Workflow”.
                </p>
              ) : (
                <div className="space-y-1.5 font-mono text-[11px] leading-relaxed">
                  {logs.map((l) => (
                    <p
                      key={l.id}
                      className={
                        l.tone === "warn"
                          ? "text-amber-400"
                          : l.tone === "good"
                            ? "text-emerald-400"
                            : "text-cyan-300/90"
                      }
                    >
                      {l.text}
                    </p>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
