import { useParams, Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Edit,
  Download,
  Plus,
  Loader2,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientForm } from "@/components/clients/ClientForm";
import { GeneratePdfModal } from "@/components/clients/GeneratePdfModal";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole, userName, signOut } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{
    id: string;
    storagePath: string;
    templateName: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: client, isLoading, refetch } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          assigned_user:profiles(name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: documents = [], refetch: refetchDocuments } = useQuery({
    queryKey: ["client-documents", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("generated_documents")
        .select(`
          id,
          created_at,
          generated_pdf_storage_path,
          template:pdf_templates(name),
          generated_by:profiles(name)
        `)
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: customFieldsWithValues = [] } = useQuery({
    queryKey: ["client-custom-fields", id],
    queryFn: async () => {
      const { data: fields } = await supabase
        .from("custom_fields")
        .select("*")
        .order("sort_order");

      const { data: values } = await supabase
        .from("client_custom_values")
        .select("*")
        .eq("client_id", id);

      return (fields ?? []).map((field) => ({
        ...field,
        value: values?.find((v) => v.custom_field_id === field.id)?.value_text ?? null,
      }));
    },
    enabled: !!id,
  });

  const handleDownload = async (storagePath: string, templateName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("generated-documents")
        .download(storagePath);

      if (error || !data) {
        throw new Error("Impossible de télécharger le fichier");
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateName || "document"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le document.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;
    
    setIsDeleting(true);
    let storageDeleteError = false;

    try {
      // 1) Delete from storage first
      const { error: storageError } = await supabase.storage
        .from("generated-documents")
        .remove([documentToDelete.storagePath]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        storageDeleteError = true;
        // Continue to delete DB record even if storage fails
      }

      // 2) Delete from database
      const { error: dbError } = await supabase
        .from("generated_documents")
        .delete()
        .eq("id", documentToDelete.id);

      if (dbError) {
        throw dbError;
      }

      // 3) Refresh list
      await refetchDocuments();

      // 4) Show appropriate toast
      if (storageDeleteError) {
        toast({
          title: "Document supprimé",
          description: "Le document a été supprimé mais le fichier n'a pas pu être effacé du stockage.",
          variant: "default",
        });
      } else {
        toast({
          title: "Document supprimé",
          description: "Le document a été supprimé avec succès.",
        });
      }
    } catch (error: any) {
      console.error("Delete document error:", error);
      toast({
        title: "Erreur",
        description: error.message?.includes("row-level security") 
          ? "Accès refusé. Vous n'avez pas les droits pour supprimer ce document."
          : "Impossible de supprimer le document.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDocumentToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <AppLayout userRole={userRole ?? "sales"} userName={userName} onLogout={signOut}>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout userRole={userRole ?? "sales"} userName={userName} onLogout={signOut}>
        <div className="flex h-full flex-col items-center justify-center">
          <p className="text-muted-foreground">Client non trouvé</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/clients")}>
            Retour aux clients
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      userRole={userRole ?? "sales"} 
      userName={userName || "Utilisateur"} 
      onLogout={signOut}
    >
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="mb-4">
          <Link
            to="/clients"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux clients
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {client.company_name}
              </h1>
              <p className="text-muted-foreground">
                {client.first_name} {client.last_name}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {client.assigned_user?.name && (
                  <Badge variant="secondary">{client.assigned_user.name}</Badge>
                )}
                <Badge variant="outline">{documents.length} documents</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Button>
            <Button variant="accent" onClick={() => setIsGenerateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Générer un document
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        <Tabs defaultValue="info" className="space-y-6">
          <TabsList>
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="custom">Champs personnalisés</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Contact Info */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold text-foreground">Contact</h3>
                <div className="space-y-4">
                  {client.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <span>{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {(client.address_line1 || client.city) && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        {client.address_line1 && <p>{client.address_line1}</p>}
                        {client.address_line2 && <p>{client.address_line2}</p>}
                        {(client.zip || client.city) && (
                          <p>
                            {client.zip} {client.city}
                          </p>
                        )}
                        {client.country && <p>{client.country}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Info */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold text-foreground">Entreprise</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Raison sociale</p>
                    <p className="font-medium">{client.company_name}</p>
                  </div>
                  {client.type_client && (
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{client.type_client}</p>
                    </div>
                  )}
                  {client.category && (
                    <div>
                      <p className="text-sm text-muted-foreground">Catégorie</p>
                      <p className="font-medium">{client.category}</p>
                    </div>
                  )}
                  {client.siret && (
                    <div>
                      <p className="text-sm text-muted-foreground">SIRET</p>
                      <p className="font-medium">{client.siret}</p>
                    </div>
                  )}
                  {client.code_naf && (
                    <div>
                      <p className="text-sm text-muted-foreground">Code NAF</p>
                      <p className="font-medium">{client.code_naf}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Créé le</p>
                    <p className="font-medium">
                      {new Date(client.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <div className="rounded-xl border border-border bg-card p-6">
              {customFieldsWithValues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Aucun champ personnalisé configuré
                  </p>
                  {userRole === "admin" && (
                    <Button variant="outline" className="mt-4" asChild>
                      <Link to="/custom-fields">Configurer les champs</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {customFieldsWithValues.map((field) => (
                    <div key={field.id}>
                      <p className="text-sm text-muted-foreground">{field.label}</p>
                      <p className="font-medium">
                        {field.value || <span className="text-muted-foreground">-</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-6 py-4">
                <h3 className="font-semibold text-foreground">
                  Historique des documents
                </h3>
              </div>
              <div className="divide-y divide-border">
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      Aucun document généré
                    </p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between px-6 py-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {doc.template?.name || "Template supprimé"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Généré le {new Date(doc.created_at).toLocaleDateString("fr-FR")} par{" "}
                            {doc.generated_by?.name || "Utilisateur"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(
                            doc.generated_pdf_storage_path,
                            doc.template?.name || "document"
                          )}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDocumentToDelete({
                            id: doc.id,
                            storagePath: doc.generated_pdf_storage_path,
                            templateName: doc.template?.name || "document",
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le client</DialogTitle>
          </DialogHeader>
          <ClientForm
            initialData={client}
            onSuccess={() => {
              setIsEditDialogOpen(false);
              refetch();
            }}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <GeneratePdfModal
        open={isGenerateModalOpen}
        onOpenChange={setIsGenerateModalOpen}
        clientId={id!}
        clientData={client}
        customValues={customFieldsWithValues.map((f) => ({ key: f.key, value: f.value }))}
        onSuccess={() => refetchDocuments()}
      />

      <AlertDialog open={!!documentToDelete} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer "{documentToDelete?.templateName}". Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteDocument}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
