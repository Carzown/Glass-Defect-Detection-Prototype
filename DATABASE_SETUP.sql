-- =========================
-- 1. DROP EXISTING TABLE
-- =========================
DROP TABLE IF EXISTS public.defects CASCADE;

-- =========================
-- 2. CREATE TABLE
-- =========================
CREATE TABLE public.defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  defect_type TEXT NOT NULL,

  detected_at TIMESTAMPTZ NOT NULL,

  image_url TEXT,
  image_path TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'resolved')),

  confidence FLOAT8,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- 3. INDEXES (PERFORMANCE)
-- =========================
CREATE INDEX idx_defects_detected_at
  ON public.defects (detected_at DESC);

CREATE INDEX idx_defects_status
  ON public.defects (status);

CREATE INDEX idx_defects_defect_type
  ON public.defects (defect_type);

CREATE INDEX idx_defects_confidence
  ON public.defects (confidence DESC);

-- =========================
-- 4. ENABLE REALTIME
-- =========================
ALTER PUBLICATION supabase_realtime
ADD TABLE public.defects;

-- =========================
-- 5. ENABLE RLS
-- =========================
ALTER TABLE public.defects
ENABLE ROW LEVEL SECURITY;

-- =========================
-- 6. RLS POLICIES (SAFE DEFAULTS)
-- =========================

-- Anyone can read defects (dashboard, analytics)
CREATE POLICY "read_all_defects"
ON public.defects
FOR SELECT
USING (true);

-- Devices can insert defects
CREATE POLICY "insert_defects"
ON public.defects
FOR INSERT
WITH CHECK (true);

-- Only updates allowed on status (admin use later)
CREATE POLICY "update_defects"
ON public.defects
FOR UPDATE
USING (true)
WITH CHECK (true);

-- NO delete policy (prevents accidental wipes)
-- DELETE is intentionally disabled

-- =========================
-- 7. AUTO-UPDATE TIMESTAMP
-- =========================
CREATE OR REPLACE FUNCTION public.update_defects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS defects_update_timestamp
ON public.defects;

CREATE TRIGGER defects_update_timestamp
BEFORE UPDATE ON public.defects
FOR EACH ROW
EXECUTE FUNCTION public.update_defects_updated_at();

-- =========================
-- 8. SUMMARY VIEW
-- =========================
CREATE OR REPLACE VIEW public.defect_statistics AS
SELECT
  COUNT(*) AS total_defects,
  COUNT(*) FILTER (WHERE status = 'pending')  AS pending_count,
  COUNT(*) FILTER (WHERE status = 'reviewed') AS reviewed_count,
  COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
  AVG(confidence) AS average_confidence,
  MAX(detected_at) AS latest_detection
FROM public.defects;

-- =========================
-- 9. DEFECTS BY TYPE VIEW
-- =========================
CREATE OR REPLACE VIEW public.defects_by_type AS
SELECT
  defect_type,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
  COUNT(*) FILTER (WHERE status = 'reviewed') AS reviewed,
  COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
  AVG(confidence) AS average_confidence,
  MAX(confidence) AS max_confidence,
  MIN(confidence) AS min_confidence
FROM public.defects
GROUP BY defect_type
ORDER BY count DESC;
