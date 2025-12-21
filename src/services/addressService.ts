import { Address, AddressFormData } from '@/interfaces/Address';

/**
 * Service de géocodage simulé
 * En production, cela pourrait être connecté à une API de géocodage comme Google Maps ou OpenStreetMap
 */
export const geocodeAddress = async (address: AddressFormData): Promise<{ latitude: number; longitude: number } | null> => {
  // Simulation d'un service de géocodage
  // En production, ceci serait remplacé par un appel réel à une API de géocodage
  try {
    // Ici, on simulerait un appel à une API de géocodage
    // Pour l'instant, retournons des coordonnées fictives pour Kinshasa, RDC
    return {
      latitude: -4.441939,  // Coordonnées approximatives pour Kinshasa
      longitude: 15.266293
    };
  } catch (error) {
    console.error('Erreur de géocodage:', error);
    return null;
  }
};

/**
 * Formater une adresse complète en chaîne de caractères
 */
export const formatFullAddress = (address: Address): string => {
  const parts = [
    address.address_line1,
    address.address_line2,
    address.city,
    address.province,
    address.postal_code,
    address.country
  ].filter(part => part && part.trim() !== '');
  
  return parts.join(', ');
};

/**
 * Valider les données d'adresse
 */
export const validateAddress = (address: AddressFormData): { isValid: boolean; errors?: Record<string, string> } => {
  const errors: Record<string, string> = {};
  
  if (!address.address_line1 || address.address_line1.trim().length < 3) {
    errors.address_line1 = 'Adresse principale requise (min. 3 caractères)';
  }
  
  if (!address.city || address.city.trim().length < 2) {
    errors.city = 'Ville requise (min. 2 caractères)';
  }
  
  if (!address.country || address.country.trim().length < 2) {
    errors.country = 'Pays requis (min. 2 caractères)';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined
  };
};

/**
 * Normaliser les données d'adresse
 */
export const normalizeAddress = (address: AddressFormData): AddressFormData => {
  return {
    ...address,
    address_line1: address.address_line1.trim(),
    address_line2: address.address_line2?.trim(),
    city: address.city.trim(),
    province: address.province?.trim(),
    country: address.country.trim(),
    postal_code: address.postal_code?.trim()
  };
};