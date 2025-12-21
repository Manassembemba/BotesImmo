import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X } from 'lucide-react';
import { Room } from '@/hooks/useRooms';

interface FiltersProps {
  rooms: Room[];
  onFilterChange: (filters: {
    search: string;
    roomType: string;
    minPrice: number;
    maxPrice: number;
    floor: string;
  }) => void;
}

export function Filters({ rooms, onFilterChange }: FiltersProps) {
  const [search, setSearch] = useState('');
  const [roomType, setRoomType] = useState('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [floor, setFloor] = useState('all');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Calcul des plages de prix
  const minPrice = useMemo(() => {
    return rooms.length > 0 ? Math.min(...rooms.map(r => r.prix_base_nuit || 0)) : 0;
  }, [rooms]);

  const maxPrice = useMemo(() => {
    return rooms.length > 0 ? Math.max(...rooms.map(r => r.prix_base_nuit || 0)) : 1000;
  }, [rooms]);

  // Types de chambres disponibles
  const roomTypes = useMemo(() => {
    const types = new Set(rooms.map(r => r.type));
    return Array.from(types);
  }, [rooms]);

  // Étages disponibles
  const floors = useMemo(() => {
    const floorsSet = new Set(rooms.map(r => r.etage?.toString()));
    return Array.from(floorsSet).filter(f => f !== undefined).sort((a, b) => Number(a) - Number(b));
  }, [rooms]);

  const minDisplayPrice = minPrice || 0;
  const maxDisplayPrice = maxPrice || 1000;

  // Mise à jour des filtres actifs
  useMemo(() => {
    const active: string[] = [];
    if (search) active.push(`Recherche: ${search}`);
    if (roomType !== 'all') active.push(`Type: ${roomType}`);
    if (priceRange[0] !== minDisplayPrice || priceRange[1] !== maxDisplayPrice) {
      active.push(`Prix: ${priceRange[0]}-${priceRange[1]}$`);
    }
    if (floor !== 'all') active.push(`Étage: ${floor}`);
    
    setActiveFilters(active);
  }, [search, roomType, priceRange, floor, minDisplayPrice, maxDisplayPrice]);

  // Réinitialiser les filtres
  const clearFilter = (filterName: string) => {
    switch (filterName.split(':')[0]) {
      case 'Recherche':
        setSearch('');
        break;
      case 'Type':
        setRoomType('all');
        break;
      case 'Prix':
        setPriceRange([minDisplayPrice, maxDisplayPrice]);
        break;
      case 'Étage':
        setFloor('all');
        break;
    }
  };

  // Réinitialiser tous les filtres
  const clearAllFilters = () => {
    setSearch('');
    setRoomType('all');
    setPriceRange([minDisplayPrice, maxDisplayPrice]);
    setFloor('all');
    setActiveFilters([]);
    onFilterChange({
      search: '',
      roomType: '',
      minPrice: minDisplayPrice,
      maxPrice: maxDisplayPrice,
      floor: ''
    });
  };

  // Fonction pour appliquer les filtres et envoyer à la page principale
  const handleApplyFilters = () => {
    onFilterChange({
      search,
      roomType: roomType === 'all' ? '' : roomType,
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      floor: floor === 'all' ? '' : floor
    });
  };

  return (
    <div className="space-y-4">
      {/* Barre de recherche et filtres principaux */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une chambre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roomType} onValueChange={setRoomType}>
          <SelectTrigger>
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {roomTypes.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={floor} onValueChange={setFloor}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les étages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les étages</SelectItem>
            {floors.map(f => (
              <SelectItem key={f} value={f}>Étage {f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleApplyFilters} className="w-full">
          <Filter className="h-4 w-4 mr-2" />
          Filtrer
        </Button>
      </div>

      {/* Curseur de prix */}
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium">Prix par nuit</label>
          <span className="text-sm text-muted-foreground">
            {priceRange[0]}$ - {priceRange[1]}$
          </span>
        </div>
        <Slider 
          value={priceRange} 
          onValueChange={setPriceRange}
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

      {/* Filtres actifs */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-xs font-medium text-muted-foreground">Filtres appliqués:</span>
          {activeFilters.map((filter) => (
            <Badge key={filter} variant="secondary" className="rounded-full">
              {filter}
              <button 
                onClick={() => clearFilter(filter)} 
                className="ml-2 h-4 w-4 rounded-full hover:bg-secondary"
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