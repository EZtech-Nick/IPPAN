
import React, { useState, useMemo } from 'react';
import { AppData, BankAccount, BankTransaction } from '../types';
import { fbService } from '../services/firebase';
import { Modal } from '../components/Modal';
import { Plus, ArrowLeft, Printer } from '../components/Icons';
import { fmtMoney, fmtDate, cleanForPDF } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    data: AppData;
    account: BankAccount;
    onBack: () => void;
}

const CATEGORIES = [
    'Truck Allowance', 'Fund Transfer', 'Bank Charges', 'Truck Expenses', 'HUB', 'Bank Interest',
    'Loan', 'Revolving / Operation Fund', 'Office Expenses', 'Fuel / Parking / Toll Fee',
    'Meals', 'Personal Expenses', 'Others'
];

export const BankDetails: React.FC<Props> = ({ data, account, onBack }) => {
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<BankTransaction>>({ 
        date: new Date().toISOString().split('T')[0], 
        type: 'Credit' 
    });

    // Sort Transactions and Calculate Balance
    const transactions = useMemo(() => {
        const sorted = (data.bank_transactions || [])
            .filter(t => t.bankId === account.id)
            .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0; // Assuming initial balance is handled via a 'Initial Deposit' transaction or just starts at 0 for ledger calculation
        // NOTE: The account.balance in DB is the CURRENT balance. 
        // For the ledger, we can either calculate forward from 0 or just display the running balance.
        // Let's assume we calculate forward.
        
        return sorted.map(t => {
            if(t.type === 'Debit') runningBalance += (Number(t.amount)||0);
            else runningBalance -= (Number(t.amount)||0);
            return { ...t, balanceSnapshot: runningBalance };
        });
    }, [data.bank_transactions, account.id]);

    const totalDebit = transactions.reduce((s, t) => s + (t.type === 'Debit' ? (Number(t.amount)||0) : 0), 0);
    const totalCredit = transactions.reduce((s, t) => s + (t.type === 'Credit' ? (Number(t.amount)||0) : 0), 0);
    const currentBalance = totalDebit - totalCredit;

    const handleSave = async () => {
        if(!form.amount || !form.category) return alert("Amount and Category required.");
        
        // Save Transaction
        const newTrans: Partial<BankTransaction> = {
            ...form,
            bankId: account.id,
            amount: Number(form.amount),
            plateNumber: form.plateNumber || '',
            controlNumber: form.controlNumber || '',
            driver: form.driver || '',
            particulars: form.particulars || ''
        };
        
        await fbService.add('bank_transactions', newTrans);

        // Update Account Balance
        const newBalance = form.type === 'Debit' 
            ? (account.balance || 0) + Number(form.amount) 
            : (account.balance || 0) - Number(form.amount);
            
        await fbService.update('accounts', account.id, { balance: newBalance });
        
        setModal(false);
        setForm({ date: new Date().toISOString().split('T')[0], type: 'Credit' });
    };

    const handlePrint = () => {
        const doc = new jsPDF('l');
        doc.setFontSize(14);
        doc.text(`Bank Ledger: ${account.bankName} - ${account.accountNumber}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

        const rows = transactions.map(t => [
            fmtDate(t.date),
            t.plateNumber || '-',
            t.controlNumber || '-',
            t.driver || '-',
            t.category,
            t.particulars,
            t.type === 'Debit' ? cleanForPDF(fmtMoney(t.amount)) : '',
            t.type === 'Credit' ? cleanForPDF(fmtMoney(t.amount)) : '',
            cleanForPDF(fmtMoney(t.balanceSnapshot))
        ]);

        // Add Total Row
        rows.push([
            '', '', '', 'TOTALS', '', '',
            cleanForPDF(fmtMoney(totalDebit)),
            cleanForPDF(fmtMoney(totalCredit)),
            cleanForPDF(fmtMoney(currentBalance))
        ]);

        autoTable(doc, {
            startY: 25,
            head: [['Date', 'Plate', 'Control#', 'Driver', 'Category', 'Particulars', 'Debit', 'Credit', 'Balance']],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [15, 118, 110] },
            styles: { fontSize: 8 }
        });

        doc.save(`Ledger_${account.bankName}.pdf`);
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                    <ArrowLeft/> Back to List
                </button>
                <h2 className="text-xl font-bold dark:text-white">{account.bankName} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({account.accountNumber})</span></h2>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded dark:bg-green-900">
                    <div className="text-xs uppercase text-green-800 dark:text-green-300 font-bold">Total Debit (Deposit)</div>
                    <div className="text-xl font-bold text-green-900 dark:text-green-100">{fmtMoney(totalDebit)}</div>
                </div>
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded dark:bg-red-900">
                    <div className="text-xs uppercase text-red-800 dark:text-red-300 font-bold">Total Credit (Withdrawal)</div>
                    <div className="text-xl font-bold text-red-900 dark:text-red-100">{fmtMoney(totalCredit)}</div>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded dark:bg-blue-900">
                    <div className="text-xs uppercase text-blue-800 dark:text-blue-300 font-bold">Current Balance</div>
                    <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{fmtMoney(currentBalance)}</div>
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <button onClick={handlePrint} className="bg-gray-600 text-white px-3 py-2 rounded flex gap-2 items-center text-xs hover:bg-gray-700 font-bold">
                    <Printer className="w-4 h-4"/> Print Ledger
                </button>
                <button onClick={()=>setModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded flex gap-2 items-center text-sm hover:bg-teal-700 font-bold shadow">
                    <Plus className="w-4 h-4"/> Add Record
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto" style={{ maxHeight: '60vh' }}>
                <table className="w-full text-sm text-left">
                    <thead className="bg-teal-800 text-white sticky top-0">
                        <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Plate #</th>
                            <th className="p-3">Control #</th>
                            <th className="p-3">Driver</th>
                            <th className="p-3">Category</th>
                            <th className="p-3">Particulars</th>
                            <th className="p-3 text-right text-green-200">Debit</th>
                            <th className="p-3 text-right text-red-200">Credit</th>
                            <th className="p-3 text-right font-bold">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(t => (
                            <tr key={t.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                <td className="p-3 whitespace-nowrap">{fmtDate(t.date)}</td>
                                <td className="p-3 font-bold">{t.plateNumber || '-'}</td>
                                <td className="p-3 font-mono">{t.controlNumber || '-'}</td>
                                <td className="p-3">{t.driver || '-'}</td>
                                <td className="p-3"><span className="bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs">{t.category}</span></td>
                                <td className="p-3 max-w-[200px] truncate" title={t.particulars}>{t.particulars}</td>
                                <td className="p-3 text-right text-green-700 dark:text-green-400 font-bold">{t.type==='Debit' ? fmtMoney(t.amount) : ''}</td>
                                <td className="p-3 text-right text-red-600 dark:text-red-400 font-bold">{t.type==='Credit' ? fmtMoney(t.amount) : ''}</td>
                                <td className="p-3 text-right font-bold">{fmtMoney(t.balanceSnapshot)}</td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr><td colSpan={9} className="p-8 text-center text-gray-500 italic">No transactions recorded.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modal} onClose={()=>setModal(false)} title="Add Bank Transaction">
                <div className="space-y-4">
                    <div className="flex gap-4 bg-gray-50 dark:bg-gray-700 p-2 rounded justify-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" checked={form.type === 'Debit'} onChange={()=>setForm({...form, type: 'Debit'})} className="w-4 h-4 text-green-600 focus:ring-green-500" />
                            <span className="font-bold text-green-700 dark:text-green-400">Debit (Deposit)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" checked={form.type === 'Credit'} onChange={()=>setForm({...form, type: 'Credit'})} className="w-4 h-4 text-red-600 focus:ring-red-500" />
                            <span className="font-bold text-red-700 dark:text-red-400">Credit (Withdrawal)</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <label className="block font-bold mb-1 dark:text-gray-300">Date</label>
                            <input type="date" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="block font-bold mb-1 dark:text-gray-300">Amount</label>
                            <input type="number" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={form.amount||''} onChange={e=>setForm({...form, amount: Number(e.target.value)})} placeholder="0.00" />
                        </div>
                        <div>
                            <label className="block font-bold mb-1 dark:text-gray-300">Plate # (Optional)</label>
                            <select className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={form.plateNumber||''} onChange={e=>setForm({...form, plateNumber: e.target.value})}>
                                <option value="">Select</option>
                                {data.trucks.map(t=><option key={t.id} value={t.plateNumber}>{t.plateNumber}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block font-bold mb-1 dark:text-gray-300">Control # (Optional)</label>
                            <input className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={form.controlNumber||''} onChange={e=>setForm({...form, controlNumber: e.target.value})} />
                        </div>
                        <div>
                            <label className="block font-bold mb-1 dark:text-gray-300">Category</label>
                            <select className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={form.category||''} onChange={e=>setForm({...form, category: e.target.value})}>
                                <option value="">Select Category</option>
                                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block font-bold mb-1 dark:text-gray-300">Driver (Optional)</label>
                            <select className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={form.driver||''} onChange={e=>setForm({...form, driver: e.target.value})}>
                                <option value="">Select</option>
                                {data.employees.filter(e=>e.role==='Driver').map(e=><option key={e.id} value={e.name}>{e.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block font-bold mb-1 dark:text-gray-300">Particulars / Description</label>
                            <textarea className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={form.particulars||''} onChange={e=>setForm({...form, particulars: e.target.value})} rows={2} />
                        </div>
                    </div>
                    <button onClick={handleSave} className="bg-teal-700 text-white w-full py-2 rounded font-bold hover:bg-teal-800 mt-2">Save Record</button>
                </div>
            </Modal>
        </div>
    );
};
