import { type ReactNode, useState } from "react";
import { Download, KeyRound, User } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./AppSidebar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinance } from "@/lib/finance-store";
import { toast } from "sonner";

export function AppShell({ children }: { children: ReactNode }) {
  const { state, set } = useFinance();
  const [keyInput, setKeyInput] = useState(state.geminiApiKey);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finops-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Snapshot exported");
  };

  return (
    <SidebarProvider>
      <div className="dark flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <KeyRound className="h-4 w-4" /> API Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Google Gemini API Key</DialogTitle>
                    <DialogDescription>
                      Stored locally in your browser. Get one at aistudio.google.com/apikey
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="apikey">API Key</Label>
                    <Input
                      id="apikey"
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="AIza..."
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        set("geminiApiKey", keyInput);
                        toast.success("API key saved");
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                <Download className="h-4 w-4" /> Export
              </Button>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-black">
                <User className="h-4 w-4" />
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
