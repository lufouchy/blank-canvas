import jsPDF from 'jspdf';
import { format, subYears, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CompanyInfo {
  logo_url: string | null;
  cnpj: string;
  nome_fantasia: string;
  address_city?: string | null;
  address_state?: string | null;
}

interface EmployeeInfo {
  full_name: string;
  cpf: string | null;
}

interface VacationData {
  start_date: string;
  end_date: string;
  days_count: number;
}

interface GenerateVacationReceiptParams {
  companyInfo: CompanyInfo | null;
  employeeInfo: EmployeeInfo;
  vacationData: VacationData;
  signatureData?: string | null;
  signedAt?: string | null;
}

const formatCNPJ = (cnpj: string): string => {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatCPF = (cpf: string): string => {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

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

export const generateVacationReceiptPDF = async ({
  companyInfo,
  employeeInfo,
  vacationData,
  signatureData,
  signedAt,
}: GenerateVacationReceiptParams): Promise<jsPDF> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let currentY = 20;

  // Deep Space Blue color for accents
  const deepSpaceBlue = { r: 2, g: 48, b: 71 };

  // Company Header
  if (companyInfo) {
    // Logo on the left
    if (companyInfo.logo_url) {
      try {
        const logoImage = await loadImage(companyInfo.logo_url);
        doc.addImage(logoImage, 'PNG', margin, currentY, 30, 30);
      } catch (error) {
        console.error('Error loading company logo:', error);
      }
    }

    // Company info on the right of the logo
    const textX = companyInfo.logo_url ? margin + 38 : margin;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(deepSpaceBlue.r, deepSpaceBlue.g, deepSpaceBlue.b);
    doc.text(companyInfo.nome_fantasia.toUpperCase(), textX, currentY + 12);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`CNPJ: ${formatCNPJ(companyInfo.cnpj)}`, textX, currentY + 20);

    currentY += 40;

    // Separator line
    doc.setDrawColor(deepSpaceBlue.r, deepSpaceBlue.g, deepSpaceBlue.b);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 15;
  }

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(deepSpaceBlue.r, deepSpaceBlue.g, deepSpaceBlue.b);
  doc.text('RECIBO DE FÉRIAS', pageWidth / 2, currentY, { align: 'center' });
  currentY += 20;

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Employer Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPREGADOR:', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(companyInfo?.nome_fantasia || '[Nome da Empresa]', margin + 35, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('CNPJ:', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(companyInfo ? formatCNPJ(companyInfo.cnpj) : '[00.000.000/0000-00]', margin + 15, currentY);
  currentY += 15;

  // Employee Section
  doc.setFont('helvetica', 'bold');
  doc.text('EMPREGADO(A):', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(employeeInfo.full_name, margin + 40, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('CPF:', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(employeeInfo.cpf ? formatCPF(employeeInfo.cpf) : '[000.000.000-00]', margin + 13, currentY);
  currentY += 20;

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 15;

  // Calculate acquisition period (1 year before vacation start)
  const vacationStart = new Date(vacationData.start_date);
  const acquisitionEnd = subYears(vacationStart, 1);
  const acquisitionStart = subYears(acquisitionEnd, 1);

  // Section 1: Acquisition Period
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(deepSpaceBlue.r, deepSpaceBlue.g, deepSpaceBlue.b);
  doc.text('1. PERÍODO AQUISITIVO (Referência):', margin, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(
    `De ${format(acquisitionStart, 'dd/MM/yyyy')} a ${format(acquisitionEnd, 'dd/MM/yyyy')}`,
    margin,
    currentY
  );
  currentY += 20;

  // Section 2: Vacation Period
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(deepSpaceBlue.r, deepSpaceBlue.g, deepSpaceBlue.b);
  doc.text('2. PERÍODO DE GOZO DE FÉRIAS:', margin, currentY);
  currentY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const vacationEnd = new Date(vacationData.end_date);
  const returnDate = addDays(vacationEnd, 1);

  doc.text(`Início: ${format(vacationStart, 'dd/MM/yyyy')}`, margin, currentY);
  currentY += 8;
  doc.text(`Término: ${format(vacationEnd, 'dd/MM/yyyy')}`, margin, currentY);
  currentY += 8;
  doc.text(`Total de dias: ${vacationData.days_count}`, margin, currentY);
  currentY += 20;

  // Section 3: Declaration
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(deepSpaceBlue.r, deepSpaceBlue.g, deepSpaceBlue.b);
  doc.text('3. DECLARAÇÃO DE GOZO:', margin, currentY);
  currentY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const declarationText = `Declaro que usufruirei as férias referentes ao período aquisitivo acima mencionado, nas datas estabelecidas, nada tendo a reclamar quanto ao gozo dos dias de descanso, estando ciente do período de retorno ao trabalho, que será no dia ${format(returnDate, 'dd/MM/yyyy')}.`;

  // Word wrap for declaration text
  const maxWidth = pageWidth - 2 * margin;
  const lines = doc.splitTextToSize(declarationText, maxWidth);
  doc.text(lines, margin, currentY);
  currentY += lines.length * 7 + 25;

  // Location and Date
  const city = companyInfo?.address_city || '[Cidade]';
  const state = companyInfo?.address_state || 'UF';
  const today = new Date();

  doc.text(
    `${city} - ${state}, ${format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`,
    margin,
    currentY
  );
  currentY += 30;

  // Signature lines
  const signatureWidth = 70;
  const firstSignatureX = margin + 10;
  const secondSignatureX = pageWidth / 2 + 10;

  // First signature line - Employer
  doc.setDrawColor(0, 0, 0);
  doc.line(firstSignatureX, currentY, firstSignatureX + signatureWidth, currentY);
  doc.setFontSize(9);
  doc.text('Assinatura do Empregador', firstSignatureX + signatureWidth / 2, currentY + 5, { align: 'center' });

  // Second signature line - Employee (with digital signature if available)
  if (signatureData && signatureData.startsWith('data:image/')) {
    // Add the digital signature image
    try {
      doc.addImage(signatureData, 'PNG', secondSignatureX, currentY - 25, signatureWidth, 22);
    } catch (err) {
      console.error('Error adding signature image to PDF:', err);
    }
    doc.line(secondSignatureX, currentY, secondSignatureX + signatureWidth, currentY);
    doc.text('Assinatura do Empregado(a)', secondSignatureX + signatureWidth / 2, currentY + 5, { align: 'center' });
    
    if (signedAt) {
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(`Assinado digitalmente em: ${format(new Date(signedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, secondSignatureX + signatureWidth / 2, currentY + 10, { align: 'center' });
    }
  } else {
    doc.line(secondSignatureX, currentY, secondSignatureX + signatureWidth, currentY);
    doc.text('Assinatura do Empregado(a)', secondSignatureX + signatureWidth / 2, currentY + 5, { align: 'center' });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Documento gerado automaticamente pelo Sistema de Gestão de RH', pageWidth / 2, 285, { align: 'center' });

  return doc;
};

export const downloadVacationReceiptPDF = (doc: jsPDF, filename: string) => {
  doc.save(filename);
};
