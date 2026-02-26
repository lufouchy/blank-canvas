import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Calendar, Clock, DollarSign, PiggyBank, Scale, Settings2, Loader2, Save, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type OvertimeStrategy = 'bank' | 'payment' | 'mixed';
type BankValidity = '3_months' | '6_months' | '1_year' | 'custom';
type MixedRuleType = 'hours_threshold' | 'day_type';

interface PayrollSettingsData {
  id: string;
  cycle_start_day: number;
  tolerance_minutes: number;
  overtime_strategy: OvertimeStrategy;
  bank_validity: BankValidity;
  bank_custom_months: number | null;
  bank_daily_limit_hours: number;
  bank_compensation_ratio: number;
  bank_sunday_multiplier: number;
  bank_holiday_multiplier: number;
  payment_weekday_percent: number;
  payment_saturday_percent: number;
  payment_sunday_percent: number;
  payment_holiday_percent: number;
  mixed_rule_type: MixedRuleType;
  mixed_hours_threshold: number;
  mixed_bank_days: string[];
  mixed_payment_days: string[];
  auto_decision_enabled: boolean;
  auto_decision_threshold_hours: number;
}

const strategyOptions = [
  {
    value: 'bank' as OvertimeStrategy,
    icon: PiggyBank,
    title: 'Banco de Horas',
    description: 'As horas excedentes são acumuladas para folgas futuras.',
  },
  {
    value: 'payment' as OvertimeStrategy,
    icon: DollarSign,
    title: 'Pagamento (Hora Extra)',
    description: 'As horas excedentes são pagas na folha de pagamento com acréscimo.',
  },
  {
    value: 'mixed' as OvertimeStrategy,
    icon: Scale,
    title: 'Misto / Híbrido',
    description: 'Parte das horas vai para o banco e parte é paga (Ex: Domingos e Feriados).',
  },
];

const cycleStartOptions = [
  { value: '1', label: 'Dia 1' },
  { value: '16', label: 'Dia 16' },
  { value: '21', label: 'Dia 21' },
  { value: '26', label: 'Dia 26' },
];

const bankValidityOptions = [
  { value: '3_months', label: '3 Meses' },
  { value: '6_months', label: '6 Meses' },
  { value: '1_year', label: '1 Ano' },
  { value: 'custom', label: 'Personalizado' },
];

