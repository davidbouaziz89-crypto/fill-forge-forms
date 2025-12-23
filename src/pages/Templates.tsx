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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";

// Mock data
const mockTemplates = [
  {
    id: "1",
    name: "Contrat de service",
    category: "Contrats",
    description: "Contrat de prestation de service standard",
    fieldsCount: 12,
    usageCount: 45,
    updatedAt: "2024-03-15",
  },
  {
    id: "2",
    name: "Proposition commerciale",
    category: "Commercial",
    description: "Template pour les propositions commerciales",
    fieldsCount: 8,
    usageCount: 23,
    updatedAt: "2024-03-10",
  },
  {
    id: "3",
    name: "Facture proforma",
    category: "Facturation",
    description: "Modèle de facture proforma",
    fieldsCount: 15,
    usageCount: 67,
    updatedAt: "2024-03-08",
  },
];

export default function Templates() {
  return (
    <AppLayout userRole="admin" userName="Admin">
      <PageHeader
        title="Templates PDF"
        description="Gérez vos modèles de documents"
        actions={
          <Button variant="accent" asChild>
            <Link to="/templates/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau template
            </Link>
          </Button>
        }
      />

      <div className="p-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockTemplates.map((template) => (
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
                    <DropdownMenuItem asChild>
                      <Link to={`/templates/${template.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        Voir
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/templates/${template.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Modifier
                      </Link>
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
                  {template.description}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="secondary">{template.category}</Badge>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{template.fieldsCount} champs</span>
                  <span>{template.usageCount} utilisations</span>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Mis à jour le {template.updatedAt}
              </p>
            </div>
          ))}
        </div>

        {mockTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Aucun template
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Créez votre premier template PDF pour commencer
            </p>
            <Button variant="accent" className="mt-6" asChild>
              <Link to="/templates/new">
                <Plus className="mr-2 h-4 w-4" />
                Créer un template
              </Link>
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
