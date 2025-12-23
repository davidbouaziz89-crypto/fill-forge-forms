import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  UserCog,
  FormInput,
  LogOut,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Templates PDF", href: "/templates", icon: FileText, adminOnly: true },
  { label: "Champs personnalisés", href: "/custom-fields", icon: FormInput, adminOnly: true },
  { label: "Utilisateurs", href: "/users", icon: UserCog, adminOnly: true },
];

interface AppSidebarProps {
  userRole?: "admin" | "sales";
  userName?: string;
  onLogout?: () => void;
}

export function AppSidebar({ userRole = "admin", userName = "Utilisateur", onLogout }: AppSidebarProps) {
  const location = useLocation();

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || userRole === "admin"
  );

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">DocuCRM</h1>
          <p className="text-xs text-sidebar-muted">Gestion documentaire</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-3 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{userName}</p>
            <p className="text-xs text-sidebar-muted capitalize">
              {userRole === "admin" ? "Administrateur" : "Commercial"}
            </p>
          </div>
        </div>
        <Button
          variant="sidebar-ghost"
          size="sm"
          className="w-full justify-start gap-3"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </aside>
  );
}
