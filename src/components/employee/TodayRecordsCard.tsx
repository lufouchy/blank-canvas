import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type TimeRecordType = 'entry' | 'lunch_out' | 'lunch_in' | 'exit';

interface TimeRecord {
  id: string;
  record_type: TimeRecordType;
  recorded_at: string;
}

interface TodayRecordsCardProps {
  records: TimeRecord[];
  onIncluir?: () => void;
}

const TodayRecordsCard = ({ records, onIncluir }: TodayRecordsCardProps) => {
  const today = new Date();
  const dayOfWeek = format(today, 'EEEE', { locale: ptBR });
  const formattedDate = format(today, 'dd.MM.yy');

  const recordLabels: Record<TimeRecordType, string> = {
    entry: 'Entrada',
    lunch_out: 'Saída Almoço',
    lunch_in: 'Volta Almoço',
    exit: 'Saída',
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wide">
          Marcações Hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
          <div className="flex items-center justify-center w-8 h-8 bg-muted rounded text-xs font-medium">
            {format(today, 'dd')}
          </div>
          <div>
            <span className="font-medium capitalize">{dayOfWeek}</span>
            <span className="text-muted-foreground ml-2">{formattedDate}</span>
          </div>
        </div>

        {records.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nenhuma marcação registrada hoje
          </p>
        ) : (
          <div className="relative pl-6">
            {/* Timeline line */}
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-primary/20" />
            
            <div className="space-y-4">
              {records.map((record, index) => (
                <div key={record.id} className="relative flex items-center gap-4">
                  {/* Timeline dot */}
                  <div className="absolute -left-4 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                  
                  <div className="flex items-center justify-between flex-1">
                    <span className="text-lg font-medium tabular-nums">
                      {format(new Date(record.recorded_at), 'HH:mm')}
                    </span>
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                </div>
              ))}
              
              {/* Pending next record indicator */}
              {records.length < 4 && (
                <div className="relative flex items-center gap-4">
                  <div className="absolute -left-4 w-3 h-3 bg-muted rounded-full border-2 border-background" />
                  <span className="text-muted-foreground">—</span>
                </div>
              )}
            </div>
          </div>
        )}

        <button className="w-full text-center text-sm text-muted-foreground mt-4 pt-3 border-t border-border hover:text-foreground transition-colors flex items-center justify-center gap-1">
          SOBRE A MARCAÇÃO
          <span className="text-xs">▲</span>
        </button>
      </CardContent>
    </Card>
  );
};

export default TodayRecordsCard;
