-- Create settings table for exchange rate and other app settings
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key varchar(50) NOT NULL UNIQUE,
  value jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Viewable by all authenticated users
CREATE POLICY "Settings viewable by authenticated users"
  ON public.settings
  FOR SELECT
  USING (public.is_authenticated());

-- Only admins can modify settings
CREATE POLICY "Settings manageable by admin"
  ON public.settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Add trigger for updated_at
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default exchange rate (1 USD = 2800 CDF approx)
INSERT INTO public.settings (key, value) 
VALUES ('exchange_rate', '{"usd_to_cdf": 2800}'::jsonb);