-- Corrige le problème de cast en supprimant la valeur par défaut avant la modification.
ALTER TABLE public.rooms ALTER COLUMN status DROP DEFAULT;

-- Renomme l'ancien ENUM pour le sauvegarder, au cas où il existe. Le nom peut varier.
-- Cette commande peut échouer si 'room_status' n'existe pas, c'est pourquoi nous la rendons plus robuste.
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN
      ALTER TYPE public.room_status RENAME TO room_status_old;
   END IF;
END$$;

-- Crée le nouvel ENUM avec les valeurs finales souhaitées
CREATE TYPE public.room_status AS ENUM (
    'Libre',
    'Occupé',
    'Nettoyage',
    'Maintenance'
);

-- Met à jour la colonne 'status' de la table 'rooms' pour utiliser le nouvel ENUM
-- et mappe les anciennes valeurs (de room_status_old) aux nouvelles.
ALTER TABLE public.rooms
ALTER COLUMN status SET DATA TYPE public.room_status
USING (
    CASE
        WHEN status::text IN ('Available', 'BOOKED', 'LIBRE') THEN 'Libre'::public.room_status
        WHEN status::text IN ('Occupied', 'PENDING_CHECKOUT', 'OCCUPIED', 'OCCUPE') THEN 'Occupé'::public.room_status
        WHEN status::text IN ('Needs Cleaning', 'Cleaning in Progress', 'PENDING_CLEANING', 'A_NETTOYER') THEN 'Nettoyage'::public.room_status
        WHEN status::text IN ('Under Maintenance', 'MAINTENANCE') THEN 'Maintenance'::public.room_status
        ELSE 'Libre'::public.room_status -- Sécurité pour tout autre cas non géré
    END
);

-- Définit la nouvelle valeur par défaut pour la colonne
ALTER TABLE public.rooms ALTER COLUMN status SET DEFAULT 'Libre'::public.room_status;

-- Supprime les anciens types ENUM qui ne sont plus utilisés
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status_old') THEN
      DROP TYPE public.room_status_old;
   END IF;
   IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'new_room_status') THEN
      DROP TYPE public.new_room_status;
   END IF;
END$$;
