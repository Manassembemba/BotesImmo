import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMediaQuery';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'success';
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatsCardProps) {
  const isMobile = useIsMobile();
  const variantStyles = {
    default: 'bg-card',
    primary: 'bg-primary/5 border-primary/20',
    warning: 'bg-status-pending-checkout-bg border-status-pending-checkout/20',
    success: 'bg-status-available-bg border-status-available/20',
  };

  const iconStyles = {
    default: 'bg-secondary text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    warning: 'bg-status-pending-checkout/10 text-status-pending-checkout',
    success: 'bg-status-available/10 text-status-available',
  };

  return (
    <div className={cn(
      'rounded-lg sm:rounded-xl border shadow-soft transition-all hover:shadow-medium animate-fade-in',
      isMobile ? 'p-3' : 'p-5'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium text-muted-foreground truncate",
            isMobile ? 'text-xs' : 'text-sm'
          )}>{title}</p>
          <p className={cn(
            "mt-1 sm:mt-2 font-semibold tracking-tight text-foreground",
            isMobile ? 'text-lg' : 'text-3xl'
          )}>{value}</p>
          {subtitle && (
            <p className={cn(
              "mt-0.5 sm:mt-1 truncate",
              isMobile ? 'text-xs' : 'text-sm',
              "text-muted-foreground"
            )}>{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              isMobile ? 'text-xs mt-0.5' : 'mt-1 text-sm font-medium',
              trend.isPositive ? 'text-status-available' : 'text-destructive'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}% vs mois dernier
            </p>
          )}
        </div>
        <div className={cn(
          isMobile ? 'rounded-md p-1.5' : 'rounded-lg p-2.5',
          iconStyles[variant]
        )}>
          <Icon className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
        </div>
      </div>
    </div>
  );
}
