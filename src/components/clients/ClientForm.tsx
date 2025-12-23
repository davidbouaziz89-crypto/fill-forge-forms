import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const clientSchema = z.object({
  company_name: z.string().min(1, "La raison sociale est requise"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  category: z.string().optional(),
  assigned_user_id: z.string().uuid().optional().or(z.literal("")),
});

interface ClientFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Partial<z.infer<typeof clientSchema> & { id: string }>;
}

export function ClientForm({ onSuccess, onCancel, initialData }: ClientFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    company_name: initialData?.company_name ?? "",
    first_name: initialData?.first_name ?? "",
    last_name: initialData?.last_name ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    address_line1: initialData?.address_line1 ?? "",
    address_line2: initialData?.address_line2 ?? "",
    zip: initialData?.zip ?? "",
    city: initialData?.city ?? "",
    country: initialData?.country ?? "France",
    category: initialData?.category ?? "",
    assigned_user_id: initialData?.assigned_user_id ?? "",
  });

  // Fetch sales users for assignment
  const { data: salesUsers = [] } = useQuery({
    queryKey: ["sales-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("is_active", true);
      return data ?? [];
    },
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      const validated = clientSchema.parse(formData);
      setIsLoading(true);

      const dataToSave = {
        ...validated,
        email: validated.email || null,
        assigned_user_id: validated.assigned_user_id || null,
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("clients")
          .update(dataToSave as any)
          .eq("id", initialData.id);

        if (error) throw error;

        toast({
          title: "Client modifié",
          description: "Les informations ont été mises à jour.",
        });
      } else {
        const { error } = await supabase.from("clients").insert(dataToSave as any);

        if (error) throw error;

        toast({
          title: "Client créé",
          description: "Le nouveau client a été ajouté avec succès.",
        });
      }

      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast({
          title: "Erreur",
          description: "Une erreur est survenue lors de l'enregistrement.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="company_name">Raison sociale *</Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => handleChange("company_name", e.target.value)}
            placeholder="Nom de l'entreprise"
          />
          {errors.company_name && (
            <p className="text-sm text-destructive">{errors.company_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="first_name">Prénom</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => handleChange("first_name", e.target.value)}
            placeholder="Prénom du contact"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_name">Nom</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => handleChange("last_name", e.target.value)}
            placeholder="Nom du contact"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="email@exemple.fr"
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="01 23 45 67 89"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address_line1">Adresse</Label>
          <Input
            id="address_line1"
            value={formData.address_line1}
            onChange={(e) => handleChange("address_line1", e.target.value)}
            placeholder="123 Rue de la Paix"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address_line2">Complément d'adresse</Label>
          <Input
            id="address_line2"
            value={formData.address_line2}
            onChange={(e) => handleChange("address_line2", e.target.value)}
            placeholder="Bâtiment, étage..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="zip">Code postal</Label>
          <Input
            id="zip"
            value={formData.zip}
            onChange={(e) => handleChange("zip", e.target.value)}
            placeholder="75001"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => handleChange("city", e.target.value)}
            placeholder="Paris"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Pays</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => handleChange("country", e.target.value)}
            placeholder="France"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Catégorie</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => handleChange("category", e.target.value)}
            placeholder="Ex: PME, Grande entreprise..."
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="assigned_user_id">Commercial assigné</Label>
          <Select
            value={formData.assigned_user_id}
            onValueChange={(value) => handleChange("assigned_user_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un commercial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Non assigné</SelectItem>
              {salesUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" variant="accent" disabled={isLoading}>
          {isLoading ? "Enregistrement..." : initialData?.id ? "Modifier" : "Créer"}
        </Button>
      </div>
    </form>
  );
}
