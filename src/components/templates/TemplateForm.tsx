import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { Upload, FileText, X, Loader2 } from "lucide-react";

const templateSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  category: z.string().optional(),
  description: z.string().optional(),
});

interface TemplateFormProps {
  onSuccess: (template?: any) => void;
  onCancel: () => void;
  initialData?: any;
}

export function TemplateForm({ onSuccess, onCancel, initialData }: TemplateFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: initialData?.name ?? "",
    category: initialData?.category ?? "",
    description: initialData?.description ?? "",
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Fichier invalide",
          description: "Veuillez sélectionner un fichier PDF",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "Le fichier ne doit pas dépasser 10 Mo",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      templateSchema.parse(formData);
      setIsLoading(true);

      let storagePath = initialData?.source_pdf_storage_path || null;

      // Upload PDF if selected
      if (selectedFile) {
        setIsUploading(true);
        const fileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        
        const { error: uploadError } = await supabase.storage
          .from("pdf-templates")
          .upload(fileName, selectedFile);

        if (uploadError) {
          throw new Error("Erreur lors de l'upload du PDF");
        }

        // Delete old file if replacing
        if (initialData?.source_pdf_storage_path) {
          await supabase.storage
            .from("pdf-templates")
            .remove([initialData.source_pdf_storage_path]);
        }

        storagePath = fileName;
        setIsUploading(false);
      }

      const dataToSave = {
        name: formData.name,
        category: formData.category || null,
        description: formData.description || null,
        source_pdf_storage_path: storagePath,
      };

      let savedTemplate;

      if (initialData?.id) {
        const { data, error } = await supabase
          .from("pdf_templates")
          .update(dataToSave)
          .eq("id", initialData.id)
          .select()
          .single();

        if (error) throw error;
        savedTemplate = data;

        toast({
          title: "Modèle modifié",
          description: `Le modèle "${formData.name}" a été mis à jour.`,
        });
      } else {
        const { data, error } = await supabase
          .from("pdf_templates")
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        savedTemplate = data;

        toast({
          title: "Modèle créé",
          description: `Le modèle "${formData.name}" a été ajouté.`,
        });
      }

      onSuccess(savedTemplate);
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
          description: error instanceof Error ? error.message : "Une erreur est survenue",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom du modèle *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Ex: Contrat de service"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Catégorie</Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) => handleChange("category", e.target.value)}
          placeholder="Ex: Contrats, Devis, Factures..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Description du modèle..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Fichier PDF</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {selectedFile ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} Mo
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setSelectedFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : initialData?.source_pdf_storage_path ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-foreground">PDF existant</p>
              <p className="text-sm text-muted-foreground">
                Cliquez pour remplacer
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Remplacer
            </Button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-accent hover:bg-accent/5"
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="mt-2 font-medium text-foreground">
              Cliquez pour uploader un PDF
            </p>
            <p className="text-sm text-muted-foreground">
              PDF uniquement, max 10 Mo
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" variant="accent" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isUploading ? "Upload en cours..." : "Enregistrement..."}
            </>
          ) : (
            initialData ? "Modifier" : "Créer"
          )}
        </Button>
      </div>
    </form>
  );
}
