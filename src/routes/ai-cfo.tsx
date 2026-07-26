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
import {
  formatCalcContext,
  getCalcMatrixState,
  useCalcMatrixState,
} from "@/lib/calc-live-store";

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

function buildSystemContext(state: ReturnType<typeof useFinance>["state"], calcContext: string) {
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

LIVE CALCULATOR MATRIX (inputs => outputs the user is currently working with)
${calcContext}
`;
}

/** Mock analyst response used when no Gemini key is configured. Swap-in point for the real API. */
function mockResponse(prompt: string, snaps: ReturnType<typeof getCalcMatrixState>) {
  const used = snaps.filter((s) => s.touched).slice(0, 4);
  const lines = (used.length ? used : snaps.slice(0, 3)).map(
    (s) => `• **${s.title}** — ${s.results.map((r) => `${r.label}: ${r.value}`).join(", ")}`,
  );
  return `**Draft analysis (offline mode)** — add your Gemini API key in the header for a live model response.

You asked: _${prompt}_

Reading your live Calculator Matrix state:
${lines.length ? lines.join("\n") : "• No calculators run yet — open the Calculator Matrix and hit Auto-Fill Sample Data."}

Based on these figures, the near-term priority is protecting gross margin while your burn multiple stays inside efficient territory. Re-run the affected calculators after any pricing change and I'll re-read the updated numbers automatically.`;
}


function AICFOView() {
  const { state, set } = useFinance();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi — I'm your AI CFO. I can already see your P&L, unit economics, and AI cost model. Ask me anything, or generate an investor narrative below." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const narrativeFlag = useRef(false);
  const calcSnaps = useCalcMatrixState();

  const send = async (prompt: string, isNarrative = false) => {
    if (!prompt.trim()) return;
    const next: Msg[] = [...messages, { role: "user", content: prompt }];
    setMessages(next);
    setInput("");
    setLoading(true);
    narrativeFlag.current = isNarrative;

    // No key configured → return the mock analyst response grounded in live Matrix data.
    if (!state.geminiApiKey) {
      await new Promise((r) => setTimeout(r, 900));
      const text = mockResponse(prompt, calcSnaps);
      setMessages([...next, { role: "assistant", content: text }]);
      if (isNarrative) {
        set("latestNarrative", text);
        set("narrativeAt", Date.now());
      }
      setLoading(false);
      return;
    }

    try {
      const system = buildSystemContext(state, formatCalcContext(calcSnaps));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(state.geminiApiKey)}`,
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
      if (narrativeFlag.current) {
        set("latestNarrative", text);
        set("narrativeAt", Date.now());
        toast.success("Investor narrative saved — included in PDF export");
      }
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
      true,
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

      <PrintView refEl={printRef} messages={messages} />
    </div>
  );
}

function PrintView({
  refEl,
  messages,
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  messages: Msg[];
}) {
  const { state } = useFinance();
  const p = computePnL(state);
  const ai = computeAICosts(state);
  // Grab last few conversational exchanges (skip greeting), cap length per msg
  const excerpts = messages
    .slice(1)
    .filter((m) => !m.content.startsWith("Error:"))
    .slice(-6)
    .map((m) => ({
      role: m.role,
      content: m.content.length > 600 ? m.content.slice(0, 600) + "…" : m.content,
    }));
  const narrative = state.latestNarrative?.trim();
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

      <h2 style={{ marginTop: 32, fontSize: 20, color: "#f59e0b" }}>Investor Narrative</h2>
      {narrative ? (
        <>
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
            Generated {state.narrativeAt ? new Date(state.narrativeAt).toLocaleString() : ""}
          </p>
          <div
            style={{
              marginTop: 12,
              padding: 16,
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#e2e8f0",
              whiteSpace: "pre-wrap",
            }}
          >
            {narrative}
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, marginTop: 8, color: "#64748b" }}>
          No narrative generated yet — click "Investor Narrative" in the AI CFO to add one here.
        </p>
      )}

      {excerpts.length > 0 && (
        <>
          <h2 style={{ marginTop: 32, fontSize: 20, color: "#f472b6" }}>AI CFO — Chat Excerpts</h2>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {excerpts.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.55,
                  background: m.role === "user" ? "#1e293b" : "#0f172a",
                  border: "1px solid #1e293b",
                  whiteSpace: "pre-wrap",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: m.role === "user" ? "#38bdf8" : "#34d399",
                    marginBottom: 4,
                  }}
                >
                  {m.role === "user" ? "Question" : "AI CFO"}
                </div>
                {m.content}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

