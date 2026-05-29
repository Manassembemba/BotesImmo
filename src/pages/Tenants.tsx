import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { CreateTenantDialog } from '@/components/tenants/CreateTenantDialog';
import { EditTenantDialog } from '@/components/tenants/EditTenantDialog';
import { TenantBookingsDialog } from '@/components/tenants/TenantBookingsDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Search, Mail, Phone, Calendar, Filter, Plus, Eye, History, MoreVertical, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useTenants, useDeleteTenant, Tenant } from '@/hooks/useTenants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLocations } from '@/hooks/useLocations';
import { useLocationFilter } from '@/context/LocationFilterContext';

const Tenants = () => {
  const { role, profile } = useAuth();
  const { selectedLocationId } = useLocationFilter();
  const { data: locations } = useLocations();
  const { data: tenants = [], isLoading } = useTenants();
  const deleteTenant = useDeleteTenant();

  const [search, setSearch] = useState('');
  const [blacklistFilter, setBlacklistFilter] = useState('all');
  const [selectedTenantForBookings, setSelectedTenantForBookings] = useState<{ id: string; name: string } | null>(null);
  const [tenantToEdit, setTenantToEdit] = useState<Tenant | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [deleteRelatedData, setDeleteRelatedData] = useState(false);

  const filteredTenants = useMemo(() => {
    return tenants.filter(tenant => {
      const searchLower = search.toLowerCase();
      const matchesSearch = (
        tenant.nom.toLowerCase().includes(searchLower) ||
        tenant.prenom.toLowerCase().includes(searchLower) ||
        (tenant.email && tenant.email.toLowerCase().includes(searchLower)) ||
        (tenant.telephone && tenant.telephone.toLowerCase().includes(searchLower))
      );

      const matchesBlacklist =
        blacklistFilter === 'all' ||
        (blacklistFilter === 'true' && tenant.liste_noire) ||
        (blacklistFilter === 'false' && !tenant.liste_noire);

      return matchesSearch && matchesBlacklist;
    });
  }, [tenants, search, blacklistFilter]);

  const subtitle = useMemo(() => {
    const tenantCount = filteredTenants.length;
    const countText = `${tenantCount} locataire${tenantCount > 1 ? 's' : ''} trouvé${tenantCount > 1 ? 's' : ''}`;

    if (role === 'ADMIN') {
      if (selectedLocationId && locations) {
        const locationName = locations.find(l => l.id === selectedLocationId)?.nom;
        return `${countText} pour : ${locationName || 'site inconnu'}`;
      }
      return `Vue globale - ${countText}`;
    }
    if (profile?.location_id && locations) {
      const userLocation = locations.find(l => l.id === profile.location_id)?.nom;
      return `${countText} pour : ${userLocation || 'Mon site'}`;
    }
    return countText;
  }, [role, profile, filteredTenants.length, selectedLocationId, locations]);

  const handleDeleteConfirm = async () => {
    if (tenantToDelete) {
      await deleteTenant.mutateAsync({ id: tenantToDelete.id, deleteData: deleteRelatedData });
      setTenantToDelete(null);
      setDeleteRelatedData(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Locataires" subtitle="Chargement...">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Chargement des locataires...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Locataires" subtitle={subtitle}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un locataire..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={blacklistFilter} onValueChange={setBlacklistFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Liste noire" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous locataires</SelectItem>
              <SelectItem value="true">Sur liste noire</SelectItem>
              <SelectItem value="false">Hors liste noire</SelectItem>
            </SelectContent>
          </Select>
          {(role === 'ADMIN' || role === 'AGENT_RES') && (
            <CreateTenantDialog trigger={
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un locataire
              </Button>
            } />
          )}
        </div>

        {filteredTenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-foreground mb-2">
              {tenants.length === 0 && !search && blacklistFilter === 'all' ? 'Aucun locataire enregistré' : 'Aucun locataire trouvé avec ces filtres'}
            </p>
            <p className="text-sm text-muted-foreground">
              {tenants.length === 0 && !search && blacklistFilter === 'all' ? 'Ajoutez votre premier locataire pour commencer' : 'Essayez de modifier votre recherche ou vos filtres'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTenants.map((tenant, index) => {
              const reservationCount = tenant.booking_count || 0;

              return (
                <div
                  key={tenant.id}
                  className="rounded-xl border bg-card p-5 shadow-soft hover:shadow-medium transition-all cursor-pointer animate-fade-in group relative"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => setSelectedTenantForBookings({ id: tenant.id, name: `${tenant.prenom} ${tenant.nom}` })}
                >
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {(role === 'ADMIN' || role === 'AGENT_RES') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setTenantToEdit(tenant);
                          }}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTenantToDelete(tenant);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <History className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
                      {tenant.prenom.charAt(0)}{tenant.nom.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">
                        {tenant.prenom} {tenant.nom}
                      </h3>
                      <div className="mt-2 space-y-1">
                        {tenant.email && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5" />
                            {tenant.email}
                          </p>
                        )}
                        {tenant.telephone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5" />
                            {tenant.telephone}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          Client depuis {format(new Date(tenant.created_at), 'MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{reservationCount}</span>
                      <span className="text-muted-foreground ml-1">réservation{reservationCount > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {tenant.liste_noire && (
                        <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                          Liste noire
                        </span>
                      )}
                      <div className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Détails <Eye className="h-3 w-3" />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTenantForBookings({ id: tenant.id, name: `${tenant.prenom} ${tenant.nom}` });
                        }}
                      >
                        <History className="h-3.5 w-3.5" />
                        Réservations
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedTenantForBookings && (
        <TenantBookingsDialog
          tenantId={selectedTenantForBookings.id}
          tenantName={selectedTenantForBookings.name}
          open={!!selectedTenantForBookings}
          onOpenChange={(open) => !open && setSelectedTenantForBookings(null)}
        />
      )}

      {tenantToEdit && (
        <EditTenantDialog
          tenant={tenantToEdit}
          open={!!tenantToEdit}
          onOpenChange={(open) => !open && setTenantToEdit(null)}
        />
      )}

      <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => {
        if (!open) {
          setTenantToDelete(null);
          setDeleteRelatedData(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Supprimer le locataire ?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Êtes-vous sûr de vouloir supprimer <strong>{tenantToDelete?.prenom} {tenantToDelete?.nom}</strong> ? 
              </p>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="deleteRelatedData" 
                  checked={deleteRelatedData}
                  onCheckedChange={(checked) => setDeleteRelatedData(checked === true)}
                />
                <Label htmlFor="deleteRelatedData">Supprimer aussi ses réservations et factures</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Si cette option est décochée, les réservations et factures deviendront orphelines (non liées à un locataire).
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Tenants;
