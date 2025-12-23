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
import { Input } from "@/components/ui/input";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  GripVertical,
  Loader2,
  Lock,
  Search,
  Calendar,
  Settings,
  User,
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
  { key: "first_name", label: "Prénom", type: "text", description: "Prénom du contact" },
  { key: "last_name", label: "Nom", type: "text", description: "Nom du contact" },
  { key: "company_name", label: "Société", type: "text", description: "Raison sociale" },
  { key: "address_line1", label: "Adresse", type: "text", description: "Numéro et voie" },
  { key: "address_line2", label: "Complément adresse", type: "text", description: "Bâtiment, étage..." },
  { key: "zip", label: "Code postal", type: "text", description: "Code postal" },
  { key: "city", label: "Ville", type: "text", description: "Ville" },
  { key: "country", label: "Pays", type: "text", description: "Pays" },
  { key: "phone", label: "Téléphone", type: "text", description: "Numéro de téléphone" },
  { key: "email", label: "Email", type: "text", description: "Adresse email" },
  { key: "siret", label: "SIRET", type: "text", description: "Numéro SIRET (entreprise)" },
  { key: "code_naf", label: "Code NAF", type: "text", description: "Code NAF (entreprise)" },
];

// System fields - computed at generation time
const systemFields = [
  { 
    key: "today_date", 
    label: "Date du jour", 
    type: "date", 
    description: "Date au moment de la génération du PDF",
    format: "DD/MM/YYYY"
  },
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
  const [searchQuery, setSearchQuery] = useState("");
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

  // Filter fields by search
  const filterBySearch = <T extends { key: string; label: string }>(fields: T[]): T[] => {
    if (!searchQuery.trim()) return fields;
    const query = searchQuery.toLowerCase();
    return fields.filter(
      (f) => f.label.toLowerCase().includes(query) || f.key.toLowerCase().includes(query)
    );
  };

  const filteredStandardFields = filterBySearch(standardFields);
  const filteredCustomFields = filterBySearch(customFields);
  const filteredSystemFields = filterBySearch(systemFields);

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
            { label: "Champs" },
          ]}
        />
      </div>
      
      <PageHeader
        title="Gestion des champs"
        description="Configurez les champs disponibles sur les fiches clients et dans les templates PDF"
      />

      <div className="p-8 space-y-8">
        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par label ou clé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Info banner */}
        <div className="rounded-lg border border-info/20 bg-info/5 p-4">
          <h4 className="font-medium text-foreground">💡 Comment ça fonctionne</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Les <strong>champs personnalisés</strong> apparaissent automatiquement dans la fiche client 
            et dans la palette de l'éditeur PDF. Les <strong>champs système</strong> (comme la date du jour) 
            ne sont disponibles que dans les templates PDF.
          </p>
        </div>

        {/* SECTION 1 - Standard Fields */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Champs standards</h2>
              <p className="text-sm text-muted-foreground">
                Champs de base disponibles pour tous les clients (non supprimables)
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {standardFields.length} champs
            </Badge>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Clé technique</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStandardFields.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun résultat pour "{searchQuery}"
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStandardFields.map((field) => (
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Fixe</Badge>
                          <Lock className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* SECTION 2 - Custom Fields */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
              <Settings className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Champs personnalisés</h2>
              <p className="text-sm text-muted-foreground">
                Champs dynamiques créés par l'administrateur
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {customFields.length} champs
            </Badge>
          </div>

          <div className="mb-4 flex justify-end">
            <Button variant="accent" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un champ
            </Button>
          </div>

          {customFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
              <Plus className="h-16 w-16 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">
                Aucun champ personnalisé
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Créez des champs personnalisés pour enrichir vos fiches clients. 
                Ils apparaîtront automatiquement dans le formulaire client et dans l'éditeur PDF.
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
                  {filteredCustomFields.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Aucun résultat pour "{searchQuery}"
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomFields.map((field) => (
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
                          <Badge variant={visibilityLabels[field.visibility]?.variant || "outline"}>
                            {visibilityLabels[field.visibility]?.label || field.visibility}
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* SECTION 3 - System Fields */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-info/10">
              <Calendar className="h-4 w-4 text-info" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Champs système</h2>
              <p className="text-sm text-muted-foreground">
                Champs calculés automatiquement (disponibles uniquement dans les templates PDF)
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {systemFields.length} champ
            </Badge>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Clé technique</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSystemFields.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucun résultat pour "{searchQuery}"
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSystemFields.map((field) => (
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
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {field.format}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-info/20 text-info border-info/30">
                          Système
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-3 text-sm text-muted-foreground italic">
            💡 Les champs système ne sont pas saisissables dans la fiche client. 
            Leur valeur est calculée automatiquement lors de la génération du PDF.
          </p>
        </section>
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
