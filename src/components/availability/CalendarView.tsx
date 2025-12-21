import { useState, useMemo } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addDays
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Booking } from '@/hooks/useBookings';
import { Room } from '@/hooks/useRooms';

interface CalendarViewProps {
  rooms: Room[];
  bookings: Booking[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  bookings: Booking[];
  roomAvailability: Record<string, { status: 'available' | 'booked' | 'maintenance' }>;
}

export function CalendarView({ rooms, bookings, currentMonth, onMonthChange, selectedDate, onDateSelect }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Calculer les jours à afficher
  const calendarDays = useMemo<DayCell[]>(() => {
    let datesToProcess: Date[];

    if (viewMode === 'week' && selectedDate) {
      // Calculer une semaine à partir de la date sélectionnée
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay()); // Dimanche
      const endOfWeek = addDays(startOfWeek, 6); // Samedi

      datesToProcess = eachDayOfInterval({ start: startOfWeek, end: endOfWeek });
    } else {
      // Vue mensuelle normale
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const monthStart = new Date(start);
      monthStart.setDate(start.getDate() - start.getDay()); // Dimanche de la semaine
      const monthEnd = new Date(end);
      monthEnd.setDate(end.getDate() + (6 - end.getDay())); // Samedi de la semaine

      datesToProcess = eachDayOfInterval({ start: monthStart, end: monthEnd });
    }

    return datesToProcess.map(date => {
      // Trouver les réservations pour ce jour
      const dayBookings = bookings.filter(b =>
        isSameDay(new Date(b.date_debut_prevue), date) ||
        isSameDay(new Date(b.date_fin_prevue), date) ||
        (date >= new Date(b.date_debut_prevue) && date <= new Date(b.date_fin_prevue))
      );

      // Calculer la disponibilité pour chaque chambre
      const roomAvailability: Record<string, { status: 'available' | 'booked' | 'maintenance' }> = {};

      rooms.forEach(room => {
        // Par défaut, supposons disponible
        roomAvailability[room.id] = { status: 'available' };

        // Vérifier si la chambre a des réservations pour cette date
        const roomBookings = dayBookings.filter(b => b.room_id === room.id);
        if (roomBookings.length > 0) {
          roomAvailability[room.id] = { status: 'booked' };
        } else if (room.status === 'MAINTENANCE') {
          roomAvailability[room.id] = { status: 'maintenance' };
        }
      });

      return {
        date,
        isCurrentMonth: viewMode === 'month' ? isSameMonth(date, currentMonth) : true,
        bookings: dayBookings,
        roomAvailability
      };
    });
  }, [rooms, bookings, currentMonth, selectedDate, viewMode]);

  // Obtenir les jours de la semaine
  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const navigateMonth = (direction: 'prev' | 'next') => {
    onMonthChange(direction === 'prev' ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (selectedDate) {
      const newDate = addDays(selectedDate, direction === 'prev' ? -7 : 7);
      onDateSelect(newDate);
    }
  };

  // Obtenir le nombre de chambres disponibles pour une date donnée
  const getAvailableRoomsCount = (date: Date) => {
    const dayCell = calendarDays.find(day => isSameDay(day.date, date));
    if (!dayCell) return 0;

    return Object.values(dayCell.roomAvailability).filter(availability =>
      availability.status === 'available'
    ).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border border-muted-foreground/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-background p-1 rounded-lg border shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted"
              onClick={() => viewMode === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted"
              onClick={() => viewMode === 'month' ? navigateMonth('next') : navigateWeek('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'month' ? 'default' : 'outline'}
            onClick={() => setViewMode('month')}
          >
            Mois
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'week' ? 'default' : 'outline'}
            onClick={() => {
              if (!selectedDate) {
                onDateSelect(new Date());
              }
              setViewMode('week');
            }}
          >
            Semaine
          </Button>
        </div>
      </div>

      {/* Vue calendrier */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {/* En-tête des jours */}
        <div className="grid grid-cols-7 bg-muted/30 border-b">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Jours du calendrier */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const availableRooms = getAvailableRoomsCount(day.date);
            const isSelected = selectedDate && isSameDay(day.date, selectedDate);

            return (
              <div
                key={index}
                className={`min-h-24 p-2 border-r border-b last:border-r-0 ${day.isCurrentMonth ? 'bg-background' : 'bg-muted/20'
                  } ${isSelected ? 'ring-2 ring-primary' : ''}`}
                onClick={() => onDateSelect(day.date)}
              >
                <div className="flex justify-between">
                  <span className={`text-sm font-medium ${day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                    {format(day.date, 'd')}
                  </span>
                  <Badge variant={availableRooms > 0 ? 'default' : 'secondary'} className="h-5 px-1.5">
                    {availableRooms}
                  </Badge>
                </div>

                {/* Aperçu rapide des disponibilités par type */}
                <div className="mt-1 space-y-1 max-h-16 overflow-y-auto">
                  {rooms.slice(0, 3).map(room => {
                    const status = day.roomAvailability[room.id]?.status;
                    const statusDisplay: Record<string, { bg: string; text: string; label: string }> = {
                      available: { bg: 'bg-green-100', text: 'text-green-800', label: 'Dispo' },
                      booked: { bg: 'bg-red-100', text: 'text-red-800', label: 'Occ' },
                      maintenance: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Maint' }
                    };

                    const displayInfo = statusDisplay[status] || statusDisplay.available;

                    return (
                      <div key={room.id} className="flex items-center gap-1 text-xs">
                        <div className={`w-2 h-2 rounded-full ${status === 'available' ? 'bg-green-500' : status === 'booked' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        <span className={`${displayInfo.text}`}>{room.numero} {displayInfo.label}</span>
                      </div>
                    );
                  })}
                  {rooms.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{rooms.length - 3} autres...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Occupé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Maintenance</span>
        </div>
      </div>
    </div>
  );
}