import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentDocuments } from "@/components/dashboard/RecentDocuments";
import { Users, FileText, TrendingUp, Building } from "lucide-react";

// Mock data - will be replaced with real data from Supabase
const mockStats = {
  totalClients: 156,
  documentsThisMonth: 42,
  activeTemplates: 8,
  conversionRate: 23.5,
};

const mockRecentDocuments = [
  {
    id: "1",
    clientName: "Entreprise ABC",
    templateName: "Contrat de service",
    createdAt: "Il y a 2 heures",
    generatedBy: "Jean Dupont",
  },
  {
    id: "2",
    clientName: "Tech Solutions SAS",
    templateName: "Proposition commerciale",
    createdAt: "Il y a 5 heures",
    generatedBy: "Marie Martin",
  },
  {
    id: "3",
    clientName: "Global Corp",
    templateName: "Contrat de service",
    createdAt: "Hier",
    generatedBy: "Jean Dupont",
  },
];

export default function Dashboard() {
  return (
    <AppLayout userRole="admin" userName="Admin">
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre activité"
      />
      
      <div className="space-y-6 p-8">
        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total clients"
            value={mockStats.totalClients}
            icon={<Users className="h-6 w-6" />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Documents ce mois"
            value={mockStats.documentsThisMonth}
            icon={<FileText className="h-6 w-6" />}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="Templates actifs"
            value={mockStats.activeTemplates}
            icon={<Building className="h-6 w-6" />}
          />
          <StatCard
            title="Taux conversion"
            value={`${mockStats.conversionRate}%`}
            icon={<TrendingUp className="h-6 w-6" />}
            trend={{ value: 3.2, isPositive: true }}
          />
        </div>

        {/* Recent Documents */}
        <RecentDocuments documents={mockRecentDocuments} />
      </div>
    </AppLayout>
  );
}
