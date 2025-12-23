import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const fieldSchema = z.object({
  key: z.string().min(1, "La clé est requise").regex(/^[a-z_]+$/, "Utilisez uniquement des lettres minuscules et underscores"),
  label: z.string().min(1, "Le label est requis"),
  type: z.enum(["text", "number", "date", "select", "boolean"]),
  required_bool: z.boolean(),
  visibility: z.enum(["admin_only", "editable", "read_only"]),
  default_value: z.string().optional(),
});

interface CustomFieldFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CustomFieldForm({ onSuccess, onCancel }: CustomFieldFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    key: "",
    label: "",
    type: "text" as "text" | "number" | "date" | "select" | "boolean",
    required_bool: false,
    visibility: "editable" as "admin_only" | "editable" | "read_only",
    default_value: "",
  });

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Auto-generate key from label
  const handleLabelChange = (value: string) => {
    handleChange("label", value);
    const key = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    handleChange("key", key);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      fieldSchema.parse(formData);
      setIsLoading(true);

      const { error } = await supabase.from("custom_fields").insert({
        key: formData.key,
        label: formData.label,
        type: formData.type,
        required_bool: formData.required_bool,
        visibility: formData.visibility,
        default_value: formData.default_value || null,
      });

      if (error) {
        if (error.code === "23505") {
          setErrors({ key: "Cette clé existe déjà" });
          return;
        }
        throw error;
      }

      toast({
        title: "Champ créé",
        description: `Le champ "${formData.label}" a été ajouté.`,
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
          description: "Une erreur est survenue",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          value={formData.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Ex: SIRET, Code NAF..."
        />
        {errors.label && (
          <p className="text-sm text-destructive">{errors.label}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="key">Clé technique</Label>
        <Input
          id="key"
          value={formData.key}
          onChange={(e) => handleChange("key", e.target.value)}
          placeholder="ex: siret, code_naf..."
        />
        {errors.key && (
          <p className="text-sm text-destructive">{errors.key}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Utilisée dans les templates PDF
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type de champ</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => handleChange("type", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Texte</SelectItem>
            <SelectItem value="number">Nombre</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="select">Liste déroulante</SelectItem>
            <SelectItem value="boolean">Oui/Non</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibilité</Label>
        <Select
          value={formData.visibility}
          onValueChange={(value) => handleChange("visibility", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="editable">Modifiable par tous</SelectItem>
            <SelectItem value="read_only">Lecture seule</SelectItem>
            <SelectItem value="admin_only">Admin uniquement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_value">Valeur par défaut</Label>
        <Input
          id="default_value"
          value={formData.default_value}
          onChange={(e) => handleChange("default_value", e.target.value)}
          placeholder="Optionnel"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="font-medium">Champ requis</p>
          <p className="text-sm text-muted-foreground">
            Le champ doit être rempli pour chaque client
          </p>
        </div>
        <Switch
          checked={formData.required_bool}
          onCheckedChange={(checked) => handleChange("required_bool", checked)}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" variant="accent" disabled={isLoading}>
          {isLoading ? "Création..." : "Créer"}
        </Button>
      </div>
    </form>
  );
}
