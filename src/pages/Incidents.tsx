import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIncidents } from '@/hooks/useIncidents';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const getSeverityStyle = (severity: string) => {
  const styles: Record<string, string> = {
    LOW: 'bg-secondary text-muted-foreground',
    MEDIUM: 'bg-status-pending-checkout-bg text-status-pending-checkout',
    HIGH: 'bg-destructive/10 text-destructive',
  };
  return styles[severity] || styles.LOW;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'OPEN':
      return <AlertTriangle className="h-4 w-4 text-status-pending-checkout" />;
    case 'IN_PROGRESS':
      return <Clock className="h-4 w-4 text-status-occupied" />;
    case 'RESOLVED':
      return <CheckCircle className="h-4 w-4 text-status-available" />;
    default:
      return null;
  }
};

const getSeverityLabel = (severity: string) => {
  const labels: Record<string, string> = {
    HIGH: 'Urgent',
    MEDIUM: 'Modéré',
    LOW: 'Faible',
  };
  return labels[severity] || severity;
};

const Incidents = () => {
  const { data: incidents = [], isLoading } = useIncidents();

  if (isLoading) {
    return (
      <MainLayout title="Incidents" subtitle="Chargement...">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Chargement des incidents...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Incidents" subtitle="Suivi des problèmes et maintenance">
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex items-center justify-end">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Signaler un incident
          </Button>
        </div>

        {/* List */}
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border bg-card">
            <p className="text-lg font-medium text-foreground mb-2">Aucun incident signalé</p>
            <p className="text-sm text-muted-foreground">Les incidents seront affichés ici</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident, index) => (
              <div 
                key={incident.id}
                className="rounded-xl border bg-card p-5 shadow-soft hover:shadow-medium transition-all animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5">{getStatusIcon(incident.status)}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">Chambre {incident.rooms?.numero}</h3>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getSeverityStyle(incident.severity))}>
                          {getSeverityLabel(incident.severity)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{incident.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Signalé le {format(new Date(incident.created_at), 'dd/MM/yyyy', { locale: fr })}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Détails
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Incidents;
