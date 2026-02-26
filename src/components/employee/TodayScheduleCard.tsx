import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coffee } from 'lucide-react';

interface TodayScheduleCardProps {
  startTime?: string;
  lunchStart?: string;
  lunchEnd?: string;
  endTime?: string;
}

const TodayScheduleCard = ({ 
  startTime = '08:00',
  lunchStart = '12:00',
  lunchEnd = '13:30',
  endTime = '18:00'
}: TodayScheduleCardProps) => {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wide">
          Escala de Hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">Horário Esperado</p>
        
        <div className="flex items-center justify-between">
          {/* Start time */}
          <div className="text-center">
            <span className="text-lg font-semibold tabular-nums">{startTime}</span>
          </div>
          
          {/* Line to lunch */}
          <div className="flex-1 h-0.5 bg-muted mx-2" />
          
          {/* Lunch start */}
          <div className="text-center">
            <span className="text-lg font-semibold tabular-nums">{lunchStart}</span>
          </div>
          
          {/* Lunch break icon */}
          <div className="mx-4 flex items-center justify-center w-10 h-10 rounded-full bg-muted">
            <Coffee className="h-5 w-5 text-muted-foreground" />
          </div>
          
          {/* Lunch end */}
          <div className="text-center">
            <span className="text-lg font-semibold tabular-nums">{lunchEnd}</span>
          </div>
          
          {/* Line to end */}
          <div className="flex-1 h-0.5 bg-muted mx-2" />
          
          {/* End time */}
          <div className="text-center">
            <span className="text-lg font-semibold tabular-nums">{endTime}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TodayScheduleCard;
