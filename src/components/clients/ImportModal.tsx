import { useState, useCallback, useMemo } from "react";
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
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertCircle, 
  Loader2, 
  Download,
  AlertTriangle,
  Users,
  RefreshCw,
  Ban
} from "lucide-react";
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

interface DuplicateInfo {
  rowIndex: number;
  reason: string;
  existingClientId: string;
}

interface PreviewResult {
  newClients: number;
  duplicates: DuplicateInfo[];
  errors: { rowIndex: number; reason: string }[];
  totalRows: number;
}

const STANDARD_FIELDS = [
  { key: "company_name", label: "Raison sociale", required: true },
  { key: "first_name", label: "Prénom", required: false },
  { key: "last_name", label: "Nom", required: false },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Téléphone", required: false },
  { key: "address_line1", label: "Adresse", required: false },
  { key: "address_line2", label: "Adresse 2", required: false },
  { key: "zip", label: "Code postal", required: false },
  { key: "city", label: "Ville", required: false },
  { key: "country", label: "Pays", required: false },
  { key: "siret", label: "SIRET", required: false },
  { key: "code_naf", label: "Code NAF", required: false },
  { key: "type_client", label: "Type client", required: false },
  { key: "category", label: "Catégorie", required: false },
];

// Generate example Excel file
const generateExampleFile = (customFields: { key: string; label: string }[]) => {
  const headers = [
    ...STANDARD_FIELDS.map(f => f.label),
    ...customFields.map(cf => cf.label)
  ];
  
  const exampleData = [
    headers,
    [
      "Acme Corp",
      "Jean",
      "Dupont",
      "jean.dupont@acme.fr",
      "0123456789",
      "123 rue de la Paix",
      "Bâtiment A",
      "75001",
      "Paris",
      "France",
      "12345678901234",
      "6201Z",
      "entreprise",
      "PME",
      ...customFields.map(() => "Valeur exemple")
    ],
    [
      "Tech Solutions",
      "Marie",
      "Martin",
      "marie@techsolutions.fr",
      "0987654321",
      "456 avenue des Champs",
      "",
      "69001",
      "Lyon",
      "France",
      "98765432109876",
      "6202A",
      "entreprise",
      "ETI",
      ...customFields.map(() => "")
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet(exampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  
  // Set column widths
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  
  XLSX.writeFile(wb, "exemple_import_clients.xlsx");
};

export function ImportModal({ open, onOpenChange, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<"format" | "upload" | "mapping" | "preview" | "importing" | "result">("format");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [allData, setAllData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [updateDuplicates, setUpdateDuplicates] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState({ created: 0, updated: 0, skipped: 0, errors: 0 });

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

  // Fetch existing clients for duplicate detection
  const { data: existingClients = [] } = useQuery({
    queryKey: ["existing-clients-import"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, email, company_name, phone, address_line1");
      return data ?? [];
    },
    enabled: open,
  });

  const allFields = useMemo(() => [
    ...STANDARD_FIELDS,
    ...customFields.map((cf) => ({ key: `custom:${cf.key}`, label: `${cf.label} (perso.)`, required: false })),
  ], [customFields]);

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
          const lowerKey = f.key.toLowerCase().replace("custom:", "");
          return lowerHeader.includes(lowerLabel) || 
                 lowerHeader.includes(lowerKey) || 
                 lowerLabel.includes(lowerHeader) ||
                 lowerKey.includes(lowerHeader) ||
                 (lowerHeader === "societe" && f.key === "company_name") ||
                 (lowerHeader === "société" && f.key === "company_name") ||
                 (lowerHeader === "raison sociale" && f.key === "company_name") ||
                 (lowerHeader === "adresse" && f.key === "address_line1") ||
                 (lowerHeader === "telephone" && f.key === "phone") ||
                 (lowerHeader === "téléphone" && f.key === "phone") ||
                 (lowerHeader === "prenom" && f.key === "first_name") ||
                 (lowerHeader === "nom" && f.key === "last_name") ||
                 (lowerHeader === "cp" && f.key === "zip") ||
                 (lowerHeader === "code postal" && f.key === "zip");
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

  // Check if a row is a duplicate
  const checkDuplicate = useCallback((clientData: Record<string, string | null>): { isDuplicate: boolean; reason: string; existingId: string } => {
    const email = clientData.email?.toLowerCase().trim();
    const companyName = clientData.company_name?.toLowerCase().trim();
    const phone = clientData.phone?.replace(/\s/g, "").trim();
    const address = clientData.address_line1?.toLowerCase().trim();

    for (const existing of existingClients) {
      // Check by email
      if (email && existing.email && existing.email.toLowerCase().trim() === email) {
        return { isDuplicate: true, reason: `Email identique: ${email}`, existingId: existing.id };
      }

      // Check by company + phone
      if (companyName && phone && 
          existing.company_name?.toLowerCase().trim() === companyName &&
          existing.phone?.replace(/\s/g, "").trim() === phone) {
        return { isDuplicate: true, reason: `Société + téléphone identiques`, existingId: existing.id };
      }

      // Check by company + address
      if (companyName && address && 
          existing.company_name?.toLowerCase().trim() === companyName &&
          existing.address_line1?.toLowerCase().trim() === address) {
        return { isDuplicate: true, reason: `Société + adresse identiques`, existingId: existing.id };
      }
    }

    return { isDuplicate: false, reason: "", existingId: "" };
  }, [existingClients]);

  // Analyze data and generate preview
  const analyzeData = useCallback(async () => {
    setIsAnalyzing(true);
    
    const result: PreviewResult = {
      newClients: 0,
      duplicates: [],
      errors: [],
      totalRows: allData.length
    };

    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];
      
      // Build client data from mapping
      const clientData: Record<string, string | null> = {};
      
      Object.entries(mapping).forEach(([excelCol, fieldKey]) => {
        if (!fieldKey || fieldKey.startsWith("custom:")) return;
        const rawValue = row[excelCol];
        // Only set value if it's not empty
        const value = rawValue?.toString().trim() || null;
        if (value) {
          clientData[fieldKey] = value;
        }
      });

      // Check required field
      if (!clientData.company_name) {
        result.errors.push({ rowIndex: i + 2, reason: "Raison sociale manquante" });
        continue;
      }

      // Check for duplicates
      const duplicateCheck = checkDuplicate(clientData);
      if (duplicateCheck.isDuplicate) {
        result.duplicates.push({
          rowIndex: i + 2,
          reason: duplicateCheck.reason,
          existingClientId: duplicateCheck.existingId
        });
      } else {
        result.newClients++;
      }
    }

    setPreviewResult(result);
    setIsAnalyzing(false);
    setStep("preview");
  }, [allData, mapping, checkDuplicate]);

  const handleImport = async () => {
    if (!previewResult) return;

    setStep("importing");
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];
      
      try {
        // Build client data from mapping
        const clientData: Record<string, string | null> = {};
        const customValues: { key: string; value: string }[] = [];

        Object.entries(mapping).forEach(([excelCol, fieldKey]) => {
          if (!fieldKey) return;
          
          const rawValue = row[excelCol];
          // Only set value if it's not empty - don't overwrite with null
          const value = rawValue?.toString().trim() || null;
          
          if (fieldKey.startsWith("custom:")) {
            const customKey = fieldKey.replace("custom:", "");
            if (value) {
              customValues.push({ key: customKey, value });
            }
          } else if (value) {
            // Only include non-empty values for standard fields
            clientData[fieldKey] = value;
          }
        });

        if (!clientData.company_name) {
          errors++;
          continue;
        }

        // Check for duplicates
        const duplicateCheck = checkDuplicate(clientData);
        
        if (duplicateCheck.isDuplicate) {
          if (updateDuplicates) {
            // Update existing client (only non-empty fields)
            const updateData: Record<string, string> = {};
            Object.entries(clientData).forEach(([key, val]) => {
              if (val) updateData[key] = val;
            });

            if (Object.keys(updateData).length > 0) {
              await supabase
                .from("clients")
                .update(updateData)
                .eq("id", duplicateCheck.existingId);
            }

            // Update custom values
            for (const cv of customValues) {
              const field = customFields.find((f) => f.key === cv.key);
              if (field) {
                await supabase
                  .from("client_custom_values")
                  .delete()
                  .eq("client_id", duplicateCheck.existingId)
                  .eq("custom_field_id", field.id);

                await supabase
                  .from("client_custom_values")
                  .insert({
                    client_id: duplicateCheck.existingId,
                    custom_field_id: field.id,
                    value_text: cv.value,
                  });
              }
            }
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new client - ensure company_name is present
          const insertData = {
            company_name: clientData.company_name as string,
            ...(clientData.first_name && { first_name: clientData.first_name }),
            ...(clientData.last_name && { last_name: clientData.last_name }),
            ...(clientData.email && { email: clientData.email }),
            ...(clientData.phone && { phone: clientData.phone }),
            ...(clientData.address_line1 && { address_line1: clientData.address_line1 }),
            ...(clientData.address_line2 && { address_line2: clientData.address_line2 }),
            ...(clientData.zip && { zip: clientData.zip }),
            ...(clientData.city && { city: clientData.city }),
            ...(clientData.country && { country: clientData.country }),
            ...(clientData.siret && { siret: clientData.siret }),
            ...(clientData.code_naf && { code_naf: clientData.code_naf }),
            ...(clientData.type_client && { type_client: clientData.type_client }),
            ...(clientData.category && { category: clientData.category }),
          };

          const { data: newClient, error } = await supabase
            .from("clients")
            .insert(insertData)
            .select("id")
            .single();

          if (error || !newClient) {
            console.error("Insert error:", error);
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
        console.error("Row error:", err);
        errors++;
      }
    }

    setResult({ created, updated, skipped, errors });
    setStep("result");
  };

  const handleClose = () => {
    setStep("format");
    setFile(null);
    setHeaders([]);
    setPreviewData([]);
    setAllData([]);
    setMapping({});
    setPreviewResult(null);
    setResult({ created: 0, updated: 0, skipped: 0, errors: 0 });
    onOpenChange(false);
    if (result.created > 0 || result.updated > 0) {
      onSuccess();
    }
  };

  const hasCompanyNameMapped = Object.values(mapping).includes("company_name");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des clients</DialogTitle>
          <DialogDescription>
            Importez vos clients depuis un fichier Excel (.xlsx) ou CSV
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Format explanation */}
        {step === "format" && (
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Format du fichier attendu
              </h4>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Une ligne = un client</li>
                <li>• Une colonne = un champ client</li>
                <li>• La première ligne doit contenir les en-têtes de colonnes</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h5 className="font-medium text-sm mb-3 text-green-600 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Colonnes obligatoires
                </h5>
                <ul className="text-sm space-y-1">
                  {STANDARD_FIELDS.filter(f => f.required).map(f => (
                    <li key={f.key} className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">{f.label}</Badge>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border rounded-lg p-4">
                <h5 className="font-medium text-sm mb-3 text-muted-foreground">
                  Colonnes facultatives
                </h5>
                <div className="flex flex-wrap gap-1">
                  {STANDARD_FIELDS.filter(f => !f.required).map(f => (
                    <Badge key={f.key} variant="outline" className="text-xs">{f.label}</Badge>
                  ))}
                  {customFields.map(cf => (
                    <Badge key={cf.key} variant="secondary" className="text-xs">{cf.label}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <h5 className="font-medium text-sm mb-2 flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Gestion des doublons
              </h5>
              <p className="text-sm text-muted-foreground">
                Un client est considéré comme doublon si l'un des critères suivants est identique :
              </p>
              <ul className="text-sm mt-2 space-y-1 text-muted-foreground">
                <li>• Email identique</li>
                <li>• OU Société + Téléphone identiques</li>
                <li>• OU Société + Adresse identiques</li>
              </ul>
            </div>

            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                onClick={() => generateExampleFile(customFields)}
              >
                <Download className="mr-2 h-4 w-4" />
                Télécharger un exemple
              </Button>
              <Button variant="accent" onClick={() => setStep("upload")}>
                Continuer
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: File upload */}
        {step === "upload" && (
          <div className="space-y-6">
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
            <div className="flex justify-start">
              <Button variant="ghost" onClick={() => setStep("format")}>
                ← Retour
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Column mapping */}
        {step === "mapping" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">{allData.length} lignes détectées</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Mapper les colonnes</h4>
              <div className="grid gap-3 max-h-[40vh] overflow-y-auto pr-2">
                {headers.map((header) => (
                  <div key={header} className="flex items-center gap-4">
                    <div className="w-1/3 min-w-0">
                      <Badge variant="secondary" className="truncate max-w-full">{header}</Badge>
                      {previewData[0]?.[header] && (
                        <span className="ml-2 text-xs text-muted-foreground truncate">
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
                            {field.label} {field.required && "*"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {!hasCompanyNameMapped && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  La raison sociale doit être mappée pour continuer.
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("upload")}>
                ← Retour
              </Button>
              <Button 
                variant="accent" 
                onClick={analyzeData}
                disabled={!hasCompanyNameMapped || isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyse...
                  </>
                ) : (
                  "Analyser et prévisualiser"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Preview before import */}
        {step === "preview" && previewResult && (
          <div className="space-y-6">
            <h4 className="font-medium">Récapitulatif de l'import</h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{previewResult.totalRows}</p>
                  <p className="text-sm text-muted-foreground">Lignes totales</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <Users className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-500">{previewResult.newClients}</p>
                  <p className="text-sm text-muted-foreground">Nouveaux clients</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <RefreshCw className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold text-amber-500">{previewResult.duplicates.length}</p>
                  <p className="text-sm text-muted-foreground">Doublons détectés</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold text-destructive">{previewResult.errors.length}</p>
                  <p className="text-sm text-muted-foreground">Erreurs</p>
                </div>
              </div>
            </div>

            {previewResult.duplicates.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">Gestion des doublons</h5>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="update-duplicates"
                      checked={updateDuplicates}
                      onCheckedChange={setUpdateDuplicates}
                    />
                    <Label htmlFor="update-duplicates" className="text-sm">
                      Mettre à jour les doublons au lieu de les ignorer
                    </Label>
                  </div>
                </div>
                
                <div className="border rounded-lg max-h-32 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Ligne</th>
                        <th className="text-left p-2">Raison du doublon</th>
                        <th className="text-left p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewResult.duplicates.slice(0, 10).map((dup, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{dup.rowIndex}</td>
                          <td className="p-2 text-muted-foreground">{dup.reason}</td>
                          <td className="p-2">
                            <Badge variant={updateDuplicates ? "default" : "secondary"}>
                              {updateDuplicates ? "Mise à jour" : "Ignoré"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewResult.duplicates.length > 10 && (
                    <p className="text-xs text-muted-foreground p-2 border-t">
                      ... et {previewResult.duplicates.length - 10} autres doublons
                    </p>
                  )}
                </div>
              </div>
            )}

            {previewResult.errors.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-medium text-sm text-destructive">Erreurs (lignes ignorées)</h5>
                <div className="border border-destructive/20 rounded-lg max-h-24 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {previewResult.errors.slice(0, 5).map((err, idx) => (
                        <tr key={idx} className="border-t first:border-t-0">
                          <td className="p-2 w-20">Ligne {err.rowIndex}</td>
                          <td className="p-2 text-destructive">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <h5 className="font-medium text-sm mb-2">Résultat attendu après import</h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <span className="text-green-600 font-medium">{previewResult.newClients}</span> nouveaux clients seront créés</li>
                <li>• <span className="text-amber-600 font-medium">{updateDuplicates ? previewResult.duplicates.length : 0}</span> clients seront mis à jour</li>
                <li>• <span className="text-muted-foreground font-medium">{updateDuplicates ? 0 : previewResult.duplicates.length}</span> doublons seront ignorés</li>
                <li>• <span className="text-destructive font-medium">{previewResult.errors.length}</span> lignes en erreur seront ignorées</li>
              </ul>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("mapping")}>
                ← Retour au mapping
              </Button>
              <Button 
                variant="accent" 
                onClick={handleImport}
                disabled={previewResult.newClients === 0 && (previewResult.duplicates.length === 0 || !updateDuplicates)}
              >
                Confirmer l'import
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Import en cours...</p>
          </div>
        )}

        {/* Step 6: Result */}
        {step === "result" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-500">{result.created}</p>
                  <p className="text-sm text-muted-foreground">Créés</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <RefreshCw className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-blue-500">{result.updated}</p>
                  <p className="text-sm text-muted-foreground">Mis à jour</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                <Ban className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{result.skipped}</p>
                  <p className="text-sm text-muted-foreground">Ignorés</p>
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
