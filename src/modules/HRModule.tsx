
import React, { useState } from 'react';
import { AppData, Employee, PayrollRecord, UserAccount } from '../types';
import { fbService } from '../services/firebaseConfig';
import { Modal } from '../components/Modal';
import { fmtMoney, fmtDate } from '../utils';
import { calculatePayrollWithAllowances } from './payrollHelper'; // Updated Import
import { Printer } from '../components/Icons';

// Import Separated Sub-modules
import { HREmployeeProfile } from './HREmployeeProfile';
import { HRPayroll } from './HRPayroll';
import { HRGeneratedPayroll } from './HRGeneratedPayroll';
import { HRLedger } from './HRLedger';
import { HRLoans } from './HRLoans';
import { HRLoansSummary } from './HRLoansSummary';
import { HRHolidays } from './HRHolidays';

interface Props {
    data: AppData;
    subTab: string;
    setSubTab: (t: string) => void;
    currentUser: UserAccount;
}

export const HRModule: React.FC<Props> = ({ data, subTab, setSubTab, currentUser }) => {
    const [search, setSearch] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string, loanId?: string} | null>(null);
    const [breakdownModal, setBreakdownModal] = useState<Employee | null>(null);

    const hasAccess = (path: string) => {
        if (currentUser.permissions.accessAll) return true;
        const keys = path.split('.');
        let val = currentUser.permissions as any;
        for (const k of keys) val = val?.[k];
        return !!val;
    };

    const tabs = [
        {id: '201', label: '201 Profile', permission: 'hr.profile201'},
        {id: 'payroll', label: 'Live Payroll', permission: 'hr.livePayroll'},
        {id: 'holidays', label: 'Holidays', permission: 'hr.holidays'},
        {id: 'generated_payroll', label: 'Generated Payroll', permission: 'hr.generatedPayroll'},
        {id: 'ipon_pondo_13th', label: 'Ipon Pondo/13th Month', permission: 'hr.iponPondo'},
        {id: 'loans', label: 'Loans Application', permission: 'hr.loansApplication'},
        {id: 'loans_summary', label: 'Loans Summary', permission: 'hr.loansSummary'}
    ].filter(t => hasAccess(t.permission));

    // Global Date Filters for Payroll
    const [payStart, setPayStart] = useState(new Date().toISOString().slice(0, 8) + '01');
    const [payEnd, setPayEnd] = useState(new Date().toISOString().split('T')[0]);
    
    // Ledger Date Filters
    const [iponStart, setIponStart] = useState(new Date().getFullYear() + '-01-01');
    const [iponEnd, setIponEnd] = useState(new Date().toISOString().split('T')[0]);

    const handleGenerateAndSavePayroll = async () => {
        // 1. Check for existing records in this period
        const existingRecords = (data.payroll_records || []).filter(r => 
            r.periodStart === payStart && r.periodEnd === payEnd
        );

        let confirmMsg = `This will generate payroll records for ALL employees from ${fmtDate(payStart)} to ${fmtDate(payEnd)}.`;
        if (existingRecords.length > 0) {
            confirmMsg += `\n\n⚠️ WARNING: ${existingRecords.length} existing records for this period will be DELETED and REGENERATED.`;
        } else {
            confirmMsg += `\n\nProceed to save?`;
        }

        if (!confirm(confirmMsg)) return;

        setIsProcessing(true);
        try {
            // 2. Delete existing records if any (Overwrite logic)
            if (existingRecords.length > 0) {
                await Promise.all(existingRecords.map(r => fbService.remove('payroll_records', r.id)));
            }

            // 3. Generate and Save new records using the shared utility logic
            // Note: We pass ALL employees here regardless of search term to ensure complete payroll generation
            const payrollData = data.employees.map(emp => 
                calculatePayrollWithAllowances(
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
                    data.holidays // Pass holidays
                )
            );
            
            const promises = payrollData.map(p => {
                const gross = Number(p.grossIncome) || 0;
                const net = Number(p.netPay) || 0;
                const ipon = Number(p.iponPondo) || 0;
                
                const record: Partial<PayrollRecord> = {
                    employeeId: p.id,
                    employeeName: p.name,
                    periodStart: payStart,
                    periodEnd: payEnd,
                    grossIncome: gross,
                    netPay: net,
                    iponPondo: ipon,
                    thirteenthMonth: gross / 12, // 1/12th of period gross
                    dateGenerated: new Date().toISOString()
                };
                return fbService.add('payroll_records', record);
            });

            await Promise.all(promises);
            
            alert(`Successfully generated and saved ${promises.length} payroll records!`);
            setSubTab('generated_payroll');
        } catch (err) {
            console.error("Payroll Generation Error:", err);
            alert("An error occurred while saving payroll. Please check the console.");
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmDelete = async () => { 
        if (deleteConfirm) { 
            if(deleteConfirm.collection === 'loan') {
                const emp = data.employees.find(e => e.id === deleteConfirm.id);
                if(emp) {
                    const updated = (emp.loans || []).filter(l => l.id !== deleteConfirm.loanId);
                    await fbService.update('employees', emp.id, { loans: updated });
                }
            } else {
                await fbService.remove(deleteConfirm.collection, deleteConfirm.id); 
            }
            setDeleteConfirm(null); 
        } 
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4 border-b pb-2 overflow-x-auto no-print">
                {tabs.map(t => (
                    <button key={t.id} onClick={()=>{setSubTab(t.id); setSearch('');}} className={`font-bold capitalize whitespace-nowrap px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${subTab === t.id ? 'bg-teal-700 text-white' : 'text-gray-600 dark:text-gray-300'}`}>{t.label}</button>
                ))}
            </div>

            <div className="no-print mb-4">
                 <input placeholder="Search employees or records..." className="border p-2 rounded dark:bg-gray-800 dark:text-white text-sm w-full md:w-96" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>

            {subTab === '201' && <HREmployeeProfile data={data} search={search} currentUser={currentUser} onDelete={(id)=>setDeleteConfirm({id, collection:'employees'})} />}
            {subTab === 'holidays' && <HRHolidays data={data} />}
            
            {subTab === 'payroll' && (
                <HRPayroll 
                    data={data}
                    search={search} 
                    currentUser={currentUser}
                    payStart={payStart} 
                    payEnd={payEnd} 
                    isProcessing={isProcessing} 
                    onStartChange={setPayStart} 
                    onEndChange={setPayEnd} 
                    onGenerate={handleGenerateAndSavePayroll} 
                />
            )}

            {subTab === 'generated_payroll' && (
                <HRGeneratedPayroll 
                    data={data} 
                    search={search} 
                    currentUser={currentUser}
                    onViewLedger={(id)=>{const e=data.employees.find(x=>x.id===id); if(e){setSubTab('ipon_pondo_13th'); setBreakdownModal(e);}}} 
                    onDelete={(id)=>setDeleteConfirm({id, collection:'payroll_records'})} 
                />
            )}

            {subTab === 'ipon_pondo_13th' && (
                <HRLedger 
                    data={data} 
                    currentUser={currentUser}
                    iponStart={iponStart} 
                    iponEnd={iponEnd} 
                    onStartChange={setIponStart} 
                    onEndChange={setIponEnd} 
                    onViewBreakdown={setBreakdownModal} 
                />
            )}

            {subTab === 'loans' && <HRLoans data={data} search={search} currentUser={currentUser} onDelete={(empId, loanId)=>setDeleteConfirm({id: empId, collection: 'loan', loanId: loanId})} />}
            
            {subTab === 'loans_summary' && <HRLoansSummary data={data} search={search} currentUser={currentUser} />}

            {/* BREAKDOWN MODAL */}
            <Modal isOpen={!!breakdownModal} onClose={()=>setBreakdownModal(null)} title={`Ledger Breakdown: ${breakdownModal?.name}`}>
                <div className="space-y-4">
                    <div className="flex justify-end no-print">
                        <button onClick={()=>window.print()} className="bg-gray-800 text-white px-3 py-1 rounded flex gap-2 text-xs items-center font-bold hover:bg-gray-900"><Printer className="w-4 h-4"/> Print Ledger</button>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded border dark:border-gray-600">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-2">History of Payroll Records ({fmtDate(iponStart)} to {fmtDate(iponEnd)})</p>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-200 dark:bg-gray-900 sticky top-0">
                                <tr><th className="p-2">Covered Period</th><th className="p-2 text-right">Gross</th><th className="p-2 text-right">13th Month</th><th className="p-2 text-right">Ipon Pondo</th></tr>
                            </thead>
                            <tbody>
                                {data.payroll_records.filter(r => r.employeeId === breakdownModal?.id && r.periodStart >= iponStart && r.periodEnd <= iponEnd)
                                    .sort((a,b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime())
                                    .map(r => (
                                    <tr key={r.id} className="border-b dark:border-gray-700">
                                        <td className="p-2">{fmtDate(r.periodStart)} - {fmtDate(r.periodEnd)}</td>
                                        <td className="p-2 text-right">{fmtMoney(r.grossIncome)}</td>
                                        <td className="p-2 text-right text-blue-600">{fmtMoney(r.grossIncome / 12)}</td>
                                        <td className="p-2 text-right text-teal-600">{fmtMoney(r.grossIncome * 0.05)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {(() => {
                        const records = data.payroll_records.filter(r => r.employeeId === breakdownModal?.id && r.periodStart >= iponStart && r.periodEnd <= iponEnd);
                        const totalGross = records.reduce((acc, r) => acc + (r.grossIncome||0), 0);
                        const totalIpon = totalGross * 0.05;
                        const total13th = totalGross / 12;
                        return (
                            <div className="grid grid-cols-3 gap-4 bg-teal-800 text-white p-6 rounded-lg shadow-xl">
                                <div><label className="text-[10px] uppercase opacity-70">Total 13th Month</label><div className="text-xl font-bold">{fmtMoney(total13th)}</div></div>
                                <div><label className="text-[10px] uppercase opacity-70">Total Ipon Pondo</label><div className="text-xl font-bold">{fmtMoney(totalIpon)}</div></div>
                                <div className="border-l pl-4 border-teal-600"><label className="text-[10px] uppercase opacity-70 font-black">Grand Total</label><div className="text-2xl font-black">{fmtMoney(total13th + totalIpon)}</div></div>
                            </div>
                        );
                    })()}
                </div>
            </Modal>

            {/* SHARED DELETE MODAL */}
            <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete">
                <div className="space-y-4 p-4"><p className="text-lg">Are you sure you want to delete this record?</p><div className="flex justify-end gap-2 mt-6"><button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button><button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button></div></div>
            </Modal>
        </div>
    );
};
