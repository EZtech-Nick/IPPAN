
import React, { useState } from 'react';
import { AppData, BankAccount, CompanyLoan, UserAccount } from '../types';
import { fbService } from '../services/firebaseConfig';
import { Modal } from '../components/Modal';
import { Plus, Printer, Eye, Edit, Trash2, FileText } from '../components/Icons';
import { fmtMoney, exportToPDF, exportToExcel, fmtDate, getAllowedNames } from '../utils';
import { BankDetails } from './BankDetails';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const FinanceModule: React.FC<Props> = ({ data, currentUser }) => {
    const [subTab, setSubTab] = useState('banks');

    const hasAccess = (path: string) => {
        if (currentUser.permissions.accessAll) return true;
        const keys = path.split('.');
        let val = currentUser.permissions as any;
        for (const k of keys) val = val?.[k];
        return !!val;
    };

    const tabs = [
        {id: 'banks', label: 'Banks', permission: 'finance.banks'},
        {id: 'company_loans', label: 'Company Loans', permission: 'finance.companyLoans'},
        {id: 'investor_report', label: 'Investor Report', permission: 'finance.investorReport'}
    ].filter(t => hasAccess(t.permission));
    const [form, setForm] = useState<Partial<BankAccount>>({});
    const [modal, setModal] = useState(false);
    const [loanModal, setLoanModal] = useState(false);
    const [loanForm, setLoanForm] = useState<Partial<CompanyLoan>>({});
    const [viewLoan, setViewLoan] = useState<CompanyLoan | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);
    
    // Bank Details State
    const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);

    // Investor Report Logic
    const investorReport = data.trucks
        .filter(t => t.investor)
        .filter(t => {
            const allowed = getAllowedNames(currentUser, 'finance.investorReport');
            return !allowed || allowed.includes(t.investor!);
        })
        .map(t => {
            const income = data.trips.filter(tr => tr.plateNumber === t.plateNumber).reduce((a,x) => a + (Number(x.grossAmount)||0), 0);
            
            // Sum expenses from TripExpense collection based on Trip IDs
            const expenses = data.trips.filter(tr => tr.plateNumber === t.plateNumber).reduce((a,x) => {
                const exp = data.trip_expenses.find(e => e.tripId === x.id);
                if (!exp) return a;
                const diesel = (Number(exp.dieselCash)||0) + (Number(exp.poUnioil)||0);
                const toll = (Number(exp.tollgateCash)||0) + (Number(exp.autosweep)||0) + (Number(exp.easytrip)||0);
                const other = (Number(exp.otherExpenses)||0);
                return a + diesel + toll + other;
            }, 0);

            const maint = data.maintenance.filter(m => m.plateNumber === t.plateNumber && m.isInvestorCharged).reduce((a,m) => a + (Number(m.laborCost)||0) + (Number(m.partsCost)||0), 0);
            const net = income - expenses - maint;
            return { truck: t.plateNumber, investor: t.investor, income, expenses, maint, net };
        });

    const handleSaveBank = async () => { if(form.id) await fbService.update('accounts', form.id, form); else await fbService.add('accounts', form); setModal(false); };
    const handleSaveLoan = async () => { /* Same logic */ const principal = Number(loanForm.principal) || 0; const loan: Partial<CompanyLoan> = { bank: loanForm.bank, principal: principal, balance: principal, terms: Number(loanForm.terms) || 12, amortization: Number(loanForm.amortization) || 0, startDate: new Date().toISOString(), payments: [] }; await fbService.add('company_loans', loan); setLoanModal(false); };
    const handleAddPayment = async () => { /* Same logic */ if(!viewLoan || !paymentAmount) return; const amt = Number(paymentAmount); const newBalance = viewLoan.balance - amt; const newPayment = { id: Date.now().toString(), date: new Date().toISOString(), amount: amt }; const updatedPayments = [...(viewLoan.payments || []), newPayment]; await fbService.update('company_loans', viewLoan.id, { balance: newBalance, payments: updatedPayments }); setViewLoan({ ...viewLoan, balance: newBalance, payments: updatedPayments }); setPaymentAmount(''); };
    const confirmDelete = async () => { if (deleteConfirm) { await fbService.remove(deleteConfirm.collection, deleteConfirm.id); setDeleteConfirm(null); } };

    // Exports
    const exportInvestor = (excel=false) => {
        if(excel) return exportToExcel(investorReport, 'Investor_Report');
        const rows = investorReport.map(r => [r.truck, r.investor, fmtMoney(r.income), fmtMoney(r.expenses), fmtMoney(r.maint), fmtMoney(r.net)]);
        exportToPDF('Investor_Report', ['Truck', 'Investor', 'Income', 'Exp', 'Maint', 'Net'], rows);
    }
    const exportBanks = (excel=false) => {
        if(excel) return exportToExcel(data.accounts, 'Bank_Accounts');
        const rows = data.accounts.map(a => [a.bankName, a.accountNumber, fmtMoney(a.balance)]);
        exportToPDF('Bank_Accounts', ['Bank', 'Account No', 'Balance'], rows);
    }

    // Render Bank Details View
    if (selectedBank) {
        return <BankDetails data={data} account={selectedBank} onBack={()=>setSelectedBank(null)} />;
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-4 border-b pb-2">
                {tabs.map(t => (
                    <button key={t.id} onClick={()=>setSubTab(t.id)} className={`font-bold capitalize px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${subTab === t.id ? 'bg-teal-700 text-white' : 'text-gray-600 dark:text-gray-300'}`}>{t.label}</button>
                ))}
            </div>

            {subTab === 'banks' && (
                <div>
                    <div className="flex justify-between mb-4">
                        <h3 className="font-bold text-lg dark:text-gray-200">Bank Accounts</h3>
                        <div className="flex gap-2">
                            <button onClick={()=>exportBanks(true)} className="bg-green-600 text-white px-2 py-1 rounded text-xs flex gap-1 items-center"><FileText/> Excel</button>
                             <button onClick={()=>{setForm({}); setModal(true)}} className="text-sm bg-teal-100 text-teal-700 px-3 py-1 rounded">Add Bank</button>
                        </div>
                    </div>
                    {/* List */}
                     <div className="grid gap-2 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                        {(data.accounts||[]).map(a => (
                            <div 
                                key={a.id} 
                                onClick={()=>setSelectedBank(a)}
                                className="flex justify-between p-4 bg-white dark:bg-gray-800 rounded shadow items-center border dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div>
                                    <div className="font-bold text-lg dark:text-white">{a.bankName}</div>
                                    <div className="text-gray-500 dark:text-gray-400">{a.accountNumber}</div>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <div className="text-xl font-bold font-mono dark:text-gray-200">{fmtMoney(a.balance)}</div>
                                    <div className="flex gap-2">
                                        <button onClick={(e)=>{e.stopPropagation(); setForm(a); setModal(true)}} className="text-blue-600 dark:text-blue-400"><Edit/></button>
                                        <button type="button" onClick={(e)=>{e.stopPropagation(); setDeleteConfirm({id: a.id, collection: 'accounts'})}} className="text-red-600"><Trash2/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                     {/* Modal */}
                     <Modal isOpen={modal} onClose={()=>setModal(false)} title="Bank Account"><div className="space-y-3"><input placeholder="Bank Name" className="border p-2 rounded w-full" value={form.bankName||''} onChange={e=>setForm({...form, bankName: e.target.value})}/><input placeholder="Account No." className="border p-2 rounded w-full" value={form.accountNumber||''} onChange={e=>setForm({...form, accountNumber: e.target.value})}/><input placeholder="Initial Balance" className="border p-2 rounded w-full" type="number" value={form.balance||''} onChange={e=>setForm({...form, balance: Number(e.target.value)})}/><button onClick={handleSaveBank} className="bg-teal-600 text-white w-full py-2 rounded">Save</button></div></Modal>
                </div>
            )}

            {subTab === 'investor_report' && (
                <div>
                     <div className="flex justify-between mb-4">
                        <h3 className="font-bold text-lg dark:text-gray-200">Investor Profit Share Report</h3>
                        <div className="flex gap-2">
                             <button onClick={()=>exportInvestor(true)} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                             <button onClick={()=>exportInvestor(false)} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                        </div>
                    </div>
                     <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}><table className="w-full text-sm text-left"><thead className="bg-purple-700 text-white sticky top-0 z-10"><tr><th className="p-3">Truck</th><th className="p-3">Investor</th><th className="p-3 text-right">Income</th><th className="p-3 text-right">Ops Exp</th><th className="p-3 text-right">Maint. (Charged)</th><th className="p-3 text-right">Net Profit</th></tr></thead><tbody>{investorReport.map((r,i) => (<tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"><td className="p-3 font-bold">{r.truck}</td><td className="p-3">{r.investor}</td><td className="p-3 text-right">{fmtMoney(r.income)}</td><td className="p-3 text-right">{fmtMoney(r.expenses)}</td><td className="p-3 text-right">{fmtMoney(r.maint)}</td><td className="p-3 text-right font-bold text-green-700 dark:text-green-400">{fmtMoney(r.net)}</td></tr>))}</tbody></table></div>
                </div>
            )}

            {subTab === 'company_loans' && (
                <div>
                     <div className="flex justify-between mb-4"><h3 className="font-bold text-lg dark:text-gray-200">Company Loans</h3><button onClick={()=>{setLoanForm({}); setLoanModal(true)}} className="bg-blue-600 text-white px-3 py-1 rounded flex gap-2"><Plus/> New Loan</button></div>
                    {/* Table Render same as before */}
                     <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}><table className="w-full text-sm text-left"><thead className="bg-gray-800 text-white sticky top-0 z-10"><tr><th className="p-3">Bank</th><th className="p-3 text-right">Principal</th><th className="p-3 text-right">Balance</th><th className="p-3 text-right">Monthly</th><th className="p-3 text-center">Progress</th><th className="p-3">Actions</th></tr></thead><tbody>{(data.company_loans||[]).map(l => { const paidCount = l.payments?.length || 0; return (<tr key={l.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"><td className="p-3 font-bold">{l.bank}</td><td className="p-3 text-right">{fmtMoney(l.principal)}</td><td className="p-3 text-right text-red-600 dark:text-red-400 font-bold">{fmtMoney(l.balance)}</td><td className="p-3 text-right">{fmtMoney(l.amortization)}</td><td className="p-3 text-center"><span className="bg-gray-200 dark:bg-gray-600 dark:text-white rounded px-2 py-1 text-xs font-bold">{paidCount} / {l.terms}</span></td><td className="p-3 text-xs flex gap-2"><button onClick={()=>setViewLoan(l)} className="text-blue-600 dark:text-blue-400 flex gap-1 items-center"><Eye/> Details</button><button type="button" onClick={(e)=>{e.stopPropagation(); setDeleteConfirm({id: l.id, collection: 'company_loans'})}} className="text-red-600 hover:text-red-800"><Trash2/></button></td></tr>) })}</tbody></table></div>
                     {/* Modals same as before */}
                     <Modal isOpen={loanModal} onClose={()=>setLoanModal(false)} title="New Company Loan"><div className="space-y-4"><input placeholder="Bank / Lender Name" className="border p-2 rounded w-full" value={loanForm.bank||''} onChange={e=>setLoanForm({...loanForm, bank: e.target.value})} /><div className="grid grid-cols-2 gap-2"><input type="number" placeholder="Principal Amount" className="border p-2 rounded w-full" value={loanForm.principal||''} onChange={e=>setLoanForm({...loanForm, principal: Number(e.target.value)})} /><input type="number" placeholder="Terms (Months)" className="border p-2 rounded w-full" value={loanForm.terms||''} onChange={e=>setLoanForm({...loanForm, terms: Number(e.target.value)})} /></div><input type="number" placeholder="Monthly Amortization" className="border p-2 rounded w-full" value={loanForm.amortization||''} onChange={e=>setLoanForm({...loanForm, amortization: Number(e.target.value)})} /><button onClick={handleSaveLoan} className="bg-blue-600 text-white w-full p-2 rounded">Create Loan Record</button></div></Modal>
                     <Modal isOpen={!!viewLoan} onClose={()=>setViewLoan(null)} title={`Loan Details: ${viewLoan?.bank}`}><div className="space-y-6"><div className="grid grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded"><div><label className="text-xs text-gray-500 dark:text-gray-300">Principal</label><div className="font-bold">{fmtMoney(viewLoan?.principal)}</div></div><div><label className="text-xs text-gray-500 dark:text-gray-300">Current Balance</label><div className="font-bold text-red-600 dark:text-red-400">{fmtMoney(viewLoan?.balance)}</div></div><div><label className="text-xs text-gray-500 dark:text-gray-300">Progress</label><div className="font-bold">{(viewLoan?.payments||[]).length} / {viewLoan?.terms}</div></div></div><div><h4 className="font-bold border-b pb-1 mb-2 dark:border-gray-600">Record Payment</h4><div className="flex gap-2"><input type="number" placeholder="Amount" className="border p-2 rounded flex-1" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} /><button onClick={handleAddPayment} className="bg-green-600 text-white px-4 rounded">Add Payment</button></div></div><div><div className="flex justify-between items-center mb-2"><h4 className="font-bold">Payment History</h4></div><div className="max-h-60 overflow-y-auto border rounded dark:border-gray-600"><table className="w-full text-sm"><thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{(viewLoan?.payments || []).map((p, i) => (<tr key={i} className="border-b dark:border-gray-700"><td className="p-2">{fmtDate(p.date)}</td><td className="p-2 text-right">{fmtMoney(p.amount)}</td></tr>))}{(!viewLoan?.payments?.length) && <tr><td colSpan={2} className="p-4 text-center text-gray-400">No payments recorded yet.</td></tr>}</tbody></table></div></div></div></Modal>
                </div>
            )}
             <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete"><div className="space-y-4 p-4"><p className="text-lg">Are you sure you want to delete this record?</p><div className="flex justify-end gap-2 mt-6"><button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button><button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button></div></div></Modal>
        </div>
    );
};
