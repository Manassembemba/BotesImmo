// interfaces/Address.ts
export interface Address {
  id?: string;
  address_line1: string;       // Adresse principale (ex: "Avenue Lumumba, N°15")
  address_line2?: string;      // Complément d'adresse (ex: "Appartement 2B")
  city: string;                // Ville (ex: "Kinshasa")
  province?: string;           // Province/État (ex: "Kinshasa")
  country: string;             // Pays (ex: "RDC")
  postal_code?: string;        // Code postal (ex: "12345")
  latitude?: number;           // Latitude pour géolocalisation
  longitude?: number;          // Longitude pour géolocalisation
  created_at?: string;
  updated_at?: string;
}

export interface RoomWithAddress extends Room {
  address?: Address;
}

export interface AddressFormData {
  address_line1: string;
  address_line2?: string;
  city: string;
  province?: string;
  country: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
}