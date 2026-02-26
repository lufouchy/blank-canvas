import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PDFExportParams {
  title: string;
  stats: { label: string; value: string | number }[];
  tableHeaders: string[];
  tableData: string[][];
}

export const exportReportToPDF = ({ title, stats, tableHeaders, tableData }: PDFExportParams): void => {
  const doc = new jsPDF('landscape');

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 148, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 25);

  // Stats row
  let xPos = 14;
  stats.forEach(stat => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${stat.label}: `, xPos, 33);
    const labelWidth = doc.getTextWidth(`${stat.label}: `);
    doc.setFont('helvetica', 'normal');
    doc.text(String(stat.value), xPos + labelWidth, 33);
    xPos += labelWidth + doc.getTextWidth(String(stat.value)) + 10;
  });

  autoTable(doc, {
    startY: 40,
    head: [tableHeaders],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [2, 48, 71], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Página ${i} de ${pageCount} - Kairos RH`, 148, doc.internal.pageSize.height - 10, { align: 'center' });
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`);
};

interface ExcelExportParams {
  sheetName: string;
  headers: string[];
  rows: string[][];
  fileName: string;
}

export const exportReportToExcel = async ({ sheetName, headers, rows, fileName }: ExcelExportParams): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kairos RH';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = headers.map((h, i) => ({ header: h, key: `col${i}`, width: Math.max(h.length + 5, 15) }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF023047' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  rows.forEach(row => {
    const obj: Record<string, string> = {};
    row.forEach((val, i) => { obj[`col${i}`] = val; });
    worksheet.addRow(obj);
  });

  worksheet.eachRow((row, num) => {
    if (num > 1 && num % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    }
  });

  // Metadata sheet
  const meta = workbook.addWorksheet('Informações');
  meta.columns = [{ header: '', key: 'label', width: 25 }, { header: '', key: 'value', width: 50 }];
  meta.addRow({ label: `Relatório: ${sheetName}`, value: '' });
  meta.addRow({ label: '', value: '' });
  meta.addRow({ label: 'Gerado em:', value: format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) });
  meta.addRow({ label: 'Total de registros:', value: rows.length.toString() });
  meta.getRow(1).font = { bold: true, size: 14 };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
};
