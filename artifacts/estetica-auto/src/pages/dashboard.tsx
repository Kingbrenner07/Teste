import { useGetDashboardSummary, useListAppointments } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, CheckCircle2, Clock, XCircle, ChevronRight, Car, User } from "lucide-react";
import { Link } from "wouter";
import { cn, formatDate } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { refetchInterval: 30000 }
  });
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayAppointments, isLoading: isLoadingAppointments } = useListAppointments({
    date: today
  });

  if (isLoadingSummary || isLoadingAppointments) {
    return (
      <div className="p-8 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-2"></div>
          <div className="h-4 w-64 bg-muted/60 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse"></div>
          ))}
        </div>
        <div className="h-96 bg-muted rounded-xl animate-pulse mt-6"></div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="outline" className="border-blue-500/30 text-blue-500 bg-blue-500/10">Agendado</Badge>;
      case 'completed':
        return <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10">Concluído</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="border-red-500/30 text-red-500 bg-red-500/10">Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTimeSlotLabel = (slot: string) => {
    switch (slot) {
      case 'morning': return 'Manhã (08:00 - 12:00)';
      case 'afternoon': return 'Tarde (14:00 - 18:00)';
      case 'full_day': return 'Dia Inteiro';
      default: return slot;
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral da oficina. {summary?.nextAvailableDate && `Próxima data livre: ${formatDate(summary.nextAvailableDate)}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Esta Semana</CardTitle>
            <CalendarIcon className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.weekAppointments || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">agendamentos</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes (Hoje)</CardTitle>
            <Clock className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.pendingCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">aguardando serviço</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídos</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.completedCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">serviços finalizados hoje</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelados</CardTitle>
            <XCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.cancelledCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">agendamentos desmarcados</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Agendamentos de Hoje</CardTitle>
            <CardDescription>{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</CardDescription>
          </div>
          <Link href="/agenda" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            Ver agenda <ChevronRight className="w-4 h-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {!todayAppointments || todayAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg border-border/50 bg-card/30">
              <CalendarIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">Nenhum serviço hoje</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Aproveite o dia ou adicione um novo agendamento.
              </p>
              <Link href="/novo-agendamento" className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium shadow hover:bg-primary/90 transition-colors">
                Novo Agendamento
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {todayAppointments.map((apt) => (
                <div key={apt.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-accent/5 transition-colors gap-4">
                  <div className="flex items-start gap-4 w-full sm:w-auto">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      <Car className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        {apt.serviceName}
                        {getStatusBadge(apt.status)}
                      </h4>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {apt.customerName}</span>
                        <span className="hidden sm:inline text-muted-foreground/30">•</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {getTimeSlotLabel(apt.timeSlot)}</span>
                      </div>
                      {apt.vehicleModel && (
                        <div className="text-xs font-mono bg-accent/30 text-accent-foreground px-2 py-0.5 rounded mt-2 inline-block">
                          {apt.vehicleModel} {apt.vehiclePlate ? `- ${apt.vehiclePlate}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Link href={`/agenda?date=${apt.date}`} className="text-sm text-muted-foreground hover:text-foreground shrink-0 px-3 py-1.5 border border-border rounded-md hover:bg-accent hover:border-accent">
                    Detalhes
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
