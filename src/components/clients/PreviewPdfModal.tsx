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
import { FileText, Loader2, Eye, Download, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Link } from "react-router-dom";
import { formatDateFR, formatDateTimeFR } from "@/lib/dateUtils";
import { renderFieldToPdf, applyTextTransform } from "@/lib/pdfRenderUtils";

interface PreviewPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientData: Record<string, any>;
  customValues: { key: string; value: string | null }[];
  templateId?: string;
}

export function PreviewPdfModal({
  open,
  onOpenChange,
  clientData,
  customValues,
  templateId,
}: PreviewPdfModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templateId || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["pdf-templates-preview"],
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
    queryKey: ["template-fields-preview", selectedTemplate],
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

  const handlePreview = async () => {
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
    setPdfBlobUrl(null);

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

      // Generate PDF blob for preview
      const generatedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(generatedPdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (error) {
      console.error("PDF preview error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer la prévisualisation.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
    }
    setPdfBlobUrl(null);
    onOpenChange(false);
  };

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const template = templates.find((t) => t.id === selectedTemplate);
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = `preview-${template?.name || "document"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Prévisualiser le document</DialogTitle>
          <DialogDescription>
            Visualisez le PDF avec les données du client sans créer de document
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
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Modèle de document</Label>
                <Select value={selectedTemplate} onValueChange={(v) => {
                  setSelectedTemplate(v);
                  setPdfBlobUrl(null);
                }}>
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
              <Button
                variant="accent"
                onClick={handlePreview}
                disabled={isGenerating || !selectedTemplate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Prévisualiser
                  </>
                )}
              </Button>
            </div>

            {pdfBlobUrl && (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-[60vh]"
                    title="Prévisualisation PDF"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger la prévisualisation
                  </Button>
                </div>
              </div>
            )}

            {!pdfBlobUrl && selectedTemplate && (
              <div className="border border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-muted-foreground">
                <Eye className="h-12 w-12 mb-4 opacity-50" />
                <p>Cliquez sur "Prévisualiser" pour afficher le document</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
