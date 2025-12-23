import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import FieldsSettings from "./pages/settings/FieldsSettings";
import TemplatesSettings from "./pages/settings/TemplatesSettings";
import UsersSettings from "./pages/settings/UsersSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <ProtectedRoute>
                  <Clients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients/:id"
              element={
                <ProtectedRoute>
                  <ClientDetail />
                </ProtectedRoute>
              }
            />
            {/* Settings routes - Admin only */}
            <Route
              path="/settings/fields"
              element={
                <ProtectedRoute requiredRole="admin">
                  <FieldsSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/templates"
              element={
                <ProtectedRoute requiredRole="admin">
                  <TemplatesSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <UsersSettings />
                </ProtectedRoute>
              }
            />
            {/* Redirects for old routes */}
            <Route path="/templates" element={<Navigate to="/settings/templates" replace />} />
            <Route path="/users" element={<Navigate to="/settings/users" replace />} />
            <Route path="/custom-fields" element={<Navigate to="/settings/fields" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
