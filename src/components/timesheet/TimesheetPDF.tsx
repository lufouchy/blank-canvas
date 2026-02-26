import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimeRecord {
  id: string;
  record_type: 'entry' | 'lunch_out' | 'lunch_in' | 'exit';
  recorded_at: string;
}

interface CompanyInfo {
  logo_url: string | null;
  cnpj: string;
  nome_fantasia: string;
}

interface GeneratePDFParams {
  records: TimeRecord[];
  month: Date;
  employeeName: string;
  signatureData?: string | null;
  companyInfo?: CompanyInfo | null;
}

const recordTypeLabel: Record<string, string> = {
  entry: 'Entrada',
  lunch_out: 'Saída Almoço',
  lunch_in: 'Volta Almoço',
  exit: 'Saída',
};

const formatCNPJ = (cnpj: string): string => {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const generateTimesheetPDF = async ({ records, month, employeeName, signatureData, companyInfo }: GeneratePDFParams): Promise<jsPDF> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const startDate = startOfMonth(month);
  const endDate = endOfMonth(month);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Colors - Deep Space Blue (#023047) and Blue Green (#219EBC)
  const deepSpaceBlue: [number, number, number] = [2, 48, 71];
  const blueGreen: [number, number, number] = [33, 158, 188];
  const skyBlue: [number, number, number] = [142, 202, 230];
  const lightBg: [number, number, number] = [248, 250, 252];

  let headerY = 10;

  // Top accent bar
  doc.setFillColor(...deepSpaceBlue);
  doc.rect(0, 0, pageWidth, 4, 'F');

  headerY = 12;

  // Company Header with improved layout
  if (companyInfo) {
    // Logo on the left
    if (companyInfo.logo_url) {
      try {
        const logoImage = await loadImage(companyInfo.logo_url);
        doc.addImage(logoImage, 'PNG', 14, headerY, 28, 28);
      } catch (error) {
        console.error('Error loading company logo:', error);
      }
    }

    // Company info with better typography
    const textX = companyInfo.logo_url ? 48 : 14;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...deepSpaceBlue);
    doc.text(companyInfo.nome_fantasia.toUpperCase(), textX, headerY + 10);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`CNPJ: ${formatCNPJ(companyInfo.cnpj)}`, textX, headerY + 18);

    headerY += 35;
  }

  // Employee info in a styled box (no title block)

  // Employee info in a styled box
  doc.setDrawColor(...skyBlue);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, headerY, pageWidth - 28, 24, 2, 2, 'S');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...deepSpaceBlue);
  doc.text('Colaborador:', 18, headerY + 8);
  doc.text('Período:', 18, headerY + 16);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(employeeName, 50, headerY + 8);
  
  const monthName = format(startDate, "MMMM 'de' yyyy", { locale: ptBR });
  doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), 42, headerY + 16);
  
  // Generation date on the right
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - 18, headerY + 12, { align: 'right' });

  headerY += 30;

  // Prepare table data
  const tableData: (string | number)[][] = [];
  let totalWorkedMinutes = 0;
  let totalOvertimeMinutes = 0;
  let workDaysCount = 0;
  const STANDARD_WORK_MINUTES = 8 * 60;

  days.forEach((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayRecords = records.filter((r) => r.recorded_at.startsWith(dayStr));
    
    const entry = dayRecords.find((r) => r.record_type === 'entry');
    const lunchOut = dayRecords.find((r) => r.record_type === 'lunch_out');
    const lunchIn = dayRecords.find((r) => r.record_type === 'lunch_in');
    const exit = dayRecords.find((r) => r.record_type === 'exit');

    let workedMinutes = 0;
    if (entry && lunchOut) {
      workedMinutes += differenceInMinutes(new Date(lunchOut.recorded_at), new Date(entry.recorded_at));
    }
    if (lunchIn && exit) {
      workedMinutes += differenceInMinutes(new Date(exit.recorded_at), new Date(lunchIn.recorded_at));
    }

    const overtime = Math.max(0, workedMinutes - STANDARD_WORK_MINUTES);
    totalWorkedMinutes += workedMinutes;
    totalOvertimeMinutes += overtime;
    
    if (workedMinutes > 0) workDaysCount++;

    const isWeekendDay = isWeekend(day);

    tableData.push([
      format(day, 'dd/MM (EEE)', { locale: ptBR }),
      entry ? format(new Date(entry.recorded_at), 'HH:mm') : '-',
      lunchOut ? format(new Date(lunchOut.recorded_at), 'HH:mm') : '-',
      lunchIn ? format(new Date(lunchIn.recorded_at), 'HH:mm') : '-',
      exit ? format(new Date(exit.recorded_at), 'HH:mm') : '-',
      workedMinutes > 0 ? formatMinutes(workedMinutes) : '-',
      overtime > 0 ? `+${formatMinutes(overtime)}` : '-',
      isWeekendDay ? 'FDS' : '',
    ]);
  });

  // Table with improved styling
  autoTable(doc, {
    startY: headerY,
    head: [['Data', 'Entrada', 'Saída Almoço', 'Volta Almoço', 'Saída', 'Trabalhado', 'H. Extra', 'Obs']],
    body: tableData,
    styles: { 
      fontSize: 7, 
      cellPadding: 1.5,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    headStyles: { 
      fillColor: deepSpaceBlue, 
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [245, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 20, halign: 'center', textColor: blueGreen },
      7: { cellWidth: 15, halign: 'center', textColor: [150, 150, 150] },
    },
    didParseCell: (data) => {
      // Highlight weekend rows
      if (data.section === 'body' && data.row.raw && (data.row.raw as any[])[7] === 'FDS') {
        data.cell.styles.fillColor = [255, 247, 235];
        data.cell.styles.textColor = [180, 130, 80];
      }
    },
  });

  // Summary section with styled cards
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  
  // Summary title
  doc.setFillColor(...deepSpaceBlue);
  doc.roundedRect(14, finalY, 60, 6, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('RESUMO DO PERÍODO', 17, finalY + 4.5);
  
  // Summary cards
  const cardY = finalY + 12;
  const cardWidth = (pageWidth - 42) / 3;
  
  // Card 1 - Dias trabalhados
  doc.setFillColor(...lightBg);
  doc.roundedRect(14, cardY, cardWidth, 20, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Dias Trabalhados', 14 + cardWidth / 2, cardY + 6, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...deepSpaceBlue);
  doc.text(`${workDaysCount}`, 14 + cardWidth / 2, cardY + 15, { align: 'center' });
  
  // Card 2 - Total trabalhado
  doc.setFillColor(...lightBg);
  doc.roundedRect(14 + cardWidth + 7, cardY, cardWidth, 20, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Total Trabalhado', 14 + cardWidth + 7 + cardWidth / 2, cardY + 6, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...deepSpaceBlue);
  doc.text(formatMinutes(totalWorkedMinutes), 14 + cardWidth + 7 + cardWidth / 2, cardY + 15, { align: 'center' });
  
  // Card 3 - Horas extras
  doc.setFillColor(235, 251, 238);
  doc.roundedRect(14 + (cardWidth + 7) * 2, cardY, cardWidth, 20, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Horas Extras', 14 + (cardWidth + 7) * 2 + cardWidth / 2, cardY + 6, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 139, 34);
  doc.text(`+${formatMinutes(totalOvertimeMinutes)}`, 14 + (cardWidth + 7) * 2 + cardWidth / 2, cardY + 15, { align: 'center' });

  // Signature section
  const signatureY = cardY + 30;
  
  if (signatureData) {
    doc.setDrawColor(...skyBlue);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, signatureY, 90, 40, 2, 2, 'S');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...deepSpaceBlue);
    doc.text('Assinatura do Colaborador', 18, signatureY + 6);
    
    doc.addImage(signatureData, 'PNG', 18, signatureY + 10, 55, 20);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Assinado em: ${format(new Date(), 'dd/MM/yyyy')}`, 18, signatureY + 35);
  } else {
    // Space for manual signature
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 2], 0);
    doc.roundedRect(14, signatureY, 90, 40, 2, 2, 'S');
    doc.setLineDashPattern([], 0);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Assinatura do Colaborador', 59, signatureY + 20, { align: 'center' });
    
    doc.setDrawColor(180, 180, 180);
    doc.line(24, signatureY + 30, 94, signatureY + 30);
  }

  // Footer - compact accent line
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;
  doc.setFillColor(...deepSpaceBlue);
  doc.rect(0, footerY, pageWidth, 8, 'F');
  
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  doc.text('Documento gerado automaticamente pelo Sistema de Ponto Digital', pageWidth / 2, footerY + 5, { align: 'center' });

  return doc;
};

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(filename);
};

export const getPDFBase64 = (doc: jsPDF): string => {
  return doc.output('datauristring');
};