const PayrollSettings = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<PayrollSettingsData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: fetchedSettings, isLoading } = useQuery({
    queryKey: ['payroll-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as PayrollSettingsData | null;
    },
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings);
    }
  }, [fetchedSettings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PayrollSettingsData>) => {
      if (!settings?.id) {
        // Create new settings
        const { data: orgData } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
        const { error } = await supabase.from('payroll_settings').insert({ ...data, organization_id: orgData?.organization_id });
        if (error) throw error;
      } else {
        // Update existing settings
        const { error } = await supabase
          .from('payroll_settings')
          .update(data)
          .eq('id', settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] });
      setHasChanges(false);
      toast({
        title: 'Configurações salvas',
        description: 'As configurações de folha de pagamento foram atualizadas.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
      console.error('Error saving payroll settings:', error);
    },
  });

  const handleChange = <K extends keyof PayrollSettingsData>(
    key: K,
    value: PayrollSettingsData[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!settings) return;
    const { id, ...data } = settings;
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhuma configuração encontrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cycle Start Day & Tolerance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Configurações Gerais
          </CardTitle>
          <CardDescription>
            Configure o ciclo de fechamento e tolerâncias de jornada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cycle Start Day */}
          <div className="space-y-2 max-w-xs">
            <Label className="flex items-center gap-2">
              Dia de Início do Ciclo
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Define o dia de fechamento para a folha de pagamento. 
                      Muitas empresas não fecham no dia 30/31.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={String(settings.cycle_start_day)}
              onValueChange={(value) => handleChange('cycle_start_day', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cycleStartOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Overtime Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Tratamento de Horas Extras
          </CardTitle>
          <CardDescription>
            Defina como as horas excedentes devem ser tratadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Strategy Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {strategyOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = settings.overtime_strategy === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleChange('overtime_strategy', option.value)}
                  className={cn(
                    'relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all hover:border-primary/50',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-muted bg-card'
                  )}
                >
                  {isSelected && (
                    <div className="absolute right-3 top-3 h-3 w-3 rounded-full bg-primary" />
                  )}
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
                    <p className="mt-1 text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <Separator />

          {/* Strategy-specific settings */}
          {settings.overtime_strategy === 'bank' && (
            <BankSettings settings={settings} onChange={handleChange} />
          )}

          {settings.overtime_strategy === 'payment' && (
            <PaymentSettings settings={settings} onChange={handleChange} />
          )}

          {settings.overtime_strategy === 'mixed' && (
            <MixedSettings settings={settings} onChange={handleChange} />
          )}
        </CardContent>
      </Card>

      {/* Auto Decision Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-primary" />
            Gatilho de Decisão Automática
          </CardTitle>
          <CardDescription>
            Configure regras automáticas para pré-preencher decisões de fechamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Habilitar decisão automática</Label>
              <p className="text-sm text-muted-foreground">
                O sistema sugere automaticamente o destino das horas baseado em limites
              </p>
            </div>
            <Switch
              checked={settings.auto_decision_enabled}
              onCheckedChange={(checked) => handleChange('auto_decision_enabled', checked)}
            />
          </div>

          {settings.auto_decision_enabled && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <Label>Limite de horas para pagamento automático</Label>
              <p className="text-sm text-muted-foreground">
                Se o saldo for maior que este limite, o excedente será marcado para pagamento
              </p>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.auto_decision_threshold_hours}
                  onChange={(e) =>
                    handleChange('auto_decision_threshold_hours', parseInt(e.target.value) || 20)
                  }
                  className="w-24"
                />
                <span className="text-muted-foreground">horas</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSave}
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

// Bank of Hours Settings Component
const BankSettings = ({
  settings,
  onChange,
}: {
  settings: PayrollSettingsData;
  onChange: <K extends keyof PayrollSettingsData>(key: K, value: PayrollSettingsData[K]) => void;
}) => (
  <div className="space-y-6 rounded-lg border bg-muted/30 p-4">
    <h4 className="font-medium">Configurações do Banco de Horas</h4>

    <div className="grid gap-6 md:grid-cols-2">
      {/* Validity */}
      <div className="space-y-2">
        <Label>Validade do Banco</Label>
        <Select
          value={settings.bank_validity}
          onValueChange={(value) => onChange('bank_validity', value as BankValidity)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bankValidityOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {settings.bank_validity === 'custom' && (
          <div className="flex items-center gap-2 pt-2">
            <Input
              type="number"
              min={1}
              max={24}
              value={settings.bank_custom_months || ''}
              onChange={(e) => onChange('bank_custom_months', parseInt(e.target.value) || null)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">meses</span>
          </div>
        )}
      </div>

      {/* Daily Limit */}
      <div className="space-y-2">
        <Label>Limite de Acúmulo Diário</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={8}
            step={0.5}
            value={settings.bank_daily_limit_hours}
            onChange={(e) => onChange('bank_daily_limit_hours', parseFloat(e.target.value) || 2)}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">horas/dia</span>
        </div>
      </div>

      {/* Compensation Ratio */}
      <div className="space-y-2">
        <Label>Proporção de Compensação (Dias Úteis)</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">1h trabalhada =</span>
          <Input
            type="number"
            min={1}
            max={3}
            step={0.1}
            value={settings.bank_compensation_ratio}
            onChange={(e) => onChange('bank_compensation_ratio', parseFloat(e.target.value) || 1)}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">h de folga</span>
        </div>
      </div>

      {/* Sunday Multiplier */}
      <div className="space-y-2">
        <Label>Multiplicador Domingos</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">1h trabalhada =</span>
          <Input
            type="number"
            min={1}
            max={3}
            step={0.1}
            value={settings.bank_sunday_multiplier}
            onChange={(e) => onChange('bank_sunday_multiplier', parseFloat(e.target.value) || 2)}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">h no banco</span>
        </div>
      </div>

      {/* Holiday Multiplier */}
      <div className="space-y-2">
        <Label>Multiplicador Feriados</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">1h trabalhada =</span>
          <Input
            type="number"
            min={1}
            max={3}
            step={0.1}
            value={settings.bank_holiday_multiplier}
            onChange={(e) => onChange('bank_holiday_multiplier', parseFloat(e.target.value) || 2)}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">h no banco</span>
        </div>
      </div>
    </div>
  </div>
);

// Payment Settings Component
const PaymentSettings = ({
  settings,
  onChange,
}: {
  settings: PayrollSettingsData;
  onChange: <K extends keyof PayrollSettingsData>(key: K, value: PayrollSettingsData[K]) => void;
}) => (
  <div className="space-y-6 rounded-lg border bg-muted/30 p-4">
    <h4 className="font-medium">Percentuais de Adicional</h4>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-left font-medium">Tipo de Dia</th>
            <th className="py-2 text-left font-medium">Percentual</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-3">Dias Úteis</td>
            <td className="py-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={settings.payment_weekday_percent}
                  onChange={(e) =>
                    onChange('payment_weekday_percent', parseInt(e.target.value) || 50)
                  }
                  className="w-20"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-3">Sábados</td>
            <td className="py-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={settings.payment_saturday_percent}
                  onChange={(e) =>
                    onChange('payment_saturday_percent', parseInt(e.target.value) || 50)
                  }
                  className="w-20"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-3">Domingos</td>
            <td className="py-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={settings.payment_sunday_percent}
                  onChange={(e) =>
                    onChange('payment_sunday_percent', parseInt(e.target.value) || 100)
                  }
                  className="w-20"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </td>
          </tr>
          <tr>
            <td className="py-3">Feriados</td>
            <td className="py-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={settings.payment_holiday_percent}
                  onChange={(e) =>
                    onChange('payment_holiday_percent', parseInt(e.target.value) || 100)
                  }
                  className="w-20"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

// Mixed Settings Component
const MixedSettings = ({
  settings,
  onChange,
}: {
  settings: PayrollSettingsData;
  onChange: <K extends keyof PayrollSettingsData>(key: K, value: PayrollSettingsData[K]) => void;
}) => (
  <div className="space-y-6 rounded-lg border bg-muted/30 p-4">
    <h4 className="font-medium">Configuração do Modo Misto</h4>
    <p className="text-sm text-muted-foreground">
      Como deseja separar as horas entre banco e pagamento?
    </p>

    <div className="space-y-4">
      {/* Rule Type Selection */}
      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => onChange('mixed_rule_type', 'hours_threshold')}
          className={cn(
            'rounded-lg border p-4 text-left transition-all',
            settings.mixed_rule_type === 'hours_threshold'
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-primary/50'
          )}
        >
          <h5 className="font-medium">Por Limite de Horas</h5>
          <p className="mt-1 text-sm text-muted-foreground">
            Primeiras X horas vão para o Banco, o restante é pago
          </p>
        </button>

        <button
          onClick={() => onChange('mixed_rule_type', 'day_type')}
          className={cn(
            'rounded-lg border p-4 text-left transition-all',
            settings.mixed_rule_type === 'day_type'
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-primary/50'
          )}
        >
          <h5 className="font-medium">Por Tipo de Dia</h5>
          <p className="mt-1 text-sm text-muted-foreground">
            Dias de semana vão para o Banco, Domingos/Feriados são pagos
          </p>
        </button>
      </div>

      {/* Hours Threshold Config */}
      {settings.mixed_rule_type === 'hours_threshold' && (
        <div className="space-y-2 rounded-lg border bg-background p-4">
          <Label>Limite de horas para o Banco</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Primeiras</span>
            <Input
              type="number"
              min={1}
              max={100}
              value={settings.mixed_hours_threshold}
              onChange={(e) =>
                onChange('mixed_hours_threshold', parseInt(e.target.value) || 20)
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              horas do mês vão para o Banco, o restante é pago
            </span>
          </div>
        </div>
      )}

      {/* Day Type Config */}
      {settings.mixed_rule_type === 'day_type' && (
        <div className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Dias que vão para o Banco</Label>
            <div className="flex flex-wrap gap-2">
              {['weekday', 'saturday'].map((day) => (
                <label
                  key={day}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-all',
                    settings.mixed_bank_days.includes(day)
                      ? 'border-primary bg-primary/10'
                      : 'border-muted'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={settings.mixed_bank_days.includes(day)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange('mixed_bank_days', [...settings.mixed_bank_days, day]);
                      } else {
                        onChange(
                          'mixed_bank_days',
                          settings.mixed_bank_days.filter((d) => d !== day)
                        );
                      }
                    }}
                    className="sr-only"
                  />
                  <span className="text-sm">
                    {day === 'weekday' ? 'Dias Úteis' : 'Sábados'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias que são Pagos</Label>
            <div className="flex flex-wrap gap-2">
              {['sunday', 'holiday'].map((day) => (
                <label
                  key={day}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-all',
                    settings.mixed_payment_days.includes(day)
                      ? 'border-primary bg-primary/10'
                      : 'border-muted'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={settings.mixed_payment_days.includes(day)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange('mixed_payment_days', [...settings.mixed_payment_days, day]);
                      } else {
                        onChange(
                          'mixed_payment_days',
                          settings.mixed_payment_days.filter((d) => d !== day)
                        );
                      }
                    }}
                    className="sr-only"
                  />
                  <span className="text-sm">
                    {day === 'sunday' ? 'Domingos' : 'Feriados'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default PayrollSettings;
