import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Clock, Loader2, Save, Info, ShieldCheck, Timer, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

type FlexibilityMode = 'tolerance' | 'fixed' | 'hours_only';

interface FlexibilitySettings {
  id: string;
  schedule_flexibility_mode: FlexibilityMode;
  tolerance_entry_minutes: number;
}

const flexibilityOptions: {
  value: FlexibilityMode;
  icon: typeof Clock;
  title: string;
  description: string;
  badge: string;
}[] = [
  {
    value: 'tolerance',
    icon: Timer,
    title: 'Tolerância Configurável',
    description:
      'O colaborador pode registrar ponto dentro de uma janela de tolerância antes ou depois do início da jornada. O horário de saída se ajusta automaticamente para cumprir a carga horária diária.',
    badge: 'Opção 1',
  },
  {
    value: 'fixed',
    icon: ShieldCheck,
    title: 'Jornada Fixa (Sem Tolerância)',
    description:
      'O ponto só pode ser registrado exatamente no horário de início e fim definidos na jornada. Não há flexibilidade de horário.',
    badge: 'Opção 2',
  },
  {
    value: 'hours_only',
    icon: CalendarClock,
    title: 'Apenas Carga Horária',
    description:
      'Sem horário fixo de entrada ou saída. O colaborador precisa cumprir apenas a carga horária diária, podendo iniciar e encerrar a jornada a qualquer momento.',
    badge: 'Opção 3',
  },
];

const ScheduleFlexibilitySettings = () => {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<FlexibilityMode>('tolerance');
  const [toleranceMinutes, setToleranceMinutes] = useState(10);
  const [hasChanges, setHasChanges] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const { data: fetchedSettings, isLoading } = useQuery({
    queryKey: ['schedule-flexibility-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_settings')
        .select('id, schedule_flexibility_mode, tolerance_entry_minutes')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as FlexibilitySettings | null;
    },
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettingsId(fetchedSettings.id);
      setMode((fetchedSettings.schedule_flexibility_mode as FlexibilityMode) || 'tolerance');
      setToleranceMinutes(fetchedSettings.tolerance_entry_minutes ?? 10);
    }
  }, [fetchedSettings]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!settingsId) {
        const { data: orgData } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();
        const { error } = await supabase.from('payroll_settings').insert({
          organization_id: orgData?.organization_id,
          schedule_flexibility_mode: mode,
          tolerance_entry_minutes: toleranceMinutes,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payroll_settings')
          .update({
            schedule_flexibility_mode: mode,
            tolerance_entry_minutes: toleranceMinutes,
          })
          .eq('id', settingsId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-flexibility-settings'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] });
      setHasChanges(false);
      toast({
        title: 'Configurações salvas',
        description: 'As configurações de flexibilidade de jornada foram atualizadas.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Modo de Flexibilidade da Jornada
          </CardTitle>
          <CardDescription>
            Define como o sistema controla o horário de entrada e saída dos colaboradores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {flexibilityOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = mode === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setMode(option.value);
                    setHasChanges(true);
                  }}
                  className={cn(
                    'relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all hover:border-primary/50',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-muted bg-card'
                  )}
                >
                  <Badge
                    variant={isSelected ? 'default' : 'secondary'}
                    className="absolute right-3 top-3 text-[10px]"
                  >
                    {option.badge}
                  </Badge>
                  <div
                    className={cn(
                      'rounded-full p-3',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{option.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tolerance config (only for Option 1) */}
      {mode === 'tolerance' && (
        <Card>
          <CardHeader>
           <CardTitle className="flex items-center gap-2 text-lg">
              <Timer className="h-5 w-5 text-primary" />
              Tolerância de Entrada/Saída
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              Minutos de antecedência ou atraso permitidos para registrar o ponto
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Exemplo: Com 10 minutos de tolerância e jornada das 8h às 17h, o
                      colaborador pode bater o ponto entre 7:50 e 8:10. Se bater às 8:10,
                      a saída se ajusta para 17:10 para completar a carga horária.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                Tolerância
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Variações de até 5 minutos no registro de ponto, observando o limite
                        máximo de 10 minutos diários, não contam como horas extras nem faltas.
                        (Art. 58 da CLT)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[toleranceMinutes]}
                  onValueChange={([value]) => {
                    setToleranceMinutes(value);
                    setHasChanges(true);
                  }}
                  max={60}
                  min={1}
                  step={1}
                  className="flex-1"
                />
                <span className="w-16 text-right font-medium tabular-nums">
                  {toleranceMinutes} min
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules Alert */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Regras aplicadas automaticamente:</strong>
          <ul className="mt-2 list-disc pl-4 space-y-1">
            <li>
              O sistema bloqueia o registro de ponto fora da jornada autorizada (considerando a
              tolerância configurada). Mensagem: "Você está fora da sua jornada de trabalho".
            </li>
            <li>
              Horas extras só podem ser registradas quando autorizadas pelo administrador
              através do menu "Gestão de Jornada".
            </li>
            <li>
              Os dados originais do horário batido são sempre preservados no sistema
              (compliance com Portaria 671).
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="shadow-lg"
            size="lg"
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Configurações
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScheduleFlexibilitySettings;
