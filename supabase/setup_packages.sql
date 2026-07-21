-- Table: box_types (รูปแบบกล่อง)
CREATE TABLE IF NOT EXISTS public.box_types (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1,
    image_url TEXT,
    box_code TEXT UNIQUE, -- เพิ่มรหัสกล่องแบบระบุเฉพาะเจาะจง
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- เพิ่มคอลัมน์รหัสกล่องกรณีตารางมีอยู่แล้ว
ALTER TABLE public.box_types ADD COLUMN IF NOT EXISTS box_code TEXT UNIQUE;

-- Table: price_sets (เซ็ตราคา)
CREATE TABLE IF NOT EXISTS public.price_sets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    set_price NUMERIC NOT NULL,
    dessert_qty INTEGER NOT NULL DEFAULT 1,
    drink_qty INTEGER NOT NULL DEFAULT 0, -- เพิ่มจำนวนเครื่องดื่ม
    allowed_boxes JSONB DEFAULT '[]'::jsonb,
    allowed_dessert_max_price NUMERIC NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- เพิ่มหมวดหมู่ให้กับตารางสินค้า (products) เดิมที่มีอยู่แล้ว
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'dessert';

-- Policies (RLS)
ALTER TABLE public.box_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for box_types" ON public.box_types FOR SELECT USING (true);
CREATE POLICY "Allow public insert for box_types" ON public.box_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for box_types" ON public.box_types FOR UPDATE USING (true);
CREATE POLICY "Allow public delete for box_types" ON public.box_types FOR DELETE USING (true);

CREATE POLICY "Allow public read access for price_sets" ON public.price_sets FOR SELECT USING (true);
CREATE POLICY "Allow public insert for price_sets" ON public.price_sets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for price_sets" ON public.price_sets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete for price_sets" ON public.price_sets FOR DELETE USING (true);
