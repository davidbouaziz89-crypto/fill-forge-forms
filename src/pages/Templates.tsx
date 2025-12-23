import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Templates() {
  const { userRole, userName, signOut } = useAuth();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["pdf-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdf_templates")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Get usage counts
  const { data: usageCounts = {} } = useQuery({
    queryKey: ["template-usage-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("generated_documents")
        .select("template_id");

      const counts: Record<string, number> = {};
      (data ?? []).forEach((doc) => {
        if (doc.template_id) {
          counts[doc.template_id] = (counts[doc.template_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Get field counts per template
  const { data: fieldCounts = {} } = useQuery({
    queryKey: ["template-field-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdf_template_fields")
        .select("template_id");

      const counts: Record<string, number> = {};
      (data ?? []).forEach((field) => {
        counts[field.template_id] = (counts[field.template_id] || 0) + 1;
      });
      return counts;
    },
  });

  if (isLoading) {
    return (
      <AppLayout userRole={userRole ?? "admin"} userName={userName} onLogout={signOut}>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      userRole={userRole ?? "admin"} 
      userName={userName || "Utilisateur"} 
      onLogout={signOut}
    >
      <PageHeader
        title="Templates PDF"
        description="Gérez vos modèles de documents"
        actions={
          <Button variant="accent">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau template
          </Button>
        }
      />

      <div className="p-8">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Aucun template
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Créez votre premier template PDF pour commencer
            </p>
            <Button variant="accent" className="mt-6">
              <Plus className="mr-2 h-4 w-4" />
              Créer un template
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        Voir
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-foreground">{template.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {template.description || "Aucune description"}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  {template.category && (
                    <Badge variant="secondary">{template.category}</Badge>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{fieldCounts[template.id] || 0} champs</span>
                    <span>{usageCounts[template.id] || 0} utilisations</span>
                  </div>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  Mis à jour le {new Date(template.updated_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
