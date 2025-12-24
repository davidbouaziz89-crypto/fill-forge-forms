import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentDocuments } from "@/components/dashboard/RecentDocuments";
import { Users, FileText, TrendingUp, Building } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeDateFR } from "@/lib/dateUtils";

export default function Dashboard() {
  const { userRole, userName, signOut } = useAuth();

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clientsRes, docsRes, templatesRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase
          .from("generated_documents")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from("pdf_templates").select("id", { count: "exact", head: true }),
      ]);

      return {
        totalClients: clientsRes.count ?? 0,
        documentsThisMonth: docsRes.count ?? 0,
        activeTemplates: templatesRes.count ?? 0,
      };
    },
  });

  // Fetch recent documents
  const { data: recentDocuments = [] } = useQuery({
    queryKey: ["recent-documents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("generated_documents")
        .select(`
          id,
          created_at,
          client:clients(company_name),
          template:pdf_templates(name),
          generated_by:profiles(name)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      return (data ?? []).map((doc) => ({
        id: doc.id,
        clientName: doc.client?.company_name ?? "Client inconnu",
        templateName: doc.template?.name ?? "Template supprimé",
        createdAt: formatRelativeDateFR(doc.created_at),
        generatedBy: doc.generated_by?.name ?? "Utilisateur",
      }));
    },
  });

  return (
    <AppLayout 
      userRole={userRole ?? "sales"} 
      userName={userName || "Utilisateur"} 
      onLogout={signOut}
    >
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre activité"
      />
      
      <div className="space-y-6 p-8">
        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total clients"
            value={stats?.totalClients ?? 0}
            icon={<Users className="h-6 w-6" />}
          />
          <StatCard
            title="Documents ce mois"
            value={stats?.documentsThisMonth ?? 0}
            icon={<FileText className="h-6 w-6" />}
          />
          <StatCard
            title="Templates actifs"
            value={stats?.activeTemplates ?? 0}
            icon={<Building className="h-6 w-6" />}
          />
          <StatCard
            title="Taux de complétion"
            value="100%"
            icon={<TrendingUp className="h-6 w-6" />}
          />
        </div>

        {/* Recent Documents */}
        <RecentDocuments documents={recentDocuments} />
      </div>
    </AppLayout>
  );
}
