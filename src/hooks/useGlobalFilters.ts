import { useState, useMemo } from 'react';

export type DateFilterType = 'all' | 'today' | 'week' | 'month' | 'custom';
export type StatusFilterType = 'all' | 'Libre' | 'Occupé' | 'Nettoyage' | 'Maintenance';

export interface FilterOptions {
  dateRange: {
    type: DateFilterType;
    startDate?: string;
    endDate?: string;
  };
  status: StatusFilterType[];
  searchTerm?: string;
  dateCreated?: {
    type: DateFilterType;
    startDate?: string;
    endDate?: string;
  };
}

export interface GlobalFilters {
  options: FilterOptions;
  setOptions: (options: Partial<FilterOptions>) => void;
  setDateFilter: (type: DateFilterType, startDate?: string, endDate?: string) => void;
  setStatusFilter: (status: StatusFilterType | StatusFilterType[]) => void;
  setSearchTerm: (term: string) => void;
  resetFilters: () => void;
  filteredData: any[]; // This will be typed based on the data being filtered
}

export const useGlobalFilters = (initialData: any[] = []): GlobalFilters => {
  const [options, setOptions] = useState<FilterOptions>({
    dateRange: { type: 'all' },
    status: ['all'],
    dateCreated: { type: 'all' },
  });

  const setDateFilter = (type: DateFilterType, startDate?: string, endDate?: string) => {
    setOptions(prev => ({
      ...prev,
      dateRange: { type, startDate, endDate }
    }));
  };

  const setStatusFilter = (status: StatusFilterType | StatusFilterType[]) => {
    const statusArray = Array.isArray(status) ? status : [status];
    setOptions(prev => ({
      ...prev,
      status: statusArray
    }));
  };

  const setSearchTerm = (term: string) => {
    setOptions(prev => ({
      ...prev,
      searchTerm: term
    }));
  };

  const resetFilters = () => {
    setOptions({
      dateRange: { type: 'all' },
      status: ['all'],
      dateCreated: { type: 'all' },
    });
  };

  const setOptionsPartial = (newOptions: Partial<FilterOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  };

  // Fonction pour filtrer les données selon les options
  const filteredData = useMemo(() => {
    let result = [...initialData];

    // Filtre par terme de recherche
    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      result = result.filter(item => {
        // Recherche dans les champs courants - à adapter selon la structure de données
        return (
          (item.name && item.name.toLowerCase().includes(term)) ||
          (item.numero && item.numero.toLowerCase().includes(term)) ||
          (item.tenant && item.tenant.toLowerCase().includes(term)) ||
          (item.type && item.type.toLowerCase().includes(term)) ||
          (item.status && item.status.toLowerCase().includes(term))
        );
      });
    }

    // Filtre par statut
    if (options.status && !options.status.includes('all')) {
      result = result.filter(item => 
        options.status.some(status => item.status?.toLowerCase().includes(status.toLowerCase()))
      );
    }

    // Filtre par date
    if (options.dateRange.type !== 'custom' && options.dateRange.type !== 'all') {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (options.dateRange.type) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          break;
        case 'week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        default:
          startDate = new Date(0);
          endDate = now;
      }

      result = result.filter(item => {
        const itemDate = new Date(item.dateCreated || item.createdAt || item.created_at || Date.now());
        return itemDate >= startDate && itemDate <= endDate;
      });
    } else if (options.dateRange.type === 'custom' && options.dateRange.startDate && options.dateRange.endDate) {
      const startDate = new Date(options.dateRange.startDate);
      const endDate = new Date(options.dateRange.endDate);
      result = result.filter(item => {
        const itemDate = new Date(item.dateCreated || item.createdAt || item.created_at || Date.now());
        return itemDate >= startDate && itemDate <= endDate;
      });
    }

    return result;
  }, [initialData, options]);

  return {
    options,
    setOptions: setOptionsPartial,
    setDateFilter,
    setStatusFilter,
    setSearchTerm,
    resetFilters,
    filteredData
  };
};