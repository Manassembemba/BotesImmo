import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { CreateTenantDialog } from '@/components/tenants/CreateTenantDialog';
import { Search, Mail, Phone, Calendar, Filter, Plus } from 'lucide-react'; // Added Filter and Plus icons
import { useTenants } from '@/hooks/useTenants';
import { useBookings } from '@/hooks/useBookings';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Select, // Added Select
  SelectContent, // Added SelectContent
  SelectItem, // Added SelectItem
  SelectTrigger, // Added SelectTrigger
  SelectValue, // Added SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const Tenants = () => {
  const { role } = useAuth();
  const { data: tenants = [], isLoading } = useTenants();
        const { data: bookingsResult } = useBookings();
  const bookings = bookingsResult?.data || [];
  const [search, setSearch] = useState(''); // Re-added search state
  const [blacklistFilter, setBlacklistFilter] = useState('all'); // New state for blacklist filter

  const filteredTenants = useMemo(() => {
    return tenants.filter(tenant => {
      const searchLower = search.toLowerCase();
      const matchesSearch = (
        tenant.nom.toLowerCase().includes(searchLower) ||
        tenant.prenom.toLowerCase().includes(searchLower) ||
        // tenant.email is optional and might have been removed from form, but exists in DB
        (tenant.email && tenant.email.toLowerCase().includes(searchLower)) ||
        (tenant.telephone && tenant.telephone.toLowerCase().includes(searchLower))
      );

      const matchesBlacklist =
        blacklistFilter === 'all' ||
        (blacklistFilter === 'true' && tenant.liste_noire) ||
        (blacklistFilter === 'false' && !tenant.liste_noire);

      return matchesSearch && matchesBlacklist;
    });
  }, [tenants, search, blacklistFilter]); // Added blacklistFilter to dependencies

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
    <MainLayout title="Locataires" subtitle={`${filteredTenants.length} locataire${filteredTenants.length > 1 ? 's' : ''} trouvé${filteredTenants.length > 1 ? 's' : ''}`}>
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4"> {/* Adjusted gap and layout */}
          <div className="relative flex-1 max-w-xs"> {/* Adjusted width */}
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un locataire..."
              className="pl-9"
              value={search} // Bind value to state
              onChange={(e) => setSearch(e.target.value)} // Add onChange handler
            />
          </div>
          {/* New Select filter for blacklist status */}
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
          {/* CreateTenantDialog moved and uses trigger prop */}
          {(role === 'ADMIN' || role === 'AGENT_RES') && (
            <CreateTenantDialog trigger={
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un locataire
              </Button>
            } />
          )}
        </div>

        {/* Grid */}
        {filteredTenants.length === 0 ? ( // Use filteredTenants
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
            {filteredTenants.map((tenant, index) => { // Use filteredTenants
              const reservationCount = bookings.filter(r => r.tenant_id === tenant.id).length;

              return (
                <div
                  key={tenant.id}
                  className="rounded-xl border bg-card p-5 shadow-soft hover:shadow-medium transition-all cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
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
                    {tenant.liste_noire && (
                      <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                        Liste noire
                      </span>
                    )}
                    {tenant.notes && !tenant.liste_noire && (
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground truncate max-w-[120px]">
                        {tenant.notes}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Tenants;
