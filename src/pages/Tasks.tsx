import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTasks, useUpdateTaskStatus } from '@/hooks/useTasks';
import { useRooms, useUpdateRoomStatus } from '@/hooks/useRooms';
import { CheckCircle2, Clock, Loader2, Sparkles, Wrench, Package } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react'; // Added useMemo

const taskTypeConfig = {
  NETTOYAGE: { label: 'Nettoyage', icon: Sparkles, color: 'bg-blue-100 text-blue-800' },
  REPARATION: { label: 'Réparation', icon: Wrench, color: 'bg-orange-100 text-orange-800' },
  INVENTAIRE: { label: 'Inventaire', icon: Package, color: 'bg-purple-100 text-purple-800' },
};

const statusConfig = {
  TO_DO: { label: 'À faire', color: 'bg-yellow-100 text-yellow-800' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Terminé', color: 'bg-green-100 text-green-800' },
};

export default function Tasks() {
  const { role, profile } = useAuth(); // Get profile for location info
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: rooms = [] } = useRooms();
  const updateTaskStatus = useUpdateTaskStatus();
  const updateRoomStatus = useUpdateRoomStatus();

  const pendingTasks = tasks.filter(t => t.status_tache !== 'COMPLETED');
  const completedTasks = tasks.filter(t => t.status_tache === 'COMPLETED');

  const handleStartTask = (taskId: string) => {
    updateTaskStatus.mutate({ id: taskId, status_tache: 'IN_PROGRESS' });
  };

  const handleCompleteTask = async (taskId: string, roomId: string, taskType: string) => {
    // Mark task as completed
    await updateTaskStatus.mutateAsync({
      id: taskId,
      status_tache: 'COMPLETED',
      date_completion: new Date().toISOString(),
    });

    // If it's a cleaning task, transition room to AVAILABLE
    if (taskType === 'NETTOYAGE') {
      const room = rooms.find(r => r.id === roomId);
      if (room && room.status === 'Nettoyage') {
        await updateRoomStatus.mutateAsync({ id: roomId, status: 'Libre' });
      }
    }
  };

  const subtitle = useMemo(() => {
    if (role === 'ADMIN') {
      return "Gestion des tâches opérationnelles pour toutes les localités.";
    }
    if (profile?.locations?.nom) {
      return `Gestion des tâches pour la localité : ${profile.locations.nom}`;
    }
    return "Gestion des tâches opérationnelles.";
  }, [role, profile]);

  if (tasksLoading) {
    return (
      <MainLayout title="Tâches" subtitle={subtitle}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Tâches" subtitle={subtitle}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Tâches en attente ({pendingTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune tâche en attente
              </p>
            ) : (
              pendingTasks.map((task) => {
                const typeConfig = taskTypeConfig[task.type_tache];
                const status = statusConfig[task.status_tache];
                const TypeIcon = typeConfig.icon;

                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card"
                  >
                    <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          Chambre {task.rooms?.numero || 'N/A'}
                        </span>
                        <Badge variant="outline" className={status.color}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {typeConfig.label}
                        {task.description && ` - ${task.description} `}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Créée le {format(new Date(task.date_creation || task.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                    {(role === 'ADMIN' || role === 'AGENT_OP') && (
                      <div className="flex gap-2">
                        {task.status_tache === 'TO_DO' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartTask(task.id)}
                            disabled={updateTaskStatus.isPending}
                          >
                            Commencer
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleCompleteTask(task.id, task.room_id, task.type_tache)}
                          disabled={updateTaskStatus.isPending || updateRoomStatus.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Terminer
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Completed Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Tâches terminées ({completedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {completedTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune tâche terminée
              </p>
            ) : (
              completedTasks.slice(0, 10).map((task) => {
                const typeConfig = taskTypeConfig[task.type_tache];
                const TypeIcon = typeConfig.icon;

                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30"
                  >
                    <div className={`p-2 rounded-lg ${typeConfig.color} opacity-60`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-muted-foreground">
                          Chambre {task.rooms?.numero || 'N/A'}
                        </span>
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          Terminé
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {typeConfig.label}
                      </p>
                      {task.date_completion && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Terminée le {format(new Date(task.date_completion), 'dd MMM yyyy à HH:mm', { locale: fr })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
