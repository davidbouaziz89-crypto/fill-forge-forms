import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
  userRole?: "admin" | "sales";
  userName?: string;
  onLogout?: () => void;
}

export function AppLayout({ children, userRole = "admin", userName = "Utilisateur", onLogout }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar userRole={userRole} userName={userName} onLogout={onLogout} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
