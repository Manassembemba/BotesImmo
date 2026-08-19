export interface Location {
  id: string;
  nom: string;           // Ex: "Immeuble A, Aile Nord", "Complexe Oasis", "Résidence ABC"
  adresse_ligne1: string;   // Ex: "Avenue du Commerce, N°15"
  adresse_ligne2?: string;  // Ex: "Appartement 2B, 3ème étage"
  ville: string;
  province?: string;
  pays: string;
  code_postal?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface LocationFormData {
  nom: string;
  adresse_ligne1: string;
  adresse_ligne2?: string;
  ville: string;
  province?: string;
  pays: string;
  code_postal?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
}