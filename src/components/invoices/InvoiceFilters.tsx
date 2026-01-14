import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, Calendar, User, Clock } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format as formatDate } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Invoice } from '@/interfaces/Invoice';

interface InvoiceFiltersProps {
  invoices: Invoice[];
  onFilterChange: (filters: {
    search: string;
    status: string;
    dateRange: { start: string; end: string };
    customer: string;
  }) => void;
  onActiveFiltersChange: (count: number) => void;
}

export function InvoiceFilters({ invoices, onFilterChange, onActiveFiltersChange }: InvoiceFiltersProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [customer, setCustomer] = useState<string>('all');
  const [period, setPeriod] = useState<string>('all');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Extraire les clients et chambres uniques
  const uniqueCustomers = useMemo(() => {
    const customers = new Set(invoices.map(inv => inv.tenant_name).filter(Boolean) as string[]);
    return ['all', ...Array.from(customers)];
  }, [invoices]);

  // Mettre à jour les filtres actifs
  useMemo(() => {
    const active: string[] = [];
    if (search) active.push(`Recherche: ${search}`);
    if (status !== 'all') active.push(`Statut: ${status}`);
    if (dateRange.start) active.push(`Du: ${dateRange.start}`);
    if (dateRange.end) active.push(`Au: ${dateRange.end}`);
    if (customer !== 'all') active.push(`Client: ${customer}`);
    if (period !== 'all' && period !== 'custom') {
      const label = period === 'today' ? "Aujourd'hui" : period === 'week' ? "Cette semaine" : "Ce mois";
      active.push(`Période: ${label}`);
    }

    setActiveFilters(active);
  }, [search, status, dateRange, customer, period]);

  useEffect(() => {
    onActiveFiltersChange(activeFilters.length);
  }, [activeFilters, onActiveFiltersChange]);

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
      case 'Client':
        setCustomer('all');
        break;
      case 'Période':
        setPeriod('all');
        setDateRange({ start: '', end: '' });
        break;
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setStatus('all');
    setDateRange({ start: '', end: '' });
    setCustomer('all');
    setPeriod('all');

    onFilterChange({
      search: '',
      status: 'all',
      dateRange: { start: '', end: '' },
      customer: 'all',
    });
  };

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    const today = new Date();

    if (value === 'today') {
      const start = formatDate(startOfDay(today), 'yyyy-MM-dd');
      const end = formatDate(endOfDay(today), 'yyyy-MM-dd');
      setDateRange({ start, end });
    } else if (value === 'week') {
      const start = formatDate(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = formatDate(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      setDateRange({ start, end });
    } else if (value === 'month') {
      const start = formatDate(startOfMonth(today), 'yyyy-MM-dd');
      const end = formatDate(endOfMonth(today), 'yyyy-MM-dd');
      setDateRange({ start, end });
    } else if (value === 'all') {
      setDateRange({ start: '', end: '' });
    }
  };

  const applyFilters = () => {
    onFilterChange({
      search,
      status,
      dateRange,
      customer,
    });
  };

  return (
    <div className="space-y-4">
      {/* Premier rang de filtres */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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

        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger>
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les dates</SelectItem>
            <SelectItem value="today">Aujourd'hui</SelectItem>
            <SelectItem value="week">Cette semaine</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
            <SelectItem value="custom">Personnalisé...</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={applyFilters} className="w-full">
          <Filter className="h-4 w-4 mr-2" />
          Filtrer
        </Button>
      </div>

      {/* Filtre de date personnalisé */}
      {period === 'custom' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Date de facturation</label>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  placeholder="Du"
                  className="text-sm bg-background"
                />
                <span className="self-center text-muted-foreground">à</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  placeholder="Au"
                  className="text-sm bg-background"
                />
              </div>
            </div>
          </div>
        </div>
      )}

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