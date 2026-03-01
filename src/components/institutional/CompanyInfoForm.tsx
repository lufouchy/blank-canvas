import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Upload, Building, MapPin, Phone } from 'lucide-react';
import { validateCNPJ, formatCNPJ, formatPhone } from '@/utils/cnpjValidation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CompanyInfoFormProps {
  companyId: string | null;
  onSave: (id: string, hasBranches: boolean) => void;
}

const businessSectors = [
  { value: 'agronegocio', label: 'Agronegócio' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'construcao', label: 'Construção' },
  { value: 'educacao', label: 'Educação' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'industria', label: 'Indústria' },
  { value: 'logistica', label: 'Logística' },
  { value: 'saude', label: 'Saúde' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'varejo', label: 'Varejo' },
  { value: 'outro', label: 'Outro' },
];

interface CompanyForm {
  logo_url: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  business_sector: string;
  address_cep: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  phone: string;
  whatsapp: string;
  financial_email: string;
  has_branches: boolean;
}

const CompanyInfoForm = ({ companyId, onSave }: CompanyInfoFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [cnpjError, setCnpjError] = useState('');
  const [orgCode, setOrgCode] = useState('');
  
  const [form, setForm] = useState<CompanyForm>({
    logo_url: '',
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    business_sector: 'outro',
    address_cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    phone: '',
    whatsapp: '',
    financial_email: '',
    has_branches: false,
  });

  const fetchOrgCode = async () => {
    try {
      // If viewing an existing company, get org code from the company's organization
      if (companyId) {
        const { data: companyData } = await supabase
          .from('company_info')
          .select('organization_id')
          .eq('id', companyId)
          .single();

        if (companyData?.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('org_code')
            .eq('id', companyData.organization_id)
            .single();

          if (orgData?.org_code) {
            setOrgCode(orgData.org_code);
            return;
          }
        }
      }

      // Fallback: get from user's own org (only for non-suporte users)
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .eq('role', 'suporte')
        .maybeSingle();

      // If suporte user and no company yet, don't show any org code
      if (roleData) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!profileData?.organization_id) return;

      const { data: orgData } = await supabase
        .from('organizations')
        .select('org_code')
        .eq('id', profileData.organization_id)
        .single();

      if (orgData?.org_code) {
        setOrgCode(orgData.org_code);
      }
    } catch (error) {
      console.error('Error fetching org code:', error);
    }
  };

  const generateAndSaveOrgCode = async (cnpjDigits: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!profileData?.organization_id) return;

      // Check if org already has a code - never overwrite
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('org_code')
        .eq('id', profileData.organization_id)
        .single();

      if (existingOrg?.org_code) {
        setOrgCode(existingOrg.org_code);
        return; // Already has a code, don't regenerate
      }

      // Get all existing org_codes
      const { data: allOrgs } = await supabase
        .from('organizations')
        .select('org_code')
        .not('org_code', 'is', null);

      const existingCodes = new Set((allOrgs || []).map(o => o.org_code));

      // Use first 5 digits of CNPJ, increment if already exists
      const base = parseInt(cnpjDigits.substring(0, 5), 10);
      let candidate = base;
      while (existingCodes.has(String(candidate).padStart(5, '0'))) {
        candidate++;
      }
      const code = String(candidate).padStart(5, '0');

      await supabase
        .from('organizations')
        .update({ org_code: code })
        .eq('id', profileData.organization_id);

      setOrgCode(code);
    } catch (error) {
      console.error('Error generating org code:', error);
    }
  };

  useEffect(() => {
    fetchOrgCode();
  }, [companyId]);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!companyId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('company_info')
          .select('*')
          .eq('id', companyId)
          .single();

        if (error) throw error;
        
        if (data) {
          setForm({
            logo_url: data.logo_url || '',
            cnpj: formatCNPJ(data.cnpj || ''),
            razao_social: data.razao_social || '',
            nome_fantasia: data.nome_fantasia || '',
            inscricao_estadual: data.inscricao_estadual || '',
            inscricao_municipal: data.inscricao_municipal || '',
            business_sector: data.business_sector || 'outro',
            address_cep: data.address_cep || '',
            address_street: data.address_street || '',
            address_number: data.address_number || '',
            address_complement: data.address_complement || '',
            address_neighborhood: data.address_neighborhood || '',
            address_city: data.address_city || '',
            address_state: data.address_state || '',
            phone: formatPhone(data.phone || ''),
            whatsapp: formatPhone(data.whatsapp || ''),
            financial_email: data.financial_email || '',
            has_branches: data.has_branches || false,
          });
        }
      } catch (error) {
        console.error('Error fetching company data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyData();
  }, [companyId]);

  const [fetchingCnpj, setFetchingCnpj] = useState(false);

  const handleCNPJChange = async (value: string) => {
    const formatted = formatCNPJ(value);
    setForm({ ...form, cnpj: formatted });
    
    const cleanCNPJ = value.replace(/\D/g, '');
    if (cleanCNPJ.length === 14) {
      if (!validateCNPJ(cleanCNPJ)) {
        setCnpjError('CNPJ inválido');
      } else {
        setCnpjError('');
        // Fetch company data from BrasilAPI
        setFetchingCnpj(true);
        try {
          const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
          if (response.ok) {
            const data = await response.json();
            setForm(prev => ({
              ...prev,
              cnpj: formatted,
              razao_social: data.razao_social || '',
              nome_fantasia: data.nome_fantasia || data.razao_social || '',
              address_cep: data.cep ? data.cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : '',
              address_street: data.logradouro || '',
              address_number: data.numero || '',
              address_complement: data.complemento || '',
              address_neighborhood: data.bairro || '',
              address_city: data.municipio || '',
              address_state: data.uf || '',
              phone: data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : '',
            }));
            toast({
              title: 'Dados carregados',
              description: 'Informações da empresa foram preenchidas automaticamente',
            });
          } else if (response.status === 404) {
            toast({
              title: 'CNPJ não encontrado',
              description: 'O CNPJ informado não foi encontrado na Receita Federal',
              variant: 'destructive',
            });
          }
        } catch (error) {
          console.error('Error fetching CNPJ data:', error);
          // Silently fail - user can fill manually
        } finally {
          setFetchingCnpj(false);
        }
      }
    } else {
      setCnpjError('');
    }
  };

  const handleCEPChange = async (value: string) => {
    const cleanCEP = value.replace(/\D/g, '');
    const formattedCEP = cleanCEP.length > 5 
      ? `${cleanCEP.slice(0, 5)}-${cleanCEP.slice(5, 8)}`
      : cleanCEP;
    
    setForm({ ...form, address_cep: formattedCEP });

    if (cleanCEP.length === 8) {
      setFetchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            address_cep: formattedCEP,
            address_street: data.logradouro || '',
            address_neighborhood: data.bairro || '',
            address_city: data.localidade || '',
            address_state: data.uf || '',
          }));
        }
      } catch (error) {
        console.error('Error fetching CEP:', error);
      } finally {
        setFetchingCep(false);
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido é 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `company-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setForm({ ...form, logo_url: urlData.publicUrl });
      toast({
        title: 'Logo enviada',
        description: 'A logomarca foi carregada com sucesso',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Erro ao enviar logo',
        description: 'Não foi possível carregar a logomarca',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanCNPJ = form.cnpj.replace(/\D/g, '');
    if (!validateCNPJ(cleanCNPJ)) {
      setCnpjError('CNPJ inválido');
      return;
    }

    setLoading(true);
    try {
      const companyData = {
        logo_url: form.logo_url || null,
        cnpj: cleanCNPJ,
        razao_social: form.razao_social,
        nome_fantasia: form.nome_fantasia,
        inscricao_estadual: form.inscricao_estadual || null,
        inscricao_municipal: form.inscricao_municipal || null,
        business_sector: form.business_sector as any,
        address_cep: form.address_cep.replace(/\D/g, '') || null,
        address_street: form.address_street || null,
        address_number: form.address_number || null,
        address_complement: form.address_complement || null,
        address_neighborhood: form.address_neighborhood || null,
        address_city: form.address_city || null,
        address_state: form.address_state || null,
        phone: form.phone.replace(/\D/g, '') || null,
        whatsapp: form.whatsapp.replace(/\D/g, '') || null,
        financial_email: form.financial_email || null,
        has_branches: form.has_branches,
      };

      if (companyId) {
        const { error } = await supabase
          .from('company_info')
          .update(companyData)
          .eq('id', companyId);

        if (error) throw error;
        
        toast({
          title: 'Dados atualizados',
          description: 'As informações da empresa foram atualizadas com sucesso',
        });
        onSave(companyId, form.has_branches);
      } else {
        const { data: ciOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
        const { data, error } = await supabase
          .from('company_info')
          .insert({ ...companyData, organization_id: ciOrgData?.organization_id })
          .select('id')
          .single();

        if (error) throw error;
        
        toast({
          title: 'Empresa cadastrada',
          description: 'Os dados institucionais foram salvos com sucesso',
        });
        onSave(data.id, form.has_branches);
      }

      // Generate org code from CNPJ if not yet set
      if (!orgCode && cleanCNPJ.length === 14) {
        await generateAndSaveOrgCode(cleanCNPJ);
      }
    } catch (error: any) {
      console.error('Error saving company:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar os dados da empresa',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && companyId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identification Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Dados de Identificação
          </CardTitle>
          <CardDescription>
            Informações básicas da pessoa jurídica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Upload */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary/20">
              {form.logo_url ? (
                <AvatarImage src={form.logo_url} alt="Logo da empresa" />
              ) : (
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Building className="h-8 w-8" />
                </AvatarFallback>
              )}
            </Avatar>
            <div className="space-y-2">
              <Label>Logomarca da Empresa</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="max-w-xs"
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <p className="text-xs text-muted-foreground">
                Máximo 5MB. Formatos: JPG, PNG, GIF
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <div className="relative">
                <Input
                  id="cnpj"
                  value={form.cnpj}
                  onChange={(e) => handleCNPJChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  required
                  readOnly={!!orgCode}
                  disabled={!!orgCode}
                  className={orgCode ? 'bg-muted' : ''}
                />
                {fetchingCnpj && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                )}
              </div>
              {cnpjError && (
                <p className="text-sm text-destructive">{cnpjError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="org_code">ID da Organização</Label>
              <Input
                id="org_code"
                value={orgCode}
                readOnly
                disabled
                className="bg-muted font-mono"
                placeholder="Gerado ao salvar o CNPJ"
              />
              <p className="text-xs text-muted-foreground">
                Gerado automaticamente a partir do CNPJ
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="razao_social">Razão Social *</Label>
              <Input
                id="razao_social"
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                placeholder="Nome jurídico da empresa"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_fantasia">Nome Fantasia *</Label>
              <Input
                id="nome_fantasia"
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                placeholder="Nome pelo qual a empresa é conhecida"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_sector">Ramo de Atividade *</Label>
              <Select
                value={form.business_sector}
                onValueChange={(value) => setForm({ ...form, business_sector: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ramo" />
                </SelectTrigger>
                <SelectContent>
                  {businessSectors.map((sector) => (
                    <SelectItem key={sector.value} value={sector.value}>
                      {sector.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
              <Input
                id="inscricao_estadual"
                value={form.inscricao_estadual}
                onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inscricao_municipal">Inscrição Municipal</Label>
              <Input
                id="inscricao_municipal"
                value={form.inscricao_municipal}
                onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location and Contact Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Localização e Contato
          </CardTitle>
          <CardDescription>
            Endereço e dados para contato
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address_cep">CEP</Label>
              <div className="relative">
                <Input
                  id="address_cep"
                  value={form.address_cep}
                  onChange={(e) => handleCEPChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {fetchingCep && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                )}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address_street">Logradouro</Label>
              <Input
                id="address_street"
                value={form.address_street}
                onChange={(e) => setForm({ ...form, address_street: e.target.value })}
                placeholder="Rua, Avenida, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_number">Número</Label>
              <Input
                id="address_number"
                value={form.address_number}
                onChange={(e) => setForm({ ...form, address_number: e.target.value })}
                placeholder="123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_complement">Complemento</Label>
              <Input
                id="address_complement"
                value={form.address_complement}
                onChange={(e) => setForm({ ...form, address_complement: e.target.value })}
                placeholder="Sala, Andar, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_neighborhood">Bairro</Label>
              <Input
                id="address_neighborhood"
                value={form.address_neighborhood}
                onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })}
                placeholder="Bairro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_city">Cidade</Label>
              <Input
                id="address_city"
                value={form.address_city}
                onChange={(e) => setForm({ ...form, address_city: e.target.value })}
                placeholder="Cidade"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_state">UF</Label>
              <Input
                id="address_state"
                value={form.address_state}
                onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })}
                placeholder="UF"
                maxLength={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone Comercial</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                placeholder="(00) 0000-0000"
                maxLength={15}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="financial_email">E-mail</Label>
              <Input
                id="financial_email"
                type="email"
                value={form.financial_email}
                onChange={(e) => setForm({ ...form, financial_email: e.target.value })}
                placeholder="financeiro@empresa.com"
              />
            </div>
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !!cnpjError}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Salvando...
            </>
          ) : (
            'Salvar e Continuar'
          )}
        </Button>
      </div>
    </form>
  );
};

export default CompanyInfoForm;
