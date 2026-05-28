import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { 
  RefreshCw, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Calendar,
  Zap,
  Settings,
  Download,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';

interface SyncStats {
  total_rooms: number;
  rooms_synced: number;
  pending_checkouts: number;
  cleaning_in_progress: number;
  transitions_24h: number;
  last_sync: string | null;
}

interface RoomTransition {
  id: string;
  room_number: string;
  previous_status: string;
  new_status: string;
  transition_type: string;
  reason: string | null;
  created_at: string;
  triggered_by_label: string;
}

interface RoomSyncStatus {
  room_id: string;
  room_number: string;
  current_status: string;
  location_name: string | null;
  current_booking_id: string | null;
  booking_status: string | null;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  check_out_reel: string | null;
  hours_since_checkout: number | null;
  hours_until_checkout: number | null;
  current_task_id: string | null;
  task_type: string | null;
  task_status: string | null;
  last_transition_at: string | null;
  last_transition_to: string | null;
  transitions_last_24h: number;
}

export default function SyncDashboard() {
  const { toast } = useToast();
  const { role } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch sync statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<SyncStats>({
    queryKey: ['sync-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sync_statistics');
      if (error) throw error;
      
      const statsData = Array.isArray(data) ? data[0] : data;
      
      return statsData || {
        total_rooms: 0,
        rooms_synced: 0,
        pending_checkouts: 0,
        cleaning_in_progress: 0,
        transitions_24h: 0,
        last_sync: null,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent transitions
  const { data: transitions, isLoading: transitionsLoading } = useQuery<RoomTransition[]>({
    queryKey: ['room-transitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_transitions_recent')
        .select('*')
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch rooms needing attention
  const { data: roomsNeedingAttention, isLoading: roomsLoading } = useQuery<RoomSyncStatus[]>({
    queryKey: ['rooms-needing-attention'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_sync_dashboard')
        .select('*')
        .or('current_status.eq.A_NETTOYER,current_status.eq.PENDING_CHECKOUT,hours_until_checkout.lt.2')
        .order('room_number');
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase.rpc('sync_room_statuses');
      
      if (error) throw error;

      toast({
        title: "Synchronisation réussie",
        description: `${data || 0} chambre(s) mise(s) à jour.`,
      });

      refetchStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de synchronisation",
        description: error.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerAutoCheckout = async () => {
    try {
      setIsSyncing(true);
      
      const { data, error } = await supabase.functions.invoke('auto-checkout-processor');
      
      if (error) throw error;

      toast({
        title: "Check-out automatique déclenché",
        description: `${data?.data?.rooms_updated || 0} chambres mises à jour.`,
      });

      refetchStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: string }> = {
      'Libre': { label: 'Libre', variant: 'default' },
      'Occupé': { label: 'Occupé', variant: 'destructive' },
      'BOOKED': { label: 'Réservée', variant: 'secondary' },
      'PENDING_CHECKOUT': { label: 'Départ imminent', variant: 'outline' },
      'A_NETTOYER': { label: 'À nettoyer', variant: 'destructive' },
      'Nettoyage': { label: 'Nettoyage', variant: 'secondary' },
      'Maintenance': { label: 'Maintenance', variant: 'outline' },
    };
    
    const { label, variant } = config[status] || { label: status, variant: 'secondary' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getTransitionTypeBadge = (type: string) => {
    const config: Record<string, { label: string; icon: any }> = {
      'MANUAL': { label: 'Manuel', icon: Settings },
      'AUTOMATIC': { label: 'Auto', icon: Zap },
      'TRIGGER': { label: 'Trigger', icon: Activity },
      'CRON': { label: 'Cron', icon: Clock },
    };
    
    const { label, icon: Icon } = config[type] || { label: type, icon: Activity };
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <MainLayout 
      title="Tableau de Bord de Synchronisation" 
      subtitle="Supervision en temps réel des statuts et automatisations"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Africa/Lubumbashi (UTC+2)
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Sync: Toutes les 15 min
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerAutoCheckout}
              disabled={isSyncing}
            >
              <Zap className="h-4 w-4 mr-2" />
              Check-out Auto
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Synchroniser
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <StatsCard
                title="Total Chambres"
                value={stats?.total_rooms?.toString() || '0'}
                subtitle="Chambres configurées"
                icon={Activity}
                variant="primary"
              />
              <StatsCard
                title="Check-outs en Attente"
                value={stats?.pending_checkouts?.toString() || '0'}
                subtitle="Départs à traiter"
                icon={Clock}
                variant="warning"
              />
              <StatsCard
                title="Nettoyages en Cours"
                value={stats?.cleaning_in_progress?.toString() || '0'}
                subtitle="Chambres en nettoyage"
                icon={RefreshCw}
                variant="secondary"
              />
              <StatsCard
                title="Transitions (24h)"
                value={stats?.transitions_24h?.toString() || '0'}
                subtitle="Changements de statut"
                icon={TrendingUp}
                variant="success"
              />
            </>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="attention" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="attention" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Requiert Attention
            </TabsTrigger>
            <TabsTrigger value="transitions" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Transitions Récentes
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Paramètres
            </TabsTrigger>
          </TabsList>

          {/* Tab: Rooms Requiring Attention */}
          <TabsContent value="attention" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Chambres Requérant Attention
                </CardTitle>
                <CardDescription>
                  Chambres en attente de check-out, nettoyage, ou avec des délais critiques
                </CardDescription>
              </CardHeader>
              <CardContent>
                {roomsLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Chargement...</p>
                  </div>
                ) : roomsNeedingAttention?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Toutes les chambres sont à jour</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chambre</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Localisation</TableHead>
                        <TableHead>Réservation</TableHead>
                        <TableHead>Délai</TableHead>
                        <TableHead>Tâche</TableHead>
                        <TableHead>Dernière Transition</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roomsNeedingAttention && roomsNeedingAttention.length > 0 ? (
                        roomsNeedingAttention.map((room) => (
                          <TableRow key={room.room_id}>
                            <TableCell className="font-bold">{room.room_number}</TableCell>
                            <TableCell>{getStatusBadge(room.current_status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {room.location_name || 'N/A'}
                            </TableCell>
                          <TableCell>
                            {room.current_booking_id ? (
                              <div className="text-xs">
                                <Badge variant="outline">{room.booking_status}</Badge>
                                <div className="text-muted-foreground mt-1">
                                  {room.date_fin_prevue ? format(new Date(room.date_fin_prevue), 'dd/MM HH:mm') : 'N/A'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Aucune</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {room.hours_until_checkout !== null && room.hours_until_checkout < 2 ? (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {room.hours_until_checkout.toFixed(1)}h avant départ
                              </Badge>
                            ) : room.hours_since_checkout !== null ? (
                              <Badge variant="secondary" className="text-xs">
                                +{room.hours_since_checkout.toFixed(1)}h après départ
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {room.current_task_id ? (
                              <Badge variant="outline">
                                {room.task_type} - {room.task_status}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {room.last_transition_at ? (
                              <div className="text-xs">
                                <div>{format(new Date(room.last_transition_at), 'dd/MM HH:mm')}</div>
                                <div className="text-muted-foreground">{room.last_transition_to}</div>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Aucune chambre ne nécessite d'attention
                        </TableCell>
                      </TableRow>
                    )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Recent Transitions */}
          <TabsContent value="transitions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Historique des Transitions
                </CardTitle>
                <CardDescription>
                  Les 50 dernières transitions de statuts de chambres
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transitionsLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Chargement...</p>
                  </div>
                ) : transitions?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Aucune transition enregistrée</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Chambre</TableHead>
                        <TableHead>Transition</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Raison</TableHead>
                        <TableHead>Déclenché Par</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transitions?.map((transition) => (
                        <TableRow key={transition.id}>
                          <TableCell className="text-sm">
                            {format(new Date(transition.created_at), 'dd/MM HH:mm:ss')}
                          </TableCell>
                          <TableCell className="font-bold">{transition.room_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{transition.previous_status}</Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge variant={transition.new_status === 'Libre' ? 'default' : 'destructive'}>
                                {transition.new_status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>{getTransitionTypeBadge(transition.transition_type)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {transition.reason || '-'}
                          </TableCell>
                          <TableCell>{transition.triggered_by_label}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Settings */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres de Synchronisation</CardTitle>
                <CardDescription>
                  Configuration des automatisations et règles de synchronisation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Heure de Check-out</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">11:00 (par défaut)</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Les check-outs automatiques sont déclenchés à cette heure
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Durée de Nettoyage</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">1 heure (par défaut)</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Temps alloué avant passage à "Libre"
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Synchronisation Auto</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Toutes les 15 minutes</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Exécution automatique de sync_room_statuses()
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Check-out Automatique</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Activé (11h-23h)</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Traitement automatique des départs
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Modifier les paramètres
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter les logs
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Système de Synchronisation Automatisé
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Les statuts des chambres sont synchronisés automatiquement toutes les 15 minutes. 
                Les check-outs sont traités automatiquement à partir de 11h00. 
                Timezone: <strong>Africa/Lubumbashi (UTC+2)</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
