
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { UserAccount } from './types';

declare global {
  interface Window {
    jspdf: any;
  }
}

export const getAllowedNames = (currentUser: UserAccount, path: string): string[] | null => {
    if (currentUser.permissions.accessAll) return null;
    const keys = path.split('.');
    let val = currentUser.permissions as any;
    for (const k of keys) val = val?.[k];
    
    if (val === 'All') return null;
    if (val === 'UserOnly') return [currentUser.name];
    if (typeof val === 'object' && val?.scope === 'UserOnly') {
        return val.names && val.names.length > 0 ? val.names : [currentUser.name];
    }
    return [currentUser.name];
};

export const fmtMoney = (n: number | string | undefined) => 
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n) || 0);

// Helper to sanitize strings for PDF generation (replaces ₱ with Php to avoid encoding issues)
export const cleanForPDF = (val: any): any => {
    if (typeof val === 'string') {
        return val.replace(/₱/g, 'Php ');
    }
    return val;
};

export const fmtDate = (d: string | undefined) => 
    d ? new Date(d).toLocaleDateString('en-PH') : '-';

export const isExpiring = (d: string | undefined) => {
    if (!d) return false;
    const diff = Math.ceil((new Date(d).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 30;
};

export const exportToPDF = (title: string, columns: string[], rows: (string|number)[][], orientation: 'p' | 'l' = 'p', format: string = 'a4') => {
    const doc = new jsPDF({ orientation, format, unit: 'mm' });
    
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(8);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, 14, 20);
    
    const sanitizedHead = columns.map(c => cleanForPDF(c));
    const sanitizedBody = rows.map(r => r.map(c => cleanForPDF(c)));

    autoTable(doc, { 
        startY: 25, 
        head: [sanitizedHead], 
        body: sanitizedBody, 
        theme: 'grid', 
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        showHead: 'everyPage', 
        margin: { top: 25, bottom: 20 },
        didDrawPage: (data) => {
            doc.setFontSize(7);
            doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        }
    });
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
};

export const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${fileName.replace(/\s+/g, '_')}.xlsx`);
};

export const calculatePHTax = (taxableIncome: number) => {
    if (taxableIncome <= 20833) return 0;
    if (taxableIncome <= 33333) return (taxableIncome - 20833) * 0.20;
    if (taxableIncome <= 66666) return 2500 + (taxableIncome - 33333) * 0.25;
    if (taxableIncome <= 166666) return 10833 + (taxableIncome - 66666) * 0.30;
    if (taxableIncome <= 666666) return 40833.33 + (taxableIncome - 166666) * 0.32;
    return 200833.33 + (taxableIncome - 666666) * 0.35;
};
