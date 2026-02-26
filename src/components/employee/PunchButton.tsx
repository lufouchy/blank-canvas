import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2 } from 'lucide-react';

interface PunchButtonProps {
  isRegistering: boolean;
  showSuccess: boolean;
  lastRegisteredTime: string | null;
  onClick: () => void;
}

const PunchButton = ({ isRegistering, showSuccess, lastRegisteredTime, onClick }: PunchButtonProps) => {
  if (showSuccess) {
    return (
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
        <div className="flex flex-col items-center gap-2">
          <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-success" />
          </div>
          <span className="text-sm font-medium text-foreground bg-card px-3 py-1 rounded-full shadow-lg">
            Registrado às {lastRegisteredTime}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <Button
        className="w-24 h-24 rounded-full bg-warning hover:bg-warning/90 text-warning-foreground shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-1"
        onClick={onClick}
        disabled={isRegistering}
      >
        {isRegistering ? (
          <Clock className="h-8 w-8 animate-spin" />
        ) : (
          <>
            <span className="text-xs font-bold uppercase">Marcar</span>
            <span className="text-xs font-bold uppercase">Ponto</span>
          </>
        )}
      </Button>
    </div>
  );
};

export default PunchButton;
