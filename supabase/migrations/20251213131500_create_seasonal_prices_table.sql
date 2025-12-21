create table seasonal_prices (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- ex: "Haute Saison Été"
  start_date date not null,
  end_date date not null,
  percentage_adjustment integer, -- ex: +20 pour +20%, -10 pour -10%
  fixed_price_override decimal, -- S'il est rempli, remplace le prix de base
  room_type text, -- Appliquer à un type de chambre (facultatif)
  created_at timestamptz default now()
);

-- Add comment to the table
comment on table seasonal_prices is 'Table to store dynamic pricing rules (seasonal adjustments) as per CDC F1.2';
