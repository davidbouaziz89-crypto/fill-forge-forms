import { useParams } from "react-router-dom";
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
} from "lucide-react";
import { Link } from "react-router-dom";

// Mock client data
const mockClient = {
  id: "1",
  companyName: "Entreprise ABC",
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean.dupont@abc.fr",
  phone: "01 23 45 67 89",
  addressLine1: "123 Rue de la Paix",
  addressLine2: "Bâtiment A",
  zip: "75001",
  city: "Paris",
  country: "France",
  assignedTo: "Marie Martin",
  siret: "123 456 789 00012",
  codeNaf: "6201Z",
  createdAt: "2024-01-15",
  documents: [
    {
      id: "1",
      templateName: "Contrat de service",
      createdAt: "2024-03-15",
      generatedBy: "Marie Martin",
    },
    {
      id: "2",
      templateName: "Proposition commerciale",
      createdAt: "2024-02-28",
      generatedBy: "Marie Martin",
    },
  ],
};

export default function ClientDetail() {
  const { id } = useParams();

  return (
    <AppLayout userRole="admin" userName="Admin">
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
                {mockClient.companyName}
              </h1>
              <p className="text-muted-foreground">
                {mockClient.firstName} {mockClient.lastName}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary">{mockClient.assignedTo}</Badge>
                <Badge variant="outline">{mockClient.documents.length} documents</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Button>
            <Button variant="accent">
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
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <span>{mockClient.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span>{mockClient.phone}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p>{mockClient.addressLine1}</p>
                      {mockClient.addressLine2 && <p>{mockClient.addressLine2}</p>}
                      <p>
                        {mockClient.zip} {mockClient.city}
                      </p>
                      <p>{mockClient.country}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold text-foreground">Entreprise</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Raison sociale</p>
                    <p className="font-medium">{mockClient.companyName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">SIRET</p>
                    <p className="font-medium">{mockClient.siret}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Code NAF</p>
                    <p className="font-medium">{mockClient.codeNaf}</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Aucun champ personnalisé configuré
                </p>
                <Button variant="outline" className="mt-4">
                  Configurer les champs
                </Button>
              </div>
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
                {mockClient.documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      Aucun document généré
                    </p>
                  </div>
                ) : (
                  mockClient.documents.map((doc) => (
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
                            {doc.templateName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Généré le {doc.createdAt} par {doc.generatedBy}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
