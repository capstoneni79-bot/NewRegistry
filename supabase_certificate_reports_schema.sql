-- ============================================================================
-- DA Hinunangan Swine Registry & Biosurveillance System
-- Complete PostgreSQL / Supabase Database Schema for Official Reports & Certificates
-- ============================================================================

BEGIN;

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Barangays Reference Table
CREATE TABLE IF NOT EXISTS public.barangays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    municipality TEXT DEFAULT 'Hinunangan',
    province TEXT DEFAULT 'Southern Leyte',
    region TEXT DEFAULT 'Region VIII',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Certificate Templates Table (Custom Layouts, Signatories, Watermarks, HTML Body)
CREATE TABLE IF NOT EXISTS public.certificate_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barangay_id UUID REFERENCES public.barangays(id) ON DELETE SET NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    template_body TEXT NOT NULL,
    css_styles JSONB NOT NULL DEFAULT '{}'::jsonb,
    template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Issued Certificates & Movement Permits Table
CREATE TABLE IF NOT EXISTS public.issued_certificates (
    id TEXT PRIMARY KEY,
    control_number TEXT NOT NULL UNIQUE,
    swine_id TEXT,
    farmer_name TEXT NOT NULL,
    barangay TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    purpose TEXT NOT NULL,
    destination TEXT,
    inspected_by TEXT NOT NULL,
    qr_payload TEXT,
    valid_until TEXT,
    status TEXT NOT NULL DEFAULT 'VALID',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Signatories Table
CREATE TABLE IF NOT EXISTS public.signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    position_title TEXT NOT NULL,
    office TEXT,
    signature_image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Certificate Signatories Junction Table
CREATE TABLE IF NOT EXISTS public.certificate_signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.certificate_templates(id) ON DELETE CASCADE,
    signatory_id UUID REFERENCES public.signatories(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_id, signatory_id)
);

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_certificate_templates_code ON public.certificate_templates(code);
CREATE INDEX IF NOT EXISTS idx_certificate_templates_barangay ON public.certificate_templates(barangay_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_control ON public.issued_certificates(control_number);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_barangay ON public.issued_certificates(barangay);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.barangays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issued_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_signatories ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for Authenticated Access & Public Read/Write for App Users
DROP POLICY IF EXISTS "Allow read access to barangays" ON public.barangays;
CREATE POLICY "Allow read access to barangays" ON public.barangays FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all access to certificate_templates" ON public.certificate_templates;
CREATE POLICY "Allow all access to certificate_templates" ON public.certificate_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to issued_certificates" ON public.issued_certificates;
CREATE POLICY "Allow all access to issued_certificates" ON public.issued_certificates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to signatories" ON public.signatories;
CREATE POLICY "Allow all access to signatories" ON public.signatories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to certificate_signatories" ON public.certificate_signatories;
CREATE POLICY "Allow all access to certificate_signatories" ON public.certificate_signatories FOR ALL USING (true) WITH CHECK (true);

COMMIT;
