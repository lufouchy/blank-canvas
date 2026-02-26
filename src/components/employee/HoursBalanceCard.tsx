import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HoursBalanceCardProps {
  balanceMinutes: number;
  previousPeriod?: number;
  currentPeriod?: number;
}

const HoursBalanceCard = ({ 
  balanceMinutes, 
  previousPeriod = 0, 
  currentPeriod 
}: HoursBalanceCardProps) => {
  const formatTime = (minutes: number) => {
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const periodBalance = currentPeriod ?? balanceMinutes;
  const total = previousPeriod + periodBalance;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wide">
          Saldo de Horas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center justify-center py-2">
          <span className={`text-3xl sm:text-4xl font-bold tabular-nums ${total < 0 ? 'text-destructive' : 'text-primary'}`}>
            {formatTime(total)}
          </span>
          <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
            Saldo Total {total < 0 ? '(a descontar)' : total > 0 ? '(a pagar)' : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 border-t border-border text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground tabular-nums whitespace-nowrap">
              {formatTime(previousPeriod)}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase leading-tight">
              Saldo<br/>Anterior
            </span>
          </div>
          
          <span className="text-muted-foreground">+</span>
          
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground tabular-nums whitespace-nowrap">
              {formatTime(periodBalance)}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase leading-tight">
              Horas<br/>Período
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HoursBalanceCard;
