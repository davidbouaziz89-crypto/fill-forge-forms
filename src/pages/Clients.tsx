import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  Upload,
  MoreHorizontal,
  Building2,
  Mail,
  Phone,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data
const mockClients = [
  {
    id: "1",
    companyName: "Entreprise ABC",
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean.dupont@abc.fr",
    phone: "01 23 45 67 89",
    city: "Paris",
    assignedTo: "Marie Martin",
    documentsCount: 5,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    companyName: "Tech Solutions SAS",
    firstName: "Sophie",
    lastName: "Bernard",
    email: "s.bernard@techsolutions.fr",
    phone: "01 98 76 54 32",
    city: "Lyon",
    assignedTo: "Jean Dupont",
    documentsCount: 3,
    createdAt: "2024-02-20",
  },
  {
    id: "3",
    companyName: "Global Corp",
    firstName: "Pierre",
    lastName: "Martin",
    email: "p.martin@globalcorp.com",
    phone: "01 11 22 33 44",
    city: "Marseille",
    assignedTo: null,
    documentsCount: 0,
    createdAt: "2024-03-10",
  },
];

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClients = mockClients.filter(
    (client) =>
      client.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${client.firstName} ${client.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout userRole="admin" userName="Admin">
      <PageHeader
        title="Clients"
        description="Gérez votre portefeuille clients"
        actions={
          <div className="flex gap-3">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Importer Excel/CSV
            </Button>
            <Button variant="accent">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau client
            </Button>
          </div>
        }
      />

      <div className="p-8">
        {/* Search and Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email ou société..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Clients Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Société</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Commercial</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <span className="font-medium">{client.companyName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.firstName} {client.lastName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {client.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {client.phone}
                    </div>
                  </TableCell>
                  <TableCell>{client.city}</TableCell>
                  <TableCell>
                    {client.assignedTo ? (
                      <Badge variant="secondary">{client.assignedTo}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Non assigné
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{client.documentsCount}</Badge>
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
                        <DropdownMenuItem asChild>
                          <Link to={`/clients/${client.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Voir la fiche
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredClients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                Aucun client trouvé
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
