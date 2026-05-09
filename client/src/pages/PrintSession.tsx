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
  Phone,
  User,
} from "lucide-react";

type UploadedFile = {
  id: number;
  fileName: string;
  fileType: string;
  pageCount: number;
  copies: number;
  colorMode: "bw" | "color";
  fileSizeBytes: number;
};

type Step = "contact" | "upload" | "summary" | "payment";

const STEP_LABELS: Record<Step, string> = {
  contact: "معلوماتك",
  upload: "الملفات",
  summary: "الملخص",
  payment: "الدفع",
};

const STEPS: Step[] = ["contact", "upload", "summary", "payment"];

// Persist session token per qrToken in localStorage
function getStoredSession(qrToken: string): string | null {
  try { return localStorage.getItem(`printportal_session_${qrToken}`); } catch { return null; }
}
function storeSession(qrToken: string, token: string) {
  try { localStorage.setItem(`printportal_session_${qrToken}`, token); } catch { /* ignore */ }
}
function clearStoredSession(qrToken: string) {
  try { localStorage.removeItem(`printportal_session_${qrToken}`); } catch { /* ignore */ }
}

export default function PrintSession() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("contact");
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    qrToken ? getStoredSession(qrToken) : null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
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
      toast.error("فشل إنشاء الجلسة: " + err.message);
    },
  });

  // Get job data — source of truth for files
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

  // Derive files from server job data
  const files: UploadedFile[] = (jobData?.files ?? []).map((f) => ({
    id: f.id,
    fileName: f.fileName,
    fileType: f.fileType,
    pageCount: f.pageCount,
    copies: f.copies,
    colorMode: ((f as any).colorMode ?? "bw") as "bw" | "color",
    fileSizeBytes: f.fileSizeBytes ?? 0,
  }));

  // If stored session is invalid/expired, clear it
  useEffect(() => {
    if (!qrToken || !device) return;
    if (sessionToken && jobData === null) {
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

  // If we have a stored session and files, skip contact step
  useEffect(() => {
    if (sessionToken && jobData && step === "contact") {
      if (jobData.job.customerName && jobData.job.customerPhone) {
        setCustomerName(jobData.job.customerName ?? "");
        setCustomerPhone((jobData.job as any).customerPhone ?? "");
        setStep("upload");
      }
    }
  }, [sessionToken, jobData]);

  const updateCopies = trpc.session.updateFileCopies.useMutation({
    onSuccess: () => refetchJob(),
  });

  const updateColorMode = trpc.session.updateFileColorMode.useMutation({
    onSuccess: () => refetchJob(),
  });

  const handleCopiesChange = (fileId: number, delta: number) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    const newCopies = Math.max(1, Math.min(99, file.copies + delta));
    updateCopies.mutate({ fileId, copies: newCopies });
  };

  const handleColorModeToggle = (fileId: number, mode: "bw" | "color") => {
    updateColorMode.mutate({ fileId, colorMode: mode });
  };

  const deleteFile = trpc.session.deleteFile.useMutation({
    onSuccess: () => refetchJob(),
  });

  const submitForPayment = trpc.session.submitForPayment.useMutation({
    onSuccess: () => setStep("payment"),
    onError: (err) => toast.error(err.message),
  });

  const confirmPayment = trpc.session.confirmPayment.useMutation({
    onSuccess: () => {
      if (qrToken) clearStoredSession(qrToken);
      if (sessionToken) navigate(`/status/${sessionToken}`);
    },
    onError: (err) => toast.error("فشل تأكيد الدفع: " + err.message),
  });

  const priceBW = parseFloat((device as any)?.pricePerPageBW?.toString() ?? device?.pricePerPage?.toString() ?? "0.50");
  const priceColor = parseFloat((device as any)?.pricePerPageColor?.toString() ?? "1.00");
  const totalPages = files.reduce((sum, f) => sum + f.pageCount * f.copies, 0);
  const totalCost = files.reduce((sum, f) => {
    const pages = f.pageCount * f.copies;
    return sum + pages * (f.colorMode === "color" ? priceColor : priceBW);
  }, 0).toFixed(2);

  const handleFileUpload = useCallback(
    async (fileList: FileList) => {
      if (!sessionToken) {
        toast.error("الجلسة غير جاهزة، انتظر لحظة.");
        return;
      }
      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append("files", file));
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
        toast.success(`تم رفع ${data.files.length} ملف بنجاح`);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "فشل الرفع");
      } finally {
        setIsUploading(false);
      }
    },
    [sessionToken, refetchJob]
  );

  const getFileIcon = (fileType: string) => {
    if (["jpg", "jpeg", "png"].includes(fileType)) return <Image className="w-4 h-4" />;
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

  const isSessionReady = !!sessionToken && !jobLoading && !createSession.isPending;

  // ── Loading ──
  if (deviceLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
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
            <h2 className="text-xl font-semibold text-foreground mb-2">الجهاز غير موجود</h2>
            <p className="text-muted-foreground text-sm">
              رمز QR غير صالح أو الجهاز غير متاح حالياً.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
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
          <div className="text-xs text-muted-foreground space-x-2 flex gap-3">
            <span>أسود: <span className="font-medium text-foreground">{priceBW.toFixed(2)}</span> ر.س</span>
            <span>ملون: <span className="font-medium text-foreground">{priceColor.toFixed(2)}</span> ر.س</span>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b border-border/30 bg-white">
        <div className="container max-w-2xl">
          <div className="flex">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`flex-1 py-3 text-center text-xs font-medium border-b-2 transition-colors ${
                  step === s
                    ? "border-primary text-primary"
                    : i < STEPS.indexOf(step)
                    ? "border-primary/30 text-muted-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {i + 1}. {STEP_LABELS[s]}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container max-w-2xl py-8">

        {/* ── STEP: Contact ── */}
        {step === "contact" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">أدخل بياناتك</h1>
              <p className="text-muted-foreground text-sm">
                نحتاج اسمك ورقم جوالك لإتمام طلب الطباعة
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  الاسم
                </Label>
                <Input
                  id="name"
                  placeholder="اسمك الكامل"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-12 text-base"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  رقم الجوال
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-12 text-base"
                  inputMode="tel"
                />
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold"
              disabled={!customerName.trim() || !customerPhone.trim() || !isSessionReady}
              onClick={() => {
                if (!customerName.trim()) {
                  toast.error("من فضلك أدخل اسمك");
                  return;
                }
                if (!customerPhone.trim()) {
                  toast.error("من فضلك أدخل رقم جوالك");
                  return;
                }
                setStep("upload");
              }}
            >
              {!isSessionReady ? (
                <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري التحضير...</>
              ) : (
                <>التالي — رفع الملفات <ArrowRight className="w-4 h-4 mr-2" /></>
              )}
            </Button>
          </div>
        )}

        {/* ── STEP: Upload ── */}
        {step === "upload" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">ارفع ملفاتك</h1>
              <p className="text-muted-foreground text-sm">
                الصيغ المدعومة: PDF، Word، JPG، PNG — حتى 50 ميجا للملف
              </p>
            </div>

            {/* Session initializing indicator */}
            {!isSessionReady && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري تهيئة الجلسة...</span>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.jpg,.jpeg,.png,image/*"
              capture={undefined}
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />

            {/* Primary Upload Button */}
            {isUploading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-10 rounded-2xl bg-accent/30 border-2 border-dashed border-primary/30">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-foreground">جاري رفع الملفات...</p>
                  <p className="text-sm text-muted-foreground mt-1">يتم عد الصفحات تلقائياً</p>
                </div>
              </div>
            ) : (
              <button
                disabled={!isSessionReady}
                onClick={() => {
                  if (!isSessionReady) {
                    toast.info("انتظر لحظة — جاري تهيئة الجلسة...");
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
                }}
                className={`w-full flex flex-col items-center justify-center gap-5 py-12 px-6 rounded-2xl border-2 border-dashed transition-all duration-200 ${
                  !isSessionReady
                    ? "opacity-50 cursor-not-allowed border-border bg-muted/30"
                    : isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-primary/40 bg-primary/3 hover:border-primary hover:bg-primary/8 active:scale-[0.99] cursor-pointer"
                }`}
              >
                <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
                  <Upload className="w-10 h-10 text-primary-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground mb-1">اضغط لرفع الملفات</p>
                  <p className="text-sm text-muted-foreground">PDF، Word، JPG، PNG</p>
                </div>
                {isSessionReady && (
                  <div className="flex gap-2 flex-wrap justify-center">
                    {["PDF", "DOCX", "JPG", "PNG"].map((fmt) => (
                      <span key={fmt} className="text-xs px-2.5 py-1 rounded-full bg-background border border-border text-muted-foreground font-medium">
                        {fmt}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )}

            {/* Uploaded files list */}
            {files.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  الملفات المرفوعة ({files.length})
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
                            <p className="text-sm font-medium text-foreground truncate">{file.fileName}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${getFileTypeBadge(file.fileType)}`}>
                              {file.fileType.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{file.pageCount} {file.pageCount === 1 ? "صفحة" : "صفحات"}</span>
                            <span>·</span>
                            <span>{formatFileSize(file.fileSizeBytes)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {/* Color mode toggle */}
                          <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs font-medium">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleColorModeToggle(file.id, "bw"); }}
                              className={`px-2 py-1 transition-colors ${file.colorMode === "bw" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}
                            >
                              أسود
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleColorModeToggle(file.id, "color"); }}
                              className={`px-2 py-1 transition-colors ${file.colorMode === "color" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}
                            >
                              ملون
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopiesChange(file.id, -1); }}
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{file.copies}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopiesChange(file.id, 1); }}
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteFile.mutate({ fileId: file.id }); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Proceed button */}
            {files.length > 0 && (
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setStep("contact")}>
                  رجوع
                </Button>
                <Button className="flex-1 h-11 font-semibold" onClick={() => setStep("summary")}>
                  مراجعة الطلب
                  <ArrowRight className="w-4 h-4 mr-2" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Summary ── */}
        {step === "summary" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">ملخص الطلب</h1>
              <p className="text-muted-foreground text-sm">راجع ملفاتك قبل الدفع</p>
            </div>

            {/* Customer info */}
            <Card className="border-border/60 bg-accent/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{customerName}</span>
                  <span className="text-muted-foreground">·</span>
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{customerPhone}</span>
                </div>
              </CardContent>
            </Card>

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
                          {file.pageCount} صفحة × {file.copies} نسخة ={" "}
                          <span className="font-medium text-foreground">{file.pageCount * file.copies} صفحة</span>
                          {" · "}
                          <span className={`font-medium ${file.colorMode === "color" ? "text-blue-600" : "text-foreground"}`}>
                            {file.colorMode === "color" ? "ملون" : "أسود"}
                          </span>
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                          {(file.pageCount * file.copies * (file.colorMode === "color" ? priceColor : priceBW)).toFixed(2)} ر.س
                        </p>
                        <p className="text-xs text-muted-foreground">{(file.colorMode === "color" ? priceColor : priceBW).toFixed(2)} ر.س/ص</p>
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
                  <span className="text-muted-foreground">إجمالي الصفحات</span>
                  <span className="font-medium text-foreground">{totalPages}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">سعر أسود وأبيض / صفحة</span>
                  <span className="font-medium text-foreground">{priceBW.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">سعر ملون / صفحة</span>
                  <span className="font-medium text-foreground">{priceColor.toFixed(2)} ر.س</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">الإجمالي</span>
                  <span className="text-xl font-bold text-primary">{totalCost} ر.س</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setStep("upload")}>
                رجوع
              </Button>
              <Button
                className="flex-1 h-11 font-semibold"
                onClick={() => {
                  submitForPayment.mutate({
                    sessionToken: sessionToken ?? "",
                    customerName: customerName || undefined,
                    customerPhone: customerPhone || undefined,
                  });
                }}
                disabled={submitForPayment.isPending}
              >
                {submitForPayment.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <CreditCard className="w-4 h-4 ml-2" />
                )}
                متابعة للدفع
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: Payment ── */}
        {step === "payment" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">الدفع</h1>
              <p className="text-muted-foreground text-sm">أكمل الدفع لبدء الطباعة</p>
            </div>

            {/* Amount due */}
            <Card className="border-primary/20 bg-accent/30">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">المبلغ المستحق</p>
                <p className="text-4xl font-bold text-primary">{totalCost}</p>
                <p className="text-sm text-muted-foreground mt-1">ريال سعودي</p>
                <p className="text-xs text-muted-foreground mt-3">
                  {totalPages} صفحة — أسود: {priceBW.toFixed(2)} / ملون: {priceColor.toFixed(2)} ر.س
                </p>
              </CardContent>
            </Card>

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={() => {
                confirmPayment.mutate({
                  sessionToken: sessionToken ?? "",
                  paymentMethod: "cash",
                });
              }}
              disabled={confirmPayment.isPending}
            >
              {confirmPayment.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 ml-2" />
              )}
              تأكيد الدفع — {totalCost} ر.س
            </Button>

            <Button variant="ghost" className="w-full" onClick={() => setStep("summary")}>
              رجوع للملخص
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}


