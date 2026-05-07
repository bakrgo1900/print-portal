import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// User-facing portal pages
import Home from "./pages/Home";
import PrintSession from "./pages/PrintSession";
import JobStatus from "./pages/JobStatus";

// Admin panel pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDevices from "./pages/admin/AdminDevices";
import AdminJobs from "./pages/admin/AdminJobs";
import AdminJobDetail from "./pages/admin/AdminJobDetail";
import AdminSettings from "./pages/admin/AdminSettings";

function Router() {
  return (
    <Switch>
      {/* User-facing portal */}
      <Route path="/" component={Home} />
      <Route path="/print/:qrToken" component={PrintSession} />
      <Route path="/status/:sessionToken" component={JobStatus} />

      {/* Admin panel */}
      <Route path="/admin">
        {() => (
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/devices">
        {() => (
          <AdminLayout>
            <AdminDevices />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/jobs">
        {() => (
          <AdminLayout>
            <AdminJobs />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/jobs/:id">
        {() => (
          <AdminLayout>
            <AdminJobDetail />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/settings">
        {() => (
          <AdminLayout>
            <AdminSettings />
          </AdminLayout>
        )}
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
