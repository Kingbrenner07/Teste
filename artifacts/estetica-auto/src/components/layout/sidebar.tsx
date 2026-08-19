import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calendar, PlusCircle, CalendarDays, MessageSquare } from "lucide-react";
import {
  getGetBotStatusQueryKey,
  useGetBotStatus,
} from "@workspace/api-client-react";

export function Sidebar() {
  const [location] = useLocation();
  const { data: botStatus } = useGetBotStatus({
    query: {
      queryKey: getGetBotStatusQueryKey(),
      refetchInterval: 30000,
    },
  });

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agenda", label: "Agenda", icon: Calendar },
    { href: "/novo-agendamento", label: "Novo Agendamento", icon: PlusCircle },
    { href: "/dias-disponiveis", label: "Dias Disponíveis", icon: CalendarDays },
    { href: "/whatsapp", label: "WhatsApp Bot", icon: MessageSquare },
  ];

  return (
    <aside className="w-64 flex flex-col bg-sidebar border-r border-sidebar-border min-h-[100dvh] shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <h1 className="font-display font-bold text-xl text-sidebar-primary-foreground tracking-tight flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary shadow-[0_0_10px_hsl(var(--primary)_/_0.5)]" />
          EstéticaAuto
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = location === link.href;
          const isBot = link.href === "/whatsapp";
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all group",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <link.icon className={cn(
                "w-5 h-5 transition-colors", 
                isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-primary"
              )} />
              <span className="flex-1">{link.label}</span>
              
              {isBot && botStatus && (
                <div className="flex h-2 w-2 relative">
                  <div className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                    botStatus.status === 'ready' ? "bg-green-400" :
                    botStatus.status === 'disconnected' ? "bg-destructive" : "bg-yellow-400"
                  )} />
                  <div className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    botStatus.status === 'ready' ? "bg-green-500" :
                    botStatus.status === 'disconnected' ? "bg-destructive" : "bg-yellow-500"
                  )} />
                </div>
              )}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-xs font-bold text-sidebar-foreground">
            EA
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground leading-none">Admin</span>
            <span className="text-xs text-sidebar-foreground/50 mt-1">Oficina Centro</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
