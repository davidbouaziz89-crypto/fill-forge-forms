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
  clientData: Record<string, any>;
  customValues: { key: string; value: string | null }[];
  onSuccess: () => void;
}

export function GeneratePdfModal({
  open,
  onOpenChange,
  clientId,
  clientData,
  customValues,
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

  const getFieldValue = (fieldKey: string, fieldSource: string): string => {
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

      // Apply fields using unified rendering utility
      for (const field of templateFields) {
        const pageIndex = (field.page || 1) - 1;
        if (pageIndex >= pages.length) continue;

        const page = pages[pageIndex];

        let value = getFieldValue(field.field_key, field.field_source);
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
