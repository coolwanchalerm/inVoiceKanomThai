-- Table: system_settings (การตั้งค่าระบบ)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default salted SHA-256 hash for PIN '147090'
INSERT INTO public.system_settings (key, value)
VALUES ('app_pin_hash', '"9d1f226465ad3fb7c9db5b88505c7ad73a9b74ffca737048b3ed3da2a7bf6711"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Policies (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read system_settings" ON public.system_settings;
CREATE POLICY "Allow public read system_settings" ON public.system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert system_settings" ON public.system_settings;
CREATE POLICY "Allow public insert system_settings" ON public.system_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update system_settings" ON public.system_settings;
CREATE POLICY "Allow public update system_settings" ON public.system_settings FOR UPDATE USING (true);
