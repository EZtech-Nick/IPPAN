
import React, { useState } from 'react';
import { AppData, Employee, UserAccount } from '../types';
import { Printer, ArrowLeft, FileText } from '../components/Icons';
import { fmtMoney, fmtDate, exportToExcel, getAllowedNames } from '../utils';
import { calculatePayrollWithAllowances } from './payrollHelper';
import { Payslip } from '../components/Payslip';

interface Props {
    data: AppData;
    search: string;
    currentUser: UserAccount;
    payStart: string;
    payEnd: string;
    isProcessing: boolean;
    onStartChange: (v: string) => void;
    onEndChange: (v: string) => void;
    onGenerate: () => void;
}

export const HRPayroll: React.FC<Props> = ({ 
    data, search, currentUser, payStart, payEnd, isProcessing, onStartChange, onEndChange, onGenerate
}) => {
    const [viewPayslip, setViewPayslip] = useState<any>(null);
    const [isBulkPrinting, setIsBulkPrinting] = useState(false);

    // Determine if the selected period counts as "End of Month" for deduction purposes
    const isEndOfMonth = (startStr: string, endStr: string) => {
        const s = new Date(startStr);
        const e = new Date(endStr);
        // If months are different, it spans a month end
        if (s.getMonth() !== e.getMonth() || s.getFullYear() !== e.getFullYear()) return true;
        // If same month, check if end date is last day of that month
        const nextDay = new Date(e);
        nextDay.setDate(e.getDate() + 1);
        return nextDay.getDate() === 1;
    };

    const getPayrollData = () => {
        return data.employees
            .filter(e => {
                const allowed = getAllowedNames(currentUser, 'hr.livePayroll');
                return !allowed || allowed.includes(e.name);
            })
            .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(emp => calculatePayrollWithAllowances(
                emp, 
                data.trips, 
                data.trip_expenses, 
                data.attendance, 
                data.ot_records, 
                data.undertime_records, 
                data.admin_allowances,
                data.pet_service_records,
                payStart, 
                payEnd,
                data.holidays
            ));
    };

    const handleExportExcel = () => {
        // Calculate for ALL employees, ignore search
        const allPayroll = data.employees
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(emp => calculatePayrollWithAllowances(
                emp, 
                data.trips, 
                data.trip_expenses, 
                data.attendance, 
                data.ot_records, 
                data.undertime_records, 
                data.admin_allowances,
                data.pet_service_records,
                payStart, 
                payEnd,
                data.holidays
            ));

        const exportData = allPayroll.map(p => ({
            'Name': p.name,
            'Role': p.role,
            'Trips/Days': p.tripCount,
            'Gross Income': p.grossIncome,
            'Admin Allowance': p.totalAdminAllowance,
            'Pet Service': p.petServicePay,
            'Holiday Pay': p.holidayPay,
            'SSS': p.sss,
            'PhilHealth': p.ph,
            'PagIbig': p.hdmf,
            'MP2': p.mp2,
            'Ipon Pondo': p.iponPondo,
            'Trip CA': p.tripCA,
            'Loan Deductions': p.loanDeductions?.reduce((s:number, l:any)=>s+l.amount, 0) || 0,
            'Tax': p.tax,
            'Net Pay': p.netPay
        }));
        exportToExcel(exportData, `Live_Payroll_${payStart}_${payEnd}`);
    };

    if (viewPayslip || isBulkPrinting) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded no-print sticky top-0 z-50 shadow-sm">
                    <button onClick={()=>{setViewPayslip(null); setIsBulkPrinting(false);}} className="bg-gray-200 text-gray-800 px-4 py-2 rounded flex items-center gap-2 font-bold hover:bg-gray-300"><ArrowLeft/> Back</button>
                    <button onClick={()=>window.print()} className="bg-teal-700 text-white px-8 py-2 rounded flex items-center gap-2 font-bold shadow-lg hover:bg-teal-800"><Printer/> Print</button>
                </div>
                <div className="print-container">
                    {isBulkPrinting ? getPayrollData().map((emp) => (<div key={emp.id} className="payslip-page"><Payslip emp={emp} payStart={payStart} payEnd={payEnd} /></div>)) : <div className="bg-white p-4 max-w-[8.5in] mx-auto shadow-2xl border"><Payslip emp={viewPayslip} payStart={payStart} payEnd={payEnd} /></div>}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex gap-4 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded shadow no-print flex-wrap">
                <div className="flex gap-4 items-center">
                    <label className="font-bold dark:text-gray-200">Cut-off Period:</label>
                    <input type="date" className="border p-2 rounded dark:bg-gray-700" value={payStart} onChange={e=>onStartChange(e.target.value)} />
                    <span className="dark:text-gray-400">to</span>
                    <input type="date" className="border p-2 rounded dark:bg-gray-700" value={payEnd} onChange={e=>onEndChange(e.target.value)} />
                    {isEndOfMonth(payStart, payEnd) ? 
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">MONTH END</span> : 
                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold">MID CUTOFF</span>
                    }
                </div>
                <div className="flex gap-2">
                     <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 font-bold shadow hover:bg-green-700">
                        <FileText className="w-4 h-4"/> Export Excel
                     </button>
                     <button 
                        onClick={onGenerate} 
                        disabled={isProcessing}
                        className={`bg-teal-700 text-white px-4 py-2 rounded flex items-center gap-2 font-bold shadow-lg transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-teal-800 active:scale-95'}`}
                     >
                        {isProcessing ? 'Processing...' : 'Generate & Save Period'}
                     </button>
                     <button onClick={()=>setIsBulkPrinting(true)} className="bg-gray-800 text-white px-4 py-2 rounded flex items-center gap-2 font-bold hover:bg-black">
                        <Printer className="w-4 h-4"/> Bulk Print
                     </button>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-sm text-left">
                    <thead className="bg-teal-700 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Employee</th>
                            <th className="p-3 text-center">Trips/Days</th>
                            <th className="p-3 text-right">Gross</th>
                            <th className="p-3 text-right text-blue-200">Allowances</th>
                            <th className="p-3 text-right text-purple-200">Pet Service</th>
                            <th className="p-3 text-right">Ipon Pondo</th>
                            <th className="p-3 text-right">Net Pay</th>
                            <th className="p-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {getPayrollData().map(e => (
                            <tr key={e.id} className="border-b dark:hover:bg-gray-700 dark:border-gray-700">
                                <td className="p-3 font-bold">{e.name}<div className="text-xs font-normal opacity-60">{e.role}</div></td>
                                <td className="p-3 text-center">{e.tripCount}</td>
                                <td className="p-3 text-right font-bold">{fmtMoney(e.grossIncome)}</td>
                                <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">{fmtMoney(e.totalAdminAllowance)}</td>
                                <td className="p-3 text-right font-bold text-purple-600 dark:text-purple-400">{e.petServicePay > 0 ? fmtMoney(e.petServicePay) : '-'}</td>
                                <td className="p-3 text-right text-orange-600 font-bold">{fmtMoney(e.iponPondo)}</td>
                                <td className="p-3 text-right font-bold text-green-700">{fmtMoney(e.netPay)}</td>
                                <td className="p-3 text-center">
                                    <button onClick={()=>setViewPayslip(e)} className="bg-teal-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-teal-700">
                                        View Payslip
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
