import { format, parse, getDaysInMonth, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGetAvailableDays, useListAppointments, useUpdateAppointment, useDeleteAppointment } from "@workspace/api-client-react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Car, Phone, Edit, Trash2, CheckCircle, XCircle, Link } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Try to get date from URL if passed
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialDateStr = searchParams.get('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    initialDateStr ? parse(initialDateStr, 'yyyy-MM-dd', new Date()) : new Date()
  );

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  
  const { data: availableDays } = useGetAvailableDays({ month, year });
  const { data: monthAppointments } = useListAppointments({ month, year });
  
  // We always fetch the selected date's appointments
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined;
  const { data: dayAppointments, isLoading: isLoadingAppointments, refetch: refetchAppointments } = useListAppointments(
    selectedDateStr ? { date: selectedDateStr } : undefined,
    { query: { enabled: !!selectedDateStr } }
  );

  const updateMutation = useUpdateAppointment();
  const deleteMutation = useDeleteAppointment();

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Calendar logic
  const daysInMonth = getDaysInMonth(currentDate);
  const startDay = startOfMonth(currentDate).getDay(); // 0 = Sunday
  
  const calendarDays = useMemo(() => {
    const days = [];
    // empty slots
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    // actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month - 1, i));
    }
    return days;
  }, [month, year, daysInMonth, startDay]);

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = availableDays?.find(d => d.date.startsWith(dateStr));
    const appointmentsCount = monthAppointments?.filter(
      apt => apt.date === dateStr && apt.status !== 'cancelled'
    ).length ?? 0;
    return {
      isAvailable: dayData?.isAvailable || false,
      hasAppointments: appointmentsCount > 0,
      appointmentsCount,
    };
  };

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

  const handleUpdateStatus = (id: number, status: string) => {
    updateMutation.mutate({ id, data: { status } }, {
      onSuccess: () => refetchAppointments()
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => refetchAppointments()
      });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-[100dvh] flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Agenda</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie seus agendamentos diários.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 lg:gap-8 flex-1 min-h-0">
        {/* Calendar Sidebar */}
        <Card className="md:w-72 lg:w-80 shrink-0 h-fit bg-card/30 border-border/50 backdrop-blur">
          <CardHeader className="p-4 border-b border-border/30">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 hover:bg-accent/20">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-medium text-sm capitalize">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 hover:bg-accent/20">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['D','S','T','Q','Q','S','S'].map((d, i) => (
                <div key={i} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} className="h-8" />;
                
                const { isAvailable, hasAppointments, appointmentsCount } = getDayStatus(date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isToday = isSameDay(date, new Date());
                
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "relative h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all mx-auto",
                      isSelected 
                        ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20" 
                        : isToday 
                          ? "bg-accent/30 text-accent-foreground font-bold"
                          : "hover:bg-accent/20 text-foreground",
                      !isAvailable && !isSelected && !isToday && "opacity-40 text-muted-foreground",
                      isAvailable && !isSelected && "font-medium",
                      hasAppointments && !isSelected && "ring-2 ring-primary/70 bg-primary/10 text-primary font-bold"
                    )}
                    title={hasAppointments ? `${appointmentsCount} agendamento(s)` : undefined}
                  >
                    {date.getDate()}
                    {hasAppointments ? (
                      <span className="absolute -right-2 -top-2 min-w-4 h-4 px-1 rounded-full bg-primary text-[9px] leading-4 text-primary-foreground font-bold shadow-sm">
                        {appointmentsCount}
                      </span>
                    ) : isAvailable && !isSelected && (
                      <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="flex-1 flex flex-col min-h-0 bg-card/30 border-border/50 backdrop-blur">
            <CardHeader className="p-5 border-b border-border/30 shrink-0">
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {selectedDate ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : "Selecione uma data"}
                </span>
                {dayAppointments && dayAppointments.length > 0 && (
                  <Badge className="bg-primary/15 text-primary border-primary/30">
                    {dayAppointments.length} {dayAppointments.length === 1 ? "agendamento" : "agendamentos"}
                  </Badge>
                )}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-6 overflow-y-auto flex-1">
            {!selectedDate ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
                <p>Selecione um dia no calendário ao lado</p>
              </div>
            ) : isLoadingAppointments ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : !dayAppointments || dayAppointments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border/40 rounded-xl bg-card/20 py-12">
                <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="font-medium text-foreground">Agenda livre</h3>
                <p className="text-sm mt-1 mb-4">Nenhum serviço agendado para este dia.</p>
                <Button asChild variant="outline">
                  <Link href={`/novo-agendamento?date=${format(selectedDate, 'yyyy-MM-dd')}`}>
                    Adicionar Agendamento
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {dayAppointments.map((apt) => (
                  <div key={apt.id} className="relative overflow-hidden rounded-xl border-2 border-primary/45 bg-primary/[0.06] hover:border-primary/70 transition-all p-5 shadow-[0_0_24px_hsl(var(--primary)/0.08)]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/80" />
                    
                    <div className="flex flex-col md:flex-row gap-6 justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-start justify-between md:justify-start gap-4">
                          <h3 className="font-display font-semibold text-lg">{apt.serviceName}</h3>
                          {getStatusBadge(apt.status)}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary/70" />
                            <span className="font-medium text-foreground/80">{getTimeSlotLabel(apt.timeSlot)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-primary/70" />
                            <span>
                              {apt.vehicleModel || "Veículo não informado"}
                              {apt.vehiclePlate && <span className="uppercase bg-accent/20 px-1.5 py-0.5 rounded text-xs ml-2 font-mono">{apt.vehiclePlate}</span>}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-primary/70" />
                            <span>{apt.customerName}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-primary/70" />
                            <span>{apt.customerPhone}</span>
                          </div>
                        </div>

                        {apt.notes && (
                          <div className="mt-2 p-3 bg-muted/30 rounded-md text-sm italic text-muted-foreground border border-border/40">
                            "{apt.notes}"
                          </div>
                        )}
                      </div>
                      
                      <div className="flex md:flex-col gap-2 shrink-0 md:border-l md:border-border/30 md:pl-6 md:justify-center">
                        {apt.status === 'scheduled' && (
                          <Button size="sm" className="w-full bg-green-600/10 text-green-500 hover:bg-green-600/20 hover:text-green-400 border border-green-500/20"
                            onClick={() => handleUpdateStatus(apt.id, 'completed')}
                            disabled={updateMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Finalizar
                          </Button>
                        )}
                        {apt.status === 'scheduled' && (
                          <Button size="sm" variant="outline" className="w-full border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                            onClick={() => handleUpdateStatus(apt.id, 'cancelled')}
                            disabled={updateMutation.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Cancelar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(apt.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Additional import missed at top
import { User } from "lucide-react";
