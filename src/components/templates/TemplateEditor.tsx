import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Move,
  Bug,
  Eye,
} from "lucide-react";
import { DraggableField } from "./DraggableField";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// Editor PDF width (fixed for consistent mapping)
const EDITOR_PDF_WIDTH = 700;

// Standard fields
const standardFields = [
  { key: "type_client", label: "Type de client", source: "standard" as const },
  { key: "company_name", label: "Société", source: "standard" as const },
  { key: "first_name", label: "Prénom", source: "standard" as const },
  { key: "last_name", label: "Nom", source: "standard" as const },
  { key: "email", label: "Email", source: "standard" as const },
  { key: "phone", label: "Téléphone", source: "standard" as const },
  { key: "address_line1", label: "Adresse 1", source: "standard" as const },
  { key: "address_line2", label: "Adresse 2", source: "standard" as const },
  { key: "zip", label: "Code postal", source: "standard" as const },
  { key: "city", label: "Ville", source: "standard" as const },
  { key: "country", label: "Pays", source: "standard" as const },
  { key: "siret", label: "SIRET", source: "standard" as const },
  { key: "code_naf", label: "Code NAF", source: "standard" as const },
];

// System fields - computed at generation time
const systemFields = [
  { key: "today_date", label: "Date du jour (JJ/MM/AAAA)", source: "system" as const },
  { key: "date_edition", label: "Date d'édition (JJ/MM/AAAA à HH:mm)", source: "system" as const },
];

interface TemplateField {
  id?: string;
  template_id: string;
  field_source: "standard" | "custom" | "system";
  field_key: string;
  page: number;
  x: number; // Normalized 0-1 (relative to viewport width)
  y: number; // Normalized 0-1 (relative to viewport height)
  width?: number; // Normalized 0-1
  height?: number; // Normalized 0-1
  font_size: number; // In PDF points
  align: "left" | "center" | "right";
  transform: "none" | "uppercase" | "lowercase" | "capitalize";
  fallback_value?: string;
}

interface TemplateEditorProps {
  template: any;
  onClose: () => void;
}

