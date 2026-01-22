import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Download, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Link } from "react-router-dom";
import { formatDateFR, formatDateTimeFR } from "@/lib/dateUtils";
import { renderFieldToPdf, applyTextTransform } from "@/lib/pdfRenderUtils";

interface GeneratePdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSuccess: () => void;
}

export function GeneratePdfModal({
  open,
  onOpenChange,
  clientId,
  onSuccess,
}: GeneratePdfModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["pdf-templates-generate"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdf_templates")
        .select("id, name, category, source_pdf_storage_path")
        .order("name");
      return data ?? [];
    },
  });

  // Fetch template fields when a template is selected
  const { data: templateFields = [] } = useQuery({
    queryKey: ["template-fields", selectedTemplate],
    queryFn: async () => {
      if (!selectedTemplate) return [];
      const { data } = await supabase
        .from("pdf_template_fields")
        .select("*")
        .eq("template_id", selectedTemplate);
      return data ?? [];
    },
    enabled: !!selectedTemplate,
  });

  // Helper to get field value from fresh data
  const getFieldValue = (
    fieldKey: string, 
    fieldSource: string,
    clientData: Record<string, any>,
    customValues: { key: string; value: string | null }[]
  ): string => {
    if (fieldSource === "system") {
      switch (fieldKey) {
        case "today_date":
          return formatDateFR(new Date());
        case "date_edition":
          return formatDateTimeFR(new Date());
        default:
          return "";
      }
    }

    if (fieldSource === "custom") {
      const customVal = customValues.find((cv) => cv.key === fieldKey);
      console.log(`[PDF Gen] Custom field "${fieldKey}": found =`, customVal?.value ?? "(empty)");
      return customVal?.value ?? "";
    }
    return clientData[fieldKey]?.toString() ?? "";
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un modèle.", variant: "destructive" });
      return;
    }

    const template = templates.find((t) => t.id === selectedTemplate);
    if (!template?.source_pdf_storage_path) {
      toast({ title: "Erreur", description: "Ce modèle n'a pas de PDF source.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);

    try {
      // CRITICAL: Fetch fresh client data directly from database to avoid stale state
      console.log("[PDF Gen] Fetching fresh client data from database...");
      const { data: freshClient, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (clientError || !freshClient) {
        throw new Error("Impossible de charger les données client");
      }
      console.log("[PDF Gen] Fresh client data loaded:", freshClient);

      // CRITICAL: Fetch fresh custom field values directly from database
      console.log("[PDF Gen] Fetching fresh custom field values from database...");
      const { data: customFields } = await supabase
        .from("custom_fields")
        .select("id, key");

      const { data: freshCustomValues } = await supabase
        .from("client_custom_values")
        .select("custom_field_id, value_text")
        .eq("client_id", clientId);

      // Map custom values with their keys
      const customValuesMap: { key: string; value: string | null }[] = (customFields ?? []).map((field) => {
        const valueRecord = freshCustomValues?.find((v) => v.custom_field_id === field.id);
        return { key: field.key, value: valueRecord?.value_text ?? null };
      });

      console.log("[PDF Gen] Fresh custom values loaded:", customValuesMap);

      // Download source PDF
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from("pdf-templates")
        .download(template.source_pdf_storage_path);

      if (downloadError || !pdfData) {
        throw new Error("Impossible de télécharger le PDF source");
      }

      // Load PDF with pdf-lib
      const pdfBytes = await pdfData.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      // Apply fields using unified rendering utility with FRESH DATA
      for (const field of templateFields) {
        const pageIndex = (field.page || 1) - 1;
        if (pageIndex >= pages.length) continue;

        const page = pages[pageIndex];

        // Use fresh data from database, not stale props
        let value = getFieldValue(field.field_key, field.field_source, freshClient, customValuesMap);
        if (field.fallback_value && !value) {
          value = field.fallback_value;
        }
        value = applyTextTransform(value, field.transform || "none");

        if (!value) continue;

        // Use unified rendering function
        renderFieldToPdf({
          value,
          fontSize: field.font_size || 10,
          font,
          page,
          coords: {
            x: Number(field.x) || 0,
            y: Number(field.y) || 0,
            width: Number(field.width) || 0.1,
            height: Number(field.height) || 0.03,
          },
          align: field.align || "left",
        });
      }

      // Save generated PDF
      const generatedPdfBytes = await pdfDoc.save();
      const fileName = `${clientId}/${Date.now()}-${template.name.replace(/\s+/g, "_")}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("generated-documents")
        .upload(fileName, generatedPdfBytes, {
          contentType: "application/pdf",
        });

      if (uploadError) throw uploadError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Save document record
      const { error: insertError } = await supabase
        .from("generated_documents")
        .insert({
          client_id: clientId,
          template_id: selectedTemplate,
          generated_pdf_storage_path: fileName,
          generated_by_user_id: user?.id,
          meta_json: { template_name: template.name },
        });

      if (insertError) throw insertError;

      toast({
        title: "Document généré",
        description: "Le PDF a été créé et ajouté à l'historique.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le document.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Générer un document</DialogTitle>
          <DialogDescription>
            Sélectionnez un modèle pour générer un PDF pré-rempli
          </DialogDescription>
        </DialogHeader>

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Aucun modèle PDF configuré
            </p>
            <Button variant="outline" asChild>
              <Link to="/settings/templates">
                Configurer les modèles
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Modèle de document</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un modèle" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {template.name}
                        {template.category && (
                          <span className="text-xs text-muted-foreground">
                            ({template.category})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && templateFields.length > 0 && (
              <div className="rounded-lg border border-border p-4 bg-muted/50">
                <p className="text-sm font-medium mb-2">Champs qui seront remplis :</p>
                <div className="flex flex-wrap gap-2">
                  {templateFields.map((field) => (
                    <span
                      key={field.id}
                      className="text-xs bg-background px-2 py-1 rounded border"
                    >
                      {field.field_key}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                variant="accent"
                onClick={handleGenerate}
                disabled={isGenerating || !selectedTemplate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Générer
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
