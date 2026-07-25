import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Bot, Download, FileText, Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { computeAICosts, computePnL, fmtCurrency, fmtPct, useFinance } from "@/lib/finance-store";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/ai-cfo")({
  head: () => ({
    meta: [
      { title: "AI CFO — FinOps Studio" },
      { name: "description", content: "Chat with an AI CFO grounded in your live financial data." },
    ],
  }),
  component: AICFOView,
});

type Msg = { role: "user" | "assistant"; content: string };

function buildSystemContext(state: ReturnType<typeof useFinance>["state"]) {
  const p = computePnL(state);
  const ai = computeAICosts(state);
  return `You are an experienced fractional CFO reviewing a startup's live financials.
Answer in a tight, executive tone. Use dollar amounts and percentages.

P&L SNAPSHOT
- Net Sales: ${fmtCurrency(p.netSales)}
- Gross Profit: ${fmtCurrency(p.grossProfit)} (${fmtPct(p.grossMarginPct)})
- EBITDA: ${fmtCurrency(p.ebitda)} (${fmtPct(p.ebitdaMarginPct)})
- EBIT: ${fmtCurrency(p.ebit)}
- PAT: ${fmtCurrency(p.pat)} (${fmtPct(p.patMarginPct)})

UNIT ECONOMICS
- ARPU: ${fmtCurrency(state.arpu)}/mo | CAC: ${fmtCurrency(state.cac)}
- Gross Margin per subscription: ${fmtPct(state.grossMarginPct)}
- Monthly churn: ${fmtPct(state.churnRate)}

AI COMPUTE ECONOMICS
- MAU: ${state.mau.toLocaleString()} | Subscription: ${fmtCurrency(state.subscriptionPrice)}/mo
- Tokens per user/mo: ${ai.tokensPerUserPerMonth.toLocaleString()}
- AI cost per user: ${fmtCurrency(ai.costPerUser)}/mo
- Monthly AI COGS: ${fmtCurrency(ai.totalMonthlyCogs)}
- AI Gross Margin: ${fmtPct(ai.grossMarginPct)}
- Min price for 75% margin: ${fmtCurrency(ai.minPriceFor75)}
`;
}

function AICFOView() {
  const { state } = useFinance();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi — I'm your AI CFO. I can already see your P&L, unit economics, and AI cost model. Ask me anything, or generate an investor narrative below." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const send = async (prompt: string) => {
    if (!prompt.trim()) return;
    if (!state.geminiApiKey) {
      toast.error("Add your Gemini API key first (top right)");
      return;
    }
    const next: Msg[] = [...messages, { role: "user", content: prompt }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const system = buildSystemContext(state);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(state.geminiApiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: next.map((m) => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.content }],
            })),
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "(no response)";
      setMessages([...next, { role: "assistant", content: text }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(msg);
      setMessages([...next, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const generateNarrative = () =>
    send(
      "Write a 3-paragraph executive summary I could put in an investor deck: highlight the strongest margins and unit economics from my current data. Be specific with numbers.",
    );

  const exportPdf = async () => {
    const node = printRef.current;
    if (!node) return;
    toast.loading("Generating PDF…", { id: "pdf" });
    try {
      node.style.display = "block";
      const canvas = await html2canvas(node, { backgroundColor: "#0b1220", scale: 2 });
      node.style.display = "none";
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`finops-pitch-${Date.now()}.pdf`);
      toast.success("PDF downloaded", { id: "pdf" });
    } catch (e) {
      toast.error("PDF export failed", { id: "pdf" });
      console.error(e);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-4xl flex-col p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-400">Advisor</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">AI CFO</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={generateNarrative} disabled={loading}>
            <Sparkles className="h-4 w-4" /> Investor Narrative
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportPdf}>
            <Download className="h-4 w-4" /> Pitch Deck PDF
          </Button>
        </div>
      </header>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Thinking…
              </div>
            )}
          </div>

          <div className="border-t border-border/50 bg-background/60 p-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask about margins, runway, or where costs are leaking…"
                rows={2}
                className="resize-none"
              />
              <Button onClick={() => send(input)} disabled={loading || !input.trim()} className="gap-2">
                <Send className="h-4 w-4" /> Send
              </Button>
            </div>
            {!state.geminiApiKey && (
              <p className="mt-2 text-xs text-amber-400">
                <FileText className="mr-1 inline h-3 w-3" /> Add your Gemini API key from the header to enable chat.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <PrintView refEl={printRef} />
    </div>
  );
}

function PrintView({ refEl }: { refEl: React.RefObject<HTMLDivElement | null> }) {
  const { state } = useFinance();
  const p = computePnL(state);
  const ai = computeAICosts(state);
  return (
    <div
      ref={refEl}
      style={{ display: "none", width: 900, padding: 48, background: "#0b1220", color: "#f1f5f9", fontFamily: "system-ui" }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>FinOps Studio — Executive Snapshot</h1>
      <p style={{ color: "#94a3b8", marginTop: 8 }}>Auto-generated {new Date().toLocaleDateString()}</p>

      <h2 style={{ marginTop: 32, fontSize: 20, color: "#34d399" }}>P&L Summary</h2>
      <table style={{ width: "100%", marginTop: 12, fontSize: 14, borderCollapse: "collapse" }}>
        <tbody>
          {[
            ["Net Sales", fmtCurrency(p.netSales)],
            ["Gross Profit", `${fmtCurrency(p.grossProfit)} (${fmtPct(p.grossMarginPct)})`],
            ["EBITDA", `${fmtCurrency(p.ebitda)} (${fmtPct(p.ebitdaMarginPct)})`],
            ["EBIT", fmtCurrency(p.ebit)],
            ["PAT", `${fmtCurrency(p.pat)} (${fmtPct(p.patMarginPct)})`],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid #1e293b" }}>
              <td style={{ padding: "8px 0", color: "#94a3b8" }}>{k}</td>
              <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32, fontSize: 20, color: "#22d3ee" }}>AI Compute Economics</h2>
      <table style={{ width: "100%", marginTop: 12, fontSize: 14, borderCollapse: "collapse" }}>
        <tbody>
          {[
            ["Monthly Active Users", state.mau.toLocaleString()],
            ["AI cost / user", fmtCurrency(ai.costPerUser)],
            ["Total AI COGS / mo", fmtCurrency(ai.totalMonthlyCogs)],
            ["Revenue / mo", fmtCurrency(ai.revenue)],
            ["AI Gross Margin", fmtPct(ai.grossMarginPct)],
            ["Min price for 75% margin", fmtCurrency(ai.minPriceFor75)],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid #1e293b" }}>
              <td style={{ padding: "8px 0", color: "#94a3b8" }}>{k}</td>
              <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32, fontSize: 20, color: "#a78bfa" }}>Unit Economics</h2>
      <p style={{ fontSize: 14, marginTop: 8, color: "#cbd5e1" }}>
        ARPU {fmtCurrency(state.arpu)}/mo · CAC {fmtCurrency(state.cac)} · Gross Margin {fmtPct(state.grossMarginPct)} · Churn {fmtPct(state.churnRate)}
      </p>
    </div>
  );
}