export function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [viewportDimensions, setViewportDimensions] = useState({ width: EDITOR_PDF_WIDTH, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch custom fields
  const { data: customFields = [] } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_fields")
        .select("*")
        .order("sort_order");
      return data ?? [];
    },
  });

  // Combine all available fields
  const allFields = [
    ...standardFields,
    ...customFields.map((f: any) => ({
      key: f.key,
      label: f.label,
      source: "custom" as const,
    })),
    ...systemFields,
  ];

  // Fetch existing template fields
  useEffect(() => {
    async function loadFields() {
      const { data } = await supabase
        .from("pdf_template_fields")
        .select("*")
        .eq("template_id", template.id);
      
      if (data) {
        setFields(data as TemplateField[]);
      }
    }
    loadFields();
  }, [template.id]);

  // Load PDF
  useEffect(() => {
    async function loadPdf() {
      if (!template.source_pdf_storage_path) return;

      const { data } = await supabase.storage
        .from("pdf-templates")
        .createSignedUrl(template.source_pdf_storage_path, 3600);

      if (data?.signedUrl) {
        setPdfUrl(data.signedUrl);
      }
      setIsLoading(false);
    }
    loadPdf();
  }, [template.source_pdf_storage_path]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // Capture viewport dimensions when PDF page renders
  const onPageLoadSuccess = useCallback((page: any) => {
    // Get the actual rendered size based on our width prop
    const scale = EDITOR_PDF_WIDTH / page.originalWidth;
    const renderedHeight = page.originalHeight * scale;
    setViewportDimensions({
      width: EDITOR_PDF_WIDTH,
      height: renderedHeight,
    });
  }, []);

  // Convert pixel position to normalized (0-1)
  const pixelToNormalized = useCallback(
    (px: number, dimension: "x" | "y") => {
      const viewportSize = dimension === "x" ? viewportDimensions.width : viewportDimensions.height;
      if (viewportSize === 0) return 0;
      return px / viewportSize;
    },
    [viewportDimensions]
  );

  // Convert normalized (0-1) to pixel position for display
  const normalizedToPixel = useCallback(
    (norm: number, dimension: "x" | "y") => {
      const viewportSize = dimension === "x" ? viewportDimensions.width : viewportDimensions.height;
      return norm * viewportSize;
    },
    [viewportDimensions]
  );

  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If no field key selected, just deselect any selected field
    if (!selectedFieldKey) {
      setSelectedField(null);
      return;
    }

    const container = containerRef.current;
    if (!container || viewportDimensions.height === 0) return;

    const rect = container.getBoundingClientRect();
    const x_px = e.clientX - rect.left;
    const y_px = e.clientY - rect.top;

    // Convert to normalized coordinates
    const x_norm = pixelToNormalized(x_px, "x");
    const y_norm = pixelToNormalized(y_px, "y");

    // Default width/height in normalized coordinates
    const defaultWidthNorm = 100 / viewportDimensions.width;
    const defaultHeightNorm = 24 / viewportDimensions.height;

    const fieldInfo = allFields.find((f) => f.key === selectedFieldKey);
    if (!fieldInfo) return;

    const newField: TemplateField = {
      template_id: template.id,
      field_source: fieldInfo.source as "standard" | "custom" | "system",
      field_key: selectedFieldKey,
      page: currentPage,
      x: x_norm,
      y: y_norm,
      width: defaultWidthNorm,
      height: defaultHeightNorm,
      font_size: 10,
      align: "left",
      transform: "none",
    };

    setFields([...fields, newField]);
    setSelectedFieldKey(null);
    setSelectedField(newField);
    toast({ title: `Champ "${fieldInfo.label}" ajouté` });
  };

  const updateFieldById = useCallback(
    (field: TemplateField, updates: Partial<TemplateField>) => {
      setFields((prev) =>
        prev.map((f) => (f === field ? { ...f, ...updates } : f))
      );
      if (selectedField === field) {
        setSelectedField({ ...field, ...updates });
      }
    },
    [selectedField]
  );

  // Handle updates from DraggableField (receives pixel values, converts to normalized)
  const handleFieldUpdate = useCallback(
    (field: TemplateField, pixelUpdates: { x?: number; y?: number; width?: number; height?: number }) => {
      const normalizedUpdates: Partial<TemplateField> = {};
      
      if (pixelUpdates.x !== undefined) {
        normalizedUpdates.x = pixelToNormalized(pixelUpdates.x, "x");
      }
      if (pixelUpdates.y !== undefined) {
        normalizedUpdates.y = pixelToNormalized(pixelUpdates.y, "y");
      }
      if (pixelUpdates.width !== undefined) {
        normalizedUpdates.width = pixelToNormalized(pixelUpdates.width, "x");
      }
      if (pixelUpdates.height !== undefined) {
        normalizedUpdates.height = pixelToNormalized(pixelUpdates.height, "y");
      }

      updateFieldById(field, normalizedUpdates);
    },
    [pixelToNormalized, updateFieldById]
  );

  const deleteField = (index: number) => {
    const field = fields[index];
    setFields(fields.filter((_, i) => i !== index));
    if (selectedField === field) {
      setSelectedField(null);
    }
    toast({ title: "Champ supprimé" });
  };

  const updateFieldProperty = (property: keyof TemplateField, value: any) => {
    if (!selectedField) return;
    
    setFields((prev) =>
      prev.map((f) =>
        f === selectedField ? { ...f, [property]: value } : f
      )
    );
    setSelectedField({ ...selectedField, [property]: value });
  };

  // Handle direct pixel input in properties panel
  const handlePixelPropertyChange = (property: "x" | "y" | "width" | "height", pixelValue: number) => {
    if (!selectedField) return;
    const normValue = pixelToNormalized(pixelValue, property === "x" || property === "width" ? "x" : "y");
    updateFieldProperty(property, normValue);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing fields
      await supabase
        .from("pdf_template_fields")
        .delete()
        .eq("template_id", template.id);

      // Insert new fields
      if (fields.length > 0) {
        const { error } = await supabase
          .from("pdf_template_fields")
          .insert(fields.map(({ id, ...f }) => f) as any);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Mapping sauvegardé" });
      queryClient.invalidateQueries({ queryKey: ["template-field-counts"] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le mapping",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    setIsSaving(true);
    saveMutation.mutate();
    setIsSaving(false);
  };

  const currentPageFields = fields.filter((f) => f.page === currentPage);

  // Get pixel values for display
  const getPixelValue = (norm: number, dimension: "x" | "y") => {
    return Math.round(normalizedToPixel(norm, dimension));
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Left sidebar - Field palette */}
      <div className="w-72 border-r border-border bg-card flex flex-col">
        <div className="border-b border-border p-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h2 className="mt-4 font-semibold text-foreground">{template.name}</h2>
          <p className="text-sm text-muted-foreground">Éditeur de mapping</p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Champs disponibles
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Sélectionnez un champ puis cliquez sur le PDF
          </p>
          
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Standards
            </h4>
            {standardFields.map((field) => (
              <button
                key={field.key}
                onClick={() => setSelectedFieldKey(field.key)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedFieldKey === field.key
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {field.label}
              </button>
            ))}

            {customFields.length > 0 && (
              <>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">
                  Personnalisés
                </h4>
                {customFields.map((field: any) => (
                  <button
                    key={field.key}
                    onClick={() => setSelectedFieldKey(field.key)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedFieldKey === field.key
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {field.label}
                  </button>
                ))}
              </>
            )}

            <h4 className="text-xs font-semibold text-info uppercase tracking-wide mt-4 mb-2">
              Système
            </h4>
            {systemFields.map((field) => (
              <button
                key={field.key}
                onClick={() => setSelectedFieldKey(field.key)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedFieldKey === field.key
                    ? "bg-info text-info-foreground"
                    : "hover:bg-info/10"
                }`}
              >
                {field.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border p-4">
          <Button
            variant="accent"
            className="w-full"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {/* Center - PDF viewer */}
      <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} / {numPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Preview button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewModalOpen(true)}
              disabled={!pdfUrl}
            >
              <Eye className="mr-2 h-4 w-4" />
              Prévisualiser le modèle
            </Button>
            
            <Badge variant="secondary">
              {currentPageFields.length} champs sur cette page
            </Badge>
            
            {/* Debug toggle */}
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-muted-foreground" />
              <Switch
                checked={debugMode}
                onCheckedChange={setDebugMode}
                aria-label="Mode debug"
              />
            </div>
          </div>
        </div>

        {/* Debug info panel */}
        {debugMode && (
          <div className="bg-card border-b border-border px-4 py-2 text-xs font-mono">
            <div className="flex gap-6">
              <span>Viewport: {viewportDimensions.width}×{Math.round(viewportDimensions.height)}px</span>
              {selectedField && (
                <>
                  <span className="text-accent">
                    Norm: x={selectedField.x.toFixed(4)}, y={selectedField.y.toFixed(4)}, 
                    w={(selectedField.width || 0).toFixed(4)}, h={(selectedField.height || 0).toFixed(4)}
                  </span>
                  <span className="text-info">
                    Pixels: x={getPixelValue(selectedField.x, "x")}, y={getPixelValue(selectedField.y, "y")}, 
                    w={getPixelValue(selectedField.width || 0, "x")}, h={getPixelValue(selectedField.height || 0, "y")}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* PDF container */}
        <div className="flex-1 overflow-auto p-8">
          <div
            ref={containerRef}
            className="relative mx-auto shadow-lg cursor-crosshair"
            onClick={handlePdfClick}
            style={{ width: "fit-content" }}
          >
            {pdfUrl && (
              <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
                <Page 
                  pageNumber={currentPage} 
                  width={EDITOR_PDF_WIDTH} 
                  onLoadSuccess={onPageLoadSuccess}
                />
              </Document>
            )}

            {/* Field overlays */}
            {currentPageFields.map((field, index) => {
              const fieldInfo = allFields.find((f) => f.key === field.field_key);
              
              // Convert normalized coords to pixels for display
              const x_px = normalizedToPixel(field.x, "x");
              const y_px = normalizedToPixel(field.y, "y");
              const w_px = normalizedToPixel(field.width || 0.1, "x");
              const h_px = normalizedToPixel(field.height || 0.03, "y");
              
              return (
                <DraggableField
                  key={`${field.field_key}-${index}`}
                  field={{
                    ...field,
                    x: x_px,
                    y: y_px,
                    width: w_px,
                    height: h_px,
                  }}
                  label={fieldInfo?.label || field.field_key}
                  isSelected={selectedField === field}
                  containerRef={containerRef}
                  onSelect={() => setSelectedField(field)}
                  onUpdate={(pixelUpdates) => handleFieldUpdate(field, pixelUpdates)}
                  onDelete={() => {
                    const globalIndex = fields.indexOf(field);
                    if (globalIndex !== -1) deleteField(globalIndex);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Right sidebar - Field properties */}
      <div className="w-72 border-l border-border bg-card flex flex-col">
        <div className="border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Propriétés</h3>
        </div>

        {selectedField ? (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Champ</Label>
              <p className="font-medium">
                {allFields.find((f) => f.key === selectedField.field_key)?.label}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="x" className="text-xs">X (px)</Label>
                <Input
                  id="x"
                  type="number"
                  value={getPixelValue(selectedField.x, "x")}
                  onChange={(e) => handlePixelPropertyChange("x", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="y" className="text-xs">Y (px)</Label>
                <Input
                  id="y"
                  type="number"
                  value={getPixelValue(selectedField.y, "y")}
                  onChange={(e) => handlePixelPropertyChange("y", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="width" className="text-xs">Largeur (px)</Label>
                <Input
                  id="width"
                  type="number"
                  value={getPixelValue(selectedField.width || 0.1, "x")}
                  onChange={(e) => handlePixelPropertyChange("width", parseInt(e.target.value) || 40)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="height" className="text-xs">Hauteur (px)</Label>
                <Input
                  id="height"
                  type="number"
                  value={getPixelValue(selectedField.height || 0.03, "y")}
                  onChange={(e) => handlePixelPropertyChange("height", parseInt(e.target.value) || 20)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fontSize" className="text-xs">Taille police (pt)</Label>
              <Input
                id="fontSize"
                type="number"
                value={selectedField.font_size}
                onChange={(e) => updateFieldProperty("font_size", parseInt(e.target.value) || 10)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Alignement</Label>
              <Select
                value={selectedField.align}
                onValueChange={(v) => updateFieldProperty("align", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Gauche</SelectItem>
                  <SelectItem value="center">Centre</SelectItem>
                  <SelectItem value="right">Droite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Transformation</Label>
              <Select
                value={selectedField.transform}
                onValueChange={(v) => updateFieldProperty("transform", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  <SelectItem value="uppercase">MAJUSCULES</SelectItem>
                  <SelectItem value="lowercase">minuscules</SelectItem>
                  <SelectItem value="capitalize">Capitalize</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fallback" className="text-xs">Valeur par défaut</Label>
              <Input
                id="fallback"
                value={selectedField.fallback_value || ""}
                onChange={(e) => updateFieldProperty("fallback_value", e.target.value)}
                placeholder="Si champ vide..."
              />
            </div>

            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => {
                const index = fields.indexOf(selectedField);
                if (index !== -1) deleteField(index);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer ce champ
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4 text-center text-muted-foreground">
            <div>
              <Move className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">
                Sélectionnez un champ sur le PDF pour modifier ses propriétés
              </p>
            </div>
          </div>
        )}

        {/* Placed fields list */}
        <div className="border-t border-border p-4">
          <h4 className="mb-2 text-sm font-medium">Champs placés ({fields.length})</h4>
          <div className="max-h-40 overflow-auto space-y-1">
            {fields.map((field, index) => (
              <div
                key={index}
                className={`flex items-center justify-between rounded px-2 py-1 text-xs cursor-pointer ${
                  selectedField === field ? "bg-accent/20" : "hover:bg-muted"
                }`}
                onClick={() => {
                  setSelectedField(field);
                  setCurrentPage(field.page);
                }}
              >
                <span>{allFields.find((f) => f.key === field.field_key)?.label}</span>
                <Badge variant="outline" className="text-[10px]">
                  P{field.page}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <TemplatePreviewModal
        open={isPreviewModalOpen}
        onOpenChange={setIsPreviewModalOpen}
        templateId={template.id}
        sourcePdfPath={template.source_pdf_storage_path || ""}
        fields={fields}
      />
    </div>
  );
}
