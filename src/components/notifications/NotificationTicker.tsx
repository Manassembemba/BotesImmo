import { useAppNotifications } from '@/hooks/useAppNotifications';
import { AlertTriangle, Clock, Info, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function NotificationTicker() {
    const { notifications } = useAppNotifications();
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible || notifications.length === 0) return null;

    const criticalCount = notifications.filter(n => n.severity === 'error').length;
    const warningCount = notifications.filter(n => n.severity === 'warning').length;

    return (
        <div className={cn(
            "relative h-10 w-full overflow-hidden flex items-center shadow-sm z-50 transition-all duration-500",
            criticalCount > 0
                ? "bg-red-600 text-white"
                : warningCount > 0
                    ? "bg-orange-500 text-white"
                    : "bg-indigo-600 text-white"
        )}>
            {/* Icon Section */}
            <div className="flex-shrink-0 px-4 h-full flex items-center bg-black/10 backdrop-blur-md z-10 border-r border-white/10 uppercase font-black text-[10px] tracking-tighter italic">
                {criticalCount > 0 ? (
                    <><AlertTriangle className="h-4 w-4 mr-1 animate-pulse" /> ALERTE CRITIQUE</>
                ) : (
                    <><Clock className="h-4 w-4 mr-1" /> FLASH INFO</>
                )}
            </div>

            {/* Ticker Content */}
            <div className="flex-1 h-full flex items-center overflow-hidden">
                <div className="flex whitespace-nowrap animate-ticker hover:pause-animation">
                    {[...notifications, ...notifications].map((notification, idx) => (
                        <div
                            key={`${notification.id}-${idx}`}
                            className="px-8 flex items-center gap-2 group cursor-default"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-white/50 group-hover:bg-white group-hover:scale-150 transition-all"></span>
                            <span className="font-bold text-xs uppercase">{notification.title} :</span>
                            <span className="text-xs font-medium text-white/90">{notification.description}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Close Button */}
            <button
                onClick={() => setIsVisible(false)}
                className="flex-shrink-0 w-10 h-full flex items-center justify-center hover:bg-black/20 transition-colors"
            >
                <X className="h-4 w-4" />
            </button>

            {/* Animation Styles */}
            <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 40s linear infinite;
        }
        .pause-animation {
          animation-play-state: paused;
        }
      `}</style>
        </div>
    );
}
