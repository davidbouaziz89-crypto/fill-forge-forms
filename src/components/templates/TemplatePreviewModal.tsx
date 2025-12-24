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
import { Loader2, Eye, Download, User, UserPlus, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatDateFR, formatDateTimeFR } from "@/lib/dateUtils";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// Mock client data for preview
const MOCK_CLIENT = {
  id: "mock-client",
  company_name: "Entreprise Exemple SARL",
  first_name: "Jean",
  last_name: "Dupont",
  email: "contact@exemple.fr",
  phone: "01 23 45 67 89",
  address_line1: "123 Rue de la Démo",
  address_line2: "Bâtiment A",
  zip: "75001",
  city: "Paris",
  country: "France",
  siret: "123 456 789 00012",
  code_naf: "7022Z",
  type_client: "entreprise",
};

// Mock custom field values
const MOCK_CUSTOM_VALUES: Record<string, string> = {
  signataire: "Jean Dupont",
  fonction: "Directeur Général",
  nombre_luminaires: "150",
  numero_devis: "DEV-2024-001",
};

interface TemplateField {
  id?: string;
  template_id: string;
  field_source: "standard" | "custom" | "system";
  field_key: string;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  font_size: number;
  align: "left" | "center" | "right";
  transform: "none" | "uppercase" | "lowercase" | "capitalize";
  fallback_value?: string;
}

interface TemplatePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  sourcePdfPath: string;
  fields: TemplateField[]; // Current fields (possibly unsaved)
}

