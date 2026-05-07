import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Loader2,
  ArrowRight,
  Search,
  Printer,
  FileText,
  RefreshCw,
  Play,
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

const STATUS_FILTERS = ["all", "pending", "paid", "printing", "done", "failed"];

export default function AdminJobs() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data: jobs, isLoading, refetch } = trpc.admin.listJobs.useQuery({});

  const updateStatus = trpc.admin.updateJobStatus.useMutation({
    onSuccess: () => {
      toast.success("Job status updated");
      utils.admin.listJobs.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const dispatchJob = trpc.admin.dispatchJob.useMutation({
    onSuccess: () => {
      toast.success("Print job dispatched");
      utils.admin.listJobs.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredJobs = (jobs ?? []).filter((job) => {
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesSearch =
      !search ||
      String(job.id).includes(search) ||
      job.device?.name?.toLowerCase().includes(search.toLowerCase()) ||
      job.customerName?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Print Jobs</h1>
          <p className="text-muted-foreground text-sm">
            {jobs?.length ?? 0} total jobs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, device, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-secondary"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-20">
          <Printer className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">No jobs found</p>
        </div>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-0">
            {filteredJobs.map((job, idx) => (
              <div key={job.id}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">Job #{job.id}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${statusBadge(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{job.device?.name ?? "Unknown device"}</span>
                      <span>·</span>
                      <span>{job.files?.length ?? 0} file(s)</span>
                      <span>·</span>
                      <span>{job.totalPages} pages</span>
                      {job.customerName && (
                        <>
                          <span>·</span>
                          <span>{job.customerName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-2">
                    <p className="text-sm font-semibold text-foreground">
                      {parseFloat(job.totalCost?.toString() ?? "0").toFixed(2)} EGP
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {job.status === "paid" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-violet-700 border-violet-200 hover:bg-violet-50"
                        onClick={() => dispatchJob.mutate({ id: job.id })}
                        disabled={dispatchJob.isPending}
                      >
                        {dispatchJob.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        Print
                      </Button>
                    )}
                    <Link href={`/admin/jobs/${job.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
                {idx < filteredJobs.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
