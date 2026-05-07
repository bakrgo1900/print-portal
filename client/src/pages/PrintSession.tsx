import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Image,
  X,
  Plus,
  Minus,
  Printer,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

type UploadedFile = {
  id: number;
  fileName: string;
  fileType: string;
  pageCount: number;
  copies: number;
  fileSizeBytes: number;
};

type Step = "upload" | "summary" | "payment";

// Persist session token per qrToken in localStorage
function getStoredSession(qrToken: string): string | null {
  try {
    return localStorage.getItem(`printportal_session_${qrToken}`);
  } catch {
    return null;
  }
}
function storeSession(qrToken: string, token: string) {
  try {
    localStorage.setItem(`printportal_session_${qrToken}`, token);
  } catch {
    // ignore
  }
}
function clearStoredSession(qrToken: string) {
  try {
    localStorage.removeItem(`printportal_session_${qrToken}`);
  } catch {
    // ignore
  }
}

export default function PrintSession() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("upload");
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    qrToken ? getStoredSession(qrToken) : null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get device info by QR token
  const {
    data: device,
    isLoading: deviceLoading,
    error: deviceError,
  } = trpc.session.getDeviceByToken.useQuery(
    { qrToken: qrToken ?? "" },
    { enabled: !!qrToken }
  );

  // Create session mutation
  const createSession = trpc.session.createSession.useMutation({
    onSuccess: (data) => {
      setSessionToken(data.sessionToken);
      if (qrToken) storeSession(qrToken, data.sessionToken);
    },
    onError: (err) => {
      toast.error("Failed to create session: " + err.message);
    },
  });

  // Get job data — this is the source of truth for files
  const {
    data: jobData,
    isLoading: jobLoading,
    refetch: refetchJob,
  } = trpc.session.getJob.useQuery(
    { sessionToken: sessionToken ?? "" },
    {
      enabled: !!sessionToken,
      refetchInterval: step === "payment" ? 3000 : false,
      retry: false,
    }
  );

  // Derive files from server job data (source of truth)
  const files: UploadedFile[] = (jobData?.files ?? []).map((f) => ({
    id: f.id,
    fileName: f.fileName,
    fileType: f.fileType,
    pageCount: f.pageCount,
    copies: f.copies,
    fileSizeBytes: f.fileSizeBytes ?? 0,
  }));

  // If stored session is invalid/expired, clear it and create a new one
  useEffect(() => {
    if (!qrToken || !device) return;
    if (sessionToken && jobData === null) {
      // Session not found on server — clear and recreate
      clearStoredSession(qrToken);
      setSessionToken(null);
    }
  }, [jobData, sessionToken, qrToken, device]);

  // Auto-create session when device is loaded and no valid session exists
  useEffect(() => {
    if (device && !sessionToken && !createSession.isPending) {
      createSession.mutate({ qrToken: qrToken ?? "" });
    }
  }, [device, sessionToken, qrToken]);

  // Update file copies
  const updateCopies = trpc.session.updateFileCopies.useMutation({
    onSuccess: () => refetchJob(),
  });

  // Delete file
  const deleteFile = trpc.session.deleteFile.useMutation({
    onSuccess: () => refetchJob(),
  });

  // Submit for payment
  const submitForPayment = trpc.session.submitForPayment.useMutation({
    onSuccess: () => {
      setStep("payment");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Confirm payment (MVP: manual trigger)
  const confirmPayment = trpc.session.confirmPayment.useMutation({
    onSuccess: () => {
      if (qrToken) clearStoredSession(qrToken);
      if (sessionToken) {
        navigate(`/status/${sessionToken}`);
      }
    },
    onError: (err) => {
      toast.error("Payment confirmation failed: " + err.message);
    },
  });

  const pricePerPage = parseFloat(device?.pricePerPage?.toString() ?? "0.50");
  const totalPages = files.reduce((sum, f) => sum + f.pageCount * f.copies, 0);
  const totalCost = (totalPages * pricePerPage).toFixed(2);

  const handleFileUpload = useCallback(
    async (fileList: FileList) => {
      if (!sessionToken) {
        toast.error("Session not ready. Please wait a moment.");
        return;
      }

      const formData = new FormData();
      Array.from(fileList).forEach((file) => {
        formData.append("files", file);
      });

      setIsUploading(true);
      try {
        const response = await fetch(`/api/upload/${sessionToken}`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error ?? "Upload failed");
        }

        const data = (await response.json()) as { files: UploadedFile[] };
        await refetchJob();
        toast.success(`${data.files.length} file(s) uploaded successfully`);
        // Reset file input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [sessionToken, refetchJob]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files);
      }
    },
    [handleFileUpload]
  );

  const handleCopiesChange = (fileId: number, delta: number) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    const newCopies = Math.max(1, Math.min(99, file.copies + delta));
    updateCopies.mutate({ fileId, copies: newCopies });
  };

  const getFileIcon = (fileType: string) => {
    if (["jpg", "jpeg", "png"].includes(fileType)) {
      return <Image className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const getFileTypeBadge = (fileType: string) => {
    const colors: Record<string, string> = {
      pdf: "bg-red-50 text-red-700 border-red-200",
      docx: "bg-blue-50 text-blue-700 border-blue-200",
      jpg: "bg-green-50 text-green-700 border-green-200",
      jpeg: "bg-green-50 text-green-700 border-green-200",
      png: "bg-purple-50 text-purple-700 border-purple-200",
    };
    return colors[fileType] ?? "bg-gray-50 text-gray-700 border-gray-200";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Loading states ──
  if (deviceLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading print station...</p>
        </div>
      </div>
    );
  }

  if (deviceError || !device) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/30">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Station Not Found</h2>
            <p className="text-muted-foreground text-sm">
              This QR code is invalid or the print station is currently offline.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSessionReady = !!sessionToken && !jobLoading && !createSession.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-white sticky top-0 z-50">
        <div className="container max-w-2xl flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Printer className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground leading-tight">{device.name}</div>
              {device.location && (
                <div className="text-xs text-muted-foreground leading-tight">{device.location}</div>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{pricePerPage.toFixed(2)} EGP</span> / page
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b border-border/30 bg-white">
        <div className="container max-w-2xl">
          <div className="flex">
            {(["upload", "summary", "payment"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`flex-1 py-3 text-center text-xs font-medium border-b-2 transition-colors ${
                  step === s
                    ? "border-primary text-primary"
                    : i < ["upload", "summary", "payment"].indexOf(step)
                    ? "border-primary/30 text-muted-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container max-w-2xl py-8">
        {/* ── STEP: Upload ── */}
        {step === "upload" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Upload your files</h1>
              <p className="text-muted-foreground text-sm">
                Supported formats: PDF, Word (.docx), JPG, PNG — up to 50 MB per file
              </p>
            </div>

            {/* Session initializing indicator */}
            {!isSessionReady && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing session...</span>
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => {
                if (!isSessionReady) {
                  toast.info("Please wait — session is initializing...");
                  return;
                }
                fileInputRef.current?.click();
              }}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
                isSessionReady ? "cursor-pointer" : "cursor-not-allowed opacity-60"
              } ${
                isDragging
                  ? "border-primary bg-accent/40 scale-[1.01]"
                  : "border-border hover:border-primary/50 hover:bg-accent/20"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-sm font-medium text-foreground">Uploading & counting pages...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
                    <Upload className="w-7 h-7 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1">
                      Drop files here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">PDF, DOCX, JPG, PNG — Max 50MB each</p>
                  </div>
                </div>
              )}
            </div>

            {/* Uploaded files list */}
            {files.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Uploaded files ({files.length})
                </h3>
                {files.map((file) => (
                  <Card key={file.id} className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                          {getFileIcon(file.fileType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-foreground truncate">
                              {file.fileName}
                            </p>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${getFileTypeBadge(
                                file.fileType
                              )}`}
                            >
                              {file.fileType.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {file.pageCount} {file.pageCount === 1 ? "page" : "pages"}
                            </span>
                            <span>·</span>
                            <span>{formatFileSize(file.fileSizeBytes)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Copies control */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopiesChange(file.id, -1);
                              }}
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{file.copies}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopiesChange(file.id, 1);
                              }}
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFile.mutate({ fileId: file.id });
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Proceed button */}
            {files.length > 0 && (
              <div className="pt-2">
                <Button
                  className="w-full h-12 text-base font-semibold"
                  onClick={() => setStep("summary")}
                >
                  Review Order
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Summary ── */}
        {step === "summary" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Order Summary</h1>
              <p className="text-muted-foreground text-sm">
                Review your files before proceeding to payment
              </p>
            </div>

            <Card className="border-border/60">
              <CardContent className="p-0">
                {files.map((file, idx) => (
                  <div key={file.id}>
                    <div className="flex items-center gap-3 p-4">
                      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                        {getFileIcon(file.fileType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.pageCount} pages × {file.copies}{" "}
                          {file.copies === 1 ? "copy" : "copies"} ={" "}
                          <span className="font-medium text-foreground">
                            {file.pageCount * file.copies} pages
                          </span>
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                          {(file.pageCount * file.copies * pricePerPage).toFixed(2)} EGP
                        </p>
                        <p className="text-xs text-muted-foreground">{file.copies}× copy</p>
                      </div>
                    </div>
                    {idx < files.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Price breakdown */}
            <Card className="border-border/60 bg-accent/30">
              <CardContent className="p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total pages</span>
                  <span className="font-medium text-foreground">{totalPages}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price per page</span>
                  <span className="font-medium text-foreground">{pricePerPage.toFixed(2)} EGP</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-xl font-bold text-primary">{totalCost} EGP</span>
                </div>
              </CardContent>
            </Card>

            {/* Optional contact info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Contact info (optional)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs text-muted-foreground">
                    Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                className="flex-1 h-11 font-semibold"
                onClick={() => {
                  submitForPayment.mutate({
                    sessionToken: sessionToken ?? "",
                    customerName: customerName || undefined,
                    customerEmail: customerEmail || undefined,
                  });
                }}
                disabled={submitForPayment.isPending}
              >
                {submitForPayment.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Proceed to Payment
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: Payment ── */}
        {step === "payment" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Payment</h1>
              <p className="text-muted-foreground text-sm">Complete your payment to start printing</p>
            </div>

            {/* Amount due */}
            <Card className="border-primary/20 bg-accent/30">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Amount due</p>
                <p className="text-4xl font-bold text-primary">{totalCost}</p>
                <p className="text-sm text-muted-foreground mt-1">EGP</p>
                <p className="text-xs text-muted-foreground mt-3">
                  {totalPages} pages × {pricePerPage.toFixed(2)} EGP/page
                </p>
              </CardContent>
            </Card>

            {/* MVP: Simulate payment */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">MVP Demo Mode</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      In production, this integrates with your payment gateway. For now, click below
                      to simulate a successful payment.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={() => {
                confirmPayment.mutate({
                  sessionToken: sessionToken ?? "",
                  paymentMethod: "demo",
                });
              }}
              disabled={confirmPayment.isPending}
            >
              {confirmPayment.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirm Payment — {totalCost} EGP
            </Button>

            <Button variant="ghost" className="w-full" onClick={() => setStep("summary")}>
              Back to summary
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
