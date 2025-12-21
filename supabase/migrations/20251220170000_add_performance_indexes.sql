-- This migration adds indexes to frequently queried columns to improve performance.

-- === FOREIGN KEY INDEXES ===
-- These speed up JOIN operations between tables.

CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON public.bookings (room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON public.bookings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_tasks_room_id ON public.tasks (room_id);
CREATE INDEX IF NOT EXISTS idx_incidents_room_id ON public.incidents (room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_location_id ON public.rooms (location_id);


-- === STATUS & DATE INDEXES ===
-- These speed up filtering and searching based on status or dates.

CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_date_fin_prevue ON public.bookings (date_fin_prevue);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms (status);


-- === SEARCH INDEXES ===
-- These speed up common search operations, like finding a tenant.

-- A composite index on nom and prenom for faster tenant searches.
CREATE INDEX IF NOT EXISTS idx_tenants_nom_prenom ON public.tenants (nom, prenom);

COMMENT ON INDEX idx_bookings_room_id IS 'Improves performance of joins between bookings and rooms.';
COMMENT ON INDEX idx_rooms_status IS 'Speeds up queries filtering rooms by their status (e.g., finding AVAILABLE rooms).';
