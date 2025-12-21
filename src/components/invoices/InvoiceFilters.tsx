import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, Calendar, DollarSign, User, Building } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Invoice } from '@/interfaces/Invoice';

interface InvoiceFiltersProps {
  invoices: Invoice[];
  onFilterChange: (filters: {
    search: string;
    status: string;
    dateRange: { start: string; end: string };
    amountRange: { min: number | null; max: number | null };
    customer: string;
    roomNumber: string;
  }) => void;
}

export function InvoiceFilters({ invoices, onFilterChange }: InvoiceFiltersProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [amountRange, setAmountRange] = useState({ min: null as number | null, max: null as number | null });
  const [customer, setCustomer] = useState<string>('all');
  const [roomNumber, setRoomNumber] = useState<string>('all');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Extraire les clients et chambres uniques
  const uniqueCustomers = useMemo(() => {
    const customers = new Set(invoices.map(inv => inv.tenant_name).filter(Boolean) as string[]);
    return ['all', ...Array.from(customers)];
  }, [invoices]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set(invoices.map(inv => inv.room_number).filter(Boolean) as string[]);
    return ['all', ...Array.from(rooms)];
  }, [invoices]);

  // Mettre à jour les filtres actifs
  useMemo(() => {
    const active: string[] = [];
    if (search) active.push(`Recherche: ${search}`);
    if (status !== 'all') active.push(`Statut: ${status}`);
    if (dateRange.start) active.push(`Du: ${dateRange.start}`);
    if (dateRange.end) active.push(`Au: ${dateRange.end}`);
    if (amountRange.min !== null) active.push(`Min: ${amountRange.min}$`);
    if (amountRange.max !== null) active.push(`Max: ${amountRange.max}$`);
    if (customer !== 'all') active.push(`Client: ${customer}`);
    if (roomNumber !== 'all') active.push(`Chambre: ${roomNumber}`);

    setActiveFilters(active);
  }, [search, status, dateRange, amountRange, customer, roomNumber]);

  const clearFilter = (filterName: string) => {
    switch (filterName.split(':')[0]) {
      case 'Recherche':
        setSearch('');
        break;
      case 'Statut':
        setStatus('all');
        break;
      case 'Du':
        setDateRange(prev => ({ ...prev, start: '' }));
        break;
      case 'Au':
        setDateRange(prev => ({ ...prev, end: '' }));
        break;
      case 'Min':
        setAmountRange(prev => ({ ...prev, min: null }));
        break;
      case 'Max':
        setAmountRange(prev => ({ ...prev, max: null }));
        break;
      case 'Client':
        setCustomer('all');
        break;
      case 'Chambre':
        setRoomNumber('all');
        break;
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setStatus('all');
    setDateRange({ start: '', end: '' });
    setAmountRange({ min: null, max: null });
    setCustomer('all');
    setRoomNumber('all');
    
    onFilterChange({
      search: '',
      status: 'all',
      dateRange: { start: '', end: '' },
      amountRange: { min: null, max: null },
      customer: 'all',
      roomNumber: 'all'
    });
  };

  const applyFilters = () => {
    onFilterChange({
      search,
      status,
      dateRange,
      amountRange,
      customer,
      roomNumber
    });
  };

  return (
    <div className="space-y-4">
      {/* Premier rang de filtres */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
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
            <SelectItem value="DRAFT">Brouillon</SelectItem>
            <SelectItem value="ISSUED">Émise</SelectItem>
            <SelectItem value="PAID">Payée</SelectItem>
            <SelectItem value="CANCELLED">Annulée</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger>
            <User className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous clients</SelectItem>
            {uniqueCustomers.filter(c => c !== 'all').map(customer => (
              <SelectItem key={customer} value={customer}>{customer}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={roomNumber} onValueChange={setRoomNumber}>
          <SelectTrigger>
            <Building className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Chambre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes chambres</SelectItem>
            {uniqueRooms.filter(r => r !== 'all').map(room => (
              <SelectItem key={room} value={room}>{room}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex gap-1">
          <div className="w-full">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Min"
                type="number"
                value={amountRange.min ?? ''}
                onChange={(e) => setAmountRange(prev => ({ ...prev, min: e.target.value ? parseFloat(e.target.value) : null }))}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Max"
                type="number"
                value={amountRange.max ?? ''}
                onChange={(e) => setAmountRange(prev => ({ ...prev, max: e.target.value ? parseFloat(e.target.value) : null }))}
                className="pl-9"
              />
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Date
          </Button>
        </div>
        
        <div>
          <Button onClick={applyFilters} className="w-full">
            <Filter className="h-4 w-4 mr-2" />
            Filtrer
          </Button>
        </div>
      </div>

      {/* Filtre de date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Date de facturation</label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              placeholder="Du"
              className="text-sm"
            />
            <span className="self-center text-muted-foreground">à</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              placeholder="Au"
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Filtres actifs */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-xs font-medium text-muted-foreground">Filtres appliqués:</span>
          {activeFilters.map(filter => (
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