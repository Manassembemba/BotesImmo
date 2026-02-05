import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, Calendar, Bed, MapPin, DollarSign } from 'lucide-react';
import { Room } from '@/hooks/useRooms';
import { DateFilterType } from '@/hooks/useGlobalFilters';

interface AvailabilityFiltersProps {
  rooms: Room[];
  onFilterChange: (filters: {
    search: string;
    roomType: string;
    minPrice: number;
    maxPrice: number;
    floor: string;
    location: string;
    status: string; // 'all', 'available', 'occupied', 'booked'
    dateRange: DateFilterType;
    startDate?: string;
    endDate?: string;
  }) => void;
}

export function AvailabilityFilters({ rooms, onFilterChange }: AvailabilityFiltersProps) {
  const [search, setSearch] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [location, setLocation] = useState('all');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState<DateFilterType>('today');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Calcul des plages de prix
  const minPrice = useMemo(() => {
    return rooms.length > 0 ? Math.min(...rooms.map(r => r.prix_base_nuit || 0)) : 0;
  }, [rooms]);

  const maxPrice = useMemo(() => {
    return rooms.length > 0 ? Math.max(...rooms.map(r => r.prix_base_nuit || 0)) : 1000;
  }, [rooms]);

  // Localités disponibles
  const locations = useMemo(() => {
    const locationSet = new Set(rooms.map(r => r.locations?.nom).filter(Boolean));
    return ['all', ...Array.from(locationSet as Set<string>)];
  }, [rooms]);

  const minDisplayPrice = minPrice || 0;
  const maxDisplayPrice = maxPrice || 1000;

  // Mise à jour des filtres actifs
  useMemo(() => {
    const active: string[] = [];
    if (search) active.push(`Recherche: ${search}`);
    if (priceRange[0] !== minDisplayPrice || priceRange[1] !== maxDisplayPrice) {
      active.push(`Prix: ${priceRange[0]}-${priceRange[1]}$`);
    }
    if (location !== 'all') active.push(`Lieu: ${location}`);
    if (status !== 'all') active.push(`Statut: ${status}`);
    if (dateRange !== 'today') {
      if (dateRange === 'custom' && customDates.start && customDates.end) {
        active.push(`Période: ${customDates.start} à ${customDates.end}`);
      } else {
        active.push(`Date: ${dateRange}`);
      }
    }

    setActiveFilters(active);
  }, [search, priceRange, location, status, dateRange, customDates]);

  // Réinitialiser les filtres
  const clearFilter = (filterName: string) => {
    switch (filterName.split(':')[0]) {
      case 'Recherche':
        setSearch('');
        break;
      case 'Prix':
        setPriceRange([minDisplayPrice, maxDisplayPrice]);
        break;
      case 'Lieu':
        setLocation('all');
        break;
      case 'Statut':
        setStatus('all');
        break;
      case 'Date':
        setDateRange('today');
        break;
      case 'Période':
        setDateRange('today');
        setCustomDates({ start: '', end: '' });
        setShowCustomDate(false);
        break;
    }
  };

  // Réinitialiser tous les filtres
  const clearAllFilters = () => {
    setSearch('');
    setPriceRange([minDisplayPrice, maxDisplayPrice]);
    setLocation('all');
    setStatus('all');
    setDateRange('today');
    setCustomDates({ start: '', end: '' });
    setShowCustomDate(false);

    onFilterChange({
      search: '',
      minPrice: minDisplayPrice,
      maxPrice: maxDisplayPrice,
      roomType: 'all',
      floor: 'all',
      location: '',
      status: '',
      dateRange: 'today'
    });
  };

  // Fonction pour appliquer les filtres et envoyer à la page principale
  const handleApplyFilters = () => {
    let startDate = undefined;
    let endDate = undefined;

    if (dateRange === 'custom' && customDates.start && customDates.end) {
      startDate = customDates.start;
      endDate = customDates.end;
    }

    onFilterChange({
      search,
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      roomType: 'all',
      floor: 'all',
      location: location === 'all' ? '' : location,
      status: status === 'all' ? '' : status,
      dateRange,
      startDate,
      endDate
    });
  };

  return (
    <div className="space-y-4">
      {/* Barre de recherche et filtres principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="Libre">Disponible</SelectItem>
            <SelectItem value="Occupé">Occupé</SelectItem>
            <SelectItem value="Maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>

        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger>
            <MapPin className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Lieu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous lieux</SelectItem>
            {locations.filter(loc => loc !== 'all').map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={(value: DateFilterType) => {
          setDateRange(value);
          if (value !== 'custom') {
            setShowCustomDate(false);
          } else {
            setShowCustomDate(true);
          }
        }}>
          <SelectTrigger>
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Aujourd'hui</SelectItem>
            <SelectItem value="week">Cette semaine</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
            <SelectItem value="custom">Personnalisé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Affichage des dates personnalisées si sélectionné */}
      {showCustomDate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-muted/50 rounded-lg">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Date de début</label>
            <Input
              type="date"
              value={customDates.start}
              onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Date de fin</label>
            <Input
              type="date"
              value={customDates.end}
              onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>
      )}

      {/* Curseur de prix */}
      <div className="bg-card p-3 rounded-lg border">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium">Prix par nuit</label>
          </div>
          <span className="text-sm text-muted-foreground">
            {priceRange[0]}$ - {priceRange[1]}$
          </span>
        </div>
        <Slider
          value={priceRange}
          onValueChange={(value) => setPriceRange([value[0], value[1]])}
          min={minDisplayPrice}
          max={maxDisplayPrice}
          step={10}
          minStepsBetweenThumbs={10}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{minDisplayPrice}$</span>
          <span>{maxDisplayPrice}$</span>
        </div>
      </div>

      {/* Bouton d'application des filtres */}
      <Button onClick={handleApplyFilters} className="w-full">
        <Filter className="h-4 w-4 mr-2" />
        Appliquer les filtres
      </Button>

      {/* Filtres actifs */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-xs font-medium text-muted-foreground">Filtres appliqués:</span>
          {activeFilters.map((filter) => (
            <Badge key={filter} variant="secondary" className="rounded-full">
              {filter}
              <button
                onClick={() => clearFilter(filter)}
                className="ml-2 h-4 w-4 rounded-full hover:bg-secondary flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="ml-2 h-6 text-xs"
          >
            Effacer tout
          </Button>
        </div>
      )}
    </div>
  );
}