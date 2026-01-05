import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OverdueDebt {
    booking_id: string;
    tenant_id: string;
    tenant_name: string;
    room_id: string;
    room_number: string;
    date_debut_prevue: string;
    date_fin_prevue: string;
    prix_total: number;
    report_date: string;
    overdue_days: number;
    daily_rate: number;
    debt_amount: number;
}

export function useOverdueDebts() {
    return useQuery({
        queryKey: ['overdue_debts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('booking_overdue_debts')
                .select('*')
                .order('overdue_days', { ascending: false });

            if (error) throw error;
            return data as OverdueDebt[];
        },
    });
}
