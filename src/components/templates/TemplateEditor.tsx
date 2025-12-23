import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Move,
  Type,
} from "lucide-react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// Standard fields
const standardFields = [
  { key: "type_client", label: "Type de client", source: "standard" },
  { key: "company_name", label: "Société", source: "standard" },
  { key: "first_name", label: "Prénom", source: "standard" },
  { key: "last_name", label: "Nom", source: "standard" },
  { key: "email", label: "Email", source: "standard" },
  { key: "phone", label: "Téléphone", source: "standard" },
  { key: "address_line1", label: "Adresse 1", source: "standard" },
  { key: "address_line2", label: "Adresse 2", source: "standard" },
  { key: "zip", label: "Code postal", source: "standard" },
  { key: "city", label: "Ville", source: "standard" },
  { key: "country", label: "Pays", source: "standard" },
  { key: "siret", label: "SIRET", source: "standard" },
  { key: "code_naf", label: "Code NAF", source: "standard" },
];

interface TemplateField {
  id?: string;
  template_id: string;
  field_source: "standard" | "custom";
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
      source: "custom",
    })),
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

  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedFieldKey || isDragging) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const fieldInfo = allFields.find((f) => f.key === selectedFieldKey);
    if (!fieldInfo) return;

    const newField: TemplateField = {
      template_id: template.id,
      field_source: fieldInfo.source as "standard" | "custom",
      field_key: selectedFieldKey,
      page: currentPage,
      x: Math.round(x),
      y: Math.round(y),
      font_size: 10,
      align: "left",
      transform: "none",
    };

    setFields([...fields, newField]);
    setSelectedFieldKey(null);
    toast({ title: `Champ "${fieldInfo.label}" ajouté` });
  };

  const handleFieldMouseDown = (e: React.MouseEvent, field: TemplateField, index: number) => {
    e.stopPropagation();
    setSelectedField(field);
    setIsDragging(true);
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !selectedField || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;

      setFields((prev) =>
        prev.map((f) =>
          f === selectedField
            ? { ...f, x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) }
            : f
        )
      );
    },
    [isDragging, selectedField, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

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
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {currentPageFields.length} champs sur cette page
            </Badge>
          </div>
        </div>

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
                <Page pageNumber={currentPage} width={700} />
              </Document>
            )}

            {/* Field overlays */}
            {currentPageFields.map((field, index) => {
              const fieldInfo = allFields.find((f) => f.key === field.field_key);
              const globalIndex = fields.indexOf(field);
              
              return (
                <div
                  key={index}
                  className={`absolute cursor-move rounded border-2 px-1 text-xs ${
                    selectedField === field
                      ? "border-accent bg-accent/20"
                      : "border-primary bg-primary/10 hover:border-accent"
                  }`}
                  style={{
                    left: field.x,
                    top: field.y,
                    fontSize: field.font_size,
                  }}
                  onMouseDown={(e) => handleFieldMouseDown(e, field, globalIndex)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedField(field);
                  }}
                >
                  <div className="flex items-center gap-1">
                    <Type className="h-3 w-3" />
                    <span>{fieldInfo?.label || field.field_key}</span>
                  </div>
                </div>
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
                <Label htmlFor="x" className="text-xs">X</Label>
                <Input
                  id="x"
                  type="number"
                  value={selectedField.x}
                  onChange={(e) => updateFieldProperty("x", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="y" className="text-xs">Y</Label>
                <Input
                  id="y"
                  type="number"
                  value={selectedField.y}
                  onChange={(e) => updateFieldProperty("y", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fontSize" className="text-xs">Taille police</Label>
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
    </div>
  );
}
