import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, Calendar, DollarSign, User, Building, Clock, CalendarDays } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AccountingFiltersProps {
  filters: {
    dateRange: { start: string; end: string };
    accountIds?: string[];
    entryStatus?: string[];
    currency?: string;
    search?: string;
    period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  };
  onFilterChange: (filters: {
    dateRange: { start: string; end: string };
    accountIds?: string[];
    entryStatus?: string[];
    currency?: string;
    search?: string;
    period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  }) => void;
  availableAccounts?: { id: string; code: string; name: string }[];
  availableCurrencies?: string[];
}

export function AccountingFilters({ 
  filters, 
  onFilterChange, 
  availableAccounts = [],
  availableCurrencies = ['USD', 'CDF']
}: AccountingFiltersProps) {
  const [search, setSearch] = useState(filters.search || '');
  const [accountIds, setAccountIds] = useState<string[]>(filters.accountIds || []);
  const [entryStatus, setEntryStatus] = useState<string[]>(filters.entryStatus || []);
  const [currency, setCurrency] = useState(filters.currency || 'all');
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>(filters.period || 'today');
  const [dateRange, setDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: filters.dateRange.start ? new Date(filters.dateRange.start) : undefined,
    end: filters.dateRange.end ? new Date(filters.dateRange.end) : undefined
  });

  // Calculate active filters
  const activeFilters = useMemo(() => {
    const active: string[] = [];
    if (search) active.push(`Recherche: ${search}`);
    if (accountIds.length > 0) active.push(`Comptes: ${accountIds.length}`);
    if (entryStatus.length > 0) active.push(`Statut: ${entryStatus.length}`);
    if (currency !== 'all') active.push(`Devise: ${currency}`);
    if (period !== 'custom' && dateRange.start && dateRange.end) {
      active.push(`Période: ${period}`);
    } else if (dateRange.start && dateRange.end) {
      active.push(`Du: ${format(dateRange.start, 'dd/MM/yyyy')} au ${format(dateRange.end, 'dd/MM/yyyy')}`);
    }
    return active;
  }, [search, accountIds, entryStatus, currency, period, dateRange]);

  const clearFilter = (filterName: string) => {
    switch (filterName.split(':')[0]) {
      case 'Recherche':
        setSearch('');
        break;
      case 'Comptes':
        setAccountIds([]);
        break;
      case 'Statut':
        setEntryStatus([]);
        break;
      case 'Devise':
        setCurrency('all');
        break;
      case 'Période':
        setPeriod('today');
        setDateRange({
          start: startOfDay(new Date()),
          end: endOfDay(new Date())
        });
        break;
      case 'Du':
        setDateRange({ start: undefined, end: undefined });
        break;
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setAccountIds([]);
    setEntryStatus([]);
    setCurrency('all');
    setPeriod('today');
    setDateRange({
      start: startOfDay(new Date()),
      end: endOfDay(new Date())
    });
  };

  const setTodayFilter = () => {
    const today = new Date();
    setDateRange({
      start: startOfDay(today),
      end: endOfDay(today)
    });
    setPeriod('today');
  };

  const setWeekFilter = () => {
    const today = new Date();
    setDateRange({
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 })
    });
    setPeriod('week');
  };

  const setMonthFilter = () => {
    const today = new Date();
    setDateRange({
      start: startOfMonth(today),
      end: endOfMonth(today)
    });
    setPeriod('month');
  };

  const setQuarterFilter = () => {
    const today = new Date();
    const quarter = Math.floor(today.getMonth() / 3);
    const start = startOfQuarter(today, quarter);
    const end = endOfQuarter(today, quarter);
    
    setDateRange({
      start: startOfDay(start),
      end: endOfDay(end)
    });
    setPeriod('quarter');
  };

  const setYearFilter = () => {
    const today = new Date();
    setDateRange({
      start: startOfYear(today),
      end: endOfYear(today)
    });
    setPeriod('year');
  };

  const startOfQuarter = (date: Date, quarter: number) => {
    const month = quarter * 3;
    return new Date(date.getFullYear(), month, 1);
  };

  const endOfQuarter = (date: Date, quarter: number) => {
    const month = quarter * 3 + 2;
    return endOfMonth(new Date(date.getFullYear(), month, 1));
  };

  const applyFilters = () => {
    onFilterChange({
      dateRange: {
        start: dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : '',
        end: dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ''
      },
      accountIds: accountIds.length > 0 ? accountIds : undefined,
      entryStatus: entryStatus.length > 0 ? entryStatus : undefined,
      currency: currency !== 'all' ? currency : undefined,
      search: search || undefined,
      period: period
    });
  };

  // Update filters when local state changes
  const handleApplyFilters = () => {
    applyFilters();
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

        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger>
            <DollarSign className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Devise" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes devises</SelectItem>
            {availableCurrencies.map(curr => (
              <SelectItem key={curr} value={curr}>{curr}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger>
            <CalendarDays className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Aujourd'hui</SelectItem>
            <SelectItem value="week">Cette semaine</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
            <SelectItem value="quarter">Ce trimestre</SelectItem>
            <SelectItem value="year">Cette année</SelectItem>
            <SelectItem value="custom">Personnalisé</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Select value={entryStatus.join(',')} onValueChange={(value) => setEntryStatus(value.split(','))}>
            <SelectTrigger className="pl-9">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Brouillon</SelectItem>
              <SelectItem value="POSTED">Posté</SelectItem>
              <SelectItem value="REVERSED">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Select value={accountIds.join(',')} onValueChange={(value) => setAccountIds(value.split(','))}>
            <SelectTrigger className="pl-9">
              <SelectValue placeholder="Comptes" />
            </SelectTrigger>
            <SelectContent>
              {availableAccounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <Calendar className="h-4 w-4 mr-2" />
                {dateRange.start && dateRange.end ? (
                  <>
                    {format(dateRange.start, 'dd/MM/yyyy')} - {format(dateRange.end, 'dd/MM/yyyy')}
                  </>
                ) : (
                  <span>Choisir dates</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange.start}
                selected={dateRange}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({
                      start: range.from,
                      end: range.to
                    });
                    setPeriod('custom');
                  }
                }}
                numberOfMonths={2}
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Button onClick={handleApplyFilters} className="w-full">
            <Filter className="h-4 w-4 mr-2" />
            Filtrer
          </Button>
        </div>
      </div>

      {/* Boutons de période rapide */}
      <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
        <Button
          variant={period === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={setTodayFilter}
          className="text-[10px] h-7 px-2"
        >
          <Clock className="h-3 w-3 mr-1" />
          Aujourd'hui
        </Button>
        <Button
          variant={period === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={setWeekFilter}
          className="text-[10px] h-7 px-2"
        >
          <Clock className="h-3 w-3 mr-1" />
          Semaine
        </Button>
        <Button
          variant={period === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={setMonthFilter}
          className="text-[10px] h-7 px-2"
        >
          <Clock className="h-3 w-3 mr-1" />
          Mois
        </Button>
        <Button
          variant={period === 'quarter' ? 'default' : 'outline'}
          size="sm"
          onClick={setQuarterFilter}
          className="text-[10px] h-7 px-2"
        >
          <Clock className="h-3 w-3 mr-1" />
          Trimestre
        </Button>
        <Button
          variant={period === 'year' ? 'default' : 'outline'}
          size="sm"
          onClick={setYearFilter}
          className="text-[10px] h-7 px-2"
        >
          <Clock className="h-3 w-3 mr-1" />
          Année
        </Button>
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