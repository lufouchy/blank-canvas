import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Pencil, Trash2, MapPin, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getStateHolidaysForYear, getMunicipalHolidaysForYear } from '@/utils/brazilianHolidays';

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'national' | 'state' | 'municipal' | 'custom';
  state_code: string | null;
  city_name: string | null;
  is_custom: boolean;
}

interface CompanyLocation {
  state: string | null;
  city: string | null;
}

const typeLabels: Record<string, string> = {
  national: 'Nacional',
  state: 'Estadual',
  municipal: 'Municipal',
  custom: 'Personalizado'
};

const typeColors: Record<string, string> = {
  national: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  state: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  municipal: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  custom: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
};

const HolidaysCalendar = () => {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyLocation, setCompanyLocation] = useState<CompanyLocation>({ state: null, city: null });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date(),
    type: 'custom' as Holiday['type']
  });
  const [saving, setSaving] = useState(false);

  const autoPopulateRegionalHolidays = useCallback(async (state: string | null, city: string | null, year: number, existingHolidays: Holiday[]) => {
    if (!state && !city) return;

    // Get organization_id
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: profileData } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', userData.user.id)
      .single();
    if (!profileData?.organization_id) return;

    const existingDates = new Set(existingHolidays.map(h => h.date));
    const toInsert: any[] = [];

    // State holidays
    if (state) {
      const stateHols = getStateHolidaysForYear(state, year);
      for (const h of stateHols) {
        if (!existingDates.has(h.date)) {
          toInsert.push({ ...h, organization_id: profileData.organization_id, state_code: state });
        }
      }
    }

    // Municipal holidays
    if (city) {
      const municipalHols = getMunicipalHolidaysForYear(city, year);
      for (const h of municipalHols) {
        if (!existingDates.has(h.date)) {
          toInsert.push({ ...h, organization_id: profileData.organization_id, city_name: city.toUpperCase() });
        }
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('holidays').insert(toInsert);
      if (error) {
        console.error('Error auto-populating holidays:', error);
      }
      return toInsert.length;
    }
    return 0;
  }, []);

  useEffect(() => {
    setCalendarMonth(new Date(selectedYear, 0));
    fetchCompanyLocation();
    fetchHolidays();
  }, [selectedYear]);

  const fetchCompanyLocation = async () => {
    const { data, error } = await supabase
      .from('company_info')
      .select('address_state, address_city')
      .limit(1)
      .maybeSingle();

    if (data) {
      setCompanyLocation({
        state: data.address_state,
        city: data.address_city
      });
    }
  };

  const fetchHolidays = async () => {
    setLoading(true);
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching holidays:', error);
      toast({
        title: 'Erro ao carregar feriados',
        description: error.message,
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    const currentHolidays = (data || []) as Holiday[];
    
    // Auto-populate state/municipal holidays if company location is set
    const { data: companyData } = await supabase
      .from('company_info')
      .select('address_state, address_city')
      .limit(1)
      .maybeSingle();

    if (companyData?.address_state || companyData?.address_city) {
      const inserted = await autoPopulateRegionalHolidays(
        companyData.address_state,
        companyData.address_city,
        selectedYear,
        currentHolidays
      );
      if (inserted && inserted > 0) {
        // Re-fetch to get the newly inserted holidays
        const { data: updatedData } = await supabase
          .from('holidays')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true });
        setHolidays((updatedData || []) as Holiday[]);
        setLoading(false);
        return;
      }
    }

    setHolidays(currentHolidays);
    setLoading(false);
  };

  const handleOpenDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        name: holiday.name,
        date: parseISO(holiday.date),
        type: holiday.type
      });
    } else {
      setEditingHoliday(null);
      setFormData({
        name: '',
        date: new Date(),
        type: 'custom'
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, informe o nome do feriado.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);

    const holidayData = {
      name: formData.name.trim(),
      date: format(formData.date, 'yyyy-MM-dd'),
      type: formData.type,
      state_code: formData.type === 'state' ? companyLocation.state : null,
      city_name: formData.type === 'municipal' ? companyLocation.city : null,
      is_custom: true
    };

    let error;

    if (editingHoliday) {
      const { error: updateError } = await supabase
        .from('holidays')
        .update(holidayData)
        .eq('id', editingHoliday.id);
      error = updateError;
    } else {
      const { data: hOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
      const { error: insertError } = await supabase
        .from('holidays')
        .insert({ ...holidayData, organization_id: hOrgData?.organization_id });
      error = insertError;
    }

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: editingHoliday ? 'Feriado atualizado' : 'Feriado criado',
        description: `O feriado "${formData.name}" foi salvo com sucesso.`
      });
      setIsDialogOpen(false);
      fetchHolidays();
    }

    setSaving(false);
  };

  const handleDelete = async (holiday: Holiday) => {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', holiday.id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Feriado excluído',
        description: `O feriado "${holiday.name}" foi removido.`
      });
      fetchHolidays();
    }
  };

  const [calendarMonth, setCalendarMonth] = useState(new Date(selectedYear, 0));
  const holidayDates = holidays.map(h => parseISO(h.date));

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i - 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with location info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Localização da Sede</CardTitle>
                <CardDescription>
                  {companyLocation.city && companyLocation.state
                    ? `${companyLocation.city} - ${companyLocation.state}`
                    : 'Não configurada nas Informações Institucionais'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Feriado
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingHoliday ? 'Editar Feriado' : 'Novo Feriado'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingHoliday
                        ? 'Altere as informações do feriado'
                        : 'Adicione um novo feriado ao calendário'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Feriado</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Aniversário da Cidade"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !formData.date && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.date
                              ? format(formData.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                              : 'Selecione uma data'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.date}
                            onSelect={(date) => date && setFormData({ ...formData, date })}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(v) => setFormData({ ...formData, type: v as Holiday['type'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="national">Nacional</SelectItem>
                          <SelectItem value="state">
                            Estadual {companyLocation.state && `(${companyLocation.state})`}
                          </SelectItem>
                          <SelectItem value="municipal">
                            Municipal {companyLocation.city && `(${companyLocation.city})`}
                          </SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar and Table */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calendar View */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visualização do Calendário</CardTitle>
            <CardDescription>
              Dias destacados são feriados
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
              <Calendar
                mode="multiple"
                selected={holidayDates}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
              numberOfMonths={1}
                className="rounded-md border pointer-events-auto"
                locale={ptBR}
              modifiers={{
                holiday: holidayDates
              }}
              modifiersStyles={{
                holiday: {
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  borderRadius: '50%'
                }
              }}
            />
          </CardContent>
        </Card>

        {/* Holidays List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista de Feriados</CardTitle>
            <CardDescription>
              {holidays.length} feriados em {selectedYear}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum feriado cadastrado para {selectedYear}
                      </TableCell>
                    </TableRow>
                  ) : (
                    holidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="font-medium">
                          {format(parseISO(holiday.date), 'dd/MM', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{holiday.name}</TableCell>
                        <TableCell>
                          <Badge className={typeColors[holiday.type]} variant="secondary">
                            {typeLabels[holiday.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(holiday)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(holiday)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {Object.entries(typeLabels).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Badge className={typeColors[key]} variant="secondary">
                  {label}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HolidaysCalendar;
