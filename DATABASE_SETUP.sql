DROP TABLE IF EXISTS public.defects CASCADE;

CREATE TABLE public.defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  defect_type TEXT NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  image_url TEXT,
  image_path TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_defects_detected_at ON public.defects(detected_at DESC);
CREATE INDEX idx_defects_device_id ON public.defects(device_id);
CREATE INDEX idx_defects_status ON public.defects(status);
CREATE INDEX idx_defects_defect_type ON public.defects(defect_type);

ALTER PUBLICATION supabase_realtime ADD TABLE public.defects;

ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all" ON public.defects FOR SELECT USING (true);
CREATE POLICY "Allow insert all" ON public.defects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update all" ON public.defects FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete all" ON public.defects FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_defects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS defects_update_timestamp ON public.defects;

CREATE TRIGGER defects_update_timestamp
  BEFORE UPDATE ON public.defects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_defects_updated_at();

CREATE OR REPLACE VIEW public.defect_statistics AS
SELECT 
  COUNT(*) as total_defects,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed_count,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
  COUNT(DISTINCT device_id) as unique_devices,
  COUNT(DISTINCT defect_type) as unique_defect_types,
  MAX(detected_at) as latest_detection
FROM public.defects;

CREATE OR REPLACE VIEW public.defects_by_type AS
SELECT 
  defect_type,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved
FROM public.defects
GROUP BY defect_type
ORDER BY count DESC;
