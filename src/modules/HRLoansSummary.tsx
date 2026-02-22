
import React, { useState } from 'react';
import { AppData, Employee, LoanPayment, Loan, UserAccount } from '../types';
import { fmtMoney, fmtDate, cleanForPDF, exportToExcel, getAllowedNames } from '../utils';
import { Modal } from '../components/Modal';
import { Eye, Printer, FileText } from '../components/Icons';
import { fbService } from '../services/firebaseConfig';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    data: AppData;
    search: string;
    currentUser: UserAccount;
}

export const HRLoansSummary: React.FC<Props> = ({ data, search, currentUser }) => {
    const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
    const [paymentModal, setPaymentModal] = useState<{loanId: string, empId: string} | null>(null);
    const [payForm, setPayForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', remarks: '' });

    // Filter employees with active loans
    const employeesWithLoans = data.employees.filter(e => {
        const allowed = getAllowedNames(currentUser, 'hr.loansSummary');
        if (allowed && !allowed.includes(e.name)) return false;

        const hasActiveLoans = (e.loans || []).some(l => l.status === 'Active');
        const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
        return hasActiveLoans && matchesSearch;
    });

    const getLoanStats = (emp: Employee) => {
        const activeLoans = (emp.loans || []).filter(l => l.status === 'Active');
        const totalPrincipal = activeLoans.reduce((sum, l) => sum + (Number(l.amount)||0), 0);
        const totalPaid = activeLoans.reduce((sum, l) => sum + (Number(l.paidAmount)||0), 0);
        const balance = totalPrincipal - totalPaid;
        return { totalPrincipal, totalPaid, balance, count: activeLoans.length };
    };

    const handleRecordPayment = async () => {
        if (!paymentModal || !viewEmployee) return;
        const emp = data.employees.find(e => e.id === paymentModal.empId);
        if (!emp) return;

        const updatedLoans: Loan[] = (emp.loans || []).map(l => {
            if (l.id === paymentModal.loanId) {
                const amount = Number(payForm.amount) || 0;
                const newPayment: LoanPayment = { 
                    id: Date.now().toString(), 
                    date: payForm.date, 
                    amount, 
                    remarks: payForm.remarks 
                };
                const totalPaid = (l.paidAmount || 0) + amount;
                return { 
                    ...l, 
                    paidAmount: totalPaid, 
                    payments: [...(l.payments || []), newPayment],
                    status: (totalPaid >= l.amount ? 'Paid' : 'Active') as 'Paid' | 'Active'
                };
            }
            return l;
        });

        await fbService.update('employees', emp.id, { loans: updatedLoans });
        
        // Refresh viewEmployee to reflect changes immediately in modal
        setViewEmployee({ ...emp, loans: updatedLoans });
        setPaymentModal(null);
        setPayForm({ date: new Date().toISOString().split('T')[0], amount: '', remarks: '' });
    };

    const handleExportExcel = () => {
        // Export all employees with active loans regardless of search
        const allWithLoans = data.employees.filter(e => (e.loans || []).some(l => l.status === 'Active'));
        const exportData = allWithLoans.map(e => {
            const stats = getLoanStats(e);
            return {
                'Employee Name': e.name,
                'Active Loans Count': stats.count,
                'Total Principal': stats.totalPrincipal,
                'Total Paid': stats.totalPaid,
                'Outstanding Balance': stats.balance
            };
        });
        exportToExcel(exportData, 'Active_Loans_Summary');
    };

    const handlePrintBreakdown = () => {
        if (!viewEmployee) return;
        const doc = new jsPDF();
        const activeLoans = viewEmployee.loans?.filter(l => l.status === 'Active') || [];
        
        // Calculate Totals
        const totalPrincipal = activeLoans.reduce((sum, l) => sum + (Number(l.amount)||0), 0);
        const totalPaid = activeLoans.reduce((sum, l) => sum + (Number(l.paidAmount)||0), 0);
        const totalBalance = totalPrincipal - totalPaid;

        // Header
        doc.setFillColor(13, 148, 136); // Teal 600
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text('IPPAN Transport - Loan Statement', 14, 13);
        
        // Employee Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`Employee: ${viewEmployee.name}`, 14, 30);
        doc.text(`Date Generated: ${fmtDate(new Date().toISOString())}`, 14, 36);

        // Summary Block in PDF
        doc.setFillColor(240, 240, 240);
        doc.rect(14, 42, 182, 15, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`Total Loan Amount: ${cleanForPDF(fmtMoney(totalPrincipal))}`, 20, 51);
        doc.text(`Total Payments: ${cleanForPDF(fmtMoney(totalPaid))}`, 80, 51);
        doc.setTextColor(200, 0, 0);
        doc.text(`Total Balance: ${cleanForPDF(fmtMoney(totalBalance))}`, 140, 51);
        doc.setTextColor(0, 0, 0);

        let yPos = 65;

        if (activeLoans.length === 0) {
            doc.text("No active loans.", 14, yPos);
        }

        activeLoans.forEach((l) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            const balance = (Number(l.amount)||0) - (Number(l.paidAmount)||0);

            // Loan Header Box
            doc.setFillColor(245, 245, 245);
            doc.setDrawColor(200, 200, 200);
            doc.rect(14, yPos, 182, 20, 'FD');
            
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 118, 110); // Teal text
            doc.text(`${l.type}`, 16, yPos + 7);
            
            doc.setTextColor(0,0,0);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`${l.description}`, 16, yPos + 14);

            // Right side stats in header
            doc.setFontSize(9);
            doc.text(`Date: ${fmtDate(l.date)}`, 120, yPos + 6);
            doc.text(`Principal: ${cleanForPDF(fmtMoney(l.amount))}`, 120, yPos + 11);
            doc.setFont("helvetica", "bold");
            doc.text(`Balance: ${cleanForPDF(fmtMoney(balance))}`, 120, yPos + 16);

            yPos += 25;

            // Payment History Table
            const body = (l.payments || []).map(p => [
                fmtDate(p.date),
                p.remarks || '-',
                cleanForPDF(fmtMoney(p.amount))
            ]);

            if (body.length > 0) {
                autoTable(doc, {
                    startY: yPos,
                    head: [['Payment Date', 'Remarks', 'Amount Paid']],
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
                    bodyStyles: { fontSize: 8 },
                    columnStyles: {
                        2: { halign: 'right', fontStyle: 'bold' }
                    },
                    margin: { left: 14, right: 14 }
                });
                yPos = (doc as any).lastAutoTable.finalY + 15;
            } else {
                doc.setFont("helvetica", "italic");
                doc.setTextColor(100, 100, 100);
                doc.text("No payments recorded yet.", 16, yPos);
                yPos += 15;
            }
        });

        doc.save(`Loan_Statement_${viewEmployee.name.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h3 className="font-bold text-lg text-orange-800 dark:text-orange-400">Employee Active Loans Summary</h3>
                <button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-2 rounded flex gap-2 items-center font-bold hover:bg-green-700 text-xs">
                    <FileText className="w-4 h-4"/> Export Excel
                </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-sm text-left">
                    <thead className="bg-orange-700 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Employee Name</th>
                            <th className="p-3 text-center">Active Loans</th>
                            <th className="p-3 text-right">Total Principal</th>
                            <th className="p-3 text-right">Total Paid</th>
                            <th className="p-3 text-right">Total Balance</th>
                            <th className="p-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employeesWithLoans.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic">No employees with active loans found.</td></tr>
                        ) : (
                            employeesWithLoans.map(e => {
                                const stats = getLoanStats(e);
                                return (
                                    <tr key={e.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700">
                                        <td className="p-3 font-bold dark:text-gray-200">{e.name}</td>
                                        <td className="p-3 text-center dark:text-gray-300">{stats.count}</td>
                                        <td className="p-3 text-right dark:text-gray-300">{fmtMoney(stats.totalPrincipal)}</td>
                                        <td className="p-3 text-right text-green-600 dark:text-green-400">{fmtMoney(stats.totalPaid)}</td>
                                        <td className="p-3 text-right font-bold text-red-600 dark:text-red-400">{fmtMoney(stats.balance)}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => setViewEmployee(e)} className="bg-orange-100 text-orange-700 px-3 py-1 rounded text-xs font-bold hover:bg-orange-200 flex items-center justify-center gap-1 mx-auto">
                                                <Eye className="w-3 h-3"/> View Breakdown
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Breakdown Modal */}
            <Modal isOpen={!!viewEmployee} onClose={() => setViewEmployee(null)} title={`Loan Breakdown: ${viewEmployee?.name}`} large>
                <div className="space-y-6">
                    {/* Summary Header */}
                    {(() => {
                        const activeLoans = viewEmployee?.loans?.filter(l => l.status === 'Active') || [];
                        const totalPrincipal = activeLoans.reduce((sum, l) => sum + (Number(l.amount)||0), 0);
                        const totalPaid = activeLoans.reduce((sum, l) => sum + (Number(l.paidAmount)||0), 0);
                        const totalBalance = totalPrincipal - totalPaid;
                        return (
                            <div className="grid grid-cols-3 gap-4 bg-gray-100 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div><div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Total Loans Amount</div><div className="text-xl font-bold dark:text-gray-100">{fmtMoney(totalPrincipal)}</div></div>
                                <div><div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Total Payments</div><div className="text-xl font-bold text-green-600 dark:text-green-400">{fmtMoney(totalPaid)}</div></div>
                                <div><div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Total Balance</div><div className="text-xl font-bold text-red-600 dark:text-red-400">{fmtMoney(totalBalance)}</div></div>
                            </div>
                        );
                    })()}

                    <div className="flex justify-end no-print">
                         <button onClick={handlePrintBreakdown} className="bg-gray-800 text-white px-3 py-1 rounded flex gap-2 text-xs items-center font-bold hover:bg-gray-900"><Printer className="w-4 h-4"/> Print Statement</button>
                    </div>
                    {viewEmployee?.loans?.filter(l => l.status === 'Active').map(l => (
                        <div key={l.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 shadow-sm">
                            <div className="flex justify-between items-start mb-4 border-b pb-2 dark:border-gray-600">
                                <div>
                                    <div className="font-bold text-lg text-teal-800 dark:text-teal-400">{l.type}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">{l.description}</div>
                                    <div className="text-xs text-gray-400 mt-1">Date: {fmtDate(l.date)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Balance</div>
                                    <div className="font-bold text-xl text-red-600 dark:text-red-400">{fmtMoney((Number(l.amount)||0) - (Number(l.paidAmount)||0))}</div>
                                    <div className="text-xs text-gray-400">of {fmtMoney(l.amount)} Principal</div>
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold uppercase mb-2 text-gray-600 dark:text-gray-300">Payment History</h4>
                                    <div className="max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border rounded dark:border-gray-600">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0">
                                                <tr>
                                                    <th className="p-2">Date</th>
                                                    <th className="p-2">Remarks</th>
                                                    <th className="p-2 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(l.payments || []).length === 0 ? (
                                                    <tr><td colSpan={3} className="p-2 text-center text-gray-400 italic">No payments yet.</td></tr>
                                                ) : (
                                                    l.payments?.map(p => (
                                                        <tr key={p.id} className="border-b dark:border-gray-700">
                                                            <td className="p-2">{fmtDate(p.date)}</td>
                                                            <td className="p-2">{p.remarks}</td>
                                                            <td className="p-2 text-right font-bold text-green-600">{fmtMoney(p.amount)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="w-48 flex flex-col justify-center items-center border-l pl-4 dark:border-gray-600">
                                    <div className="text-center mb-4">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Scheduled Deduction</div>
                                        <div className="font-bold text-lg dark:text-white">{fmtMoney(l.amortization)}</div>
                                        <div className="text-[10px] text-gray-400">per cutoff</div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setPayForm({ date: new Date().toISOString().split('T')[0], amount: String(l.amortization || 0), remarks: 'Payroll Deduction' });
                                            setPaymentModal({ loanId: l.id, empId: viewEmployee.id });
                                        }} 
                                        className="bg-green-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-green-700 w-full text-xs"
                                    >
                                        Record Payment
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Payment Input Modal */}
            <Modal isOpen={!!paymentModal} onClose={() => setPaymentModal(null)} title="Record Loan Payment">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold block mb-1">Date</label>
                        <input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-xs font-bold block mb-1">Amount</label>
                        <input type="number" className="border p-2 rounded w-full dark:bg-gray-800 font-bold" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-xs font-bold block mb-1">Remarks</label>
                        <input className="border p-2 rounded w-full dark:bg-gray-800" placeholder="e.g. Payroll Deduction" value={payForm.remarks} onChange={e => setPayForm({ ...payForm, remarks: e.target.value })} />
                    </div>
                    <button onClick={handleRecordPayment} className="bg-green-600 text-white w-full py-2 rounded font-bold mt-4">Confirm Payment</button>
                </div>
            </Modal>
        </div>
    );
};
