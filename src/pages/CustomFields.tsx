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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data
const mockCustomFields = [
  {
    id: "1",
    key: "siret",
    label: "SIRET",
    type: "text",
    required: true,
    visibility: "editable",
    createdAt: "2024-01-10",
  },
  {
    id: "2",
    key: "code_naf",
    label: "Code NAF",
    type: "text",
    required: false,
    visibility: "editable",
    createdAt: "2024-01-10",
  },
  {
    id: "3",
    key: "capital",
    label: "Capital social",
    type: "number",
    required: false,
    visibility: "admin_only",
    createdAt: "2024-02-15",
  },
  {
    id: "4",
    key: "date_creation",
    label: "Date de création",
    type: "date",
    required: false,
    visibility: "read_only",
    createdAt: "2024-02-20",
  },
  {
    id: "5",
    key: "secteur",
    label: "Secteur d'activité",
    type: "select",
    options: ["Industrie", "Services", "Commerce", "BTP"],
    required: true,
    visibility: "editable",
    createdAt: "2024-03-01",
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

export default function CustomFields() {
  return (
    <AppLayout userRole="admin" userName="Admin">
      <PageHeader
        title="Champs personnalisés"
        description="Configurez les champs additionnels pour vos fiches clients"
        actions={
          <Button variant="accent">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau champ
          </Button>
        }
      />

      <div className="p-8">
        {/* Fields Table */}
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
              {mockCustomFields.map((field) => (
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
                    {field.required ? (
                      <Badge variant="destructive" className="bg-warning text-warning-foreground">
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
                    {field.createdAt}
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
                        <DropdownMenuItem className="text-destructive">
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

          {mockCustomFields.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FormInput className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                Aucun champ personnalisé configuré
              </p>
              <Button variant="accent" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Créer un champ
              </Button>
            </div>
          )}
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
      </div>
    </AppLayout>
  );
}
