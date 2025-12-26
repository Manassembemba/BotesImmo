import { z } from 'zod';

export const tenantSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est requis").max(100, "Le nom doit faire moins de 100 caractères"),
  prenom: z.string().trim().min(1, "Le prénom est requis").max(100, "Le prénom doit faire moins de 100 caractères"),
  email: z.string().trim().email("Email invalide").max(255, "L'email doit faire moins de 255 caractères").optional().or(z.literal('')),
  telephone: z.string().trim().max(20, "Le téléphone doit faire moins de 20 caractères").optional().or(z.literal('')),
  id_document: z.string().trim().max(50, "L'identifiant doit faire moins de 50 caractères").optional().or(z.literal('')),
  notes: z.string().trim().max(500, "Les notes doivent faire moins de 500 caractères").optional().or(z.literal('')),
  liste_noire: z.boolean(),
});

export const roomSchema = z.object({
  numero: z.string().trim().min(1, "Le numéro est requis").max(20, "Le numéro doit faire moins de 20 caractères"),
  type: z.enum(['SINGLE', 'DOUBLE', 'SUITE', 'STUDIO'], { required_error: "Le type est requis" }),
  floor: z.number().int().min(0, "L'étage doit être positif").max(100, "L'étage doit être inférieur à 100"),
  capacite_max: z.number().int().min(1, "La capacité minimum est 1").max(20, "La capacité maximum est 20"),
  prix_base_nuit: z.number().positive("Le prix par nuit doit être positif").max(100000, "Le prix par nuit doit être inférieur à 100 000€"),
  prix_base_semaine: z.number().positive("Le prix par semaine doit être positif").max(500000, "Le prix par semaine doit être inférieur à 500 000€").nullable().optional(),
  prix_base_mois: z.number().positive("Le prix par mois doit être positif").max(1000000, "Le prix par mois doit être inférieur à 1 000 000€").nullable().optional(),
  description: z.string().trim().max(1000, "La description doit faire moins de 1000 caractères").optional().or(z.literal('')),
  location_id: z.string().uuid().optional().nullable(), // Référence vers la localisation
});

export const bookingSchema = z.object({
  room_id: z.string().uuid("Chambre invalide"),
  tenant_id: z.string().uuid("Locataire invalide"),
  date_debut_prevue: z.string().min(1, "La date d'arrivée est requise"),
  date_fin_prevue: z.string().min(1, "La date de départ est requise"),
  prix_total: z.number().positive("Le prix total doit être positif").max(1000000, "Le prix total doit être inférieur à 1 000 000€"),
  notes: z.string().trim().max(500, "Les notes doivent faire moins de 500 caractères").optional().or(z.literal('')),
  status: z.enum(['PENDING', 'CONFIRMED']),
  discount_amount: z.number().min(0, "La réduction ne peut être négative").optional(),
  initial_payment: z.number().min(0, "Le paiement ne peut être négatif").optional(),
}).refine(data => {
  const start = new Date(data.date_debut_prevue);
  const end = new Date(data.date_fin_prevue);
  return end > start;
}, {
  message: "La date de départ doit être après la date d'arrivée",
  path: ["date_fin_prevue"],
});

export type TenantFormData = z.infer<typeof tenantSchema>;
export type RoomFormData = z.infer<typeof roomSchema>;
export type BookingFormData = z.infer<typeof bookingSchema>;

export const paymentSchema = z.object({
  invoice_id: z.string().uuid("Facture invalile").optional().nullable(),
  montant: z.number({ invalid_type_error: "Le montant doit être un nombre." }).positive("Le montant doit être positif.").max(1000000, "Le montant doit être inférieur à 1 000 000$"),
  date_paiement: z.string().min(1, "La date de paiement est requise"),
  methode: z.enum(['CB', 'CASH', 'TRANSFERT', 'CHEQUE'], { required_error: "La méthode est requise" }),
  notes: z.string().trim().max(500, "Les notes doivent faire moins de 500 caractères").optional().or(z.literal('')),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;
