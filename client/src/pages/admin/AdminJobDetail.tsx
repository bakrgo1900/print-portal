import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  FileText,
  Image,
  Printer,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  User,
  Mail,
  Monitor,
  MapPin,
} from "lucide-react";

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    paid: "bg-blue-50 text-blue-700 border-blue-200",
    printing: "bg-violet-50 text-violet-700 border-violet-200",
    done: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
  };
  return map[status] ?? "bg-gray-50 text-gray-700 border-gray-200";
};

export default function AdminJobDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const jobId = parseInt(id ?? "0");

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.admin.getJob.useQuery({ id: jobId }, { enabled: !!jobId });

  const updateStatus = trpc.admin.updateJobStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      utils.admin.getJob.invalidate({ id: jobId });
    },
    onError: (err) => toast.error(err.message),
  });

  const dispatchJob = trpc.admin.dispatchJob.useMutation({
    onSuccess: () => {
      toast.success("Print job dispatched to printer");
      utils.admin.getJob.invalidate({ id: jobId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <p className="text-muted-foreground">Job not found</p>
      </div>
    );
  }

  const { job, files, device } = data;

  const getFileIcon = (fileType: string) => {
    if (fileType === "jpg" || fileType === "jpeg" || fileType === "png") {
      return <Image className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/jobs")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Job #{job.id}</h1>
            <span className={`text-sm px-2.5 py-1 rounded-lg border font-medium ${statusBadge(job.status)}`}>
              {job.status}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Created {new Date(job.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          {job.status === "paid" && (
            <Button
              className="gap-2"
              onClick={() => dispatchJob.mutate({ id: job.id })}
              disabled={dispatchJob.isPending}
            >
              {dispatchJob.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Dispatch to Printer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Files */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Files ({files.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {files.map((file, idx) => (
                <div key={file.id}>
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                      {getFileIcon(file.fileType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.fileType.toUpperCase()} · {file.pageCount} pages × {file.copies} copies
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">
                        {file.pageCount * file.copies} pages
                      </p>
                    </div>
                  </div>
                  {idx < files.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Status timeline */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { status: "pending", label: "Order Created", date: job.createdAt, icon: Clock },
                { status: "paid", label: "Payment Confirmed", date: job.paidAt, icon: CreditCard },
                { status: "printing", label: "Sent to Printer", date: job.paidAt, icon: Printer },
                { status: "done", label: "Print Complete", date: job.printedAt, icon: CheckCircle2 },
              ].map((step, idx) => {
                const isReached =
                  ["pending", "paid", "printing", "done"].indexOf(job.status) >= idx;
                return (
                  <div key={step.status} className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isReached
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <step.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isReached ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                    </div>
                    {step.date && isReached && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(step.date).toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Cost summary */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cost Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total pages</span>
                <span className="font-medium">{job.totalPages}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price/page</span>
                <span className="font-medium">
                  {parseFloat(device?.pricePerPage?.toString() ?? "0").toFixed(2)} EGP
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-primary text-lg">
                  {parseFloat(job.totalCost?.toString() ?? "0").toFixed(2)} EGP
                </span>
              </div>
              {job.paymentRef && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">Payment ref</p>
                  <p className="text-xs font-mono text-foreground mt-0.5">{job.paymentRef}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Device info */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Device</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{device?.name ?? "Unknown"}</span>
              </div>
              {device?.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{device.location}</span>
                </div>
              )}
              {job.printNodeJobId && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">PrintNode Job ID</p>
                  <p className="text-xs font-mono text-foreground mt-0.5">{job.printNodeJobId}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer info */}
          {(job.customerName || job.customerEmail) && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {job.customerName && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{job.customerName}</span>
                  </div>
                )}
                {job.customerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{job.customerEmail}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Manual status update */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Update Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(["pending", "paid", "printing", "done", "failed"] as const).map((s) => (
                <Button
                  key={s}
                  variant={job.status === s ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-start text-xs"
                  disabled={job.status === s || updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: job.id, status: s })}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
