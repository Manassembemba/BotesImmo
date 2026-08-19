import { useMemo } from 'react';
import { useBookings, type Booking } from '@/hooks/useBookings';
import { format, isFuture, isPast, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils'; // Assuming this is for conditional class names

interface RoomBookingsHistoryProps {
  roomId: string;
}

const getBookingStatusBadge = (booking: Booking) => {
  const today = new Date();
  const startDate = parseISO(booking.date_debut_prevue);
  const endDate = parseISO(booking.date_fin_prevue);

  // Consider IN_PROGRESS as current even if its end date is past
  if (booking.status === 'IN_PROGRESS') {
    return <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Actuelle</Badge>;
  } else if (isPast(endDate)) {
    return <Badge variant="outline" className="bg-gray-100 text-gray-700">Terminée</Badge>;
  } else if (isFuture(startDate)) {
    return <Badge variant="outline" className="bg-blue-100 text-blue-700">Future</Badge>;
  } else if ((isToday(startDate) || isPast(startDate)) && (isToday(endDate) || isFuture(endDate))) {
    return <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Actuelle</Badge>;
  }
  return <Badge variant="outline">{booking.status}</Badge>; // Fallback
};


export function RoomBookingsHistory({ roomId }: RoomBookingsHistoryProps) {
  const { data: bookingsData, isLoading } = useBookings();
  const bookings = bookingsData?.data || [];

  const roomBookings = useMemo(() => {
    return bookings
      .filter(booking => booking.room_id === roomId)
      .sort((a, b) => new Date(a.date_debut_prevue).getTime() - new Date(b.date_debut_prevue).getTime());
  }, [bookings, roomId]);

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Chargement des réservations...</div>;
  }

  if (roomBookings.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">Aucune réservation pour cet appartement.</div>;
  }

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Montant Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roomBookings.map((booking) => {
            try {
              const tenantName = booking.tenants ? `${booking.tenants.prenom || ''} ${booking.tenants.nom || ''}`.trim() : 'N/A';
              const startDate = booking.date_debut_prevue ? parseISO(booking.date_debut_prevue) : null;
              const endDate = booking.date_fin_prevue ? parseISO(booking.date_fin_prevue) : null;
              const formattedDates = (startDate && endDate)
                ? `${format(startDate, 'dd MMM yyyy', { locale: fr })} - ${format(endDate, 'dd MMM yyyy', { locale: fr })}`
                : 'Dates invalides';
              const totalAmount = booking.montant_total !== undefined && booking.montant_total !== null
                ? `${booking.montant_total.toFixed(2)} $`
                : 'N/A';

              return (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">
                    {tenantName}
                  </TableCell>
                  <TableCell>
                    {formattedDates}
                  </TableCell>
                  <TableCell>{getBookingStatusBadge(booking)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {totalAmount}
                  </TableCell>
                </TableRow>
              );
            } catch (error) {
              console.error("Error rendering booking row:", booking.id, error);
              return (
                <TableRow key={booking.id} className="bg-red-100">
                  <TableCell colSpan={4} className="text-center text-red-600">
                    Erreur d'affichage pour la réservation {booking.id}. Veuillez consulter la console.
                  </TableCell>
                </TableRow>
              );
            }
          })}
        </TableBody>
      </Table>
    </div>
  );
}
