import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeHiringScenario, getDepartmentFullyLoadedAnnualCost, type HiringDepartment } from "@/lib/strategy-models";
import { fmtCurrency, useFinance } from "@/lib/finance-store";

export const Route = createFileRoute("/human-capital")({
  head: () => ({
    meta: [
      { title: "Human Capital FinOps — FinOps Studio" },
      { name: "description", content: "Model fully-loaded employee costs, team economics, and hiring scenarios against operating burn." },
      { property: "og:title", content: "Human Capital FinOps — FinOps Studio" },
      { property: "og:description", content: "Explore workforce costs and hiring scenario runway impact." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HumanCapitalView,
});

const INITIAL_DEPARTMENTS: HiringDepartment[] = [
  { id: "engineering", name: "Engineering", headcount: 8, averageSalary: 142_000, benefitsPct: 24, saasPerEmployeeMonthly: 220, hardwarePerEmployeeMonthly: 125, teams: ["Platform", "Product Engineering", "Security"] },
  { id: "go-to-market", name: "Go-to-market", headcount: 5, averageSalary: 118_000, benefitsPct: 22, saasPerEmployeeMonthly: 310, hardwarePerEmployeeMonthly: 65, teams: ["Sales", "Marketing", "Customer Success"] },
  { id: "operations", name: "Operations", headcount: 3, averageSalary: 96_000, benefitsPct: 21, saasPerEmployeeMonthly: 180, hardwarePerEmployeeMonthly: 75, teams: ["Finance", "People", "Business Operations"] },
];

function HumanCapitalView() {
  const { state } = useFinance();
  const [departments, setDepartments] = useState(INITIAL_DEPARTMENTS);
  const [selectedId, setSelectedId] = useState(INITIAL_DEPARTMENTS[0]?.id ?? "engineering");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ engineering: true, "go-to-market": true, operations: true });
  const [scenario, setScenario] = useState<"freeze" | "aggressive">("freeze");
  const [hiringPct, setHiringPct] = useState(20);

  const scenarioData = useMemo(() => computeHiringScenario(departments, scenario, hiringPct), [departments, scenario, hiringPct]);
  const selected = departments.find((department) => department.id === selectedId) ?? departments[0];
  const selectedAnnualCost = selected ? getDepartmentFullyLoadedAnnualCost(selected) : 0;
  const currentMonthlyPayroll = state.salaries / 12;
  const incrementalMonthlyHireCost = scenarioData.incrementalAnnualCost / 12;
  const projectedMonthlyOpex = Math.max(0, currentMonthlyPayroll + state.marketing / 12 + state.otherOpex / 12 + state.cogs / 12 + incrementalMonthlyHireCost);
  const monthlyRevenue = state.revenue / 12;
  const projectedMonthlyDeficit = Math.max(0, projectedMonthlyOpex - monthlyRevenue);
  const cashForRunway = typeof state.extractedFields.cash === "number" ? state.extractedFields.cash : 0;
  const projectedRunway = cashForRunway > 0 && projectedMonthlyDeficit > 0 ? cashForRunway / projectedMonthlyDeficit : null;

  function updateDepartment(id: string, key: "averageSalary" | "benefitsPct" | "saasPerEmployeeMonthly" | "hardwarePerEmployeeMonthly" | "headcount", value: number) {
    setDepartments((current) => current.map((department) => department.id === id ? { ...department, [key]: Math.max(0, value) } : department));
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Workforce economics</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Human Capital FinOps</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">See the full cost of each team and model hiring pace against operating burn.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Modeled headcount" value={scenarioData.projectedHeadcount.toLocaleString()} />
        <Metric icon={Wallet} label="Selected team annual cost" value={fmtCurrency(selectedAnnualCost)} />
        <Metric icon={Building2} label="Additional annual hiring cost" value={fmtCurrency(scenarioData.incrementalAnnualCost)} />
        <Metric icon={Users} label="Estimated new hires" value={scenarioData.plannedHires.toLocaleString()} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization model</CardTitle>
            <CardDescription>Illustrative team structure. Select a department to inspect and edit cost assumptions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mx-auto max-w-2xl space-y-3">
              <div className="mx-auto flex w-fit items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-sm font-medium"><Building2 className="h-4 w-4 text-chart-1" /> Company · {scenarioData.projectedHeadcount} people</div>
              <div className="mx-auto h-5 w-px bg-border" />
              <div className="grid gap-3 md:grid-cols-3">
                {departments.map((department) => (
                  <div key={department.id} className={`rounded-md border p-3 ${selectedId === department.id ? "border-chart-1/60 bg-chart-1/5" : "border-border/60 bg-card"}`}>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`${expanded[department.id] ? "Collapse" : "Expand"} ${department.name} teams`} onClick={() => setExpanded((value) => ({ ...value, [department.id]: !value[department.id] }))}>
                        {expanded[department.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal px-2 py-2 text-left" onClick={() => setSelectedId(department.id)}>
                        <span><span className="block text-sm font-semibold">{department.name}</span><span className="block text-xs text-muted-foreground">{department.headcount} people</span></span>
                      </Button>
                    </div>
                    {expanded[department.id] && <div className="ml-9 mt-2 space-y-1 border-l border-border pl-3">{department.teams.map((team) => <p key={team} className="py-1 text-xs text-muted-foreground">{team}</p>)}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border/60 p-4"><p className="text-xs text-muted-foreground">Revenue per modeled employee</p><p className="mt-1 text-xl font-semibold tabular-nums">{fmtCurrency(state.revenue / Math.max(1, scenarioData.projectedHeadcount))}</p></div>
              <div className="rounded-md border border-border/60 p-4"><p className="text-xs text-muted-foreground">Modeled hiring impact on monthly P&L</p><p className="mt-1 text-xl font-semibold tabular-nums">+{fmtCurrency(incrementalMonthlyHireCost)}</p></div>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{selected?.name ?? "Department"} cost detail</CardTitle><CardDescription>Fully loaded annual estimate for this team.</CardDescription></CardHeader>
            {selected && <CardContent className="space-y-4">
              <Badge variant="outline">{selected.headcount} modeled employees</Badge>
              <label className="block space-y-1.5 text-xs text-muted-foreground">Average base salary<Input type="number" min={0} step={1000} value={selected.averageSalary} onChange={(event) => updateDepartment(selected.id, "averageSalary", Number(event.target.value))} /></label>
              <label className="block space-y-1.5 text-xs text-muted-foreground">Benefits and payroll load (%)<Input type="number" min={0} max={100} value={selected.benefitsPct} onChange={(event) => updateDepartment(selected.id, "benefitsPct", Number(event.target.value))} /></label>
              <label className="block space-y-1.5 text-xs text-muted-foreground">SaaS seats / employee / month<Input type="number" min={0} value={selected.saasPerEmployeeMonthly} onChange={(event) => updateDepartment(selected.id, "saasPerEmployeeMonthly", Number(event.target.value))} /></label>
              <label className="block space-y-1.5 text-xs text-muted-foreground">Hardware / employee / month<Input type="number" min={0} value={selected.hardwarePerEmployeeMonthly} onChange={(event) => updateDepartment(selected.id, "hardwarePerEmployeeMonthly", Number(event.target.value))} /></label>
              <div className="rounded-md bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Fully loaded annual team cost</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmtCurrency(selectedAnnualCost)}</p></div>
            </CardContent>}
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Hiring scenario</CardTitle><CardDescription>Preview the effect without changing your saved P&amp;L.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={scenario} onValueChange={(value) => setScenario(value as "freeze" | "aggressive")}>
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="freeze">Hiring freeze</TabsTrigger><TabsTrigger value="aggressive">Growth plan</TabsTrigger></TabsList>
              </Tabs>
              {scenario === "aggressive" && <div className="space-y-2"><div className="flex justify-between text-xs"><span>Headcount increase</span><span>{hiringPct}%</span></div><Slider aria-label="Headcount increase percentage" min={5} max={50} step={5} value={[hiringPct]} onValueChange={(value) => setHiringPct(value[0] ?? 20)} /></div>}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Current P&amp;L salaries / month</span><span className="tabular-nums">{fmtCurrency(currentMonthlyPayroll)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">New hires / month</span><span className="tabular-nums">+{fmtCurrency(incrementalMonthlyHireCost)}</span></div>
                <div className="border-t border-border pt-2"><div className="flex justify-between gap-3"><span>Projected operating burn*</span><span className="font-semibold tabular-nums">{fmtCurrency(projectedMonthlyDeficit)}</span></div></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Runway from uploaded cash</span><span className="tabular-nums">{projectedRunway === null ? "Cash data needed" : `${projectedRunway.toFixed(1)} months`}</span></div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">*Uses current P&amp;L revenue and operating costs plus scenario hires. Runway appears only when a cash balance has been accepted from Data Ingestion.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <Card><CardContent className="p-4"><Icon className="mb-3 h-4 w-4 text-chart-1" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>;
}