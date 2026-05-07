import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
  Printer,
  Key,
  Wifi,
  WifiOff,
  ExternalLink,
} from "lucide-react";

export default function AdminSettings() {
  const [printNodeApiKey, setPrintNodeApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const utils = trpc.useUtils();

  const { data: settings, isLoading } = trpc.admin.getSettings.useQuery();

  const { data: printers, isLoading: printersLoading, refetch: refetchPrinters } = trpc.admin.listPrinters.useQuery();

  const updateSettings = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      setPrintNodeApiKey("");
      utils.admin.getSettings.invalidate();
      utils.admin.listPrinters.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const testConnection = trpc.admin.testPrintNode.useMutation({
    onSuccess: () => {
      toast.success("PrintNode connection successful!", { icon: "✅" });
      refetchPrinters();
    },
    onError: (err) => toast.error("Connection failed: " + err.message),
  });

  const handleSave = () => {
    if (!printNodeApiKey.trim()) {
      toast.error("Please enter a PrintNode API key");
      return;
    }
    updateSettings.mutate({ printNodeApiKey: printNodeApiKey.trim() });
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">Configure PrintNode integration and system settings</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* PrintNode Integration */}
        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                <Printer className="w-4.5 h-4.5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">PrintNode Integration</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Connect to PrintNode to dispatch print jobs to your Windows machine
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Connection status */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              {settings?.printNodeApiKey ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">API Key Configured</p>
                    <p className="text-xs text-muted-foreground">PrintNode API key is set</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                    Configured
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Not Configured</p>
                    <p className="text-xs text-muted-foreground">Enter your PrintNode API key below</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                    Not set
                  </span>
                </>
              )}
            </div>

            {/* API Key input */}
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-sm font-medium">
                PrintNode API Key
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="apiKey"
                    type={showKey ? "text" : "password"}
                    placeholder={settings?.printNodeApiKey ? "Enter new key to update..." : "Enter your PrintNode API key"}
                    value={printNodeApiKey}
                    onChange={(e) => setPrintNodeApiKey(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowKey(!showKey)}
                  className="flex-shrink-0"
                >
                  {showKey ? "Hide" : "Show"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://app.printnode.com/app/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  app.printnode.com
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={updateSettings.isPending || !printNodeApiKey.trim()}
                className="gap-2"
              >
                {updateSettings.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save API Key
              </Button>
              {settings?.printNodeApiKey && (
                <Button
                  variant="outline"
                  onClick={() => testConnection.mutate()}
                  disabled={testConnection.isPending}
                  className="gap-2"
                >
                  {testConnection.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wifi className="w-4 h-4" />
                  )}
                  Test Connection
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available Printers */}
        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Printer className="w-4.5 h-4.5 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Available Printers</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Printers connected via PrintNode client
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchPrinters()}
                className="text-xs"
              >
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!settings?.printNodeApiKey ? (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Configure API key to see printers</p>
              </div>
            ) : printersLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !printers || printers.length === 0 ? (
              <div className="text-center py-6">
                <Printer className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No printers found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Make sure PrintNode client is running on your Windows machine
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {printers.map((printer, idx) => (
                  <div key={printer.id}>
                    <div className="flex items-center gap-3 py-2">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          printer.state === "online" ? "bg-emerald-500" : "bg-gray-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{printer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {printer.computer.name} · ID: {printer.id}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          printer.state === "online"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
                        {printer.state}
                      </span>
                    </div>
                    {idx < printers.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setup guide */}
        <Card className="border-border/60 bg-accent/20">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">PrintNode Setup Guide</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-semibold text-foreground flex-shrink-0">1.</span>
                <span>
                  Create a free account at{" "}
                  <a href="https://www.printnode.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    printnode.com
                  </a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground flex-shrink-0">2.</span>
                <span>Download and install the PrintNode client on your Windows machine</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground flex-shrink-0">3.</span>
                <span>Sign in to the client — your printers will appear automatically</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground flex-shrink-0">4.</span>
                <span>Copy your API key from the PrintNode dashboard and paste it above</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground flex-shrink-0">5.</span>
                <span>Go to Devices and assign the printer ID to each print station</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
