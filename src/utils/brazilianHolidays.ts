/**
 * Brazilian state and municipal holidays data.
 * Used to auto-populate holidays based on company location.
 */

interface HolidayTemplate {
  name: string;
  month: number; // 1-12
  day: number;
}

// State holidays by state code (UF)
export const stateHolidays: Record<string, HolidayTemplate[]> = {
  AC: [
    { name: 'Dia do Evangélico', month: 1, day: 23 },
    { name: 'Aniversário do Acre', month: 6, day: 15 },
    { name: 'Início da Revolução Acreana', month: 8, day: 6 },
    { name: 'Dia da Amazônia', month: 9, day: 5 },
    { name: 'Assinatura do Tratado de Petrópolis', month: 11, day: 17 },
  ],
  AL: [
    { name: 'Emancipação Política de Alagoas', month: 9, day: 16 },
    { name: 'São João', month: 6, day: 24 },
  ],
  AM: [
    { name: 'Elevação do Amazonas à Categoria de Província', month: 9, day: 5 },
  ],
  AP: [
    { name: 'Dia de São José', month: 3, day: 19 },
    { name: 'Criação do Território Federal do Amapá', month: 9, day: 13 },
  ],
  BA: [
    { name: 'Independência da Bahia', month: 7, day: 2 },
  ],
  CE: [
    { name: 'Dia de São José', month: 3, day: 19 },
    { name: 'Data Magna do Ceará', month: 3, day: 25 },
  ],
  DF: [
    { name: 'Fundação de Brasília', month: 4, day: 21 },
    { name: 'Dia do Evangélico', month: 11, day: 30 },
  ],
  ES: [],
  GO: [],
  MA: [
    { name: 'Adesão do Maranhão à Independência do Brasil', month: 7, day: 28 },
  ],
  MG: [],
  MS: [
    { name: 'Criação do Estado de Mato Grosso do Sul', month: 10, day: 11 },
  ],
  MT: [],
  PA: [
    { name: 'Adesão do Grão-Pará à Independência do Brasil', month: 8, day: 15 },
  ],
  PB: [
    { name: 'Fundação do Estado da Paraíba', month: 8, day: 5 },
  ],
  PE: [],
  PI: [
    { name: 'Dia do Piauí', month: 10, day: 19 },
  ],
  PR: [
    { name: 'Emancipação Política do Paraná', month: 12, day: 19 },
  ],
  RJ: [
    { name: 'Dia de São Jorge', month: 4, day: 23 },
  ],
  RN: [
    { name: 'Mártires de Cunhaú e Uruaçu', month: 10, day: 3 },
  ],
  RO: [
    { name: 'Criação do Estado de Rondônia', month: 1, day: 4 },
    { name: 'Dia do Evangélico', month: 6, day: 18 },
  ],
  RR: [
    { name: 'Criação do Estado de Roraima', month: 10, day: 5 },
  ],
  RS: [
    { name: 'Dia do Gaúcho - Revolução Farroupilha', month: 9, day: 20 },
  ],
  SC: [
    { name: 'Criação da Capitania de Santa Catarina', month: 8, day: 11 },
  ],
  SE: [
    { name: 'Emancipação Política de Sergipe', month: 7, day: 8 },
  ],
  SP: [
    { name: 'Revolução Constitucionalista de 1932', month: 7, day: 9 },
  ],
  TO: [
    { name: 'Criação do Estado do Tocantins', month: 10, day: 5 },
    { name: 'Autonomia do Estado do Tocantins', month: 3, day: 18 },
    { name: 'Nossa Senhora da Natividade', month: 9, day: 8 },
  ],
};

