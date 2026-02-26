import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay } from 'date-fns';
import { validateSchedulePunch } from '@/utils/scheduleValidation';
import EmployeeHero from '@/components/employee/EmployeeHero';
import TodayRecordsCard from '@/components/employee/TodayRecordsCard';
import HoursBalanceCard from '@/components/employee/HoursBalanceCard';
import MonthlyTimesheetCard from '@/components/employee/MonthlyTimesheetCard';
import TodayScheduleCard from '@/components/employee/TodayScheduleCard';

import LocationInfoDialog from '@/components/employee/LocationInfoDialog';
import { useLocationValidation } from '@/hooks/useLocationValidation';

type TimeRecordType = 'entry' | 'lunch_out' | 'lunch_in' | 'exit';

interface TimeRecord {
  id: string;
  record_type: TimeRecordType;
  recorded_at: string;
}

const recordTypeLabels: Record<TimeRecordType, string> = {
  entry: 'Entrada',
  lunch_out: 'Saída Almoço',
  lunch_in: 'Volta Almoço',
  exit: 'Saída',
};

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { validateLocation, isValidating } = useLocationValidation();
  const [todayRecords, setTodayRecords] = useState<TimeRecord[]>([]);
  const [hoursBalance, setHoursBalance] = useState(0);
  const [previousBalance, setPreviousBalance] = useState(0);
  const [currentPeriodBalance, setCurrentPeriodBalance] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastRegisteredTime, setLastRegisteredTime] = useState<string | null>(null);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [mapData, setMapData] = useState<{
    userLocation: { lat: number; lng: number } | null;
    companyLocation: { lat: number; lng: number } | null;
    allowedRadius: number | null;
    distanceMeters?: number;
    isValid?: boolean;
  }>({
    userLocation: null,
    companyLocation: null,
    allowedRadius: null,
  });

  useEffect(() => {
    if (user) {
      fetchTodayRecords();
      fetchHoursBalance();
    }
  }, [user]);

  const fetchTodayRecords = async () => {
    if (!user?.id) return;

    const start = startOfDay(new Date()).toISOString();
    const end = endOfDay(new Date()).toISOString();

    const { data, error } = await supabase
      .from('time_records')
      .select('*')
      .eq('user_id', user.id)
      .gte('recorded_at', start)
      .lte('recorded_at', end)
      .order('recorded_at', { ascending: true });

    if (!error && data) {
      setTodayRecords(data as TimeRecord[]);
    }
  };

  const fetchHoursBalance = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('hours_balance')
      .select('balance_minutes')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setPreviousBalance(data.balance_minutes);
    }
  };

  const handleBalanceCalculated = (periodBalance: number) => {
    setCurrentPeriodBalance(periodBalance);
    setHoursBalance(previousBalance + periodBalance);
  };

  const getNextRecordType = (): TimeRecordType => {
    if (todayRecords.length === 0) return 'entry';
    const lastRecord = todayRecords[todayRecords.length - 1];
    switch (lastRecord.record_type) {
      case 'entry': return 'lunch_out';
      case 'lunch_out': return 'lunch_in';
      case 'lunch_in': return 'exit';
      case 'exit': return 'entry';
      default: return 'entry';
    }
  };

  const handlePunchClock = async () => {
    // Block duplicate punches within 1 minute
    if (todayRecords.length > 0) {
      const lastRecord = todayRecords[todayRecords.length - 1];
      const lastTime = new Date(lastRecord.recorded_at).getTime();
      const now = Date.now();
      if (now - lastTime < 60_000) {
        toast({
          variant: 'destructive',
          title: 'Aguarde',
          description: 'É necessário aguardar pelo menos 1 minuto entre as marcações.',
        });
        return;
      }
    }

    setIsRegistering(true);

    // Validate schedule before allowing punch
    const scheduleResult = await validateSchedulePunch(user!.id);
    if (!scheduleResult.allowed) {
      toast({
        variant: 'destructive',
        title: 'Ponto bloqueado',
        description: scheduleResult.message || 'Você está fora da sua jornada de trabalho.',
      });
      setIsRegistering(false);
      return;
    }
    
    // Validate location before allowing punch
    const locationResult = await validateLocation();
    
    // Update map data if we have location info
    if (locationResult.latitude !== null && locationResult.longitude !== null) {
      setMapData({
        userLocation: { lat: locationResult.latitude, lng: locationResult.longitude },
        companyLocation: locationResult.companyLatitude && locationResult.companyLongitude 
          ? { lat: locationResult.companyLatitude, lng: locationResult.companyLongitude }
          : null,
        allowedRadius: locationResult.allowedRadius || null,
        distanceMeters: locationResult.distanceMeters,
        isValid: locationResult.isValid,
      });
      setShowMapDialog(true);
    }
    
    if (!locationResult.isValid) {
      toast({
        variant: 'destructive',
        title: 'Localização inválida',
        description: locationResult.message,
      });
      setIsRegistering(false);
      return;
    }

    // Show location validation message if available
    if (locationResult.message && locationResult.latitude !== null) {
      toast({
        title: 'Localização verificada',
        description: locationResult.message,
      });
    }

    const recordType = getNextRecordType();
    const recordedAt = new Date().toISOString();

    const { data: profileData } = await supabase.from('profiles').select('organization_id').eq('user_id', user?.id).single();
    const { error } = await supabase
      .from('time_records')
      .insert({
        user_id: user?.id,
        record_type: recordType,
        recorded_at: recordedAt,
        latitude: locationResult.latitude,
        longitude: locationResult.longitude,
        organization_id: profileData?.organization_id,
      });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar ponto',
        description: error.message,
      });
    } else {
      const timeStr = format(new Date(recordedAt), 'HH:mm');
      setLastRegisteredTime(timeStr);
      setShowSuccess(true);

      setTodayRecords((prev) =>
        [...prev, { id: crypto.randomUUID(), record_type: recordType, recorded_at: recordedAt }]
          .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()),
      );

      toast({
        title: 'Ponto registrado!',
        description: `${recordTypeLabels[recordType]} às ${timeStr}`,
      });

      await fetchTodayRecords();
      setTimeout(() => setShowSuccess(false), 3000);
    }

    setIsRegistering(false);
  };

  return (
    <div className="p-6 animate-fade-in">
      {/* Hero section with employee info + punch button */}
      <EmployeeHero
        isRegistering={isRegistering || isValidating}
        onPunchClock={handlePunchClock}
      />

      {/* Success feedback */}
      {showSuccess && lastRegisteredTime && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
          <span className="text-sm font-medium text-foreground bg-card px-3 py-1 rounded-full shadow-lg">
            Registrado às {lastRegisteredTime}
          </span>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <TodayRecordsCard records={todayRecords} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <HoursBalanceCard balanceMinutes={hoursBalance} previousPeriod={previousBalance} currentPeriod={currentPeriodBalance} />
          <TodayScheduleCard />
        </div>
      </div>

      {/* Monthly timesheet */}
      <div className="mt-6">
        <MonthlyTimesheetCard onBalanceCalculated={handleBalanceCalculated} />
      </div>

      {/* Location map dialog */}
      <LocationInfoDialog
        open={showMapDialog}
        onOpenChange={setShowMapDialog}
        userLocation={mapData.userLocation}
        companyLocation={mapData.companyLocation}
        allowedRadius={mapData.allowedRadius}
        distanceMeters={mapData.distanceMeters}
        isValid={mapData.isValid}
      />
    </div>
  );
};

export default EmployeeDashboard;
