import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRooms } from '@/hooks/useRooms';
import { useBookings } from '@/hooks/useBookings';
import { format, addDays, differenceInDays, isAfter, isBefore, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import { AvailabilityFilters } from '@/components/availability/AvailabilityFilters';
import { CalendarView } from '@/components/availability/CalendarView';
import { CardView } from '@/components/availability/CardView';
import { Button } from '@/components/ui/button';
import { Download, List, Grid, Calendar as CalendarIcon } from 'lucide-react';
import { exportAvailabilityData } from '@/services/availabilityExportService';
import { DateFilterType } from '@/hooks/useGlobalFilters';

const Availability = () => {
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
      const { data: bookingsResult, isLoading: bookingsLoading } = useBookings();
  const bookings = bookingsResult?.data || [];

  const [currentView, setCurrentView] = useState<'table' | 'calendar' | 'card'>('table');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    minPrice: 0,
    maxPrice: 10000,
    location: '',
    status: '',
    dateRange: 'today' as DateFilterType,
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined
  });

  const isLoading = roomsLoading || bookingsLoading;

  // Filter rooms based on filter criteria
  const filteredRooms = rooms.filter(room => {
    const matchesSearch = !filters.search ||
      room.numero.toLowerCase().includes(filters.search.toLowerCase()) ||
      room.type.toLowerCase().includes(filters.search.toLowerCase());

    const matchesPrice = room.prix_base_nuit >= filters.minPrice && room.prix_base_nuit <= filters.maxPrice;

    const matchesLocation = !filters.location || room.locations?.nom === filters.location;

    const matchesStatus = !filters.status || room.status === filters.status;

    return matchesSearch && matchesPrice && matchesLocation && matchesStatus;
  });

  // Calculate next availability for each room
  const roomAvailability = filteredRooms.map(room => {
    const today = new Date();

    // Get all active bookings for this room sorted by end date
    const roomBookings = bookings
      .filter(b => b.room_id === room.id && ['CONFIRMED', 'IN_PROGRESS'].includes(b.status))
      .sort((a, b) => new Date(a.date_fin_prevue).getTime() - new Date(b.date_fin_prevue).getTime());

    if (roomBookings.length === 0) {
      // Room is currently available
      return {
        ...room,
        nextAvailableDate: today,
        isAvailableNow: true,
        daysUntilAvailable: 0,
        currentBooking: null
      };
    }

    // Find the last booking's end date
    const lastBooking = roomBookings[roomBookings.length - 1];
    const endDate = parseISO(lastBooking.date_fin_prevue);

    const isAvailableNow = room.status === 'Libre';
    const daysUntilAvailable = isAvailableNow ? 0 : Math.max(0, differenceInDays(endDate, today));

    return {
      ...room,
      nextAvailableDate: isAvailableNow ? today : endDate,
      isAvailableNow,
      daysUntilAvailable,
      currentBooking: isAvailableNow ? null : lastBooking
    };
  });

  // Sort: available first, then by days until available
  const sortedRooms = [...roomAvailability].sort((a, b) => {
    if (a.isAvailableNow && !b.isAvailableNow) return -1;
    if (!a.isAvailableNow && b.isAvailableNow) return 1;
    return a.daysUntilAvailable - b.daysUntilAvailable;
  });

  // Handler for filter changes
  const handleFilterChange = (newFilters: {
    search: string;
    minPrice: number;
    maxPrice: number;
    location: string;
    status: string;
    dateRange: DateFilterType;
    startDate?: string;
    endDate?: string;
  }) => {
    setFilters(newFilters);
  };

  // Handler for export
  const handleExport = (format: 'csv' | 'pdf') => {
    exportAvailabilityData(
      filteredRooms,
      bookings,
      {
        format,
        includeBookings: true,
        includePricing: true,
        roomType: filters.roomType
      }
    );
  };

  if (isLoading) {
    return (
      <MainLayout title="Disponibilité" subtitle="Chargement...">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Chargement...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Disponibilité" subtitle="Prochaines disponibilités des appartements">
      <div className="space-y-6">
        {/* Filtres et boutons d'action */}
        <div className="bg-card rounded-lg border p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={currentView === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView('table')}
              >
                <List className="h-4 w-4 mr-2" />
                Tableau
              </Button>
              <Button
                variant={currentView === 'card' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView('card')}
              >
                <Grid className="h-4 w-4 mr-2" />
                Carte
              </Button>
              <Button
                variant={currentView === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView('calendar')}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Calendrier
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
          <AvailabilityFilters
            rooms={rooms}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Affichage selon la vue sélectionnée */}
        {currentView === 'table' && (
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    N°
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Nom & Numéro
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Localité
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Prochaine disponibilité
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Jours restants
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Prix / Nuit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedRooms.map((room, index) => (
                  <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">{room.numero}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{room.type}</p>
                          <p className="text-xs text-muted-foreground">Étage {room.etage}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {room.isAvailableNow ? (
                        <span className="inline-flex items-center rounded-md bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-400">
                          Disponible
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-400">
                          Occupé
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {room.locations?.nom || 'N/A'}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {room.isAvailableNow ? (
                        <span className="text-green-600 font-medium">Maintenant</span>
                      ) : (
                        <span className="text-foreground">
                          {format(room.nextAvailableDate, 'dd MMM yyyy', { locale: fr })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {room.isAvailableNow ? (
                        <span className="text-green-600">—</span>
                      ) : (
                        <span className="font-medium text-orange-600">
                          {room.daysUntilAvailable} jour{room.daysUntilAvailable > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <CurrencyDisplay amountUSD={room.prix_base_nuit} showBoth className="text-sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {currentView === 'calendar' && (
          <CalendarView
            rooms={rooms}
            bookings={bookings}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
        )}

        {currentView === 'card' && (
          <CardView
            rooms={sortedRooms}
          />
        )}

        {sortedRooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-foreground mb-2">Aucun appartement</p>
            <p className="text-sm text-muted-foreground">Ajoutez des appartements pour voir leur disponibilité</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Availability;
