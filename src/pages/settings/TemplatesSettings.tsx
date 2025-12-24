import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatDateFR } from "@/lib/dateUtils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplateForm } from "@/components/templates/TemplateForm";
import { TemplateEditor } from "@/components/templates/TemplateEditor";

export default function TemplatesSettings() {
  const { userRole, userName, signOut } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [editorTemplate, setEditorTemplate] = useState<any>(null);
  const queryClient = useQueryClient();

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

  const deleteMutation = useMutation({
    mutationFn: async (template: any) => {
      // Delete PDF from storage if exists
      if (template.source_pdf_storage_path) {
        await supabase.storage
          .from("pdf-templates")
          .remove([template.source_pdf_storage_path]);
      }
      
      const { error } = await supabase
        .from("pdf_templates")
        .delete()
        .eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdf-templates"] });
      toast({ title: "Template supprimé" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le template",
        variant: "destructive",
      });
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

  // Show editor in full screen mode
  if (editorTemplate) {
    return (
      <TemplateEditor
        template={editorTemplate}
        onClose={() => {
          setEditorTemplate(null);
          queryClient.invalidateQueries({ queryKey: ["pdf-templates"] });
          queryClient.invalidateQueries({ queryKey: ["template-field-counts"] });
        }}
      />
    );
  }

  return (
    <AppLayout 
      userRole={userRole ?? "admin"} 
      userName={userName || "Utilisateur"} 
      onLogout={signOut}
    >
      <div className="border-b border-border bg-card px-8 py-4">
        <Breadcrumbs
          items={[
            { label: "Paramétrage", href: "/settings/fields" },
            { label: "Modèles PDF" },
          ]}
        />
      </div>
      
      <PageHeader
        title="Modèles PDF"
        description="Créez et configurez vos modèles de documents"
        actions={
          <Button variant="accent" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau modèle
          </Button>
        }
      />

      <div className="p-8">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Aucun modèle PDF
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Créez votre premier modèle pour générer des documents
            </p>
            <Button 
              variant="accent" 
              className="mt-6"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Créer un modèle
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
                      <DropdownMenuItem onClick={() => setEditorTemplate(template)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Éditer le mapping
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Modifier les infos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(template)}
                      >
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

                <div className="mt-4 flex gap-2">
                  {template.source_pdf_storage_path ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditorTemplate(template)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Éditer le mapping
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditingTemplate(template)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un PDF
                    </Button>
                  )}
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  Mis à jour le {formatDateFR(template.updated_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau modèle PDF</DialogTitle>
          </DialogHeader>
          <TemplateForm
            onSuccess={(template) => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["pdf-templates"] });
              // Open editor if PDF was uploaded
              if (template?.source_pdf_storage_path) {
                setEditorTemplate(template);
              }
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le modèle</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <TemplateForm
              initialData={editingTemplate}
              onSuccess={(template) => {
                setEditingTemplate(null);
                queryClient.invalidateQueries({ queryKey: ["pdf-templates"] });
                if (template?.source_pdf_storage_path && !editingTemplate.source_pdf_storage_path) {
                  setEditorTemplate(template);
                }
              }}
              onCancel={() => setEditingTemplate(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
