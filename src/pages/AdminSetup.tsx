import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AdminSetup() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      // Check if any admin exists
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      setHasAdmin((adminRoles?.length ?? 0) > 0);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser({ id: user.id, email: user.email ?? "" });
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const promoteToAdmin = async () => {
    if (!currentUser) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté",
        variant: "destructive",
      });
      return;
    }

    setIsPromoting(true);
    try {
      // Check again if admin exists (race condition prevention)
      const { data: existingAdmins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if ((existingAdmins?.length ?? 0) > 0) {
        toast({
          title: "Erreur",
          description: "Un administrateur existe déjà",
          variant: "destructive",
        });
        setHasAdmin(true);
        return;
      }

      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (existingRole) {
        // Update existing role to admin
        const { error } = await supabase
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", currentUser.id);

        if (error) throw error;
      } else {
        // Insert new admin role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: currentUser.id, role: "admin" });

        if (error) throw error;
      }

      toast({
        title: "Succès !",
        description: "Vous êtes maintenant administrateur. Rechargez la page.",
      });

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch (error: any) {
      console.error("Error promoting to admin:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de vous promouvoir administrateur",
        variant: "destructive",
      });
    } finally {
      setIsPromoting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <CardTitle>Non connecté</CardTitle>
            <CardDescription>
              Vous devez être connecté pour accéder à cette page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-success" />
            <CardTitle>Administrateur existant</CardTitle>
            <CardDescription>
              Un administrateur existe déjà. Contactez-le pour obtenir les droits d'administration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/dashboard")}>
              Retour au tableau de bord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <CardTitle>Configuration administrateur</CardTitle>
          <CardDescription>
            Aucun administrateur n'existe encore. Vous pouvez vous définir comme administrateur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Compte actuel : <strong>{currentUser.email}</strong>
            </p>
          </div>
          <Button
            className="w-full"
            onClick={promoteToAdmin}
            disabled={isPromoting}
          >
            {isPromoting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Promotion en cours...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Me définir administrateur
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
