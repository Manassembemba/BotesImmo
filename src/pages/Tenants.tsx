import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { CreateTenantDialog } from '@/components/tenants/CreateTenantDialog';
import { EditTenantDialog } from '@/components/tenants/EditTenantDialog';
import { TenantBookingsDialog } from '@/components/tenants/TenantBookingsDialog';
import {
  Search,
  Mail,
  Phone,
  Calendar,
  Filter,
  Plus,
  History,
  Users,
  UserCheck,
  Award,
  AlertTriangle,
  LayoutGrid,
  List,
  MoreVertical,
  Edit2,
  Trash2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  ArrowUpDown,
} from 'lucide-react';
import { useTenants, useUpdateTenant, useDeleteTenant, Tenant } from '@/hooks/useTenants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useLocations } from '@/hooks/useLocations';
import { useLocationFilter } from '@/context/LocationFilterContext';
import { cn } from '@/lib/utils';

type SortOption = 'recent' | 'bookings_desc' | 'name_asc';

const Tenants = () => {
  const { role, profile } = useAuth();
  const { selectedLocationId } = useLocationFilter();
  const { data: locations } = useLocations();
  const { data: tenants = [], isLoading } = useTenants();
  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();

  const [search, setSearch] = useState('');
  const [blacklistFilter, setBlacklistFilter] = useState('all');
  const [loyaltyFilter, setLoyaltyFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Dialog states
  const [bookingHistoryTenant, setBookingHistoryTenant] = useState<{ id: string; name: string } | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);

  // KPIs
  const stats = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter(t => (t.booking_count || 0) > 0).length;
    const loyal = tenants.filter(t => (t.booking_count || 0) >= 2).length;
    const blacklisted = tenants.filter(t => t.liste_noire).length;

    return { total, active, loyal, blacklisted };
  }, [tenants]);

  // Filtering and sorting
  const filteredTenants = useMemo(() => {
    let result = tenants.filter(tenant => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        tenant.nom.toLowerCase().includes(searchLower) ||
        tenant.prenom.toLowerCase().includes(searchLower) ||
        (tenant.email && tenant.email.toLowerCase().includes(searchLower)) ||
        (tenant.telephone && tenant.telephone.toLowerCase().includes(searchLower)) ||
        (tenant.id_document && tenant.id_document.toLowerCase().includes(searchLower));

      const matchesBlacklist =
        blacklistFilter === 'all' ||
        (blacklistFilter === 'true' && tenant.liste_noire) ||
        (blacklistFilter === 'false' && !tenant.liste_noire);

      const bookingCount = tenant.booking_count || 0;
      const matchesLoyalty =
        loyaltyFilter === 'all' ||
        (loyaltyFilter === 'new' && bookingCount === 0) ||
        (loyaltyFilter === 'active' && bookingCount >= 1 && bookingCount < 3) ||
        (loyaltyFilter === 'vip' && bookingCount >= 3);

      return matchesSearch && matchesBlacklist && matchesLoyalty;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'bookings_desc') {
        return (b.booking_count || 0) - (a.booking_count || 0);
      }
      if (sortBy === 'name_asc') {
        return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`);
      }
      // 'recent' by default
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [tenants, search, blacklistFilter, loyaltyFilter, sortBy]);

  const subtitle = useMemo(() => {
    const tenantCount = filteredTenants.length;
    const countText = `${tenantCount} locataire${tenantCount > 1 ? 's' : ''}`;

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

  const handleToggleBlacklist = async (tenant: Tenant) => {
    try {
      await updateTenant.mutateAsync({
        id: tenant.id,
        liste_noire: !tenant.liste_noire,
      });
    } catch (error) {
      console.error('Erreur bascule liste noire:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTenant) return;
    try {
      await deleteTenant.mutateAsync(deletingTenant.id);
      setDeletingTenant(null);
    } catch (error) {
      console.error('Erreur suppression locataire:', error);
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
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Locataires</p>
              <p className="text-2xl font-black text-foreground mt-1">{stats.total}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avec Séjours</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fidèles (2+)</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{stats.loyal}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Liste Noire</p>
              <p className="text-2xl font-black text-destructive mt-1">{stats.blacklisted}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Action Bar & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-muted/20 p-3 sm:p-4 rounded-xl border border-border/50">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher nom, tél, email, pièce..."
                className="pl-9 h-10 text-base sm:text-sm bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={blacklistFilter} onValueChange={setBlacklistFilter}>
              <SelectTrigger className="w-[145px] h-10 bg-white text-xs sm:text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5 opacity-60" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="false">Actifs</SelectItem>
                <SelectItem value="true">Liste noire</SelectItem>
              </SelectContent>
            </Select>

            <Select value={loyaltyFilter} onValueChange={setLoyaltyFilter}>
              <SelectTrigger className="w-[145px] h-10 bg-white text-xs sm:text-sm">
                <Award className="h-3.5 w-3.5 mr-1.5 opacity-60" />
                <SelectValue placeholder="Fidélité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes fidélités</SelectItem>
                <SelectItem value="new">Nouveaux (0)</SelectItem>
                <SelectItem value="active">Réguliers (1-2)</SelectItem>
                <SelectItem value="vip">Fidèles (3+)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[155px] h-10 bg-white text-xs sm:text-sm">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 opacity-60" />
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récents</SelectItem>
                <SelectItem value="bookings_desc">Plus de séjours</SelectItem>
                <SelectItem value="name_asc">Nom A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-white border border-border rounded-lg p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode('grid')}
                title="Affichage en cartes"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode('table')}
                title="Affichage en tableau"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {(role === 'ADMIN' || role === 'AGENT_RES') && (
              <CreateTenantDialog
                trigger={
                  <Button className="h-10 gap-2 font-bold shadow-sm">
                    <Plus className="h-4 w-4" />
                    Ajouter un locataire
                  </Button>
                }
              />
            )}
          </div>
        </div>

        {/* Content Display */}
        {filteredTenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-2xl border border-dashed border-border p-8">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-lg font-bold text-foreground mb-1">
              {tenants.length === 0 && !search && blacklistFilter === 'all'
                ? 'Aucun locataire enregistré'
                : 'Aucun locataire ne correspond à vos critères'}
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              {tenants.length === 0 && !search && blacklistFilter === 'all'
                ? 'Ajoutez votre premier client pour commencer à gérer ses séjours.'
                : 'Essayez de modifier votre recherche ou de réinitialiser vos filtres.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTenants.map((tenant, index) => {
              const reservationCount = tenant.booking_count || 0;
              const initials = `${tenant.prenom?.[0] || ''}${tenant.nom?.[0] || ''}`.toUpperCase() || 'L';

              return (
                <div
                  key={tenant.id}
                  className={cn(
                    "rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group",
                    tenant.liste_noire && "border-destructive/30 bg-destructive/[0.02]"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-2xl font-black text-base shrink-0 shadow-inner",
                          tenant.liste_noire
                            ? "bg-destructive/10 text-destructive"
                            : reservationCount >= 3
                            ? "bg-amber-100 text-amber-800"
                            : "bg-indigo-50 text-indigo-700"
                        )}>
                          {initials}
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-foreground leading-tight">
                            {tenant.prenom} {tenant.nom?.toUpperCase()}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            {tenant.liste_noire ? (
                              <Badge variant="destructive" className="text-[10px] h-5 gap-1 font-bold">
                                <ShieldAlert className="h-3 w-3" /> Liste Noire
                              </Badge>
                            ) : reservationCount >= 3 ? (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] h-5 gap-1 font-bold">
                                <Award className="h-3 w-3" /> VIP ({reservationCount} séjours)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground font-normal">
                                {reservationCount} séjour{reservationCount > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Dropdown Menu Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer font-medium"
                            onClick={() => setEditingTenant(tenant)}
                          >
                            <Edit2 className="h-4 w-4 text-indigo-600" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer font-medium"
                            onClick={() => setBookingHistoryTenant({ id: tenant.id, name: `${tenant.prenom} ${tenant.nom}` })}
                          >
                            <History className="h-4 w-4 text-primary" />
                            Historique des séjours
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer font-medium"
                            onClick={() => handleToggleBlacklist(tenant)}
                          >
                            {tenant.liste_noire ? (
                              <>
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                Retirer de la liste noire
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="h-4 w-4 text-destructive" />
                                Inscrire sur liste noire
                              </>
                            )}
                          </DropdownMenuItem>
                          {(role === 'ADMIN') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-destructive focus:text-destructive font-medium"
                                onClick={() => setDeletingTenant(tenant)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-1.5 text-xs text-muted-foreground pt-1">
                      {tenant.telephone && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-700">{tenant.telephone}</span>
                        </p>
                      )}
                      {tenant.email && (
                        <p className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{tenant.email}</span>
                        </p>
                      )}
                      {tenant.id_document && (
                        <p className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>ID: {tenant.id_document}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        Inscrit en {format(new Date(tenant.created_at), 'MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs font-semibold flex-1 bg-white hover:bg-muted"
                      onClick={() => setBookingHistoryTenant({ id: tenant.id, name: `${tenant.prenom} ${tenant.nom}` })}
                    >
                      <History className="h-3.5 w-3.5 text-indigo-600" />
                      Séjours ({reservationCount})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 bg-white hover:bg-muted shrink-0"
                      onClick={() => setEditingTenant(tenant)}
                      title="Modifier les informations"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-bold text-xs">LOCATAIRE</TableHead>
                  <TableHead className="font-bold text-xs">CONTACT</TableHead>
                  <TableHead className="font-bold text-xs">PIÈCE D'IDENTITÉ</TableHead>
                  <TableHead className="font-bold text-xs text-center">SÉJOURS</TableHead>
                  <TableHead className="font-bold text-xs">STATUT</TableHead>
                  <TableHead className="font-bold text-xs text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => {
                  const reservationCount = tenant.booking_count || 0;
                  return (
                    <TableRow key={tenant.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <div className="font-bold text-sm text-foreground">
                          {tenant.prenom} {tenant.nom?.toUpperCase()}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Inscrit le {format(new Date(tenant.created_at), 'dd/MM/yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <div className="font-semibold text-slate-700">{tenant.telephone || '—'}</div>
                          <div className="text-muted-foreground truncate max-w-[180px]">{tenant.email || '—'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tenant.id_document || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          "font-bold text-xs",
                          reservationCount >= 3 ? "bg-amber-50 text-amber-700 border-amber-200" : ""
                        )}>
                          {reservationCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tenant.liste_noire ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            Liste Noire
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            Actif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold"
                            onClick={() => setBookingHistoryTenant({ id: tenant.id, name: `${tenant.prenom} ${tenant.nom}` })}
                          >
                            <History className="h-3.5 w-3.5" />
                            Séjours
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-slate-900"
                            onClick={() => setEditingTenant(tenant)}
                            title="Modifier"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          {role === 'ADMIN' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingTenant(tenant)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Tenant Dialog */}
      {editingTenant && (
        <EditTenantDialog
          tenant={editingTenant}
          open={!!editingTenant}
          onOpenChange={(open) => !open && setEditingTenant(null)}
        />
      )}

      {/* Tenant Bookings Dialog */}
      {bookingHistoryTenant && (
        <TenantBookingsDialog
          tenantId={bookingHistoryTenant.id}
          tenantName={bookingHistoryTenant.name}
          open={!!bookingHistoryTenant}
          onOpenChange={(open) => !open && setBookingHistoryTenant(null)}
        />
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deletingTenant} onOpenChange={(open) => !open && setDeletingTenant(null)}>
        <AlertDialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Supprimer ce locataire ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Êtes-vous sûr de vouloir supprimer définitivement la fiche de{' '}
              <span className="font-bold text-foreground">
                {deletingTenant?.prenom} {deletingTenant?.nom}
              </span>
              ?
              {(deletingTenant?.booking_count || 0) > 0 && (
                <span className="block mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                  ⚠️ Ce locataire a {deletingTenant?.booking_count} réservation(s) enregistrée(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-4">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white font-bold"
              onClick={handleConfirmDelete}
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
