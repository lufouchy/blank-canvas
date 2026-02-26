import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  cpf: string | null;
  birth_date: string | null;
  hire_date: string | null;
  termination_date: string | null;
  phone: string | null;
  sector: string | null;
  position: string | null;
  work_schedule_id: string | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  status: string | null;
  specification: string | null;
}

interface WorkSchedule {
  id: string;
  name: string;
}

interface ExportParams {
  employees: Employee[];
  schedules: WorkSchedule[];
  filters: {
    searchTerm: string;
    filterSector: string;
    filterStatus: string;
  };
}

const formatCPF = (cpf: string | null): string => {
  if (!cpf) return '-';
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length !== 11) return cpf;
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatPhone = (phone: string | null): string => {
  if (!phone) return '-';
  const numbers = phone.replace(/\D/g, '');
  if (numbers.length === 10) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  if (numbers.length === 11) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
  return phone;
};

const formatDate = (date: string | null): string => {
  if (!date) return '-';
  try {
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '-';
  }
};

const getScheduleName = (scheduleId: string | null, schedules: WorkSchedule[]): string => {
  if (!scheduleId) return '-';
  const schedule = schedules.find(s => s.id === scheduleId);
  return schedule?.name || '-';
};

const getFilterDescription = (filters: ExportParams['filters']): string => {
  const parts: string[] = [];
  if (filters.searchTerm) parts.push(`Nome: "${filters.searchTerm}"`);
  if (filters.filterSector !== 'all') parts.push(`Setor: ${filters.filterSector}`);
  if (filters.filterStatus !== 'all') parts.push(`Status: ${filters.filterStatus}`);
  return parts.length > 0 ? parts.join(' | ') : 'Sem filtros aplicados';
};

export const exportToPDF = ({ employees, schedules, filters }: ExportParams): void => {
  const doc = new jsPDF('landscape');

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LISTA DE COLABORADORES', 148, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 25);
  doc.text(`Filtros: ${getFilterDescription(filters)}`, 14, 31);
  doc.text(`Total: ${employees.length} colaborador(es)`, 14, 37);

  // Table data
  const tableData = employees.map((emp) => [
    emp.full_name,
    emp.email,
    formatCPF(emp.cpf),
    emp.sector || '-',
    emp.position || '-',
    formatDate(emp.hire_date),
    getScheduleName(emp.work_schedule_id, schedules),
    (emp.status || 'ativo').charAt(0).toUpperCase() + (emp.status || 'ativo').slice(1),
    emp.specification || '-',
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Nome', 'E-mail', 'CPF', 'Setor', 'Cargo', 'Admissão', 'Jornada', 'Status', 'Especificação']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [219, 39, 119], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 45 },
      2: { cellWidth: 28 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 22 },
      6: { cellWidth: 25 },
      7: { cellWidth: 20 },
      8: { cellWidth: 30 },
    },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `Página ${i} de ${pageCount} - Sistema de Ponto Digital`,
      148,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  const filename = `colaboradores_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`;
  doc.save(filename);
};

export const exportToExcel = async ({ employees, schedules, filters }: ExportParams): Promise<void> => {
  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Ponto Digital';
  workbook.created = new Date();

  // Create main worksheet
  const worksheet = workbook.addWorksheet('Colaboradores');

  // Define columns with headers and widths
  worksheet.columns = [
    { header: 'Nome', key: 'nome', width: 30 },
    { header: 'E-mail', key: 'email', width: 35 },
    { header: 'CPF', key: 'cpf', width: 15 },
    { header: 'Telefone', key: 'telefone', width: 16 },
    { header: 'Data de Nascimento', key: 'nascimento', width: 15 },
    { header: 'Setor', key: 'setor', width: 15 },
    { header: 'Cargo', key: 'cargo', width: 20 },
    { header: 'Data de Admissão', key: 'admissao', width: 15 },
    { header: 'Data de Desligamento', key: 'desligamento', width: 18 },
    { header: 'Jornada', key: 'jornada', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Especificação', key: 'especificacao', width: 20 },
    { header: 'CEP', key: 'cep', width: 10 },
    { header: 'Endereço', key: 'endereco', width: 35 },
    { header: 'Número', key: 'numero', width: 10 },
    { header: 'Complemento', key: 'complemento', width: 20 },
    { header: 'Bairro', key: 'bairro', width: 20 },
    { header: 'Cidade', key: 'cidade', width: 20 },
    { header: 'Estado', key: 'estado', width: 8 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDB2777' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  employees.forEach((emp) => {
    worksheet.addRow({
      nome: emp.full_name,
      email: emp.email,
      cpf: formatCPF(emp.cpf),
      telefone: formatPhone(emp.phone),
      nascimento: formatDate(emp.birth_date),
      setor: emp.sector || '-',
      cargo: emp.position || '-',
      admissao: formatDate(emp.hire_date),
      desligamento: formatDate(emp.termination_date),
      jornada: getScheduleName(emp.work_schedule_id, schedules),
      status: (emp.status || 'ativo').charAt(0).toUpperCase() + (emp.status || 'ativo').slice(1),
      especificacao: emp.specification || '-',
      cep: emp.address_cep || '-',
      endereco: emp.address_street || '-',
      numero: emp.address_number || '-',
      complemento: emp.address_complement || '-',
      bairro: emp.address_neighborhood || '-',
      cidade: emp.address_city || '-',
      estado: emp.address_state || '-',
    });
  });

  // Add alternating row colors
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' },
      };
    }
  });

  // Create metadata worksheet
  const metadataSheet = workbook.addWorksheet('Informações');
  metadataSheet.columns = [
    { header: '', key: 'label', width: 25 },
    { header: '', key: 'value', width: 50 },
  ];

  metadataSheet.addRow({ label: 'Relatório de Colaboradores', value: '' });
  metadataSheet.addRow({ label: '', value: '' });
  metadataSheet.addRow({ label: 'Gerado em:', value: format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) });
  metadataSheet.addRow({ label: 'Filtros aplicados:', value: getFilterDescription(filters) });
  metadataSheet.addRow({ label: 'Total de colaboradores:', value: employees.length.toString() });

  // Style metadata title
  const titleRow = metadataSheet.getRow(1);
  titleRow.font = { bold: true, size: 14 };

  // Generate file and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `colaboradores_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
};
