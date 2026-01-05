import { Database as GeneratedDatabase } from './types';

type PublicDatabase = GeneratedDatabase['public'];

export type Database = Omit<GeneratedDatabase, 'public'> & {
    public: Omit<PublicDatabase, 'Views' | 'Functions'> & {
        Views: PublicDatabase['Views'] & {
            [key: string]: any;
            caisse_daily_summary: {
                Row: {
                    date: string;
                    total_usd: number;
                    total_cdf: number;
                    total_equivalent_usd: number;
                    nombre_paiements: number;
                    methodes_utilisees: string[];
                };
                Insert: {
                    date?: string;
                    total_usd?: number;
                    total_cdf?: number;
                    total_equivalent_usd?: number;
                    nombre_paiements?: number;
                    methodes_utilisees?: string[];
                };
                Update: {
                    date?: string;
                    total_usd?: number;
                    total_cdf?: number;
                    total_equivalent_usd?: number;
                    nombre_paiements?: number;
                    methodes_utilisees?: string[];
                };
                Relationships: [];
            };
        };
        Functions: PublicDatabase['Functions'] & {
            [key: string]: any;
            create_booking_and_checkin: {
                Args: any;
                Returns: any;
            };
            create_booking_with_invoice_atomic: {
                Args: any;
                Returns: any;
            };
        };
    };
};
