import { useState, useCallback } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ColumnMapping {
  [excelColumn: string]: string;
}

const STANDARD_FIELDS = [
  { key: "company_name", label: "Raison sociale" },
  { key: "first_name", label: "Prénom" },
  { key: "last_name", label: "Nom" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Téléphone" },
  { key: "address_line1", label: "Adresse 1" },
  { key: "address_line2", label: "Adresse 2" },
  { key: "zip", label: "Code postal" },
  { key: "city", label: "Ville" },
  { key: "country", label: "Pays" },
  { key: "siret", label: "SIRET" },
  { key: "code_naf", label: "Code NAF" },
  { key: "type_client", label: "Type client" },
  { key: "category", label: "Catégorie" },
];

export function ImportModal({ open, onOpenChange, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<"upload" | "mapping" | "importing" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [allData, setAllData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [updateOnEmail, setUpdateOnEmail] = useState(true);
  const [result, setResult] = useState({ created: 0, updated: 0, errors: 0 });

  // Fetch custom fields
  const { data: customFields = [] } = useQuery({
    queryKey: ["custom-fields-import"],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_fields")
        .select("id, key, label")
        .order("sort_order");
      return data ?? [];
    },
  });

  const allFields = [
    ...STANDARD_FIELDS,
    ...customFields.map((cf) => ({ key: `custom:${cf.key}`, label: `${cf.label} (perso.)` })),
  ];

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

      if (jsonData.length === 0) {
        toast({ title: "Fichier vide", description: "Le fichier ne contient aucune donnée.", variant: "destructive" });
        return;
      }

      const fileHeaders = Object.keys(jsonData[0]);
      setHeaders(fileHeaders);
      setPreviewData(jsonData.slice(0, 5));
      setAllData(jsonData);

      // Auto-map columns based on similarity
      const autoMapping: ColumnMapping = {};
      fileHeaders.forEach((header) => {
        const lowerHeader = header.toLowerCase().trim();
        const matched = allFields.find((f) => {
          const lowerLabel = f.label.toLowerCase();
          const lowerKey = f.key.toLowerCase();
          return lowerHeader.includes(lowerLabel) || 
                 lowerHeader.includes(lowerKey) || 
                 lowerLabel.includes(lowerHeader) ||
                 lowerKey.includes(lowerHeader);
        });
        if (matched) {
          autoMapping[header] = matched.key;
        }
      });
      setMapping(autoMapping);
      setStep("mapping");
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de lire le fichier.", variant: "destructive" });
    }
  }, [allFields]);

  const handleImport = async () => {
    if (!mapping.company_name && !Object.values(mapping).includes("company_name")) {
      // Check if company_name is mapped
      const hasCompanyName = Object.values(mapping).includes("company_name");
      if (!hasCompanyName) {
        toast({ 
          title: "Champ obligatoire", 
          description: "La raison sociale doit être mappée.", 
          variant: "destructive" 
        });
        return;
      }
    }

    setStep("importing");
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const row of allData) {
      try {
        // Build client data from mapping
        const clientData: Record<string, string | null> = {};
        const customValues: { key: string; value: string }[] = [];

        Object.entries(mapping).forEach(([excelCol, fieldKey]) => {
          const value = row[excelCol]?.toString().trim() || null;
          
          if (fieldKey.startsWith("custom:")) {
            const customKey = fieldKey.replace("custom:", "");
            if (value) {
              customValues.push({ key: customKey, value });
            }
          } else {
            clientData[fieldKey] = value;
          }
        });

        if (!clientData.company_name) {
          errors++;
          continue;
        }

        // Check if client exists by email
        let existingClient = null;
        if (updateOnEmail && clientData.email) {
          const { data } = await supabase
            .from("clients")
            .select("id")
            .eq("email", clientData.email)
            .maybeSingle();
          existingClient = data;
        }

        if (existingClient) {
          // Update existing client
          await supabase
            .from("clients")
            .update(clientData as any)
            .eq("id", existingClient.id);
          
          // Update custom values
          for (const cv of customValues) {
            const field = customFields.find((f) => f.key === cv.key);
            if (field) {
              // Delete existing then insert to handle upsert
              await supabase
                .from("client_custom_values")
                .delete()
                .eq("client_id", existingClient.id)
                .eq("custom_field_id", field.id);
              
              await supabase
                .from("client_custom_values")
                .insert({
                  client_id: existingClient.id,
                  custom_field_id: field.id,
                  value_text: cv.value,
                });
            }
          }
          updated++;
        } else {
          // Create new client
          const { data: newClient, error } = await supabase
            .from("clients")
            .insert(clientData as any)
            .select("id")
            .single();
          
          if (error || !newClient) {
            errors++;
            continue;
          }

          // Insert custom values
          for (const cv of customValues) {
            const field = customFields.find((f) => f.key === cv.key);
            if (field) {
              await supabase
                .from("client_custom_values")
                .insert({
                  client_id: newClient.id,
                  custom_field_id: field.id,
                  value_text: cv.value,
                });
            }
          }
          created++;
        }
      } catch (err) {
        errors++;
      }
    }

    setResult({ created, updated, errors });
    setStep("result");
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setPreviewData([]);
    setAllData([]);
    setMapping({});
    setResult({ created: 0, updated: 0, errors: 0 });
    onOpenChange(false);
    if (result.created > 0 || result.updated > 0) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des clients</DialogTitle>
          <DialogDescription>
            Importez vos clients depuis un fichier Excel (.xlsx) ou CSV
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Glissez un fichier ou cliquez pour sélectionner
            </p>
            <label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="accent" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Sélectionner un fichier
                </span>
              </Button>
            </label>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">{allData.length} lignes détectées</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="update-email"
                  checked={updateOnEmail}
                  onCheckedChange={setUpdateOnEmail}
                />
                <Label htmlFor="update-email">Mettre à jour si email identique</Label>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Mapper les colonnes</h4>
              <div className="grid gap-3">
                {headers.map((header) => (
                  <div key={header} className="flex items-center gap-4">
                    <div className="w-1/3">
                      <Badge variant="secondary">{header}</Badge>
                      {previewData[0]?.[header] && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ex: {previewData[0][header].toString().substring(0, 20)}...
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={mapping[header] || ""}
                      onValueChange={(value) => setMapping((prev) => ({ ...prev, [header]: value }))}
                    >
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Ignorer cette colonne" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Ignorer</SelectItem>
                        {allFields.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button variant="accent" onClick={handleImport}>
                Importer {allData.length} lignes
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Import en cours...</p>
          </div>
        )}

        {step === "result" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-500">{result.created}</p>
                  <p className="text-sm text-muted-foreground">Créés</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Check className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-blue-500">{result.updated}</p>
                  <p className="text-sm text-muted-foreground">Mis à jour</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold text-destructive">{result.errors}</p>
                  <p className="text-sm text-muted-foreground">Erreurs</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="accent" onClick={handleClose}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
