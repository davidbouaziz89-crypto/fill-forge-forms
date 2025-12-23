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
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientForm } from "@/components/clients/ClientForm";
import { ImportModal } from "@/components/clients/ImportModal";

export default function Clients() {
  const { userRole, userName, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { data: clients = [], refetch } = useQuery({
    queryKey: ["clients", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select(`
          id,
          company_name,
          first_name,
          last_name,
          email,
          phone,
          city,
          assigned_user_id,
          created_at,
          assigned_user:profiles(name)
        `)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(
          `company_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`
        );
      }

      const { data } = await query.limit(100);
      return data ?? [];
    },
  });

  // Get document counts for each client
  const { data: docCounts = {} } = useQuery({
    queryKey: ["client-doc-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("generated_documents")
        .select("client_id");
      
      const counts: Record<string, number> = {};
      (data ?? []).forEach((doc) => {
        counts[doc.client_id] = (counts[doc.client_id] || 0) + 1;
      });
      return counts;
    },
  });

  return (
    <AppLayout 
      userRole={userRole ?? "sales"} 
      userName={userName || "Utilisateur"} 
      onLogout={signOut}
    >
      <PageHeader
        title="Clients"
        description="Gérez votre portefeuille clients"
        actions={
          <div className="flex gap-3">
            {userRole === "admin" && (
              <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importer Excel/CSV
              </Button>
            )}
            <Button variant="accent" onClick={() => setIsCreateDialogOpen(true)}>
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
              {clients.map((client) => (
                <TableRow key={client.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <span className="font-medium">{client.company_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.first_name} {client.last_name}
                  </TableCell>
                  <TableCell>
                    {client.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {client.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {client.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{client.city}</TableCell>
                  <TableCell>
                    {client.assigned_user?.name ? (
                      <Badge variant="secondary">{client.assigned_user.name}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Non assigné
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{docCounts[client.id] || 0}</Badge>
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

          {clients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                Aucun client trouvé
              </p>
              <Button 
                variant="accent" 
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Créer un client
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
          </DialogHeader>
          <ClientForm 
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              refetch();
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onSuccess={() => refetch()}
      />
    </AppLayout>
  );
}
