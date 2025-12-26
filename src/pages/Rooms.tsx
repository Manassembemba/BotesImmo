import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { CreateRoomDialog } from '@/components/rooms/CreateRoomDialog';
import { EditRoomDialog } from '@/components/rooms/EditRoomDialog';
import { LocationManagement } from '@/components/locations/LocationManagement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Pencil, Trash2, Filter, Bed, MapPin, DollarSign, Building2, X } from 'lucide-react';
import { useRooms, useDeleteRoom, type Room } from '@/hooks/useRooms';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useAuth } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useGlobalFilters } from '@/hooks/useGlobalFilters';
import { GlobalFilters } from '@/components/filters/GlobalFilters';

const getStatusBadge = (status: RoomStatus) => {
  const config: Record<RoomStatus, { label: string; className: string }> = {
    Libre: { label: 'DISPONIBLE', className: 'status-available' },
    Occupé: { label: 'OCCUPÉ', className: 'status-occupied' },
    Nettoyage: { label: 'NETTOYAGE', className: 'status-pending-cleaning' },
    Maintenance: { label: 'MAINTENANCE', className: 'status-out-of-service' },
  };
  const { label, className } = config[status] || config.Libre;
  return (
    <Badge className={cn('font-medium text-xs px-3 py-1', className)}>
      {label}
    </Badge>
  );
};

