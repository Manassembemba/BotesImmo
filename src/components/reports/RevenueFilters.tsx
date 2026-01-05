"use client"

import { useState, useEffect, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

type Period = 'today' | 'week' | 'month';

interface RevenueFiltersProps {
  onFilterChange: (filters: { dateRange: DateRange | undefined, roomType: string }) => void;
  rooms: { type: string }[]; 
}

export const RevenueFilters = ({ onFilterChange, rooms }: RevenueFiltersProps) => {
  const [date, setDate] = useState<DateRange | undefined>();
  const [roomType, setRoomType] = useState('all');

  const roomTypes = useMemo(() => {
    if (!rooms) return [];
    const uniqueTypes = new Set(rooms.map(room => room.type));
    return ['all', ...Array.from(uniqueTypes)];
  }, [rooms]);

  useEffect(() => {
    onFilterChange({ dateRange: date, roomType });
  }, [date, roomType, onFilterChange]);

  const handlePeriodSelect = (period: Period) => {
    const today = new Date();
    switch (period) {
      case 'today':
        setDate({ from: startOfToday(), to: endOfToday() });
        break;
      case 'week':
        setDate({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) });
        break;
      case 'month':
        setDate({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[300px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Choisissez une période</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Room Type Selector */}
        <Select value={roomType} onValueChange={setRoomType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Type de chambre" />
          </SelectTrigger>
          <SelectContent>
            {roomTypes.map(type => (
              <SelectItem key={type} value={type}>
                {type === 'all' ? 'Tous les types' : type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => handlePeriodSelect('today')}>Aujourd'hui</Button>
        <Button variant="outline" size="sm" onClick={() => handlePeriodSelect('week')}>Cette semaine</Button>
        <Button variant="outline" size="sm" onClick={() => handlePeriodSelect('month')}>Ce mois-ci</Button>
      </div>
    </div>
  );
};
