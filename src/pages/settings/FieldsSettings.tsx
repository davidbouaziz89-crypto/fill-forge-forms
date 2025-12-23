import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  GripVertical,
  Loader2,
  Lock,
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

// Standard fields that are always available
const standardFields = [
  { key: "type_client", label: "Type de client", type: "select", description: "Particulier ou Entreprise" },
  { key: "company_name", label: "Société", type: "text", description: "Raison sociale" },
  { key: "first_name", label: "Prénom", type: "text", description: "Prénom du contact" },
  { key: "last_name", label: "Nom", type: "text", description: "Nom du contact" },
  { key: "email", label: "Email", type: "text", description: "Adresse email" },
  { key: "phone", label: "Téléphone", type: "text", description: "Numéro de téléphone" },
  { key: "address_line1", label: "Adresse ligne 1", type: "text", description: "Numéro et voie" },
  { key: "address_line2", label: "Adresse ligne 2", type: "text", description: "Complément d'adresse" },
  { key: "zip", label: "Code postal", type: "text", description: "Code postal" },
  { key: "city", label: "Ville", type: "text", description: "Ville" },
  { key: "country", label: "Pays", type: "text", description: "Pays" },
  { key: "siret", label: "SIRET", type: "text", description: "Numéro SIRET (entreprise)" },
  { key: "code_naf", label: "Code NAF", type: "text", description: "Code NAF (entreprise)" },
];

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

export default function FieldsSettings() {
  const { userRole, userName, signOut } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
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
      <div className="border-b border-border bg-card px-8 py-4">
        <Breadcrumbs
          items={[
            { label: "Paramétrage", href: "/settings/fields" },
            { label: "Champs clients" },
          ]}
        />
      </div>
      
      <PageHeader
        title="Champs clients"
        description="Configurez les champs disponibles sur les fiches clients et dans les templates PDF"
      />

      <div className="p-8">
        <Tabs defaultValue="standard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="standard">Champs standards</TabsTrigger>
            <TabsTrigger value="custom">Champs personnalisés</TabsTrigger>
          </TabsList>

          <TabsContent value="standard">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-6 py-4">
                <h3 className="font-semibold text-foreground">Champs standards</h3>
                <p className="text-sm text-muted-foreground">
                  Ces champs sont disponibles par défaut pour tous les clients
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Clé</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standardFields.map((field) => (
                    <TableRow key={field.key}>
                      <TableCell className="font-medium">{field.label}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {field.key}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[field.type] || field.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {field.description}
                      </TableCell>
                      <TableCell>
                        <Lock className="h-4 w-4 text-muted-foreground/50" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <div className="mb-4 flex justify-end">
              <Button variant="accent" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau champ
              </Button>
            </div>

            {customFields.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
                <Plus className="h-16 w-16 text-muted-foreground/50" />
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
                              <DropdownMenuItem onClick={() => setEditingField(field)}>
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
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-6 rounded-lg border border-info/20 bg-info/5 p-4">
          <h4 className="font-medium text-foreground">💡 Conseil</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Les champs définis ici sont disponibles dans l'éditeur de templates PDF 
            pour placer les données clients sur vos documents.
          </p>
        </div>
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

      <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le champ</DialogTitle>
          </DialogHeader>
          {editingField && (
            <CustomFieldForm
              initialData={editingField}
              onSuccess={() => {
                setEditingField(null);
                queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
              }}
              onCancel={() => setEditingField(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
