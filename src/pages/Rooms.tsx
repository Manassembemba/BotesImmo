import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { CreateRoomDialog } from '@/components/rooms/CreateRoomDialog';
import { EditRoomDialog } from '@/components/rooms/EditRoomDialog';
import { LocationManagement } from '@/components/locations/LocationManagement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Pencil, Trash2, Filter, Bed, DollarSign, Building2, X, CalendarDays } from 'lucide-react';
import { useRooms, useDeleteRoom, type Room } from '@/hooks/useRooms';
import { useLocations } from '@/hooks/useLocations';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useAuth } from '@/hooks/useAuth';
import { useLocationFilter } from '@/context/LocationFilterContext';
import { useBookings } from '@/hooks/useBookings';
import { getEffectiveRoomStatus, RoomStatusResult, EffectiveRoomStatus } from '@/lib/statusUtils';
import { differenceInDays, parseISO, isWithinInterval, format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

type RoomStatus = 'Libre' | 'Occupé' | 'Nettoyage' | 'Maintenance' | 'BOOKED' | 'MAINTENANCE' | 'PENDING_CLEANING' | 'PENDING_CHECKOUT';

// Define an interface for the processed room to include active tenant info
interface ProcessedRoom extends Room {
  effectiveStatus: EffectiveRoomStatus; // The dynamically calculated status
  nextAvailableDate: Date;
  daysRemaining: number;
  isOverdue: boolean;
  isAvailableNow: boolean;
  activeTenant?: { // Add optional active tenant information
    id: string;
    nom: string;
    prenom: string;
    telephone?: string;
    email?: string;
  };
}

const getStatusBadge = (status: RoomStatus) => {
  const config = {
    Libre: { label: 'DISPONIBLE', className: 'status-available' },
    Occupé: { label: 'OCCUPÉ', className: 'status-occupied' },
    BOOKED: { label: 'RÉSERVÉ', className: 'status-booked' },
    PENDING_CHECKOUT: { label: 'DÉPART PRÉVU', className: 'status-pending-checkout' },
    Maintenance: { label: 'MAINTENANCE', className: 'bg-yellow-500 text-white' }, // Add Maintenance status badge
  };
  const { label, className } = config[status] || { label: status, className: 'bg-gray-400' };
  return (
    <Badge className={cn('font-medium text-xs px-3 py-1', className)}>
      {label}
    </Badge>
  );
};

const Rooms = () => {
  const { role, profile } = useAuth();
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: bookingsData } = useBookings(
    { status: ['CONFIRMED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'PENDING_CHECKOUT'] },
    { pageIndex: 0, pageSize: 1000 }
  );
  const bookings = bookingsData?.data || [];
  const { data: locations } = useLocations();
  const { selectedLocationId } = useLocationFilter();
  const { data: exchangeRateData } = useExchangeRate();
  const deleteRoom = useDeleteRoom();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [currentView, setCurrentView] = useState<'rooms' | 'locations'>('rooms');

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [editDialogActiveTab, setEditDialogActiveTab] = useState('details'); // New state for active tab

  const { options, setSearchTerm } = useGlobalFilters(rooms);

  const pageSubtitle = useMemo(() => {
    if (role === 'ADMIN') {
      if (selectedLocationId && locations) {
        const locationName = locations.find(l => l.id === selectedLocationId)?.nom;
        return `Gérez les appartements pour le site : ${locationName || 'Inconnu'}`;
      }
      return "Gérez les appartements de tous les sites.";
    }
    if (profile?.locations?.nom) {
      return `Appartements pour le site : ${profile.locations.nom}`;
    }
    if (profile?.location_id && locations) {
      const userLocation = locations.find(l => l.id === profile.location_id)?.nom;
      return `Appartements pour le site : ${userLocation || 'Mon site'}`;
    }
    return "Gérez les appartements de tous les sites.";
  }, [role, profile, selectedLocationId, locations]);

  const resetFilters = () => {
    setSearchTerm('');
    setRoomTypeFilter('all');
    setStatusFilter('all');
    setPriceRange({ min: null, max: null });
  };

  const uniqueRoomTypes = useMemo(() => Array.from(new Set(rooms.map(room => room.type))), [rooms]);

  const roomsWithEffectiveStatus: ProcessedRoom[] = useMemo(() => {
    const today = new Date();
    return rooms.map(room => {
      const { status: effectiveStatus, activeBooking } = getEffectiveRoomStatus(room, bookings, today);

      // Calcul des infos de disponibilité (peut être révisé pour utiliser activeBooking)
      const roomBookings = bookings
        .filter(b => b.room_id === room.id && ['CONFIRMED', 'IN_PROGRESS'].includes(b.status))
        .sort((a, b) => new Date(a.date_fin_prevue).getTime() - new Date(b.date_fin_prevue).getTime());

      const currentOrNextBooking = activeBooking || roomBookings[0]; // Prioritize activeBooking

      const isAvailableNow = effectiveStatus === 'Libre' || effectiveStatus === 'Nettoyage';
      const nextAvailableDate = isAvailableNow ? today : (currentOrNextBooking ? parseISO(currentOrNextBooking.date_fin_prevue) : today);

      const diff = differenceInDays(nextAvailableDate, today);
      const isOverdue = !isAvailableNow && diff < 0;
      const daysRemaining = isAvailableNow ? 0 : diff;

      let activeTenantInfo: ProcessedRoom['activeTenant'] | undefined;
      if (activeBooking && activeBooking.tenants && (activeBooking.tenants.nom || activeBooking.tenants.prenom)) {
        activeTenantInfo = {
          id: activeBooking.tenant_id,
          nom: activeBooking.tenants.nom || 'Inconnu', // Provide default if null
          prenom: activeBooking.tenants.prenom || 'Client', // Provide default if null
          telephone: activeBooking.tenants.telephone,
          email: activeBooking.tenants.email,
        };
      }

      return {
        ...room,
        effectiveStatus,
        status: effectiveStatus, // Override the static status with the effective one
        nextAvailableDate,
        daysRemaining,
        isOverdue,
        isAvailableNow,
        activeTenant: activeTenantInfo,
      };
    });
  }, [rooms, bookings]);

  const filteredRooms = useMemo(() => {
    return roomsWithEffectiveStatus.filter(room => {
      const searchLower = options.searchTerm?.toLowerCase() || '';
      const matchesSearch = !searchLower || (
        room.numero.toLowerCase().includes(searchLower) ||
        room.type.toLowerCase().includes(searchLower) ||
        room.locations?.nom?.toLowerCase().includes(searchLower)
      );
      const matchesType = roomTypeFilter === 'all' || room.type === roomTypeFilter;
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
      const matchesPrice =
        (priceRange.min === null || room.prix_base_nuit >= priceRange.min) &&
        (priceRange.max === null || room.prix_base_nuit <= priceRange.max);
      return matchesSearch && matchesType && matchesStatus && matchesPrice;
    });
  }, [roomsWithEffectiveStatus, options.searchTerm, roomTypeFilter, statusFilter, priceRange]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (options.searchTerm) count++;
    if (roomTypeFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (priceRange.min !== null || priceRange.max !== null) count++;
    return count;
  }, [options.searchTerm, roomTypeFilter, statusFilter, priceRange]);

  const handleDelete = async () => {
    if (deletingRoomId) {
      await deleteRoom.mutateAsync(deletingRoomId);
      setDeletingRoomId(null);
    }
  };

  const handleEditRoom = (room: Room) => {
    setEditDialogActiveTab('details'); // Default to details tab for editing
    setEditingRoom(room);
  };

  const handleViewReservations = (room: Room) => {
    setEditDialogActiveTab('reservations'); // Switch to reservations tab
    setEditingRoom(room);
  };

  if (roomsLoading) {
    return (
      <MainLayout title="APPARTEMENTS" subtitle={pageSubtitle}>
        <div className="flex items-center justify-center h-64"><p className="text-muted-foreground animate-pulse">Chargement des appartements...</p></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="APPARTEMENTS" subtitle={pageSubtitle}>
      <div className="space-y-6">
        <div className="flex border-b border-border">
          <button
            className={`pb-3 px-4 font-medium text-sm ${currentView === 'rooms' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setCurrentView('rooms')}
          >
            <div className="flex items-center gap-2"><Bed className="h-4 w-4" /> Appartements</div>
          </button>
          {role === 'ADMIN' && (
            <button
              className={`pb-3 px-4 font-medium text-sm ${currentView === 'locations' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setCurrentView('locations')}
            >
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Localités</div>
            </button>
          )}
        </div>

        {currentView === 'rooms' && (
          <div className="space-y-6">
            <div className="border rounded-lg p-4 mb-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un appartement (numéro, type, occupant)..."
                  value={options.searchTerm || ''}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                  <SelectTrigger><Bed className="h-4 w-4 mr-2" /><SelectValue placeholder="Type de chambre" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous types</SelectItem>
                    {uniqueRoomTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><Building2 className="h-4 w-4 mr-2" /><SelectValue placeholder="Statut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="Libre">Disponible</SelectItem>
                    <SelectItem value="Occupé">Occupé</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Min" type="number" value={priceRange.min ?? ''} onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value ? parseFloat(e.target.value) : null }))} className="pl-9" />
                  </div>
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Max" type="number" value={priceRange.max ?? ''} onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value ? parseFloat(e.target.value) : null }))} className="pl-9" />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-2 border-t">
                <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">{activeFiltersCount} {activeFiltersCount > 1 ? 'filtres actifs' : 'filtre actif'}</span></div>
                <Button variant="outline" size="sm" onClick={resetFilters}><span className="mr-1">Réinitialiser</span><X className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="flex justify-end">{role === 'ADMIN' && <CreateRoomDialog />}</div>

            {filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-lg border">
                <p className="text-lg font-medium text-foreground mb-2">{rooms.length === 0 ? 'Aucun appartement enregistré' : 'Aucun appartement trouvé'}</p>
                <p className="text-sm text-muted-foreground">{rooms.length === 0 ? 'Ajoutez votre premier appartement pour commencer' : 'Essayez de modifier votre recherche'}</p>
              </div>
            ) : (
              <div className="bg-card rounded-lg border shadow-soft overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary hover:bg-primary">
                      <TableHead className="text-primary-foreground font-semibold">N°</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">NOM & NUMÉRO</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">STATUT</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">CLIENT ACTUEL</TableHead> {/* NEW COLUMN */}
                      <TableHead className="text-primary-foreground font-semibold">LOCALITÉ</TableHead>
                      <TableHead className="text-primary-foreground font-semibold text-center">PROCHAINE DISPO.</TableHead>
                      <TableHead className="text-primary-foreground font-semibold text-center">JOURS RESTANTS</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">PRIX / NUIT</TableHead>
                      {role === 'ADMIN' && <TableHead className="text-primary-foreground font-semibold text-right">ACTIONS</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRooms.map((room, index) => (
                      <TableRow key={room.id} className="hover:bg-secondary/50">
                        <TableCell className="font-medium">{filteredRooms.indexOf(room) + 1}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">APPARTEMENT - {room.numero}</span>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">{room.type} • Étage {room.floor}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(room.status)}</TableCell>
                        <TableCell> {/* NEW CELL FOR ACTIVE TENANT */}
                          {room.activeTenant ? (
                            <div className="flex flex-col">
                              <span className="font-bold">{room.activeTenant.prenom} {room.activeTenant.nom?.toUpperCase()}</span>
                              {room.activeTenant.telephone && <span className="text-xs text-muted-foreground">{room.activeTenant.telephone}</span>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>{room.locations?.nom || <span className="text-muted-foreground">N/A</span>}</TableCell>
                        <TableCell className="text-center font-medium">
                          {room.isAvailableNow ? (
                            <span className="text-emerald-600">Maintenant</span>
                          ) : (
                            <span className="text-foreground">{format(room.nextAvailableDate, 'dd MMM yyyy', { locale: fr })}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {room.isAvailableNow ? (
                            <span className="text-emerald-600">—</span>
                          ) : (
                            <span className={cn(
                              "font-bold px-2 py-0.5 rounded text-xs transition-colors",
                              room.isOverdue
                                ? "bg-red-600 text-white animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                                : room.daysRemaining <= 1
                                  ? "bg-rose-100 text-rose-700 animate-pulse"
                                  : "bg-blue-100 text-blue-700"
                            )}>
                              {room.isOverdue ? `- ${Math.abs(room.daysRemaining)} jour${Math.abs(room.daysRemaining) > 1 ? 's' : ''}` : `${room.daysRemaining} jour${room.daysRemaining > 1 ? 's' : ''}`}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            <p className="text-foreground">{room.prix_base_nuit.toFixed(2)} $</p>
                            <p className="text-muted-foreground text-[10px] font-bold">({Math.round(room.prix_base_nuit * rate).toLocaleString('fr-FR')} FC)</p>
                          </div>
                        </TableCell>
                        {role === 'ADMIN' && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleViewReservations(room)}><CalendarDays className="h-4 w-4" /></Button>
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleEditRoom(room)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => setDeletingRoomId(room.id)}><Trash2 className="h-4 w-4" /></Button>
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

        {currentView === 'locations' && (<div className="space-y-6"><LocationManagement /></div>)}
      </div>

      <EditRoomDialog
        room={editingRoom}
        open={!!editingRoom}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRoom(null);
          }
        }}
        initialActiveTab={editDialogActiveTab} // Pass the initial active tab
      />
      <AlertDialog open={!!deletingRoomId} onOpenChange={() => setDeletingRoomId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cet appartement ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible et supprimera l'appartement définitivement.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleteRoom.isPending}>{deleteRoom.isPending ? 'Suppression...' : 'Supprimer'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Rooms;