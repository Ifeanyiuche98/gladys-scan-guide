CREATE TABLE public.scan_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_hash TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_hash, usage_date)
);

CREATE INDEX idx_scan_usage_lookup ON public.scan_usage (client_hash, usage_date);

ALTER TABLE public.scan_usage ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated roles. Only service role (used by edge functions) can read/write.
