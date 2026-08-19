import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  getGetAvailableSlotsQueryKey,
  useListServices,
  useGetAvailableSlots,
  useCreateAppointment,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, Loader2, Car, User, Clock, CalendarDays, AlignLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  customerName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  customerPhone: z.string().min(10, "Telefone inválido"),
  serviceId: z.coerce.number().positive("Selecione um serviço"),
  date: z.string().min(1, "Selecione uma data"),
  timeSlot: z.string().optional(), // We'll handle this in the submission or slot selection
  vehicleModel: z.string().optional(),
  vehiclePlate: z.string().optional(),
  notes: z.string().optional(),
});

export default function NovoAgendamento() {
  const [_, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialDate = searchParams.get('date');
  
  const queryClient = useQueryClient();
  const { data: services, isLoading: isLoadingServices } = useListServices();
  const createMutation = useCreateAppointment();
  
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      serviceId: 0,
      date: initialDate || "",
      vehicleModel: "",
      vehiclePlate: "",
      notes: "",
    },
  });

  const watchDate = form.watch("date");
  const watchServiceId = form.watch("serviceId");

  const { data: slotsData, isLoading: isLoadingSlots } = useGetAvailableSlots(
    { date: watchDate, serviceId: watchServiceId },
    {
      query: {
        queryKey: getGetAvailableSlotsQueryKey({
          date: watchDate,
          serviceId: watchServiceId,
        }),
        enabled: !!watchDate && !!watchServiceId,
      },
    }
  );

  // Reset slot when date or service changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [watchDate, watchServiceId]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!slotsData?.canSchedule) {
      toast.error(slotsData?.reason || "Horário indisponível para este serviço.");
      return;
    }
    
    // In our simplified API, if period is full_day, slot might not matter, but we just pass what the API expects.
    // The API create endpoint doesn't strictly take timeSlot in AppointmentInput, it infers it or uses first available if needed,
    // wait, looking at API schema, AppointmentInput has date, but not timeSlot. It's determined by the backend based on availability or service period.
    // Wait, the API schema AppointmentInput: { customerName, customerPhone, serviceId, date, notes, vehicleModel, vehiclePlate }
    // It doesn't take timeSlot directly.
    
    createMutation.mutate(
      { data: { ...values } },
      {
        onSuccess: () => {
          toast.success("Agendamento criado com sucesso!");
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          setLocation("/agenda");
        },
        onError: (err) => {
          toast.error(
            err.data?.error || "Erro ao criar agendamento.",
          );
        }
      }
    );
  }

  const selectedService = services?.find(s => s.id === watchServiceId);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Novo Agendamento</h1>
        <p className="text-muted-foreground mt-1">
          Registre um novo serviço para um cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-2 border-border/50 bg-card/40 backdrop-blur shadow-lg shadow-background/50">
          <CardHeader>
            <CardTitle>Detalhes do Serviço</CardTitle>
            <CardDescription>Preencha os dados do cliente e veículo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                    <User className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cliente</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Cliente</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: João Silva" {...field} className="bg-background/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone (WhatsApp)</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} className="bg-background/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                    <Car className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Veículo</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vehicleModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: BMW 320i Preta" {...field} className="bg-background/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vehiclePlate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Placa</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC-1234" {...field} className="bg-background/50 uppercase" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                    <AlignLeft className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Serviço & Agendamento</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="serviceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serviço</FormLabel>
                          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? String(field.value) : undefined}>
                            <FormControl>
                              <SelectTrigger className="bg-background/50">
                                <SelectValue placeholder="Selecione um serviço" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingServices ? (
                                <SelectItem value="0" disabled>Carregando...</SelectItem>
                              ) : (
                                services?.map((s) => (
                                  <SelectItem key={s.id} value={String(s.id)}>
                                    {s.name} ({s.durationMinutes} min)
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="bg-background/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Instruções especiais, estado do veículo, etc." 
                            className="resize-none bg-background/50" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    className="w-full md:w-auto shadow-[0_0_15px_hsl(var(--primary)_/_0.3)] transition-all"
                    disabled={
                      createMutation.isPending ||
                      Boolean(
                        watchDate &&
                          watchServiceId &&
                          !slotsData?.canSchedule,
                      )
                    }
                  >
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Agendamento
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Status Panel Sidebar */}
        <div className="space-y-6">
          <Card className="border-border/50 bg-card/20 backdrop-blur shadow-lg">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Disponibilidade
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {!watchServiceId || !watchDate ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  <CalendarDays className="w-8 h-8 opacity-20 mx-auto mb-2" />
                  Selecione um serviço e uma data para verificar a disponibilidade.
                </div>
              ) : isLoadingSlots ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : slotsData ? (
                <div className="space-y-3">
                  <div className={cn(
                    "p-3 rounded-lg border text-sm font-medium flex items-start gap-2",
                    slotsData.canSchedule 
                      ? "bg-green-500/10 border-green-500/20 text-green-500" 
                      : "bg-destructive/10 border-destructive/20 text-destructive"
                  )}>
                    {slotsData.canSchedule ? (
                      <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"/> Horário Disponível</span>
                    ) : (
                      <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive"/> Indisponível</span>
                    )}
                  </div>
                  
                  {!slotsData.canSchedule && slotsData.reason && (
                    <p className="text-sm text-destructive/80 mt-2 bg-destructive/5 p-2 rounded">
                      Motivo: {slotsData.reason}
                    </p>
                  )}
                  
                  {slotsData.canSchedule && slotsData.slots && slotsData.slots.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Períodos Sugeridos</p>
                      <div className="flex flex-wrap gap-2">
                        {slotsData.slots.map(slot => (
                          <Badge key={slot} variant="secondary" className="bg-secondary/50">
                            {slot === 'morning' ? 'Manhã' : slot === 'afternoon' ? 'Tarde' : 'Dia Inteiro'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {selectedService && (
            <Card className="border-border/50 bg-card/20 backdrop-blur">
              <CardHeader className="pb-3 border-b border-border/30">
                <CardTitle className="text-lg">Resumo do Serviço</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground">{selectedService.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{selectedService.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border/30">
                  <div className="bg-background/50 rounded p-2 text-center">
                    <p className="text-xs text-muted-foreground uppercase">Duração</p>
                    <p className="font-mono text-sm font-medium">{selectedService.durationMinutes} min</p>
                  </div>
                  <div className="bg-background/50 rounded p-2 text-center">
                    <p className="text-xs text-muted-foreground uppercase">Período</p>
                    <p className="text-sm font-medium">
                      {selectedService.period === 'full_day' ? 'Dia Inteiro' : 
                       selectedService.period === 'both_periods' ? 'Flexível' : 
                       selectedService.period === 'morning_only' ? 'Manhã' : 'Tarde'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