export function TemplatePreviewModal({
  open,
  onOpenChange,
  templateId,
  sourcePdfPath,
  fields,
}: TemplatePreviewModalProps) {
  const [clientSource, setClientSource] = useState<"mock" | "existing">("mock");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pdfViewError, setPdfViewError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch existing clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-preview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, first_name, last_name")
        .order("company_name")
        .limit(50);
      return data ?? [];
    },
    enabled: open,
  });

  // Fetch selected client data
  const { data: selectedClient } = useQuery({
    queryKey: ["client-detail-preview", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("id", selectedClientId)
        .single();
      return data;
    },
    enabled: !!selectedClientId && clientSource === "existing" && open,
  });

  // Fetch custom values for selected client
  const { data: clientCustomValues = [] } = useQuery({
    queryKey: ["client-custom-values-preview", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data } = await supabase
        .from("client_custom_values")
        .select("custom_field_id, value_text, custom_fields(key)")
        .eq("client_id", selectedClientId);
      return (data ?? []).map((v: any) => ({
        key: v.custom_fields?.key,
        value: v.value_text,
      }));
    },
    enabled: !!selectedClientId && clientSource === "existing" && open,
  });

  // Fetch custom fields for mock values
  const { data: customFields = [] } = useQuery({
    queryKey: ["custom-fields-preview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_fields")
        .select("key, label")
        .order("sort_order");
      return data ?? [];
    },
    enabled: open,
  });

  const getFieldValue = (fieldKey: string, fieldSource: string): string => {
    // Handle system fields
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

    const clientData = clientSource === "existing" && selectedClient
      ? selectedClient
      : MOCK_CLIENT;
    
    const customValues = clientSource === "existing"
      ? clientCustomValues
      : customFields.map((cf: any) => ({
          key: cf.key,
          value: MOCK_CUSTOM_VALUES[cf.key] || `[${cf.label}]`,
        }));

    if (fieldSource === "custom") {
      const customVal = customValues.find((cv: any) => cv.key === fieldKey);
      return customVal?.value ?? "";
    }
    return (clientData as any)[fieldKey]?.toString() ?? "";
  };

  const applyTransform = (value: string, transform: string): string => {
    switch (transform) {
      case "uppercase":
        return value.toUpperCase();
      case "lowercase":
        return value.toLowerCase();
      case "capitalize":
        return value.replace(/\b\w/g, (c) => c.toUpperCase());
      default:
        return value;
    }
  };

  const wrapText = (
    text: string,
    font: any,
    fontSize: number,
    maxWidth: number
  ): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  };

  const handlePreview = async () => {
    console.log("Starting preview generation...");
    console.log("Source PDF path:", sourcePdfPath);
    console.log("Fields count:", fields.length);
    console.log("Client source:", clientSource);
    
    setErrorMessage(null);
    
    if (!sourcePdfPath) {
      const msg = "Ce modèle n'a pas de PDF source configuré.";
      setErrorMessage(msg);
      toast({
        title: "Erreur",
        description: msg,
        variant: "destructive",
      });
      return;
    }

    if (clientSource === "existing" && !selectedClientId) {
      const msg = "Veuillez sélectionner un client.";
      setErrorMessage(msg);
      toast({
        title: "Erreur",
        description: msg,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
    }
    setPdfBlobUrl(null);
    setNumPages(0);
    setPdfViewError(null);
    try {
      console.log("Downloading source PDF from:", sourcePdfPath);
      
      // Download source PDF
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from("pdf-templates")
        .download(sourcePdfPath);

      if (downloadError) {
        console.error("Download error:", downloadError);
        throw new Error(`Erreur de téléchargement: ${downloadError.message}`);
      }
      
      if (!pdfData) {
        throw new Error("Le fichier PDF source est vide ou introuvable.");
      }

      console.log("PDF downloaded, size:", pdfData.size);

      // Load PDF with pdf-lib
      const pdfBytes = await pdfData.arrayBuffer();
      console.log("PDF bytes loaded:", pdfBytes.byteLength);
      
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      
      console.log("PDF loaded, pages:", pages.length);

      // Apply current fields (from editor, not saved)
      console.log("Applying fields:", fields);
      
      for (const field of fields) {
        const pageIndex = (field.page || 1) - 1;
        if (pageIndex >= pages.length) {
          console.warn("Field page out of range:", field.page);
          continue;
        }

        const page = pages[pageIndex];
        const { width: pageWidthPt, height: pageHeightPt } = page.getSize();

        let value = getFieldValue(field.field_key, field.field_source);
        console.log(`Field ${field.field_key}: value="${value}"`);
        
        if (field.fallback_value && !value) {
          value = field.fallback_value;
        }
        value = applyTransform(value, field.transform || "none");

        if (!value) continue;

        const fontSize = field.font_size || 10;

        const x_norm = Number(field.x) || 0;
        const y_norm = Number(field.y) || 0;
        const w_norm = Number(field.width) || 0.1;
        const h_norm = Number(field.height) || 0.03;

        const fieldWidthPt = w_norm * pageWidthPt;
        const fieldHeightPt = h_norm * pageHeightPt;

        let x_pt = x_norm * pageWidthPt;
        const y_from_top_pt = y_norm * pageHeightPt;
        let y_pt = pageHeightPt - y_from_top_pt - fontSize;

        const lineHeight = fontSize * 1.3;
        const maxLines = Math.floor(fieldHeightPt / lineHeight);
        const isMultiline = maxLines > 1;

        if (isMultiline) {
          const lines = wrapText(value, font, fontSize, fieldWidthPt - 4);
          const linesToDraw = lines.slice(0, maxLines);

          for (let i = 0; i < linesToDraw.length; i++) {
            const lineY = y_pt - i * lineHeight;
            const lineWidth = font.widthOfTextAtSize(linesToDraw[i], fontSize);
            let lineX = x_pt;

            if (field.align === "center") {
              lineX = x_pt + (fieldWidthPt - lineWidth) / 2;
            } else if (field.align === "right") {
              lineX = x_pt + fieldWidthPt - lineWidth;
            }

            page.drawText(linesToDraw[i], {
              x: lineX,
              y: lineY,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
            });
          }
        } else {
          const textWidth = font.widthOfTextAtSize(value, fontSize);
          const minMargin = 2;

          x_pt = Math.max(minMargin, Math.min(x_pt, pageWidthPt - textWidth - minMargin));
          y_pt = Math.max(minMargin, Math.min(y_pt, pageHeightPt - fontSize - minMargin));

          let finalX = x_pt;

          if (field.align === "center") {
            finalX = x_pt + (fieldWidthPt - textWidth) / 2;
          } else if (field.align === "right") {
            finalX = x_pt + fieldWidthPt - textWidth;
          }

          finalX = Math.max(minMargin, Math.min(finalX, pageWidthPt - textWidth - minMargin));

          page.drawText(value, {
            x: finalX,
            y: y_pt,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        }
      }

      // Generate PDF blob (NOT saved)
      console.log("Generating final PDF...");
      const generatedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(generatedPdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      console.log("PDF generated, blob URL:", url);
      setPdfBlobUrl(url);
      toast({
        title: "Prévisualisation générée",
        description: "Le PDF a été généré avec succès.",
      });
    } catch (error: any) {
      console.error("PDF preview error:", error);
      const errorMsg = error?.message || "Impossible de générer la prévisualisation.";
      setErrorMessage(errorMsg);
      toast({
        title: "Erreur de génération",
        description: errorMsg,
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
    setNumPages(0);
    setPdfViewError(null);
    setErrorMessage(null);
    onOpenChange(false);
  };

  const handleOpenInNewTab = () => {
    if (!pdfBlobUrl) return;
    window.open(pdfBlobUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = `preview-template.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>👁️ Prévisualiser le modèle</DialogTitle>
          <DialogDescription>
            Visualisez le rendu final avec les positions actuelles des champs (non sauvegardées)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client source selection */}
          <div className="flex gap-4">
            <Button
              variant={clientSource === "mock" ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setClientSource("mock");
                setPdfBlobUrl(null);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Client fictif
            </Button>
            <Button
              variant={clientSource === "existing" ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setClientSource("existing");
                setPdfBlobUrl(null);
              }}
            >
              <User className="mr-2 h-4 w-4" />
              Client existant
            </Button>
          </div>

          {/* Client selector (only for existing) */}
          {clientSource === "existing" && (
            <div className="space-y-2">
              <Label>Sélectionner un client</Label>
              <Select
                value={selectedClientId}
                onValueChange={(v) => {
                  setSelectedClientId(v);
                  setPdfBlobUrl(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                      {client.first_name && ` - ${client.first_name} ${client.last_name || ""}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Mock client info */}
          {clientSource === "mock" && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Données fictives utilisées :</p>
              <p className="text-muted-foreground">
                {MOCK_CLIENT.company_name} • {MOCK_CLIENT.first_name} {MOCK_CLIENT.last_name} • {MOCK_CLIENT.city}
              </p>
            </div>
          )}

          {/* Preview button */}
          <Button
            variant="accent"
            className="w-full"
            onClick={handlePreview}
            disabled={isGenerating || (clientSource === "existing" && !selectedClientId)}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Générer la prévisualisation
              </>
            )}
          </Button>

          {/* PDF Preview */}
          {pdfBlobUrl && (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <div className="h-[55vh] overflow-auto">
                  <Document
                    file={pdfBlobUrl}
                    onLoadSuccess={({ numPages }) => {
                      setNumPages(numPages);
                      setPdfViewError(null);
                    }}
                    onLoadError={(err) => {
                      const msg =
                        err && typeof (err as any).message === "string"
                          ? `Impossible d’afficher le PDF dans l’interface : ${(err as any).message}`
                          : "Impossible d’afficher le PDF dans l’interface.";
                      setPdfViewError(msg);
                    }}
                    loading={
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Chargement de l’aperçu…
                      </div>
                    }
                  >
                    {Array.from({ length: numPages }, (_, i) => (
                      <div key={`page_${i + 1}`} className="flex justify-center py-3">
                        <Page
                          pageNumber={i + 1}
                          width={720}
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                        />
                      </div>
                    ))}
                  </Document>
                </div>
              </div>

              {pdfViewError && (
                <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-4">
                  <div className="flex items-start gap-3 text-destructive">
                    <AlertCircle className="h-5 w-5 mt-0.5" />
                    <div>
                      <p className="font-medium">Affichage inline impossible</p>
                      <p className="text-sm mt-1">{pdfViewError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  Ouvrir dans un nouvel onglet
                </Button>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger
                </Button>
              </div>
            </div>
          )}

          {/* Error state */}
          {!pdfBlobUrl && errorMessage && (
            <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-6 flex flex-col items-center justify-center text-destructive">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p className="font-medium">Erreur de génération</p>
              <p className="text-sm mt-2 text-center">{errorMessage}</p>
            </div>
          )}

          {/* Empty state */}
          {!pdfBlobUrl && !errorMessage && (
            <div className="border border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-muted-foreground">
              <Eye className="h-12 w-12 mb-4 opacity-50" />
              <p>Cliquez sur "Générer la prévisualisation" pour voir le rendu</p>
              <p className="text-xs mt-2">Les positions actuelles des champs seront utilisées</p>
              {fields.length === 0 && (
                <p className="text-xs mt-2 text-amber-500">Aucun champ n'est placé sur le document</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
