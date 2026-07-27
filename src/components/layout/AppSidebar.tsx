import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  Calculator,
  Database,
  LineChart,
  Sparkles,
  TrendingUp,
  Radar,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Overview", url: "/", icon: LineChart },
  { title: "Data Ingestion", url: "/data", icon: Database },
  { title: "P&L Waterfall", url: "/pnl", icon: BarChart3 },
  { title: "Unit Economics", url: "/unit-economics", icon: Users },
  { title: "AI Cost Simulator", url: "/ai-simulator", icon: TrendingUp },
  { title: "Calculator Matrix", url: "/calculators", icon: Calculator },
  { title: "AI CFO", url: "/ai-cfo", icon: Bot },
];

const scienceItems = [
  { title: "ML Anomaly Radar", url: "/ml-anomaly", icon: Radar },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 text-black">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">FinOps Studio</span>
            <span className="truncate text-[10px] text-muted-foreground">AI CFO Suite</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Data Science</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {scienceItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
