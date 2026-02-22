
import React, { useState } from 'react';
import { AppData, Loan, LoanPayment, UserAccount } from '../types';
import { Plus, Edit, Trash2, Printer, Eye, FileText } from '../components/Icons';
import { fmtMoney, fmtDate, exportToPDF, exportToExcel, getAllowedNames } from '../utils';
import { Modal } from '../components/Modal';
import { fbService } from '../services/firebase';

interface Props {
    data: AppData;
    search: string;
    currentUser: UserAccount;
    onDelete: (empId: string, loanId: string) => void;
}

export const HRLoans: React.FC<Props> = ({ data, search, currentUser, onDelete }) => {
    const [loanModal, setLoanModal] = useState(false);
    const [loanForm, setLoanForm] = useState<any>({ date: new Date().toISOString().split('T')[0], status: 'Active', type: 'Office CA' });
    const [payModal, setPayModal] = useState(false);
    const [payForm, setPayForm] = useState<any>({ date: new Date().toISOString().split('T')[0] });
    const [historyModal, setHistoryModal] = useState<any>(null);

    // Robust flattened loan calculation
    const allLoans = data.employees
        .filter(e => {
            const allowed = getAllowedNames(currentUser, 'hr.loansApplication');
            return !allowed || allowed.includes(e.name);
        })
        .flatMap(emp => 
            (emp.loans || []).map(l => ({ 
                ...l, 
                employeeId: emp.id, 
                employeeName: emp.name 
            }))
        ).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const filteredLoans = allLoans.filter(l => 
        l.employeeName.toLowerCase().includes(search.toLowerCase()) || 
        (l.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.type || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleSaveLoan = async () => {
        const emp = data.employees.find(e => e.id === loanForm.employeeId);
        if(!emp) return alert("Select an applicant.");
        const newLoan: Loan = { 
            id: loanForm.id || Math.random().toString(36).substr(2, 9), 
            date: loanForm.date, 
            type: loanForm.type || 'Office CA',
            description: loanForm.description || '', 
            amount: Number(loanForm.amount), 
            amortization: Number(loanForm.amortization) || 0,
            paidAmount: Number(loanForm.paidAmount) || 0, 
            status: Number(loanForm.paidAmount) >= Number(loanForm.amount) ? 'Paid' : 'Active', 
            payments: loanForm.payments || [] 
        };
        let updatedLoans;
        if(loanForm.id) updatedLoans = (emp.loans || []).map(l => l.id === loanForm.id ? newLoan : l);
        else updatedLoans = [...(emp.loans || []), newLoan];
        await fbService.update('employees', emp.id, { loans: updatedLoans });
        setLoanModal(false);
    };

    const handleProcessPayment = async () => {
        const { employeeId, loanId, amount, remarks, date } = payForm;
        const emp = data.employees.find(e => e.id === employeeId);
        if(!emp) return;
        const updatedLoans = (emp.loans || []).map(l => {
            if(l.id === loanId) {
                const newPayment: LoanPayment = { id: Date.now().toString(), date, amount: Number(amount), remarks };
                const totalPaid = (l.paidAmount || 0) + Number(amount);
                return { ...l, paidAmount: totalPaid, payments: [...(l.payments || []), newPayment], status: totalPaid >= l.amount ? 'Paid' : 'Active' };
            }
            return l;
        });
        await fbService.update('employees', emp.id, { loans: updatedLoans });
        setPayModal(false);
    };

    const exportLoanHistory = () => {
        if(!historyModal) return;
        const headers = ['Payment Date', 'Amount Paid', 'Remarks'];
        const rows = (historyModal.payments || []).map((p: any) => [fmtDate(p.date), fmtMoney(p.amount), p.remarks || '-']);
        exportToPDF(`Loan_History_${historyModal.employeeName}`, headers, rows, 'p');
    };

    const exportLoans = (excel = false) => {
        const dataToExport = allLoans; // Export ALL loans, ignore search
        if(excel) return exportToExcel(dataToExport.map(l => ({ 'Applicant': l.employeeName, 'Date': fmtDate(l.date), 'Type': l.type, 'Description': l.description, 'Amount': l.amount, 'Paid': l.paidAmount, 'Balance': l.amount - l.paidAmount, 'Per Cutoff': l.amortization, 'Status': l.status })), 'Loan_Applications');
        const headers = ['Applicant', 'Date', 'Type', 'Description', 'Amount', 'Paid', 'Balance', 'Per Cutoff', 'Status'];
        const rows = dataToExport.map(l => [l.employeeName, fmtDate(l.date), l.type, l.description, fmtMoney(l.amount), fmtMoney(l.paidAmount), fmtMoney(l.amount - l.paidAmount), fmtMoney(l.amortization), l.status]);
        exportToPDF('Loan_Applications_Report', headers, rows, 'l');
    };

    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h3 className="font-bold text-lg dark:text-gray-200">Loan Applications & Management</h3>
                <div className="flex gap-2 items-center flex-wrap">
                    <button onClick={()=>exportLoans(true)} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center text-xs hover:bg-green-700 font-bold"><FileText className="w-3 h-3"/> Excel</button>
                    <button onClick={()=>exportLoans(false)} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center text-xs hover:bg-red-700 font-bold"><Printer className="w-3 h-3"/> PDF</button>
                    <button onClick={()=>{setLoanForm({date: new Date().toISOString().split('T')[0], status:'Active', paidAmount:0, type: 'Office CA'}); setLoanModal(true)}} className="bg-teal-600 text-white px-4 py-2 rounded flex gap-2 font-bold shadow-sm hover:bg-teal-700">
                        <Plus/> Apply for Loan
                    </button>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-teal-700 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Applicant Name</th>
                            <th className="p-3">Application Date</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Description</th>
                            <th className="p-3 text-right">Amount</th>
                            <th className="p-3 text-right text-yellow-200">Payment/Cutoff</th>
                            <th className="p-3 text-right text-green-200">Total Paid</th>
                            <th className="p-3 text-right text-red-200">Balance</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLoans.length === 0 ? (
                            <tr><td colSpan={10} className="p-10 text-center text-gray-400 italic">No loans found.</td></tr>
                        ) : (
                            filteredLoans.map((l) => (
                                <tr key={l.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                    <td className="p-3 font-bold">{l.employeeName}</td>
                                    <td className="p-3">{fmtDate(l.date)}</td>
                                    <td className="p-3"><span className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded text-xs">{l.type}</span></td>
                                    <td className="p-3 truncate max-w-[150px]" title={l.description}>{l.description}</td>
                                    <td className="p-3 text-right font-bold">{fmtMoney(l.amount)}</td>
                                    <td className="p-3 text-right font-mono">{fmtMoney(l.amortization)}</td>
                                    <td className="p-3 text-right text-green-700 dark:text-green-400 font-bold">{fmtMoney(l.paidAmount)}</td>
                                    <td className="p-3 text-right text-red-600 font-bold">{fmtMoney(l.amount - l.paidAmount)}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.status==='Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {l.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center flex justify-center gap-2">
                                        <button onClick={() => {setPayForm({employeeId: l.employeeId, loanId: l.id, date: new Date().toISOString().split('T')[0], amount: l.amortization || 0, remarks: ''}); setPayModal(true)}} className="text-green-600 font-bold border px-2 py-1 rounded text-[10px] hover:bg-green-50 shadow-sm" title="Record Payment">PAY</button>
                                        <button onClick={() => setHistoryModal(l)} className="text-teal-600" title="View History"><Eye className="w-4 h-4"/></button>
                                        <button onClick={() => {setLoanForm({...l, employeeId: l.employeeId}); setLoanModal(true)}} className="text-blue-600" title="Edit"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => onDelete(l.employeeId, l.id)} className="text-red-600" title="Delete"><Trash2 className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={loanModal} onClose={()=>setLoanModal(false)} title={loanForm.id ? "Edit Loan Application" : "New Loan Application"}>
                <div className="space-y-4 p-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold uppercase text-gray-500">Name of Applicant</label><select className="border p-2 rounded w-full dark:bg-gray-800" value={loanForm.employeeId||''} onChange={e=>setLoanForm({...loanForm, employeeId: e.target.value})}><option value="">Select Employee</option>{data.employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                        <div><label className="text-xs font-bold uppercase text-gray-500">Date</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={loanForm.date||''} onChange={e=>setLoanForm({...loanForm, date: e.target.value})} /></div>
                        
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500">Type of Loan</label>
                            <select className="border p-2 rounded w-full dark:bg-gray-800" value={loanForm.type||'Office CA'} onChange={e=>setLoanForm({...loanForm, type: e.target.value})}>
                                <option value="Uniform">Uniform</option>
                                <option value="Office CA">Office CA</option>
                                <option value="SSS Loan">SSS Loan</option>
                                <option value="Pag-Ibig Loan">Pag-Ibig Loan</option>
                                <option value="Other Deduction">Other Deduction</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500">Payment per Cutoff</label>
                            <input type="number" className="border p-2 rounded w-full dark:bg-gray-800 font-bold text-orange-600" value={loanForm.amortization||''} onChange={e=>setLoanForm({...loanForm, amortization: e.target.value})} placeholder="0.00" />
                        </div>

                        <div className="col-span-2"><label className="text-xs font-bold uppercase text-gray-500">Description</label><textarea className="border p-2 rounded w-full dark:bg-gray-800 h-20" placeholder="Purpose..." value={loanForm.description||''} onChange={e=>setLoanForm({...loanForm, description: e.target.value})} /></div>
                        <div><label className="text-xs font-bold uppercase text-gray-500">Total Amount</label><input type="number" className="border p-2 rounded w-full font-bold dark:bg-gray-800" value={loanForm.amount||''} onChange={e=>setLoanForm({...loanForm, amount: e.target.value})} /></div>
                        <div><label className="text-xs font-bold uppercase text-gray-500">Paid So Far</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800" value={loanForm.paidAmount||''} onChange={e=>setLoanForm({...loanForm, paidAmount: e.target.value})} /></div>
                    </div>
                    <div className="pt-4 flex justify-between items-center border-t"><div className="text-lg font-bold text-teal-700">Balance: {fmtMoney(Number(loanForm.amount||0) - Number(loanForm.paidAmount||0))}</div><button onClick={handleSaveLoan} className="bg-teal-600 text-white px-10 py-2 rounded font-bold shadow-lg">Save Application</button></div>
                </div>
            </Modal>

            <Modal isOpen={payModal} onClose={()=>setPayModal(false)} title="Record Loan Payment">
                <div className="space-y-4 p-2"><div className="grid grid-cols-1 gap-4"><div><label className="text-xs font-bold uppercase text-gray-500">Payment Date</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={payForm.date||''} onChange={e=>setPayForm({...payForm, date: e.target.value})} /></div><div><label className="text-xs font-bold uppercase text-gray-500">Payment Amount</label><input type="number" className="border p-2 rounded w-full font-bold text-lg dark:bg-gray-800" value={payForm.amount||''} onChange={e=>setPayForm({...payForm, amount: e.target.value})} /></div><div><label className="text-xs font-bold uppercase text-gray-500">Remarks</label><input className="border p-2 rounded w-full dark:bg-gray-800" placeholder="e.g. Salary Deduction" value={payForm.remarks||''} onChange={e=>setPayForm({...payForm, remarks: e.target.value})} /></div></div><button onClick={handleProcessPayment} className="bg-green-600 text-white w-full py-3 rounded font-bold shadow-lg mt-4">Confirm Payment</button></div>
            </Modal>

            <Modal isOpen={!!historyModal} onClose={()=>setHistoryModal(null)} title={`Loan Payment History - ${historyModal?.employeeName}`}>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-700 p-4 rounded border dark:border-gray-600 flex-1">
                            <div><span className="text-[10px] uppercase block text-gray-400">Total Loan</span><div className="font-bold">{fmtMoney(historyModal?.amount)}</div></div>
                            <div><span className="text-[10px] uppercase block text-gray-400">Paid</span><div className="font-bold text-green-600">{fmtMoney(historyModal?.paidAmount)}</div></div>
                            <div><span className="text-[10px] uppercase block text-gray-400">Balance</span><div className="font-bold text-red-600">{fmtMoney(historyModal?.amount - historyModal?.paidAmount)}</div></div>
                        </div>
                        <button onClick={exportLoanHistory} className="ml-4 bg-red-600 text-white p-4 rounded-lg shadow hover:bg-red-700 flex flex-col items-center justify-center gap-1">
                            <Printer className="w-5 h-5"/>
                            <span className="text-[10px] font-bold uppercase tracking-tighter">PDF History</span>
                        </button>
                    </div>
                    <div className="max-h-[40vh] overflow-y-auto"><table className="w-full text-sm text-left border-collapse"><thead className="bg-gray-200 dark:bg-gray-900 sticky top-0"><tr><th className="p-2">Date</th><th className="p-2 text-right">Amount</th><th className="p-2">Remarks</th></tr></thead><tbody>{(historyModal?.payments || []).map((p: any) => (<tr key={p.id} className="border-b dark:border-gray-700"><td className="p-2">{fmtDate(p.date)}</td><td className="p-2 text-right font-bold text-green-700">{fmtMoney(p.amount)}</td><td className="p-2 text-xs italic text-gray-500">{p.remarks}</td></tr>)) }{(!historyModal?.payments?.length) && <tr><td colSpan={3} className="p-4 text-center text-gray-400 italic">No payments recorded.</td></tr>}</tbody></table></div>
                </div>
            </Modal>
        </div>
    );
};
