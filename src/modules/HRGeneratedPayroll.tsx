
import React from 'react';
import { AppData, UserAccount } from '../types';
import { Trash2, Printer, FileText } from '../components/Icons';
import { fmtDate, fmtMoney, exportToExcel, getAllowedNames } from '../utils';

interface Props {
    data: AppData;
    search: string;
    currentUser: UserAccount;
    onViewLedger: (id: string) => void;
    onDelete: (id: string) => void;
}

export const HRGeneratedPayroll: React.FC<Props> = ({ data, search, currentUser, onViewLedger, onDelete }) => {
    const filtered = data.payroll_records
        .filter(r => {
            const allowed = getAllowedNames(currentUser, 'hr.generatedPayroll');
            return !allowed || allowed.includes(r.employeeName);
        })
        .filter(r => r.employeeName.toLowerCase().includes(search.toLowerCase()) || r.periodStart.includes(search) || r.periodEnd.includes(search))
        .sort((a,b) => new Date(b.dateGenerated).getTime() - new Date(a.dateGenerated).getTime());

    const handleExportExcel = () => {
        // Export all records
        const allRecords = [...data.payroll_records].sort((a,b) => new Date(b.dateGenerated).getTime() - new Date(a.dateGenerated).getTime());
        const exportData = allRecords.map(r => ({
            'Generated Date': new Date(r.dateGenerated).toLocaleDateString(),
            'Employee': r.employeeName,
            'Period Start': r.periodStart,
            'Period End': r.periodEnd,
            'Gross Income': r.grossIncome,
            'Net Pay': r.netPay,
            'Ipon Pondo': r.iponPondo,
            '13th Month': r.thirteenthMonth
        }));
        exportToExcel(exportData, 'Generated_Payroll_History');
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-end gap-2 no-print">
                <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded flex gap-2 items-center font-bold hover:bg-green-700">
                    <FileText className="w-4 h-4"/> Export Excel
                </button>
                <button onClick={()=>window.print()} className="bg-gray-800 text-white px-4 py-2 rounded flex gap-2 items-center font-bold hover:bg-gray-900"><Printer className="w-4 h-4"/> Print List</button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-teal-700 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Generated Date</th>
                            <th className="p-3">Employee Name</th>
                            <th className="p-3">Period</th>
                            <th className="p-3 text-right">Gross Income</th>
                            <th className="p-3 text-right">Net Pay</th>
                            <th className="p-3 text-center no-print">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(r => (
                        <tr key={r.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                            <td className="p-3">{new Date(r.dateGenerated).toLocaleString()}</td>
                            <td className="p-3 font-bold">{r.employeeName}</td>
                            <td className="p-3 text-xs">{fmtDate(r.periodStart)} - {fmtDate(r.periodEnd)}</td>
                            <td className="p-3 text-right font-mono">{fmtMoney(r.grossIncome)}</td>
                            <td className="p-3 text-right font-mono font-bold text-teal-600">{fmtMoney(r.netPay)}</td>
                            <td className="p-3 text-center flex gap-2 justify-center no-print">
                                <button onClick={() => onViewLedger(r.employeeId)} className="text-teal-600 hover:text-teal-800 font-bold text-[10px] border border-teal-200 px-2 py-1 rounded bg-teal-50">VIEW LEDGER</button>
                                <button onClick={() => onDelete(r.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                            </td>
                        </tr>
                    ))}
                    {filtered.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">No generated records found.</td></tr>)}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
