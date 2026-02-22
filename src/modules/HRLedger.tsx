
import React from 'react';
import { AppData, Employee, UserAccount } from '../types';
import { fmtMoney, exportToExcel, getAllowedNames } from '../utils';
import { FileText } from '../components/Icons';

interface Props {
    data: AppData;
    currentUser: UserAccount;
    iponStart: string;
    iponEnd: string;
    onStartChange: (v: string) => void;
    onEndChange: (v: string) => void;
    onViewBreakdown: (e: Employee) => void;
}

export const HRLedger: React.FC<Props> = ({ data, currentUser, iponStart, iponEnd, onStartChange, onEndChange, onViewBreakdown }) => {
    
    const getLedgerData = () => {
        return data.employees
            .filter(e => {
                const allowed = getAllowedNames(currentUser, 'hr.iponPondo');
                return !allowed || allowed.includes(e.name);
            })
            .map(e => {
                const records = data.payroll_records.filter(r => r.employeeId === e.id && r.periodStart >= iponStart && r.periodEnd <= iponEnd);
                const totalGross = records.reduce((acc, r) => acc + (r.grossIncome||0), 0);
                const totalIpon = totalGross * 0.05;
                const total13th = totalGross / 12;
                return {
                    id: e.id,
                    name: e.name,
                    recordCount: records.length,
                    totalGross,
                    totalIpon,
                    total13th
                };
            });
    };

    const handleExportExcel = () => {
        const rawData = getLedgerData();
        const exportData = rawData.map(d => ({
            'Employee': d.name,
            'Total Gross (Period)': d.totalGross,
            'Ipon Pondo (5%)': d.totalIpon,
            '13th Month (1/12)': d.total13th
        }));
        exportToExcel(exportData, `Ledger_${iponStart}_${iponEnd}`);
    };

    const ledgerData = getLedgerData();

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded shadow border-l-4 border-orange-500 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h3 className="font-bold text-lg text-orange-800 dark:text-orange-400">Ipon Pondo & 13th Month Ledger</h3>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded border dark:border-gray-600 text-sm">
                        <span className="font-bold">Period Filter:</span>
                        <input type="date" className="border p-1 rounded dark:bg-gray-800" value={iponStart} onChange={e=>onStartChange(e.target.value)} />
                        <span className="dark:text-gray-400">to</span>
                        <input type="date" className="border p-1 rounded dark:bg-gray-800" value={iponEnd} onChange={e=>onEndChange(e.target.value)} />
                    </div>
                    <button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-2 rounded flex gap-2 items-center font-bold hover:bg-green-700 text-xs">
                        <FileText className="w-4 h-4"/> Export Excel
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Employee</th>
                            <th className="p-3 text-right">Lifetime Saved Gross</th>
                            <th className="p-3 text-right text-teal-700">Ipon Pondo (5%)</th>
                            <th className="p-3 text-right text-blue-700">13th Month (Gross/12)</th>
                            <th className="p-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ledgerData.map(d => (
                            <tr key={d.id} className="border-b dark:border-gray-700">
                                <td className="p-3 font-bold">{d.name}<div className="text-[10px] font-normal opacity-50">{d.recordCount} saved periods in range</div></td>
                                <td className="p-3 text-right text-gray-500">{fmtMoney(d.totalGross)}</td>
                                <td className="p-3 text-right font-bold text-teal-700 dark:text-teal-400">{fmtMoney(d.totalIpon)}</td>
                                <td className="p-3 text-right font-bold text-blue-700 dark:text-blue-400">{fmtMoney(d.total13th)}</td>
                                <td className="p-3 text-center">
                                    <button onClick={() => {
                                        const emp = data.employees.find(e => e.id === d.id);
                                        if (emp) onViewBreakdown(emp);
                                    }} className="bg-teal-600 text-white px-3 py-1 rounded text-xs font-bold shadow-sm hover:bg-teal-700">
                                        View Breakdown
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
