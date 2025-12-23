import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  FormInput,
  GripVertical,
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
import { CustomFieldForm } from "@/components/custom-fields/CustomFieldForm";

const typeLabels: Record<string, string> = {
  text: "Texte",
  number: "Nombre",
  date: "Date",
  select: "Liste",
  boolean: "Oui/Non",
};

const visibilityLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  admin_only: { label: "Admin uniquement", variant: "default" },
  editable: { label: "Modifiable", variant: "secondary" },
  read_only: { label: "Lecture seule", variant: "outline" },
};

export default function CustomFields() {
  const { userRole, userName, signOut } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: customFields = [], isLoading } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_fields")
        .select("*")
        .order("sort_order");
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      toast({ title: "Champ supprimé" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le champ",
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

  return (
    <AppLayout 
      userRole={userRole ?? "admin"} 
      userName={userName || "Utilisateur"} 
      onLogout={signOut}
    >
      <PageHeader
        title="Champs personnalisés"
        description="Configurez les champs additionnels pour vos fiches clients"
        actions={
          <Button variant="accent" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau champ
          </Button>
        }
      />

      <div className="p-8">
        {customFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
            <FormInput className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Aucun champ personnalisé
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Créez des champs personnalisés pour enrichir vos fiches clients
            </p>
            <Button 
              variant="accent" 
              className="mt-6"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Créer un champ
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Clé</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Requis</TableHead>
                    <TableHead>Visibilité</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customFields.map((field) => (
                    <TableRow key={field.id} className="group">
                      <TableCell>
                        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/50" />
                      </TableCell>
                      <TableCell className="font-medium">{field.label}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {field.key}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[field.type]}</Badge>
                      </TableCell>
                      <TableCell>
                        {field.required_bool ? (
                          <Badge className="bg-warning text-warning-foreground">
                            Requis
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={visibilityLabels[field.visibility].variant}>
                          {visibilityLabels[field.visibility].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(field.created_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
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
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(field.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 rounded-lg border border-info/20 bg-info/5 p-4">
              <h4 className="font-medium text-foreground">
                💡 Conseil
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Les champs personnalisés vous permettent d'ajouter des informations spécifiques 
                à votre métier (SIRET, Code NAF, etc.). Ces champs peuvent ensuite être utilisés 
                dans vos templates PDF.
              </p>
            </div>
          </>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau champ personnalisé</DialogTitle>
          </DialogHeader>
          <CustomFieldForm
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
