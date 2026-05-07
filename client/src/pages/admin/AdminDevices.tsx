import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Monitor,
  QrCode,
  Pencil,
  Trash2,
  Loader2,
  Download,
  MapPin,
  DollarSign,
  Printer,
} from "lucide-react";

type Device = {
  id: number;
  name: string;
  location: string | null;
  pricePerPage: string;
  printNodePrinterId: string | null;
  isActive: number;
  qrToken: string;
  createdAt: Date;
};

export default function AdminDevices() {
  const [showCreate, setShowCreate] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [qrDevice, setQrDevice] = useState<Device | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    location: "",
    pricePerPage: "0.50",
    printNodePrinterId: "",
  });

  const utils = trpc.useUtils();

  const { data: devices, isLoading } = trpc.devices.list.useQuery();
  const { data: printers } = trpc.admin.listPrinters.useQuery();

  const createDevice = trpc.devices.create.useMutation({
    onSuccess: () => {
      toast.success("Device created successfully");
      setShowCreate(false);
      resetForm();
      utils.devices.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateDevice = trpc.devices.update.useMutation({
    onSuccess: () => {
      toast.success("Device updated");
      setEditDevice(null);
      utils.devices.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDevice = trpc.devices.delete.useMutation({
    onSuccess: () => {
      toast.success("Device deleted");
      utils.devices.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const generateQr = trpc.devices.generateQrCode.useMutation({
    onSuccess: (data) => {
      setQrDataUrl(data.qrDataUrl);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({ name: "", location: "", pricePerPage: "0.50", printNodePrinterId: "" });
  };

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("Device name is required");
      return;
    }
    createDevice.mutate({
      name: form.name,
      location: form.location || undefined,
      pricePerPage: form.pricePerPage,
      printNodePrinterId: form.printNodePrinterId || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editDevice) return;
    updateDevice.mutate({
      id: editDevice.id,
      name: form.name || undefined,
      location: form.location || undefined,
      pricePerPage: form.pricePerPage || undefined,
      printNodePrinterId: form.printNodePrinterId || undefined,
    });
  };

  const handleGenerateQr = (device: Device) => {
    setQrDevice(device);
    setQrDataUrl(null);
    generateQr.mutate({
      deviceId: device.id,
      baseUrl: window.location.origin,
    });
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !qrDevice) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-${qrDevice.name.replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const DeviceForm = ({ onSubmit, loading }: { onSubmit: () => void; loading: boolean }) => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-sm">Device Name *</Label>
        <Input
          id="name"
          placeholder="e.g. Library Print Station A"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location" className="text-sm">Location</Label>
        <Input
          id="location"
          placeholder="e.g. Ground Floor, Room 101"
          value={form.location}
          onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="price" className="text-sm">Price per Page (EGP)</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.50"
          value={form.pricePerPage}
          onChange={(e) => setForm((p) => ({ ...p, pricePerPage: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="printer" className="text-sm">PrintNode Printer ID</Label>
        {printers && printers.length > 0 ? (
          <select
            id="printer"
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.printNodePrinterId}
            onChange={(e) => setForm((p) => ({ ...p, printNodePrinterId: e.target.value }))}
          >
            <option value="">Select a printer...</option>
            {printers.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name} ({p.computer.name})
              </option>
            ))}
          </select>
        ) : (
          <Input
            id="printer"
            placeholder="Enter PrintNode printer ID"
            value={form.printNodePrinterId}
            onChange={(e) => setForm((p) => ({ ...p, printNodePrinterId: e.target.value }))}
          />
        )}
        <p className="text-xs text-muted-foreground">
          Configure PrintNode API key in Settings to see available printers
        </p>
      </div>
      <Button
        className="w-full"
        onClick={onSubmit}
        disabled={loading}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Save Device
      </Button>
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Devices</h1>
          <p className="text-muted-foreground text-sm">Manage your print stations and QR codes</p>
        </div>
        <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
            </DialogHeader>
            <DeviceForm onSubmit={handleCreate} loading={createDevice.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !devices || devices.length === 0 ? (
        <div className="text-center py-20">
          <Monitor className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No devices yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Add your first print station to get started
          </p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Device
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {devices.map((device) => (
            <Card key={device.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                      <Monitor className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{device.name}</h3>
                      {device.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {device.location}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      device.isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}
                  >
                    {device.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Price/page</p>
                    <p className="text-sm font-semibold text-foreground">
                      {parseFloat(device.pricePerPage?.toString() ?? "0").toFixed(2)} EGP
                    </p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Printer</p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {device.printNodePrinterId ? `ID: ${device.printNodePrinterId}` : "Not set"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => handleGenerateQr(device as Device)}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QR Code
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => {
                      setEditDevice(device as Device);
                      setForm({
                        name: device.name,
                        location: device.location ?? "",
                        pricePerPage: device.pricePerPage?.toString() ?? "0.50",
                        printNodePrinterId: device.printNodePrinterId ?? "",
                      });
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Delete this device?")) {
                        deleteDevice.mutate({ id: device.id });
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editDevice} onOpenChange={(open) => { if (!open) { setEditDevice(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
          </DialogHeader>
          <DeviceForm onSubmit={handleUpdate} loading={updateDevice.isPending} />
        </DialogContent>
      </Dialog>

      {/* QR Code dialog */}
      <Dialog open={!!qrDevice} onOpenChange={(open) => { if (!open) { setQrDevice(null); setQrDataUrl(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code — {qrDevice?.name}</DialogTitle>
          </DialogHeader>
          <div className="text-center">
            {generateQr.isPending ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : qrDataUrl ? (
              <div className="space-y-4">
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-56 h-56 mx-auto rounded-xl border border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Scan to start a print session at {qrDevice?.name}
                </p>
                <Button className="w-full gap-2" onClick={handleDownloadQr}>
                  <Download className="w-4 h-4" />
                  Download QR Code
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
