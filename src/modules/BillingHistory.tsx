
import React, { useState } from 'react';
import { AppData, BillingRecord, UserAccount } from '../types';
import { fmtDate, fmtMoney, exportToExcel, exportToPDF, getAllowedNames } from '../utils';
import { Eye, Briefcase, Printer, FileText, Edit, Trash2 } from '../components/Icons'; 
import { Modal } from '../components/Modal';
import { fbService } from '../services/firebaseConfig';

interface Props {
    data: AppData;
    currentUser: UserAccount;
    onProcessPaymentSuccess?: () => void;
    onEditRequest?: (record: BillingRecord) => void;
}

export const BillingHistory: React.FC<Props> = ({ data, currentUser, onProcessPaymentSuccess, onEditRequest }) => {
    const [historySearch, setHistorySearch] = useState('');
    const [viewBilling, setViewBilling] = useState<BillingRecord | null>(null);
    
    // Payment Modal
    const [paymentModal, setPaymentModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState<Partial<BillingRecord>>({});

    // Delete
    const [deleteConfirm, setDeleteConfirm] = useState<BillingRecord | null>(null);

    const filtered = (data.billings || [])
        .filter(b => {
            const allowed = getAllowedNames(currentUser, 'billing.history');
            return !allowed || allowed.includes(b.clientName);
        })
        .filter(b => b.clientName.toLowerCase().includes(historySearch.toLowerCase()) || b.billingNo.includes(historySearch))
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleExportExcel = () => {
        // Export all billings sorted by date desc
        const allBillings = [...(data.billings || [])].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        exportToExcel(allBillings.map(b => ({
            BillingNo: b.billingNo, Date: b.date, DueDate: b.dueDate, Client: b.clientName,
            Total: b.netAmount, Paid: b.datePaid ? 'Yes' : 'No'
        })), 'Billing_History');
    };

    const handleExportPDF = () => {
        const rows = filtered.map(b => [b.billingNo, fmtDate(b.date), b.clientName, fmtMoney(b.netAmount), b.datePaid?'PAID':'UNPAID']);
        exportToPDF('Billing_History', ['No', 'Date', 'Client', 'Amount', 'Status'], rows);
    };

    const getGracePeriod = (dueDate: string | undefined) => {
        if (!dueDate) return '-';
        const diff = new Date(dueDate).getTime() - new Date().getTime();
        const days = Math.ceil(diff / (1000 * 3600 * 24));
        return days >= 0 ? `${days} days remaining` : `${Math.abs(days)} days overdue`;
    };

    // --- Actions ---

    const handleProcessPayment = (b: BillingRecord) => {
        setPaymentForm({ ...b, datePaid: b.datePaid || new Date().toISOString().split('T')[0], cashBond: b.cashBond || 0, commission: b.commission || 0, orNumber: b.orNumber || '', invoiceNumber: b.invoiceNumber || '' });
        setPaymentModal(true);
    };

    const handleSavePayment = async () => {
        if (!paymentForm.id) return;
        await fbService.update('billings', paymentForm.id, { datePaid: paymentForm.datePaid || null, orNumber: paymentForm.orNumber || '', invoiceNumber: paymentForm.invoiceNumber || '', cashBond: Number(paymentForm.cashBond) || 0, commission: Number(paymentForm.commission) || 0 });
        if (paymentForm.datePaid && paymentForm.items && paymentForm.items.length > 0) {
            await Promise.all(paymentForm.items.map(item => fbService.update('trips', item.tripId, { status: 'Paid' })));
        }
        setPaymentModal(false);
        if (onProcessPaymentSuccess) onProcessPaymentSuccess();
    };

    const handleDelete = async () => {
        if(!deleteConfirm) return;
        // Optionally revert trips to Returned if needed, similar to BillingSummary logic
        if (deleteConfirm.items && deleteConfirm.items.length > 0) {
            await Promise.all(deleteConfirm.items.map(item => fbService.update('trips', item.tripId, { status: 'Returned' })));
        }
        await fbService.remove('billings', deleteConfirm.id);
        setDeleteConfirm(null);
    };

    // Computations for Payment Modal
    const totalNet = (paymentForm.netAmount || 0) - (Number(paymentForm.cashBond) || 0) - (Number(paymentForm.commission) || 0); 

    // Computations for View Mode
    let relatedExpenses: any[] = [];
    let subtotalTrips = 0;
    let subtotalCharges = 0;

    if (viewBilling) {
        subtotalTrips = viewBilling.items.reduce((a, t) => a + (Number(t.rate) || 0), 0);
        
        const tripIds = new Set(viewBilling.items.map(i => i.tripId));
        relatedExpenses = data.trip_expenses.filter(e => {
            if (!tripIds.has(e.tripId)) return false;
            const charges = (Number(e.manoChargesClient) || 0) + (Number(e.otherExpChargesClient) || 0) + (Number(e.total_charges_client) || 0);
            return charges > 0;
        });

        subtotalCharges = relatedExpenses.reduce((a, e) => {
            const mano = Number(e.manoChargesClient) || 0;
            const other = Number(e.otherExpChargesClient) || 0;
            const savedTotal = Number(e.total_charges_client) || 0;
            return a + (savedTotal > 0 ? savedTotal : (mano + other));
        }, 0);
    }

    // Header component reused in view mode
    const SoaHeader = () => (
        <div className="flex items-center justify-center mb-2">
            <img src="https://image2url.com/images/1766232107704-62599d3b-3b93-4f19-ad67-32f9db0ab9e4.png" className="w-full max-w-[8.5in] object-contain" alt="IPPAN Transport" />
        </div>
    );

    return (
        <div>
            {!viewBilling ? (
                <div>
                    <div className="flex justify-between mb-4">
                         <div className="flex gap-2">
                             <button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                             <button onClick={handleExportPDF} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                         </div>
                        <input placeholder="Search history..." className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={historySearch} onChange={e=>setHistorySearch(e.target.value)} />
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-teal-700 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="p-3">Billing No</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Due Date</th>
                                    <th className="p-3">Grace Period</th>
                                    <th className="p-3">Client</th>
                                    <th className="p-3">Period</th>
                                    <th className="p-3 text-right">Total Amount</th>
                                    <th className="p-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(b => (
                                        <tr key={b.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                            <td className="p-3 font-bold dark:text-gray-200">{b.billingNo}</td>
                                            <td className="p-3 dark:text-gray-300">{fmtDate(b.date)}</td>
                                            <td className="p-3 dark:text-gray-300 text-blue-600 font-bold">{fmtDate(b.dueDate)}</td>
                                            <td className="p-3 dark:text-gray-300 text-xs">{getGracePeriod(b.dueDate)}</td>
                                            <td className="p-3 dark:text-gray-300">{b.clientName}</td>
                                            <td className="p-3 dark:text-gray-300">{fmtDate(b.periodStart)} - {fmtDate(b.periodEnd)}</td>
                                            <td className="p-3 text-right font-bold text-teal-700 dark:text-teal-400">{fmtMoney(b.netAmount)}</td>
                                            <td className="p-3 text-center flex gap-2 justify-center">
                                                <button onClick={()=>setViewBilling(b)} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 text-xs" title="View SOA"><Eye/></button>
                                                {onEditRequest && (
                                                    <button onClick={()=>onEditRequest(b)} className="text-orange-600 hover:text-orange-800" title="Edit in SOA Generator"><Edit/></button>
                                                )}
                                                {!b.datePaid ? (
                                                    <button onClick={()=>handleProcessPayment(b)} className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 flex items-center gap-1">Process</button>
                                                ) : (
                                                    <span className="text-green-600 font-bold text-xs border border-green-600 px-2 rounded">PAID</span>
                                                )}
                                                <button onClick={()=>setDeleteConfirm(b)} className="text-red-600 hover:text-red-800" title="Delete"><Trash2/></button>
                                            </td>
                                        </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div>
                    <button onClick={()=>setViewBilling(null)} className="mb-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Back to History</button>
                    <button onClick={()=>window.print()} className="mb-4 ml-2 bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900">Print</button>
                    <div id="printable-area" className="bg-white text-gray-800 p-8 max-w-[8.5in] mx-auto shadow-lg text-xs">
                        <SoaHeader />
                        {/* ... Billing View Details ... */}
                        <div className="flex justify-center mb-6"><div className="border-y-2 border-gray-800 py-1 px-8"><span className="font-bold text-sm uppercase tracking-wider">Billing Period: {fmtDate(viewBilling.periodStart)} — {fmtDate(viewBilling.periodEnd)}</span></div></div>
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-1/2">
                                <div className="grid grid-cols-[80px_1fr] gap-1"><span className="font-bold">Bill To:</span> <span>{viewBilling.clientName}</span><span className="font-bold">TIN:</span> <span>{viewBilling.clientTin}</span><span className="font-bold">Address:</span> <span>{viewBilling.clientAddress}</span></div>
                            </div>
                            <div className="w-1/2 flex justify-end">
                                <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-right"><span className="font-bold">Billing No:</span> <span>{viewBilling.billingNo}</span><span className="font-bold">Date:</span> <span>{fmtDate(viewBilling.date)}</span></div>
                            </div>
                        </div>
                         {/* TRIPS TABLE - Same as provided code */}
                         <table className="w-full mb-2 border-collapse border border-gray-300">
                            <thead>
                                <tr className="bg-gray-800 text-white text-[10px] uppercase font-bold text-center tracking-wider">
                                    <th className="border border-gray-400 p-1.5">Date</th>
                                    <th className="border border-gray-400 p-1.5">Plate</th>
                                    <th className="border border-gray-400 p-1.5">Truck Type</th>
                                    <th className="border border-gray-400 p-1.5">Origin</th>
                                    <th className="border border-gray-400 p-1.5">Destination</th>
                                    <th className="border border-gray-400 p-1.5">Waybill #</th>
                                    <th className="border border-gray-400 p-1.5">Runsheet #</th>
                                    <th className="border border-gray-400 p-1.5">ELI #</th>
                                    <th className="border border-gray-400 p-1.5">Drops</th>
                                    <th className="border border-gray-400 p-1.5">DR #</th>
                                    <th className="border border-gray-400 p-1.5 text-right">Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {viewBilling.items.map((t, idx) => (
                                    <tr key={idx} className="text-center text-[11px]">
                                        <td className="border p-1">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="border p-1">{t.plateNumber}</td>
                                        <td className="border p-1">{t.truckModel}</td>
                                        <td className="border p-1">{t.origin}</td>
                                        <td className="border p-1">{t.destination}</td>
                                        <td className="border p-1">{t.waybillNo || '-'}</td>
                                        <td className="border p-1">{t.transmittalNo || '-'}</td>
                                        <td className="border p-1">{t.eliNo || '-'}</td>
                                        <td className="border p-1">{t.dropCount}</td>
                                        <td className="border p-1">{t.drNumber}</td>
                                        <td className="border p-1 text-right">{fmtMoney(t.rate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold bg-gray-50 text-[11px]">
                                    <td colSpan={8} className="border p-1 text-right">SUBTOTAL (TRIPS)</td>
                                    <td className="border p-1 text-center">{viewBilling.totalDropCount}</td>
                                    <td className="border p-1"></td>
                                    <td className="border p-1 text-right">{fmtMoney(subtotalTrips)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* CHARGES TABLE */}
                        {relatedExpenses.length > 0 && (
                            <div className="mt-4 mb-4">
                                <h4 className="font-bold text-xs uppercase mb-1">Add-on Charges (Client)</h4>
                                <table className="w-full border-collapse border border-gray-300">
                                    <thead>
                                        <tr className="bg-gray-200 text-gray-800 text-[10px] uppercase font-bold text-center tracking-wider">
                                            <th className="border border-gray-400 p-1.5">Date</th>
                                            <th className="border border-gray-400 p-1.5">Plate</th>
                                            <th className="border border-gray-400 p-1.5">DR #</th>
                                            <th className="border border-gray-400 p-1.5">Mano (Client)</th>
                                            <th className="border border-gray-400 p-1.5">Other (Client)</th>
                                            <th className="border border-gray-400 p-1.5">Notes</th>
                                            <th className="border border-gray-400 p-1.5 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {relatedExpenses.map(e => {
                                            const t = data.trips.find(trip => trip.id === e.tripId);
                                            const mano = Number(e.manoChargesClient) || 0;
                                            const other = Number(e.otherExpChargesClient) || 0;
                                            const total = Number(e.total_charges_client) || (mano + other);
                                            return (
                                                <tr key={e.id} className="text-center text-[11px]">
                                                    <td className="border p-1">{t ? fmtDate(t.date) : '-'}</td>
                                                    <td className="border p-1">{t ? t.plateNumber : '-'}</td>
                                                    <td className="border p-1 font-bold">{t ? t.drNumber : '-'}</td>
                                                    <td className="border p-1 text-right">{fmtMoney(mano)}</td>
                                                    <td className="border p-1 text-right">{fmtMoney(other)}</td>
                                                    <td className="border p-1 text-left italic">{e.notes_charges_client}</td>
                                                    <td className="border p-1 text-right font-bold">{fmtMoney(total)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="font-bold bg-gray-50 text-[11px]">
                                            <td colSpan={6} className="border p-1 text-right">SUBTOTAL (CHARGES)</td>
                                            <td className="border p-1 text-right">{fmtMoney(subtotalCharges)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        <div className="flex justify-end mb-8 no-break-inside text-[11px]">
                            <div className="w-1/2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-gray-500">Subtotal (Trips)</span>
                                    <span>{fmtMoney(subtotalTrips)}</span>
                                </div>
                                {subtotalCharges > 0 && (
                                    <div className="flex justify-between items-center mb-1 border-b border-gray-300 pb-1">
                                        <span className="text-gray-500">Subtotal (Charges)</span>
                                        <span>{fmtMoney(subtotalCharges)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-2 font-bold text-sm bg-gray-100 p-1 rounded">
                                    <span>TOTAL GROSS (Base)</span>
                                    <span>{fmtMoney(viewBilling.totalRate)}</span>
                                </div>
                                
                                {viewBilling.isVat && (
                                    <div className="flex justify-between items-center mb-1">
                                        <span>VAT (12%)</span>
                                        <span className="font-bold">{fmtMoney(viewBilling.vatTaxAmount)}</span>
                                    </div>
                                )}
                                {viewBilling.isVatable && (
                                    <div className="flex justify-between items-center mb-1">
                                        <span>VATABLE SALES</span>
                                        <span className="font-bold">{fmtMoney(viewBilling.vatableSales)}</span>
                                    </div>
                                )}
                                {viewBilling.isVatAmount && (
                                    <div className="flex justify-between items-center mb-1">
                                        <span>VAT AMOUNT</span>
                                        <span className="font-bold">{fmtMoney(viewBilling.vatAmount)}</span>
                                    </div>
                                )}
                                {viewBilling.isEwt && (
                                    <div className="flex justify-between items-center mb-1 text-red-600">
                                        <span>Less: 2% EWT</span>
                                        <span className="font-bold">({fmtMoney(viewBilling.ewtAmount)})</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center border-t-2 border-black pt-2 mt-2 text-sm font-bold">
                                    <span>Total Billing Amount</span>
                                    <span>{fmtMoney(viewBilling.netAmount)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-end mt-12 gap-8 no-break-inside">
                            <div className="flex-1 text-center">
                                <div className="font-bold border-b border-black mb-1">{viewBilling.preparedBy}</div>
                                <div className="text-xs">Prepared by:</div>
                            </div>
                            <div className="flex-1 text-center">
                                <div className="font-bold border-b border-black mb-1">{viewBilling.checkedBy}</div>
                                <div className="text-xs">Checked and Approved by:</div>
                            </div>
                            <div className="flex-1 text-center">
                                <div className="border-b border-black h-6 mb-1"></div>
                                <div className="text-xs">Received by / Date</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            <Modal isOpen={paymentModal} onClose={()=>setPaymentModal(false)} title="Process Payment">
                <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                         <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs text-gray-500 dark:text-gray-300">Client</label><div className="font-bold">{paymentForm.clientName}</div></div>
                            <div><label className="text-xs text-gray-500 dark:text-gray-300">Billing No</label><div className="font-bold">{paymentForm.billingNo}</div></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold dark:text-gray-300">Date Paid</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={paymentForm.datePaid||''} onChange={e=>setPaymentForm({...paymentForm, datePaid: e.target.value})} /></div>
                        <div><label className="text-xs font-bold dark:text-gray-300">OR Number</label><input className="border p-2 rounded w-full" value={paymentForm.orNumber||''} onChange={e=>setPaymentForm({...paymentForm, orNumber: e.target.value})} /></div>
                    </div>
                    <div className="border-t pt-4 mt-2">
                        <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold">Less Commission</span><input type="number" className="border p-1 rounded w-32 text-right" value={paymentForm.commission||0} onChange={e=>setPaymentForm({...paymentForm, commission: Number(e.target.value)})} /></div>
                        <div className="flex justify-between items-center bg-teal-50 p-2 rounded mt-2"><span className="font-bold text-lg text-teal-800">Total Net</span><span className="font-bold text-xl text-teal-800">{fmtMoney(totalNet)}</span></div>
                    </div>
                    <button onClick={handleSavePayment} className="bg-teal-600 text-white w-full py-2 rounded font-bold hover:bg-teal-700 mt-4">Save Payment</button>
                </div>
            </Modal>

            {/* Delete Confirmation */}
            <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Delete Billing Record">
                <div className="space-y-4 p-4">
                    <p className="text-lg">Are you sure you want to delete <strong>Billing #{deleteConfirm?.billingNo}</strong>?</p>
                     <div className="bg-orange-50 dark:bg-orange-900 border-l-4 border-orange-500 p-4 rounded">
                        <p className="text-sm text-orange-800 dark:text-orange-200">
                            <strong>Warning:</strong> Deleting this record will revert all associated DR Numbers/Trips to <strong>'Returned'</strong> status so they can be billed again.
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
