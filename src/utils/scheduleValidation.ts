import { supabase } from '@/integrations/supabase/client';

interface ScheduleValidationResult {
  allowed: boolean;
  message?: string;
}

interface WorkScheduleInfo {
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  monday_hours: number | null;
  tuesday_hours: number | null;
  wednesday_hours: number | null;
  thursday_hours: number | null;
  friday_hours: number | null;
  saturday_hours: number | null;
  sunday_hours: number | null;
  schedule_type: string;
}

type FlexibilityMode = 'tolerance' | 'fixed' | 'hours_only';

/**
 * Validates whether the employee is allowed to punch at the current time
 * based on the company's schedule flexibility settings.
 */
export async function validateSchedulePunch(userId: string): Promise<ScheduleValidationResult> {
  try {
    // 1. Fetch flexibility settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, work_schedule_id')
      .eq('user_id', userId)
      .single();

    if (!profile) return { allowed: true };

    const { data: payrollSettings } = await supabase
      .from('payroll_settings')
      .select('schedule_flexibility_mode, tolerance_entry_minutes')
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    const mode: FlexibilityMode = (payrollSettings?.schedule_flexibility_mode as FlexibilityMode) || 'tolerance';
    const toleranceMinutes = payrollSettings?.tolerance_entry_minutes ?? 10;

    // Option 3: hours_only - no schedule restriction
    if (mode === 'hours_only') {
      return { allowed: true };
    }

    // Need work schedule for options 1 and 2
    if (!profile.work_schedule_id) {
      return { allowed: true }; // No schedule assigned, allow
    }

    const { data: schedule } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('id', profile.work_schedule_id)
      .single();

    if (!schedule) return { allowed: true };

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat

    // Check if today is a working day
    const dayHoursMap: Record<number, number | null> = {
      0: schedule.sunday_hours,
      1: schedule.monday_hours,
      2: schedule.tuesday_hours,
      3: schedule.wednesday_hours,
      4: schedule.thursday_hours,
      5: schedule.friday_hours,
      6: schedule.saturday_hours,
    };

    const expectedHours = dayHoursMap[dayOfWeek] ?? 0;
    if (expectedHours === 0) {
      // Check for overtime authorization
      const isAuthorized = await checkOvertimeAuthorization(userId, profile.organization_id);
      if (isAuthorized) return { allowed: true };
      return { allowed: false, message: 'Você está fora da sua jornada de trabalho.' };
    }

    // Check for temporary schedule adjustment
    const today = now.toISOString().split('T')[0];
    const { data: adjustment } = await supabase
      .from('schedule_adjustments')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', profile.organization_id)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Use adjustment times if available, otherwise use schedule times
    const startTimeStr = adjustment?.custom_start_time || schedule.start_time;
    const endTimeStr = adjustment?.custom_end_time || schedule.end_time;

    // Parse times
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const scheduleStart = startH * 60 + startM;
    const scheduleEnd = endH * 60 + endM;

    // Check overtime authorization for extended hours
    const hasOvertimeAuth = adjustment?.overtime_authorized || 
      await checkOvertimeAuthorization(userId, profile.organization_id);

    if (mode === 'tolerance') {
      const earliestEntry = scheduleStart - toleranceMinutes;
      // Allow up to tolerance after end, or overtime if authorized
      const latestExit = hasOvertimeAuth 
        ? scheduleEnd + (adjustment?.overtime_max_minutes || 120)
        : scheduleEnd + toleranceMinutes;

      if (currentMinutes < earliestEntry || currentMinutes > latestExit) {
        return { allowed: false, message: 'Você está fora da sua jornada de trabalho.' };
      }
      return { allowed: true };
    }

    if (mode === 'fixed') {
      // For fixed mode, allow punch only within schedule window (small 2min buffer for system delay)
      const buffer = 2;
      const earliestEntry = scheduleStart - buffer;
      const latestExit = hasOvertimeAuth
        ? scheduleEnd + (adjustment?.overtime_max_minutes || 120)
        : scheduleEnd + buffer;

      if (currentMinutes < earliestEntry || currentMinutes > latestExit) {
        return { allowed: false, message: 'Você está fora da sua jornada de trabalho.' };
      }
      return { allowed: true };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error validating schedule punch:', error);
    return { allowed: true }; // Fail open to not block employees
  }
}

async function checkOvertimeAuthorization(userId: string, organizationId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('schedule_adjustments')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('overtime_authorized', true)
    .lte('start_date', today)
    .gte('end_date', today)
    .limit(1)
    .maybeSingle();

  return !!data;
}
