import { Link } from "react-router-dom";
import { Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AgencySupportAccountsPanel from "@/components/admin/AgencySupportAccountsPanel";
import AgencyProjectsAdminPanel from "@/components/admin/AgencyProjectsAdminPanel";


const AdminAgency = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Agency support</h1>
              <p className="text-sm text-muted-foreground">
                Every owner with purchased support accounts and the sub-accounts they assigned.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/admin">
              <Button variant="outline" size="sm" className="gap-1">
                <ArrowLeft className="w-4 h-4" /> Admin
              </Button>
            </Link>
            <Link to="/admin/support">
              <Button variant="outline" size="sm">
                Support
              </Button>
            </Link>
            <Link to="/admin/setup-tracker">
              <Button variant="outline" size="sm">
                AI Studio Setup
              </Button>
            </Link>
          </div>
        </div>

        <AgencySupportAccountsPanel />

        <AgencyProjectsAdminPanel />

      </div>
    </div>
  );
};

export default AdminAgency;
