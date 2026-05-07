import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import {
  Printer,
  FileText,
  DollarSign,
  Clock,
  CheckCircle2,
  ArrowRight,
  Loader2,
  TrendingUp,
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

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: jobs, isLoading: jobsLoading } = trpc.admin.listJobs.useQuery({});

  const recentJobs = jobs?.slice(0, 8) ?? [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your print portal activity</p>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground mb-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading stats...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Jobs",
              value: stats?.totalJobs ?? 0,
              icon: FileText,
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "Pending",
              value: stats?.pendingJobs ?? 0,
              icon: Clock,
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: "Completed",
              value: stats?.doneJobs ?? 0,
              icon: CheckCircle2,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              label: "Revenue",
              value: `${parseFloat(stats?.totalRevenue?.toString() ?? "0").toFixed(2)} EGP`,
              icon: TrendingUp,
              color: "text-primary",
              bg: "bg-accent",
            },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent jobs */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Print Jobs</CardTitle>
            <Link href="/admin/jobs">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                View all
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="text-center py-12">
              <Printer className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No print jobs yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Jobs will appear here once customers scan QR codes
              </p>
            </div>
          ) : (
            <div>
              {recentJobs.map((job, idx) => (
                <div key={job.id}>
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-foreground">
                          Job #{job.id}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${statusBadge(job.status)}`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.device?.name ?? "Unknown device"} ·{" "}
                        {job.files?.length ?? 0} file(s) · {job.totalPages} pages
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">
                        {parseFloat(job.totalCost?.toString() ?? "0").toFixed(2)} EGP
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Link href={`/admin/jobs/${job.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                  {idx < recentJobs.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
