import { FileText, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Document {
  id: string;
  clientName: string;
  templateName: string;
  createdAt: string;
  generatedBy: string;
}

interface RecentDocumentsProps {
  documents: Document[];
}

export function RecentDocuments({ documents }: RecentDocumentsProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Documents récents</h2>
        </div>
        <Button variant="ghost" size="sm">
          Voir tout
        </Button>
      </div>
      <div className="divide-y divide-border">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">Aucun document généré</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{doc.clientName}</p>
                  <p className="text-sm text-muted-foreground">{doc.templateName}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-foreground">{doc.createdAt}</p>
                  <p className="text-xs text-muted-foreground">par {doc.generatedBy}</p>
                </div>
                <Button variant="ghost" size="icon-sm">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
