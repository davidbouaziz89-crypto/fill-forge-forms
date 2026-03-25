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
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { formatDateFR, formatDateTimeFR } from "@/lib/dateUtils";
import { renderFieldToPdf, applyTextTransform } from "@/lib/pdfRenderUtils";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  fields: TemplateField[];
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

  const handlePreview = async () => {
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
      // Download source PDF
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from("pdf-templates")
        .download(sourcePdfPath);

      if (downloadError) {
        throw new Error(`Erreur de téléchargement: ${downloadError.message}`);
      }
      
      if (!pdfData) {
        throw new Error("Le fichier PDF source est vide ou introuvable.");
      }

      // Load PDF with pdf-lib
      const pdfBytes = await pdfData.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      // Apply fields using unified rendering utility
      for (const field of fields) {
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

      // Generate PDF blob
      const generatedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(generatedPdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
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
          <DialogTitle>Prévisualiser le modèle</DialogTitle>
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
            <div className="rounded-lg border border-border p-4 bg-muted/50">
              <p className="text-sm font-medium mb-2">Client fictif de démonstration :</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Société: {MOCK_CLIENT.company_name}</div>
                <div>Contact: {MOCK_CLIENT.first_name} {MOCK_CLIENT.last_name}</div>
                <div>Email: {MOCK_CLIENT.email}</div>
                <div>Ville: {MOCK_CLIENT.city}</div>
              </div>
            </div>
          )}

          {/* Error display */}
          {errorMessage && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{errorMessage}</span>
              </div>
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
                Génération en cours...
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
              <div className="border rounded-lg overflow-hidden bg-muted/30 flex justify-center">
                <Document
                  file={pdfBlobUrl}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  onLoadError={(error) => {
                    console.error("PDF view error:", error);
                    setPdfViewError("Impossible d'afficher le PDF dans le navigateur.");
                  }}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  {Array.from(new Array(numPages), (_, index) => (
                    <Page
                      key={`page_${index + 1}`}
                      pageNumber={index + 1}
                      width={600}
                      className="border-b last:border-b-0"
                    />
                  ))}
                </Document>
              </div>

              {pdfViewError && (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  {pdfViewError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ouvrir dans un nouvel onglet
                </Button>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