// Municipal holidays by city name (uppercase, normalized)
// Covers all state capitals and major cities
export const municipalHolidays: Record<string, HolidayTemplate[]> = {
  'PORTO ALEGRE': [
    { name: 'Nossa Senhora dos Navegantes', month: 2, day: 2 },
    { name: 'Aniversário de Porto Alegre', month: 3, day: 26 },
  ],
  'SÃO PAULO': [
    { name: 'Aniversário de São Paulo', month: 1, day: 25 },
  ],
  'RIO DE JANEIRO': [
    { name: 'Dia de São Sebastião', month: 1, day: 20 },
    { name: 'Aniversário do Rio de Janeiro', month: 3, day: 1 },
  ],
  'BELO HORIZONTE': [
    { name: 'Aniversário de Belo Horizonte', month: 12, day: 12 },
  ],
  'SALVADOR': [
    { name: 'Aniversário de Salvador', month: 3, day: 29 },
  ],
  'BRASÍLIA': [
    { name: 'Aniversário de Brasília', month: 4, day: 21 },
  ],
  'CURITIBA': [
    { name: 'Aniversário de Curitiba', month: 3, day: 29 },
  ],
  'RECIFE': [
    { name: 'Aniversário de Recife', month: 3, day: 12 },
  ],
  'FORTALEZA': [
    { name: 'Aniversário de Fortaleza', month: 4, day: 13 },
    { name: 'Nossa Senhora da Assunção', month: 8, day: 15 },
  ],
  'BELÉM': [
    { name: 'Aniversário de Belém', month: 1, day: 12 },
  ],
  'MANAUS': [
    { name: 'Aniversário de Manaus', month: 10, day: 24 },
  ],
  'GOIÂNIA': [
    { name: 'Aniversário de Goiânia', month: 10, day: 24 },
  ],
  'FLORIANÓPOLIS': [
    { name: 'Aniversário de Florianópolis', month: 3, day: 23 },
  ],
  'VITÓRIA': [
    { name: 'Aniversário de Vitória', month: 9, day: 8 },
  ],
  'NATAL': [
    { name: 'Aniversário de Natal', month: 12, day: 25 },
  ],
  'CAMPO GRANDE': [
    { name: 'Aniversário de Campo Grande', month: 8, day: 26 },
  ],
  'CUIABÁ': [
    { name: 'Aniversário de Cuiabá', month: 4, day: 8 },
  ],
  'JOÃO PESSOA': [
    { name: 'Aniversário de João Pessoa', month: 8, day: 5 },
  ],
  'TERESINA': [
    { name: 'Aniversário de Teresina', month: 8, day: 16 },
  ],
  'SÃO LUÍS': [
    { name: 'Aniversário de São Luís', month: 9, day: 8 },
  ],
  'MACEIÓ': [
    { name: 'Aniversário de Maceió', month: 12, day: 5 },
  ],
  'ARACAJU': [
    { name: 'Aniversário de Aracaju', month: 3, day: 17 },
  ],
  'MACAPÁ': [
    { name: 'Aniversário de Macapá', month: 2, day: 4 },
  ],
  'RIO BRANCO': [
    { name: 'Aniversário de Rio Branco', month: 12, day: 28 },
  ],
  'BOA VISTA': [
    { name: 'Aniversário de Boa Vista', month: 6, day: 9 },
  ],
  'PORTO VELHO': [
    { name: 'Aniversário de Porto Velho', month: 10, day: 2 },
  ],
  'PALMAS': [
    { name: 'Aniversário de Palmas', month: 5, day: 20 },
  ],
};

/**
 * Get state holidays for a given state code and year.
 */
export function getStateHolidaysForYear(stateCode: string, year: number) {
  const upperState = stateCode?.toUpperCase();
  const holidays = stateHolidays[upperState] || [];
  return holidays.map(h => ({
    name: h.name,
    date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
    type: 'state' as const,
    state_code: upperState,
    city_name: null,
    is_custom: false,
  }));
}

/**
 * Get municipal holidays for a given city name and year.
 */
export function getMunicipalHolidaysForYear(cityName: string, year: number) {
  const upperCity = cityName?.toUpperCase()?.trim();
  const holidays = municipalHolidays[upperCity] || [];
  return holidays.map(h => ({
    name: h.name,
    date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
    type: 'municipal' as const,
    state_code: null,
    city_name: upperCity,
    is_custom: false,
  }));
}