const Rooms = () => {
  const { role } = useAuth();
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: exchangeRate } = useExchangeRate();
  const deleteRoom = useDeleteRoom();
  const rate = exchangeRate?.usd_to_cdf || 2800;

  // États pour les filtres additionnels
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [currentView, setCurrentView] = useState<'rooms' | 'locations'>('rooms');

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  // Utiliser le hook de filtres global pour la recherche
  const { options, setSearchTerm, resetFilters } = useGlobalFilters(rooms);

  // Extraire les valeurs uniques pour les filtres
  const uniqueRoomTypes = useMemo(() => {
    const types = new Set(rooms.map(room => room.type));
    return ['all', ...Array.from(types)];
  }, [rooms]);

  const uniqueLocations = useMemo(() => {
    const locations = new Set(rooms.map(room => room.locations?.nom).filter(Boolean));
    return ['all', ...Array.from(locations as Set<string>)];
  }, [rooms]);

  // Filtrer les chambres
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Filtre de recherche
      const searchLower = options.searchTerm?.toLowerCase() || '';
      const matchesSearch = !searchLower || (
        room.numero.toLowerCase().includes(searchLower) ||
        room.type.toLowerCase().includes(searchLower) ||
        room.locations?.nom?.toLowerCase().includes(searchLower)
      );

      // Filtre par type
      const matchesType = roomTypeFilter === 'all' || room.type === roomTypeFilter;

      // Filtre par statut
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;

      // Filtre par localité
      const matchesLocation = locationFilter === 'all' || room.locations?.nom === locationFilter;

      // Filtre par prix
      const matchesPrice =
        (priceRange.min === null || room.prix_base_nuit >= priceRange.min) &&
        (priceRange.max === null || room.prix_base_nuit <= priceRange.max);

      return matchesSearch && matchesType && matchesStatus && matchesLocation && matchesPrice;
    });
  }, [rooms, options.searchTerm, roomTypeFilter, statusFilter, locationFilter, priceRange]);

  // Compter les filtres actifs
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (options.searchTerm) count++;
    if (roomTypeFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (locationFilter !== 'all') count++;
    if (priceRange.min !== null || priceRange.max !== null) count++;
    return count;
  }, [options.searchTerm, roomTypeFilter, statusFilter, locationFilter, priceRange]);

  const handleDelete = async () => {
    if (deletingRoomId) {
      await deleteRoom.mutateAsync(deletingRoomId);
      setDeletingRoomId(null);
    }
  };

  if (roomsLoading) {
    return (
      <MainLayout title="APPARTEMENTS">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Chargement des appartements...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="APPARTEMENTS">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            className={`pb-3 px-4 font-medium text-sm ${currentView === 'rooms' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setCurrentView('rooms')}
          >
            <div className="flex items-center gap-2">
              <Bed className="h-4 w-4" />
              Appartements
            </div>
          </button>
          {role === 'ADMIN' && (
            <button
              className={`pb-3 px-4 font-medium text-sm ${currentView === 'locations' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setCurrentView('locations')}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Localités
              </div>
            </button>
          )}
        </div>

        {/* Rooms View */}
        {currentView === 'rooms' && (
          <div className="space-y-6">
            {/* Filtres avancés */}
            <div className="border rounded-lg p-4 mb-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un appartement (numéro, type, localité)..."
                  value={options.searchTerm || ''}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Filtre par type */}
                <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                  <SelectTrigger>
                    <Bed className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Type de chambre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous types</SelectItem>
                    {uniqueRoomTypes.filter(type => type !== 'all').map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtre par statut */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="Libre">Disponible</SelectItem>
                    <SelectItem value="Occupé">Occupé</SelectItem>
                    <SelectItem value="Nettoyage">Nettoyage</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtre par localité */}
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger>
                    <MapPin className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Localité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes localités</SelectItem>
                    {uniqueLocations.filter(loc => loc !== 'all').map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtre par prix */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Min"
                        type="number"
                        value={priceRange.min ?? ''}
                        onChange={(e) => setPriceRange(prev => ({
                          ...prev,
                          min: e.target.value ? parseFloat(e.target.value) : null
                        }))}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Max"
                        type="number"
                        value={priceRange.max ?? ''}
                        onChange={(e) => setPriceRange(prev => ({
                          ...prev,
                          max: e.target.value ? parseFloat(e.target.value) : null
                        }))}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {activeFiltersCount} {activeFiltersCount > 1 ? 'filtres actifs' : 'filtre actif'}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <span className="mr-1">Réinitialiser</span>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              {role === 'ADMIN' && <CreateRoomDialog />}
            </div>

            {filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-lg border">
                <p className="text-lg font-medium text-foreground mb-2">
                  {rooms.length === 0 ? 'Aucun appartement enregistré' : 'Aucun appartement trouvé'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {rooms.length === 0 ? 'Ajoutez votre premier appartement pour commencer' : 'Essayez de modifier votre recherche'}
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary hover:bg-primary">
                      <TableHead className="text-primary-foreground font-semibold">N°</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">NOM & NUMÉRO</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">STATUT</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">TYPE</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">LOCALITÉ</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">PRIX</TableHead>
                      {role === 'ADMIN' && <TableHead className="text-primary-foreground font-semibold text-right">ACTIONS</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRooms.map((room, index) => (
                      <TableRow key={room.id} className="hover:bg-secondary/50">
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <span className="font-medium">APPARTEMENT - {room.numero}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(room.status)}</TableCell>
                        <TableCell>{room.type}</TableCell>
                        <TableCell>{room.locations?.nom || <span className="text-muted-foreground">N/A</span>}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>USD : {room.prix_base_nuit.toFixed(2)}</p>
                            <p className="text-muted-foreground">CDF : {Math.round(room.prix_base_nuit * rate).toLocaleString('fr-FR')}</p>
                          </div>
                        </TableCell>
                        {role === 'ADMIN' && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditingRoom(room)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => setDeletingRoomId(room.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Locations View */}
        {currentView === 'locations' && (
          <div className="space-y-6">
            <LocationManagement />
          </div>
        )}
      </div>

      <EditRoomDialog
        room={editingRoom}
        open={!!editingRoom}
        onOpenChange={(open) => !open && setEditingRoom(null)}
      />

      <AlertDialog open={!!deletingRoomId} onOpenChange={() => setDeletingRoomId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cet appartement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible et supprimera l'appartement définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteRoom.isPending}>
              {deleteRoom.isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </MainLayout>
  );
};

export default Rooms;