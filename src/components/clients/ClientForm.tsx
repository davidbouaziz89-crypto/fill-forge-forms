import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
  siret: z.string().optional(),
  code_naf: z.string().optional(),
  type_client: z.string().optional(),
});

interface ClientFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Partial<z.infer<typeof clientSchema> & { id: string }>;
}

export function ClientForm({ onSuccess, onCancel, initialData }: ClientFormProps) {
  const { userRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  
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
    siret: initialData?.siret ?? "",
    code_naf: initialData?.code_naf ?? "",
    type_client: initialData?.type_client ?? "entreprise",
  });

  // Fetch assignable users using secure function (returns only id and name, not email)
  const { data: salesUsers = [] } = useQuery({
    queryKey: ["assignable-users"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_assignable_users");
      return data ?? [];
    },
  });

  // Fetch custom fields
  const { data: customFields = [] } = useQuery({
    queryKey: ["custom-fields-form"],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_fields")
        .select("*")
        .order("sort_order");
      return data ?? [];
    },
  });

  // Fetch existing custom values if editing
  useEffect(() => {
    if (initialData?.id && customFields.length > 0) {
      supabase
        .from("client_custom_values")
        .select("custom_field_id, value_text")
        .eq("client_id", initialData.id)
        .then(({ data }) => {
          const values: Record<string, string> = {};
          (data ?? []).forEach((v) => {
            const field = customFields.find((f) => f.id === v.custom_field_id);
            if (field) {
              values[field.key] = v.value_text ?? "";
            }
          });
          setCustomValues(values);
        });
    }
  }, [initialData?.id, customFields]);

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

  const handleCustomChange = (key: string, value: string) => {
    setCustomValues((prev) => ({ ...prev, [key]: value }));
  };

  const canEditField = (visibility: string | null): boolean => {
    if (userRole === "admin") return true;
    return visibility === "editable";
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

      let clientId = initialData?.id;

      if (initialData?.id) {
        const { error } = await supabase
          .from("clients")
          .update(dataToSave as any)
          .eq("id", initialData.id);

        if (error) throw error;
      } else {
        const { data: newClient, error } = await supabase
          .from("clients")
          .insert(dataToSave as any)
          .select("id")
          .single();

        if (error) throw error;
        clientId = newClient.id;
      }

      // Save custom values
      if (clientId) {
        for (const field of customFields) {
          const value = customValues[field.key];
          if (value !== undefined) {
            // Delete existing then insert
            await supabase
              .from("client_custom_values")
              .delete()
              .eq("client_id", clientId)
              .eq("custom_field_id", field.id);
            
            if (value) {
              await supabase
                .from("client_custom_values")
                .insert({
                  client_id: clientId,
                  custom_field_id: field.id,
                  value_text: value,
                });
            }
          }
        }
      }

      toast({
        title: initialData?.id ? "Client modifié" : "Client créé",
        description: initialData?.id 
          ? "Les informations ont été mises à jour."
          : "Le nouveau client a été ajouté avec succès.",
      });

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

  const renderCustomField = (field: typeof customFields[0]) => {
    const value = customValues[field.key] ?? field.default_value ?? "";
    const disabled = !canEditField(field.visibility);
    const options = Array.isArray(field.options_json) ? field.options_json : [];

    switch (field.type) {
      case "select":
        return (
          <Select
            value={value}
            onValueChange={(v) => handleCustomChange(field.key, v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Sélectionner ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt: string) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={value === "true"}
              onCheckedChange={(checked) => handleCustomChange(field.key, checked ? "true" : "false")}
              disabled={disabled}
            />
            <span className="text-sm">{value === "true" ? "Oui" : "Non"}</span>
          </div>
        );
      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleCustomChange(field.key, e.target.value)}
            disabled={disabled}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleCustomChange(field.key, e.target.value)}
            disabled={disabled}
          />
        );
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleCustomChange(field.key, e.target.value)}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="standard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="standard">Informations</TabsTrigger>
          {customFields.length > 0 && (
            <TabsTrigger value="custom">Champs personnalisés</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="standard" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Type client */}
            <div className="space-y-2">
              <Label htmlFor="type_client">Type de client</Label>
              <Select
                value={formData.type_client}
                onValueChange={(value) => handleChange("type_client", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type de client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entreprise">Entreprise</SelectItem>
                  <SelectItem value="particulier">Particulier</SelectItem>
                </SelectContent>
              </Select>
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

            {/* SIRET / Code NAF - only for entreprise */}
            {formData.type_client === "entreprise" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input
                    id="siret"
                    value={formData.siret}
                    onChange={(e) => handleChange("siret", e.target.value)}
                    placeholder="123 456 789 00012"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code_naf">Code NAF</Label>
                  <Input
                    id="code_naf"
                    value={formData.code_naf}
                    onChange={(e) => handleChange("code_naf", e.target.value)}
                    placeholder="6201Z"
                  />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="assigned_user_id">Commercial assigné</Label>
              <Select
                value={formData.assigned_user_id || "none"}
                onValueChange={(value) => handleChange("assigned_user_id", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un commercial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {salesUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        {customFields.length > 0 && (
          <TabsContent value="custom" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {customFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label>
                    {field.label}
                    {field.required_bool && <span className="text-destructive ml-1">*</span>}
                    {field.visibility === "admin_only" && (
                      <span className="ml-2 text-xs text-muted-foreground">(Admin)</span>
                    )}
                    {field.visibility === "read_only" && (
                      <span className="ml-2 text-xs text-muted-foreground">(Lecture seule)</span>
                    )}
                  </Label>
                  {renderCustomField(field)}
                </div>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

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
