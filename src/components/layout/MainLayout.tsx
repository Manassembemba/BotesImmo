import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useSidebar } from '@/context/SidebarContext';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { MobileNavBar } from './MobileNavBar';
import { NotificationTicker } from '../notifications/NotificationTicker';

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  headerImage?: boolean;
}

export function MainLayout({ children, title, subtitle, headerImage = false }: MainLayoutProps) {
  const { isCollapsed } = useSidebar();
  const isMobile = useIsMobile();
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NotificationTicker />
      <div className="flex flex-1 relative">
        <Sidebar />
        <div className={cn(
          "transition-all duration-300 flex-1 w-full overflow-y-auto",
          isMobile
            ? "pl-0"
            : isCollapsed
              ? "pl-20"
              : "pl-60"
        )}>
          {/* Header */}
          {headerImage ? (
            <div
              className={cn(
                "relative bg-cover bg-center",
                isMobile ? "h-32" : "h-48"
              )}
              style={{
                backgroundImage: 'linear-gradient(to right, rgba(30, 58, 95, 0.9), rgba(30, 58, 95, 0.7)), url("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop")'
              }}
            >
              <div className={cn("absolute inset-0 flex flex-col justify-center", isMobile ? "p-4" : "p-8")}>
                <div className="flex items-center gap-4">
                  <img
                    src="/LOGO.jpg"
                    alt="Botes Immo Logo"
                    className={cn(
                      "object-contain rounded-lg",
                      isMobile ? "h-12 w-12" : "h-20 w-20"
                    )}
                  />
                  <div>
                    <h1 className={cn(
                      "font-bold text-white tracking-tight",
                      isMobile ? "text-xl" : "text-4xl"
                    )}>{title}</h1>
                    {subtitle && (
                      <div className="mt-1 sm:mt-3">
                        <p className={cn(
                          "text-white/90 flex items-start gap-2",
                          isMobile ? "text-xs" : "text-lg"
                        )}>
                          <span className={cn(
                            "leading-none",
                            isMobile ? "text-lg" : "text-3xl"
                          )}>"</span>
                          <span>{subtitle}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <p className={cn(
                  "text-white/70 flex items-center gap-2",
                  isMobile ? "text-xs mt-2" : "text-sm mt-4"
                )}>
                  <span className="inline-block w-4 h-4 bg-white/20 rounded"></span>
                  Date du jour : {today}
                </p>
              </div>
            </div>
          ) : (
            <div className={cn("bg-card border-b border-border", isMobile ? "px-4 py-3" : "px-8 py-6")}>
              <div className="flex items-center gap-3">
                <img
                  src="/LOGO.jpg"
                  alt="Botes Immo Logo"
                  className={cn(
                    "object-contain rounded-lg",
                    isMobile ? "h-8 w-8" : "h-12 w-12"
                  )}
                />
                <div>
                  <h1 className={cn(
                    "font-bold text-foreground tracking-tight",
                    isMobile ? "text-lg" : "text-3xl"
                  )}>{title}</h1>
                  {subtitle && (
                    <p className={cn(
                      "text-muted-foreground",
                      isMobile ? "text-xs mt-0.5" : "mt-1"
                    )}>{subtitle}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className={cn("p-4 sm:p-6", isMobile ? "pb-20" : "")}>
            {children}
          </main>

          {/* Mobile Navigation Bar */}
          {isMobile && <MobileNavBar />}
        </div>
      </div>
    </div>
  );
}