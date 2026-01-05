import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BookingFinancialSummary {
    booking_id: string;
    booking_total_price: number;
    total_invoiced: number;
    total_paid: number;
    balance_due: number;
    invoice_count: number;
    payment_count: number;
    last_invoice_date: string | null;
    last_payment_date: string | null;
}

export function useBookingFinancialSummary(bookingId: string | undefined) {
    return useQuery({
        queryKey: ['booking-financial-summary', bookingId],
        queryFn: async () => {
            if (!bookingId) return null;

            const { data, error } = await supabase
                .from('booking_financial_summary')
                .select('*')
                .eq('booking_id', bookingId)
                .single();

            if (error) throw error;
            return data as BookingFinancialSummary;
        },
        enabled: !!bookingId,
    });
}
