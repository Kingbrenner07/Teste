import { useGetBotStatus, useDisconnectBot, useListConversations } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, QrCode, PowerOff, RefreshCw, CheckCircle2, AlertCircle, Phone, Clock, User } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBotStatusQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export default function WhatsAppBot() {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Dynamic polling interval based on status
  const { data: statusData, isLoading: isLoadingStatus } = useGetBotStatus({ 
    query: { 
      refetchInterval: (data) => {
        // Poll quickly if connecting or waiting for QR scan
        if (data?.status === 'connecting' || data?.status === 'qr_ready') return 3000;
        // Poll normally otherwise
        return 30000;
      }
    } 
  });

  const disconnectMutation = useDisconnectBot();
  const { data: conversations, isLoading: isLoadingConversations } = useListConversations({
    query: { enabled: statusData?.status === 'ready' }
  });

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/bot/connect`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao conectar');
      queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
      toast.success("Iniciando conexão com WhatsApp...");
    } catch (error) {
      toast.error("Erro ao iniciar conexão. O servidor pode estar indisponível.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm("Tem certeza que deseja desconectar o bot? Ele deixará de responder aos clientes.")) {
      disconnectMutation.mutate(undefined, {
        onSuccess: () => {
          toast.success("Bot desconectado.");
          queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
        }
      });
    }
  };

  const getStatusBadge = () => {
    if (!statusData) return <Badge variant="outline">Desconhecido</Badge>;
    
    switch (statusData.status) {
      case 'ready':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]"><CheckCircle2 className="w-3 h-3 mr-1" /> Conectado & Pronto</Badge>;
      case 'authenticated':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 hover:bg-blue-500/30"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Autenticado, carregando...</Badge>;
      case 'qr_ready':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30"><QrCode className="w-3 h-3 mr-1" /> Aguardando Leitura</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Conectando...</Badge>;
      case 'disconnected':
      default:
        return <Badge variant="outline" className="border-destructive/30 text-destructive"><PowerOff className="w-3 h-3 mr-1" /> Desconectado</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">WhatsApp Bot</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie o assistente virtual que agenda serviços automaticamente via WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Connection Card */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border/50 bg-card/40 backdrop-blur shadow-lg overflow-hidden relative">
            {statusData?.status === 'ready' && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-[50px] -z-10 rounded-full" />
            )}
            
            <CardHeader className="border-b border-border/30 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className={cn("w-5 h-5", statusData?.status === 'ready' ? "text-green-500" : "text-primary")} />
                    Status da Conexão
                  </CardTitle>
                  <CardDescription className="mt-1">Serviço de atendimento 24h</CardDescription>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            
            <CardContent className="pt-6 min-h-[300px] flex flex-col items-center justify-center text-center">
              {isLoadingStatus ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : statusData?.status === 'ready' ? (
                <div className="space-y-4 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-green-500/10 border-4 border-green-500/20 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(34,197,94,0.15)] relative">
                    <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping opacity-30" />
                    <MessageSquare className="w-10 h-10 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Bot Ativo</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {statusData.phoneNumber ? `Conectado como ${statusData.phoneNumber}` : "O bot está respondendo os clientes."}
                    </p>
                  </div>
                  {statusData.lastActivity && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 bg-accent/20 px-3 py-1.5 rounded-full">
                      <Clock className="w-3 h-3" /> Última atividade: {format(parseISO(statusData.lastActivity), "HH:mm")}
                    </div>
                  )}
                </div>
              ) : statusData?.status === 'qr_ready' && statusData.qrCode ? (
                <div className="space-y-6 flex flex-col items-center w-full">
                  <div className="text-sm text-muted-foreground text-center">
                    Abra o WhatsApp no seu celular, vá em <strong className="text-foreground">Aparelhos Conectados</strong> e aponte a câmera para este código.
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-xl shadow-white/5 border-4 border-primary/20 relative">
                    <img 
                      src={`data:image/png;base64,${statusData.qrCode}`} 
                      alt="WhatsApp QR Code" 
                      className="w-64 h-64 mx-auto"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none" />
                  </div>
                </div>
              ) : statusData?.status === 'connecting' || statusData?.status === 'authenticated' ? (
                <div className="space-y-4 flex flex-col items-center">
                  <RefreshCw className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground animate-pulse">Sincronizando com WhatsApp...</p>
                </div>
              ) : (
                <div className="space-y-6 flex flex-col items-center opacity-70">
                  <PowerOff className="w-16 h-16 text-muted-foreground" />
                  <div className="text-center">
                    <h3 className="font-medium text-lg">Serviço Parado</h3>
                    <p className="text-sm text-muted-foreground mt-1">O bot não está rodando. Conecte para voltar a atender.</p>
                  </div>
                </div>
              )}
            </CardContent>
            
            <CardFooter className="border-t border-border/30 bg-muted/5 pt-4">
              {statusData?.status === 'ready' ? (
                <Button 
                  variant="destructive" 
                  className="w-full shadow-md"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                >
                  <PowerOff className="w-4 h-4 mr-2" />
                  Desconectar Bot
                </Button>
              ) : (
                <Button 
                  className="w-full shadow-[0_0_15px_hsl(var(--primary)_/_0.3)] transition-all"
                  onClick={handleConnect}
                  disabled={isConnecting || statusData?.status === 'connecting' || statusData?.status === 'qr_ready' || statusData?.status === 'authenticated'}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {isConnecting ? "Iniciando..." : "Gerar QR Code de Conexão"}
                </Button>
              )}
            </CardFooter>
          </Card>
          
          <Card className="border-border/50 bg-card/20 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Como o bot funciona</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> Lista serviços disponíveis e preços.</p>
              <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> Verifica a agenda e sugere horários (baseado nos Dias Disponíveis configurados).</p>
              <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> Solicita modelo do carro e placa.</p>
              <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> Confirma o agendamento que aparece automaticamente na sua Dashboard.</p>
            </CardContent>
          </Card>
        </div>

        {/* Conversations List */}
        <div className="lg:col-span-7">
          <Card className="border-border/50 bg-card/40 backdrop-blur shadow-lg h-full flex flex-col">
            <CardHeader className="border-b border-border/30 pb-4 shrink-0">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Conversas Recentes
              </CardTitle>
              <CardDescription>
                Histórico de interações do bot com os clientes hoje.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-0 p-0 flex-1 overflow-hidden relative">
              {statusData?.status !== 'ready' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-background/50 backdrop-blur-sm z-10">
                  <AlertCircle className="w-10 h-10 mb-3 opacity-30" />
                  <p>Conecte o bot para ver as conversas</p>
                </div>
              ) : null}
              
              <div className="h-[600px] overflow-y-auto p-4 space-y-3">
                {isLoadingConversations ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-lg border border-border/30" />
                  ))
                ) : !conversations || conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                    <MessageSquare className="w-12 h-12 mb-4" />
                    <p>Nenhuma conversa iniciada ainda</p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div key={conv.phone} className="flex gap-4 p-4 rounded-lg border border-border/50 bg-card hover:bg-accent/5 transition-colors group cursor-default">
                      <div className="w-12 h-12 rounded-full bg-accent/20 flex flex-col items-center justify-center shrink-0 border border-primary/10 group-hover:border-primary/40 transition-colors relative">
                        <User className="w-5 h-5 text-foreground/70" />
                        {conv.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-semibold text-foreground truncate pr-2">{conv.name}</h4>
                          <span className="text-xs text-muted-foreground shrink-0 mt-1 whitespace-nowrap">
                            {formatDistanceToNow(parseISO(conv.lastMessageAt), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground/80 font-mono">
                          <Phone className="w-3 h-3" /> {conv.phone}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 break-all">
                          "{conv.lastMessage}"
                        </p>
                      </div>
                      
                      {conv.hasAppointment && (
                        <div className="shrink-0 flex items-center self-center">
                          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                            Agendou
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
      </div>
    </div>
  );
}

// Ensure Loader2 is imported at top
import { Loader2 } from "lucide-react";