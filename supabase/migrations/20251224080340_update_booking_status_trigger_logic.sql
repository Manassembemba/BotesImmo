CREATE OR REPLACE FUNCTION public.update_room_status_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT or UPDATE of a booking
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- If booking becomes CONFIRMED or PENDING, mark room as Occupé (to block it)
    IF NEW.status = 'CONFIRMED' OR NEW.status = 'PENDING' THEN
      UPDATE public.rooms
      SET status = 'Occupé' -- Use new enum value
      WHERE id = NEW.room_id AND rooms.status != 'Occupé' AND rooms.status != 'Maintenance'; -- Don't override Maintenance or already Occupé
    -- If booking is COMPLETED or CANCELLED, try to make room Libre
    ELSIF NEW.status = 'COMPLETED' OR NEW.status = 'CANCELLED' THEN
      -- Only set to Libre if no other active bookings (CONFIRMED, PENDING, CHECKED_IN) exist for this room
      IF NOT EXISTS (
        SELECT 1
        FROM public.bookings
        WHERE room_id = NEW.room_id
          AND status IN ('CONFIRMED', 'PENDING', 'CHECKED_IN') -- These statuses imply room is NOT Libre
          AND id != NEW.id -- Exclude the current booking being updated if it's an UPDATE operation
      ) THEN
        UPDATE public.rooms
        SET status = 'Libre' -- Use new enum value
        WHERE id = NEW.room_id AND rooms.status != 'Maintenance'; -- Don't override Maintenance
      END IF;
    END IF;
  -- Handle DELETE of a booking
  ELSIF (TG_OP = 'DELETE') THEN
    -- If no other active bookings exist for this room, make it LIBRE
    IF NOT EXISTS (
      SELECT 1
      FROM public.bookings
      WHERE room_id = OLD.room_id
        AND status IN ('CONFIRMED', 'PENDING', 'CHECKED_IN')
    ) THEN
      UPDATE public.rooms
      SET status = 'Libre' -- Use new enum value
      WHERE id = OLD.room_id AND rooms.status != 'Maintenance'; -- Don't override Maintenance
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
