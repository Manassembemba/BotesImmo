import { Clock, UserCheck, Sparkles, AlertCircle, ShoppingCart, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Define a type for a single activity item
export interface Activity {
  id: string;
  type: 'booking' | 'payment' | 'checkin' | 'checkout';
  message: string;
  timestamp: string;
}

// Map activity types to icons and colors
const activityConfig = {
  booking: { icon: ShoppingCart, color: 'text-blue-500' },
  payment: { icon: DollarSign, color: 'text-green-500' },
  checkin: { icon: UserCheck, color: 'text-purple-500' },
  checkout: { icon: UserCheck, color: 'text-red-500' },
};

interface RecentActivityProps {
  activities: Activity[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft animate-fade-in">
      <h3 className="font-semibold text-foreground mb-4">Activité Récente</h3>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune activité récente.</p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const config = activityConfig[activity.type] || { icon: AlertCircle, color: 'text-gray-500' };
            
            return (
              <div 
                key={activity.id} 
                className="flex items-start gap-3 animate-slide-in-right"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={cn('mt-0.5 rounded-lg p-2 bg-secondary', config.color)}>
                  <config.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activity.message}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
