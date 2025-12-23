-- =============================================
-- DocuCRM Database Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. User Roles (stored separately for security)
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'sales');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'sales',
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own role" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- 2. Profiles table
-- =============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- 3. Clients table
-- =============================================
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    zip TEXT,
    city TEXT,
    country TEXT DEFAULT 'France',
    assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all clients" ON public.clients
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales can view assigned clients" ON public.clients
FOR SELECT USING (
    public.has_role(auth.uid(), 'sales') AND assigned_user_id = auth.uid()
);

CREATE POLICY "Sales can update assigned clients" ON public.clients
FOR UPDATE USING (
    public.has_role(auth.uid(), 'sales') AND assigned_user_id = auth.uid()
);

-- =============================================
-- 4. Custom Fields definition
-- =============================================
CREATE TYPE public.field_type AS ENUM ('text', 'number', 'date', 'select', 'boolean');
CREATE TYPE public.field_visibility AS ENUM ('admin_only', 'editable', 'read_only');

CREATE TABLE public.custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    type field_type NOT NULL DEFAULT 'text',
    options_json JSONB DEFAULT '[]'::jsonb,
    required_bool BOOLEAN DEFAULT false,
    default_value TEXT,
    visibility field_visibility DEFAULT 'editable',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage custom fields" ON public.custom_fields
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view custom fields" ON public.custom_fields
FOR SELECT TO authenticated USING (true);

-- =============================================
-- 5. Client Custom Values
-- =============================================
CREATE TABLE public.client_custom_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    custom_field_id UUID REFERENCES public.custom_fields(id) ON DELETE CASCADE NOT NULL,
    value_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, custom_field_id)
);

ALTER TABLE public.client_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all custom values" ON public.client_custom_values
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales can view custom values for assigned clients" ON public.client_custom_values
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.clients 
        WHERE clients.id = client_custom_values.client_id 
        AND clients.assigned_user_id = auth.uid()
    )
);

CREATE POLICY "Sales can update editable custom values for assigned clients" ON public.client_custom_values
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.clients 
        WHERE clients.id = client_custom_values.client_id 
        AND clients.assigned_user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.custom_fields 
        WHERE custom_fields.id = client_custom_values.custom_field_id 
        AND custom_fields.visibility = 'editable'
    )
);

-- =============================================
-- 6. PDF Templates
-- =============================================
CREATE TABLE public.pdf_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    source_pdf_storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates" ON public.pdf_templates
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "All authenticated can view templates" ON public.pdf_templates
FOR SELECT TO authenticated USING (true);

-- =============================================
-- 7. PDF Template Fields (mapping zones)
-- =============================================
CREATE TYPE public.field_source AS ENUM ('standard', 'custom');
CREATE TYPE public.text_transform AS ENUM ('none', 'uppercase', 'lowercase', 'capitalize');
CREATE TYPE public.text_align AS ENUM ('left', 'center', 'right');

CREATE TABLE public.pdf_template_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.pdf_templates(id) ON DELETE CASCADE NOT NULL,
    field_source field_source NOT NULL DEFAULT 'standard',
    field_key TEXT NOT NULL,
    page INTEGER NOT NULL DEFAULT 1,
    x NUMERIC NOT NULL DEFAULT 0,
    y NUMERIC NOT NULL DEFAULT 0,
    width NUMERIC,
    height NUMERIC,
    font_size INTEGER DEFAULT 12,
    align text_align DEFAULT 'left',
    transform text_transform DEFAULT 'none',
    fallback_value TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pdf_template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage template fields" ON public.pdf_template_fields
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "All authenticated can view template fields" ON public.pdf_template_fields
FOR SELECT TO authenticated USING (true);

-- =============================================
-- 8. Generated Documents
-- =============================================
CREATE TABLE public.generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES public.pdf_templates(id) ON DELETE SET NULL,
    generated_pdf_storage_path TEXT NOT NULL,
    generated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    meta_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all documents" ON public.generated_documents
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales can view documents for assigned clients" ON public.generated_documents
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.clients 
        WHERE clients.id = generated_documents.client_id 
        AND clients.assigned_user_id = auth.uid()
    )
);

CREATE POLICY "Sales can create documents for assigned clients" ON public.generated_documents
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.clients 
        WHERE clients.id = generated_documents.client_id 
        AND clients.assigned_user_id = auth.uid()
    )
    AND generated_by_user_id = auth.uid()
);

-- =============================================
-- 9. Triggers for updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pdf_templates_updated_at
    BEFORE UPDATE ON public.pdf_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_custom_values_updated_at
    BEFORE UPDATE ON public.client_custom_values
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 10. Trigger to auto-create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 11. Storage buckets
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('pdf-templates', 'pdf-templates', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-documents', 'generated-documents', false);

-- Storage policies for pdf-templates (admin only)
CREATE POLICY "Admins can manage pdf templates storage" ON storage.objects
FOR ALL USING (bucket_id = 'pdf-templates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read pdf templates storage" ON storage.objects
FOR SELECT USING (bucket_id = 'pdf-templates' AND auth.role() = 'authenticated');

-- Storage policies for generated-documents
CREATE POLICY "Admins can manage generated documents storage" ON storage.objects
FOR ALL USING (bucket_id = 'generated-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read their generated documents" ON storage.objects
FOR SELECT USING (
    bucket_id = 'generated-documents' 
    AND (
        public.has_role(auth.uid(), 'admin')
        OR EXISTS (
            SELECT 1 FROM public.generated_documents gd
            JOIN public.clients c ON gd.client_id = c.id
            WHERE gd.generated_pdf_storage_path = name
            AND c.assigned_user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can upload generated documents" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'generated-documents' 
    AND auth.role() = 'authenticated'
);