
import React, { useState } from 'react';
import { AppData, BillingRecord, UserAccount } from '../types';
import { fbService } from '../services/firebaseConfig';
import { Modal } from '../components/Modal';
import { Trash2, Printer, FileText } from '../components/Icons';
import { fmtMoney, fmtDate, exportToExcel, exportToPDF, getAllowedNames } from '../utils';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const BillingSummary: React.FC<Props> = ({ data, currentUser }) => {
    const [search, setSearch] = useState('');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<BillingRecord | null>(null);

    const filtered = data.billings.filter(b => {
        const allowed = getAllowedNames(currentUser, 'billing.summary');
        if (allowed && !allowed.includes(b.clientName)) return false;
        
        const matchesSearch = b.billingNo.includes(search) || b.clientName.toLowerCase().includes(search.toLowerCase());
        const afterStart = dateStart ? b.date >= dateStart : true;
        const beforeEnd = dateEnd ? b.date <= dateEnd : true;
        return matchesSearch && afterStart && beforeEnd;
    }).sort((a,b) => b.billingNo.localeCompare(a.billingNo));

    const getGracePeriod = (dateBilled: string) => {
        const diff = new Date().getTime() - new Date(dateBilled).getTime();
        return Math.floor(diff / (1000 * 3600 * 24));
    };

    const handleDelete = async () => {
        if(!deleteConfirm) return;
        if (deleteConfirm.items && deleteConfirm.items.length > 0) {
            await Promise.all(deleteConfirm.items.map(item => fbService.update('trips', item.tripId, { status: 'Returned' })));
        }
        await fbService.remove('billings', deleteConfirm.id);
        setDeleteConfirm(null);
    };

    const handleExportExcel = () => {
        // Export ALL billings within date range ignoring search
        const billingsToExport = data.billings.filter(b => {
            const afterStart = dateStart ? b.date >= dateStart : true;
            const beforeEnd = dateEnd ? b.date <= dateEnd : true;
            return afterStart && beforeEnd;
        }).sort((a,b) => b.billingNo.localeCompare(a.billingNo));

        const exportData = billingsToExport.map(b => {
             const totalDed = (b.ewtAmount||0) + (b.cashBond||0) + (b.commission||0); 
             return {
                'Billing No': b.billingNo,
                'Date Billed': fmtDate(b.date),
                'Client': b.clientName,
                'Period Start': fmtDate(b.periodStart),
                'Period End': fmtDate(b.periodEnd),
                'Due Date': fmtDate(b.dueDate),
                'Date Paid': fmtDate(b.datePaid),
                'Status': b.datePaid ? 'PAID' : 'UNPAID',
                'OR Number': b.orNumber,
                'Invoice Number': b.invoiceNumber,
                'Total Amount': b.totalRate,
                'VAT Amount': b.vatTaxAmount,
                'EWT Amount': b.ewtAmount,
                'Cash Bond': b.cashBond,
                'Commission': b.commission,
                'Total Deductions': totalDed,
                'Net Amount Received': b.netAmount
             };
        });
        exportToExcel(exportData, 'Billing_Summary');
    };

    const handleExportPDF = () => {
        const rows = filtered.map(b => [b.billingNo, fmtDate(b.date), b.clientName, fmtMoney(b.totalRate), fmtMoney(b.netAmount), b.datePaid ? 'Paid' : 'Unpaid']);
        exportToPDF('Billing_Summary', ['No', 'Date', 'Client', 'Total', 'Net', 'Status'], rows);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg dark:text-gray-200">Billing Summary</h3>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="dark:text-gray-300">From:</span><input type="date" className="border p-1 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={dateStart} onChange={e=>setDateStart(e.target.value)} />
                        <span className="dark:text-gray-300">To:</span><input type="date" className="border p-1 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} />
                    </div>
                </div>
                 <div className="flex gap-2">
                     <button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                     <button onClick={handleExportPDF} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                    <input placeholder="Search..." className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={search} onChange={e=>setSearch(e.target.value)} />
                </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-blue-800 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Billing #</th>
                            <th className="p-3">Date Billed</th>
                            <th className="p-3">Due Date</th>
                            <th className="p-3">Grace Period</th>
                            <th className="p-3">Date Paid</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">OR #</th>
                            <th className="p-3">Inv #</th>
                            <th className="p-3">Client</th>
                            <th className="p-3 text-right">Amount</th>
                            <th className="p-3 text-right">Less VAT</th>
                            <th className="p-3 text-right">Less WHT</th>
                            <th className="p-3 text-right">Cash Bond</th>
                            <th className="p-3 text-right">Less Comm</th>
                            <th className="p-3 text-right">Total Ded.</th>
                            <th className="p-3 text-right font-bold">Total Net</th>
                            <th className="p-3 text-center sticky right-0 bg-blue-800">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(b => {
                            const totalDed = (b.ewtAmount||0) + (b.cashBond||0) + (b.commission||0); 
                            const baseAmount = b.totalRate + (b.vatTaxAmount||0);
                            const totalNet = baseAmount - totalDed;
                            const isPaid = !!b.datePaid;

                            return (
                                <tr key={b.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                    <td className="p-3 font-bold">{b.billingNo}</td>
                                    <td className="p-3">{fmtDate(b.date)}</td>
                                    <td className="p-3 text-blue-600 font-bold dark:text-blue-400">{fmtDate(b.dueDate)}</td>
                                    <td className="p-3 text-center">{getGracePeriod(b.date)} days</td>
                                    <td className="p-3">{fmtDate(b.datePaid)}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {isPaid ? 'PAID' : 'BILLED'}
                                        </span>
                                    </td>
                                    <td className="p-3">{b.orNumber || '-'}</td>
                                    <td className="p-3">{b.invoiceNumber || '-'}</td>
                                    <td className="p-3">{b.clientName}</td>
                                    <td className="p-3 text-right font-bold">{fmtMoney(b.totalRate)}</td>
                                    <td className="p-3 text-right text-gray-500">{fmtMoney(b.vatTaxAmount)}</td>
                                    <td className="p-3 text-right text-red-500">{fmtMoney(b.ewtAmount)}</td>
                                    <td className="p-3 text-right text-red-500">{fmtMoney(b.cashBond)}</td>
                                    <td className="p-3 text-right text-red-500">{fmtMoney(b.commission)}</td>
                                    <td className="p-3 text-right font-bold text-red-600">{fmtMoney(totalDed)}</td>
                                    <td className="p-3 text-right font-bold text-teal-700 dark:text-teal-400">{fmtMoney(totalNet)}</td>
                                    <td className="p-3 text-center sticky right-0 bg-white dark:bg-gray-800">
                                        <button onClick={()=>setDeleteConfirm(b)} className="text-red-600 hover:text-red-800" title="Delete Billing"><Trash2/></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Delete Billing Record">
                <div className="space-y-4 p-4">
                    <p className="text-lg">Are you sure you want to delete <strong>Billing #{deleteConfirm?.billingNo}</strong>?</p>
                     <div className="bg-orange-50 dark:bg-orange-900 border-l-4 border-orange-500 p-4 rounded">
                        <p className="text-sm text-orange-800 dark:text-orange-200">
                            <strong>Warning:</strong> Deleting this record will revert all associated DR Numbers/Trips to <strong>'Returned'</strong> status.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Confirm Delete</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
