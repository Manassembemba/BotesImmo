import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, X, Search, CalendarDays, Clock, CalendarCheck, CalendarRange } from 'lucide-react';
import { DateFilterType, StatusFilterType } from '@/hooks/useGlobalFilters';

interface GlobalFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  dateFilter: DateFilterType;
  onDateFilterChange: (type: DateFilterType, startDate?: string, endDate?: string) => void;
  statusFilter: StatusFilterType[];
  onStatusFilterChange: (status: StatusFilterType[]) => void;
  onReset: () => void;
  activeFiltersCount: number;
}

export const GlobalFilters = ({
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  statusFilter,
  onStatusFilterChange,
  onReset,
  activeFiltersCount,
}: GlobalFiltersProps) => {
  const [showDateRange, setShowDateRange] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const dateFilterOptions = [
    { value: 'today', label: 'Aujourd\'hui', icon: Clock },
    { value: 'week', label: 'Cette semaine', icon: CalendarDays },
    { value: 'month', label: 'Ce mois', icon: CalendarCheck },
    { value: 'custom', label: 'Personnalisé', icon: CalendarRange },
  ];

  const statusOptions = [
      { value: 'Libre', label: 'Disponible', color: 'success' },
      { value: 'Occupé', label: 'Occupé', color: 'primary' },
      { value: 'Nettoyage', label: 'Nettoyage', color: 'warning' },
      { value: 'Maintenance', label: 'Maintenance', color: 'destructive' },  ];

  const handleDateRangeSubmit = () => {
    if (dateRange.start && dateRange.end) {
      onDateFilterChange('custom', dateRange.start, dateRange.end);
      setShowDateRange(false);
    }
  };

  const clearDateRange = () => {
    setDateRange({ start: '', end: '' });
    setShowDateRange(false);
    onDateFilterChange('today');
  };

  const toggleStatus = (status: StatusFilterType) => {
    if (status === 'all') {
      onStatusFilterChange(['all']);
    } else {
      const newStatuses = statusFilter.includes(status)
        ? statusFilter.filter(s => s !== status)
        : [...statusFilter.filter(s => s !== 'all'), status];
      
      // Si tous les statuts sont sélectionnés, ou aucun, on revient à 'all'
      if (newStatuses.length === 0 || newStatuses.length === statusOptions.length) {
        onStatusFilterChange(['all']);
      } else {
        onStatusFilterChange(newStatuses);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filtres principaux */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={dateFilter === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDateFilterChange('today')}
        >
          <Clock className="h-4 w-4 mr-1" />
          Aujourd'hui
        </Button>
        
        <Button
          variant={dateFilter === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDateFilterChange('week')}
        >
          <CalendarDays className="h-4 w-4 mr-1" />
          Cette semaine
        </Button>
        
        <Button
          variant={dateFilter === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDateFilterChange('month')}
        >
          <CalendarCheck className="h-4 w-4 mr-1" />
          Ce mois
        </Button>
        
        <Button
          variant={dateFilter === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowDateRange(!showDateRange)}
        >
          <CalendarRange className="h-4 w-4 mr-1" />
          Personnalisé
        </Button>
      </div>

      {/* Filtre de date personnalisé */}
      {showDateRange && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg">
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="max-w-[140px]"
          />
          <span className="text-muted-foreground">à</span>
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="max-w-[140px]"
          />
          <Button size="sm" onClick={handleDateRangeSubmit}>
            Appliquer
          </Button>
          <Button size="sm" variant="outline" onClick={clearDateRange}>
            Annuler
          </Button>
        </div>
      )}

      {/* Filtres par statut */}
      <div className="flex flex-wrap items-center gap-2">
        {statusOptions.map((option) => (
          <Button
            key={option.value}
            variant={statusFilter.includes(option.value as StatusFilterType) ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => toggleStatus(option.value as StatusFilterType)}
          >
            <Badge className={`bg-${option.color} text-xs`}>
              {option.label}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Bouton Réinitialiser */}
      {activeFiltersCount > 0 && (
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {activeFiltersCount} {activeFiltersCount > 1 ? 'filtres actifs' : 'filtre actif'}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>
            <X className="h-4 w-4 mr-1" />
            Réinitialiser
          </Button>
        </div>
      )}
    </div>
  );
};