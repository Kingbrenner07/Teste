import { format, getDaysInMonth, startOfMonth, addMonths, subMonths, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetAvailableDays, useSetAvailableDays, getGetAvailableDaysQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function DiasDisponiveis() {
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  
  const queryClient = useQueryClient();
  const { data: availableDays, isLoading } = useGetAvailableDays({ month, year });
  const setDaysMutation = useSetAvailableDays();
  
  // Keep local state of selected dates to allow batch saving
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  
  // Sync when data loads
  const initializedForMonth = useRef<string | null>(null);
  const currentMonthKey = `${year}-${month}`;
  
  useEffect(() => {
    if (availableDays && initializedForMonth.current !== currentMonthKey) {
      const dates = new Set(
        availableDays.filter(d => d.isAvailable).map(d => d.date.split('T')[0])
      );
      setSelectedDates(dates);
      initializedForMonth.current = currentMonthKey;
    }
  }, [availableDays, currentMonthKey]);

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
    initializedForMonth.current = null; // force resync
  };
  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
    initializedForMonth.current = null; // force resync
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const startDay = startOfMonth(currentDate).getDay(); // 0 = Sunday
  
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month - 1, i));
    }
    return days;
  }, [month, year, daysInMonth, startDay]);

  const toggleDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const newSelected = new Set(selectedDates);
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr);
    } else {
      newSelected.add(dateStr);
    }
    setSelectedDates(newSelected);
  };

  const handleSave = () => {
    const datesArray = Array.from(selectedDates);
    setDaysMutation.mutate(
      { data: { month, year, dates: datesArray } },
      {
        onSuccess: (data) => {
          toast.success("Dias disponíveis salvos com sucesso.");
          // Update cache
          queryClient.setQueryData(getGetAvailableDaysQueryKey({ month, year }), data);
        },
        onError: () => {
          toast.error("Erro ao salvar os dias. Tente novamente.");
        }
      }
    );
  };

  const today = startOfDay(new Date());

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Dias Disponíveis</h1>
          <p className="text-muted-foreground mt-1">
            Configure os dias em que a oficina aceitará agendamentos neste mês.
          </p>
        </div>
        
        <Button 
          onClick={handleSave} 
          disabled={setDaysMutation.isPending || isLoading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_hsl(var(--primary)_/_0.3)] transition-all gap-2"
        >
          <Save className="w-4 h-4" />
          {setDaysMutation.isPending ? "Salvando..." : "Salvar Configuração"}
        </Button>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur shadow-lg shadow-background/50 overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/30 px-6 py-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <CardTitle className="capitalize text-lg">{format(currentDate, "MMMM yyyy", { locale: ptBR })}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-7 gap-2 text-center mb-4">
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d, i) => (
              <div key={i} className="text-sm font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>
          
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2 md:gap-3">
              {calendarDays.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} className="min-h-20" />;
                
                const dateStr = format(date, 'yyyy-MM-dd');
                const isSelected = selectedDates.has(dateStr);
                const past = isBefore(date, today);
                
                return (
                  <button
                    key={i}
                    disabled={past}
                    onClick={() => toggleDay(date)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 min-h-20 rounded-xl border transition-all relative overflow-hidden group",
                      past ? "opacity-30 cursor-not-allowed bg-muted/20 border-transparent" :
                      isSelected
                        ? "bg-primary/10 border-primary text-primary-foreground shadow-[inset_0_0_10px_hsl(var(--primary)_/_0.2)]"
                        : "bg-card border-border/50 hover:border-primary/50 hover:bg-accent/5 text-foreground"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-8 h-8 bg-primary -rotate-45 translate-x-4 -translate-y-4 shadow-[0_0_10px_hsl(var(--primary))] transition-transform group-hover:scale-110" />
                    )}
                    <span className={cn(
                      "text-lg font-bold z-10",
                      isSelected ? "text-primary shadow-sm" : ""
                    )}>
                      {date.getDate()}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground z-10 mt-1">
                      {isSelected ? "Aberto" : past ? "Passado" : "Fechado"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 flex items-start gap-4">
        <div className="mt-1 h-8 w-8 rounded bg-primary/20 flex items-center justify-center text-primary shrink-0">
          <CalendarIcon className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-medium text-foreground">Como funciona a agenda</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione os dias da semana em que sua oficina estará funcionando. Os dias marcados como "Aberto" aparecerão no formulário de Novo Agendamento para que os clientes sejam registrados. Não esqueça de clicar em "Salvar" após modificar.
          </p>
        </div>
      </div>
    </div>
  );
}
