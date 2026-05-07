import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  CheckCircle2,
  Clock,
  Printer,
  AlertCircle,
  FileText,
  Image,
  CreditCard,
} from "lucide-react";

type JobStatus = "pending" | "paid" | "printing" | "done" | "failed";

const statusConfig: Record<JobStatus, { label: string; color: string; icon: React.ElementType; description: string }> = {
  pending: {
    label: "Pending Payment",
    color: "text-amber-600",
    icon: Clock,
    description: "Waiting for payment confirmation",
  },
  paid: {
    label: "Payment Confirmed",
    color: "text-blue-600",
    icon: CreditCard,
    description: "Payment received, preparing to print",
  },
  printing: {
    label: "Printing",
    color: "text-violet-600",
    icon: Printer,
    description: "Your documents are being printed now",
  },
  done: {
    label: "Done",
    color: "text-emerald-600",
    icon: CheckCircle2,
    description: "Your documents are ready to collect",
  },
  failed: {
    label: "Failed",
    color: "text-red-600",
    icon: AlertCircle,
    description: "Something went wrong. Please contact the print station.",
  },
};

const statusSteps: JobStatus[] = ["pending", "paid", "printing", "done"];

export default function JobStatus() {
  const { sessionToken } = useParams<{ sessionToken: string }>();

  const { data, isLoading, error } = trpc.session.getJob.useQuery(
    { sessionToken: sessionToken ?? "" },
    {
      enabled: !!sessionToken,
      refetchInterval: (query) => {
        const status = query.state.data?.job?.status;
        if (status === "done" || status === "failed") return false;
        return 3000;
      },
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
            <p className="text-muted-foreground text-sm">
              This print session could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { job, files, device } = data;
  const status = (job.status as string) as JobStatus;
  const isDone = status === ("done" as string);
  const config = statusConfig[status] ?? statusConfig.pending;
  const StatusIcon = config.icon;
  const currentStepIndex = statusSteps.indexOf(status);

  const getFileIcon = (fileType: string) => {
    if (fileType === "jpg" || fileType === "jpeg" || fileType === "png") {
      return <Image className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-white sticky top-0 z-50">
        <div className="container max-w-2xl flex items-center h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Printer className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground leading-tight">
                {device?.name ?? "Print Station"}
              </div>
              <div className="text-xs text-muted-foreground leading-tight">Order #{job.id}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl py-8 space-y-6">
        {/* Status card */}
        <Card className="border-border/60 overflow-hidden">
          <div
            className={`h-1.5 ${
              status === "done"
                ? "bg-emerald-500"
                : status === "failed"
                ? "bg-red-500"
                : status === "printing"
                ? "bg-violet-500"
                : status === "paid"
                ? "bg-blue-500"
                : "bg-amber-500"
            }`}
          />
          <CardContent className="p-6 text-center">
            <div
              className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
                status === "done"
                  ? "bg-emerald-50"
                  : status === "failed"
                  ? "bg-red-50"
                  : status === "printing"
                  ? "bg-violet-50"
                  : status === "paid"
                  ? "bg-blue-50"
                  : "bg-amber-50"
              }`}
            >
              <StatusIcon
                className={`w-8 h-8 ${config.color} ${
                  status === "printing" ? "animate-pulse" : ""
                }`}
              />
            </div>
            <h2 className={`text-xl font-bold mb-1 ${config.color}`}>{config.label}</h2>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </CardContent>
        </Card>

        {/* Progress steps */}
        <div className="flex items-center gap-0">
          {statusSteps.map((s, i) => {
            const isCompleted = i < currentStepIndex || status === "done";
            const isCurrent = i === currentStepIndex && status !== "done";
            const stepConf = statusConfig[s];
            const StepIcon = stepConf.icon;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCompleted || isDone
                        ? "bg-primary border-primary text-primary-foreground"
                        : isCurrent
                        ? "border-primary text-primary bg-accent"
                        : "border-border text-muted-foreground bg-background"
                    }`}
                  >
                    {isCompleted || isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <StepIcon className={`w-3.5 h-3.5 ${isCurrent ? "animate-pulse" : ""}`} />
                    )}
                  </div>
                  <span
                    className={`text-xs mt-1.5 font-medium ${
                      isCompleted || isCurrent || isDone
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stepConf.label.split(" ")[0]}
                  </span>
                </div>
                {i < statusSteps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-1 mb-5 transition-colors ${
                      i < currentStepIndex || status === "done" ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Files */}
        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-semibold text-foreground">Files ({files.length})</h3>
            </div>
            {files.map((file, idx) => (
              <div key={file.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                    {getFileIcon(file.fileType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.pageCount} pages × {file.copies} {file.copies === 1 ? "copy" : "copies"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground flex-shrink-0">
                    {file.pageCount * file.copies} pages
                  </span>
                </div>
                {idx < files.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cost summary */}
        <Card className="border-border/60 bg-accent/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total pages</span>
              <span className="font-medium">{job.totalPages}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price per page</span>
              <span className="font-medium">{parseFloat(device?.pricePerPage?.toString() ?? "0.50").toFixed(2)} EGP</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-semibold">Total paid</span>
              <span className="font-bold text-primary text-lg">
                {parseFloat(job.totalCost?.toString() ?? "0").toFixed(2)} EGP
              </span>
            </div>
          </CardContent>
        </Card>

        {status === "done" && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Thank you for using PrintPortal. Please collect your documents from the print station.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
