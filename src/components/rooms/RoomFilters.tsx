import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RoomFiltersProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}

export function RoomFilters({ onSearchChange, onStatusChange, onTypeChange }: RoomFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-card border shadow-soft animate-fade-in">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher une chambre..."
          className="pl-9"
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <Select onValueChange={onStatusChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Tous les statuts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          <SelectItem value="Libre">Disponible</SelectItem>
          <SelectItem value="Occupé">Occupée</SelectItem>
          <SelectItem value="Nettoyage">Nettoyage</SelectItem>
          <SelectItem value="Maintenance">Maintenance</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={onTypeChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Tous les types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les types</SelectItem>
          <SelectItem value="SINGLE">Simple</SelectItem>
          <SelectItem value="DOUBLE">Double</SelectItem>
          <SelectItem value="SUITE">Suite</SelectItem>
          <SelectItem value="STUDIO">Studio</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" className="gap-2">
        <Filter className="h-4 w-4" />
        Plus de filtres
      </Button>
    </div>
  );
}
