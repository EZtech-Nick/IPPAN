
import React, { useState, useEffect } from 'react';
import { AppData, BillingRecord, Trip, TripExpense, UserAccount } from '../types';
import { fmtDate, fmtMoney, getAllowedNames } from '../utils';
import { Printer, Plus, Trash2 } from '../components/Icons';
import { fbService } from '../services/firebaseConfig';

interface Props {
    data: AppData;
    currentUser: UserAccount;
    onSave: () => void;
    editingRecord?: BillingRecord | null;
}

export const BillingSOA: React.FC<Props> = ({ data, currentUser, onSave, editingRecord }) => {
    // SOA Generation State
    const [client, setClient] = useState('');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
    const [billingNoOverride, setBillingNoOverride] = useState('');
    const [preparedBy, setPreparedBy] = useState('');
    const [checkedBy, setCheckedBy] = useState('');

    // Selection Mode State
    const [selectionMode, setSelectionMode] = useState<'all' | 'dr'>('all');
    const [drInput, setDrInput] = useState('');
    const [manualTrips, setManualTrips] = useState<Trip[]>([]);
    const [manualOverrides, setManualOverrides] = useState<Trip[]>([]);

    // Toggle States
    const [isVat, setIsVat] = useState(false);
    const [isVatable, setIsVatable] = useState(false);
    const [isVatAmount, setIsVatAmount] = useState(false);
    const [isEwt, setIsEwt] = useState(false);

    // Initialize state when editingRecord changes
    useEffect(() => {
        if (editingRecord) {
            setClient(editingRecord.clientName);
            setDateStart(editingRecord.periodStart);
            setDateEnd(editingRecord.periodEnd);
            setBillingDate(editingRecord.date);
            setBillingNoOverride(editingRecord.billingNo);
            setPreparedBy(editingRecord.preparedBy);
            setCheckedBy(editingRecord.checkedBy);
            setIsVat(editingRecord.isVat);
            setIsVatable(editingRecord.isVatable);
            setIsVatAmount(editingRecord.isVatAmount);
            setIsEwt(editingRecord.isEwt);

            // Reconstruct trips
            const loadedTrips = editingRecord.items.map(item => {
                // Find original trip to get full data, or use item data if deleted/missing
                const original = data.trips.find(t => t.id === item.tripId);
                return original || {
                    id: item.tripId,
                    date: item.date,
                    plateNumber: item.plateNumber,
                    origin: item.origin,
                    destination: item.destination,
                    dropCount: item.dropCount,
                    drNumber: item.drNumber,
                    grossAmount: item.rate,
                    client: editingRecord.clientName,
                    status: 'Paid', // Dummy status, won't affect display much
                    typeOfTrip: 'N/A' // Fallback
                } as Trip;
            });
            
            setManualOverrides(loadedTrips);
            setSelectionMode('dr'); // Force manual mode when editing to preserve specific list
        } else {
            // Reset if no record
            setClient('');
            setDateStart('');
            setDateEnd('');
            setBillingNoOverride('');
            setPreparedBy('');
            setCheckedBy('');
            setIsVat(false);
            setIsVatable(false);
            setIsVatAmount(false);
            setIsEwt(false);
            setManualOverrides([]);
            setManualTrips([]);
        }
    }, [editingRecord, data.trips]);

    const clients = (data.clients||[])
        .filter(c => {
            const allowed = getAllowedNames(currentUser, 'billing.soa');
            return !allowed || allowed.includes(c.name);
        })
        .map(c => c.name);
    const selectedClient = data.clients.find(c => c.name === client);

    // --- SOA Logic ---
    const getSoaTrips = () => {
        return data.trips.filter(t => {
            const isClient = t.client === client;
            const isUnpaid = t.status !== 'Paid';
            const afterStart = dateStart ? t.date >= dateStart : true;
            const beforeEnd = dateEnd ? t.date <= dateEnd : true;
            return isClient && isUnpaid && afterStart && beforeEnd;
        }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    // Determine which trips to use
    // If editing, prioritize manualOverrides which contains the record's trips
    const baseTrips = (selectionMode === 'all' && !editingRecord) ? getSoaTrips() : manualTrips;
    
    // Combine base trips with manual overrides (those added by DR specifically)
    // De-duplicate by ID
    const combinedTrips = [...baseTrips, ...manualOverrides].reduce((acc: Trip[], current) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) return acc.concat([current]);
        else return acc;
    }, []).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const trips = combinedTrips;

    // --- Expense / Charges Logic ---
    const tripIds = new Set(trips.map(t => t.id));
    
    // Get expenses linked to selected trips that have ANY client charges
    const relatedExpenses = data.trip_expenses.filter(e => {
        if (!tripIds.has(e.tripId)) return false;
        const charges = (Number(e.manoChargesClient) || 0) + (Number(e.otherExpChargesClient) || 0) + (Number(e.total_charges_client) || 0);
        return charges > 0;
    });

    // Handle Manual DR Add
    const handleAddDr = () => {
        if (!client) return alert("Please select a client first.");
        if (!drInput) return;

        // Allow searching even paid trips if we are editing (to re-add a removed one or fixing)
        // But generally, we search for unpaid. If editing, we might want to allow adding any trip for that client?
        // Let's stick to standard search but maybe relax 'Paid' check if editing? 
        // For simplicity, strict search.
        const foundTrip = data.trips.find(t => 
            t.client === client && 
            t.drNumber.trim().toLowerCase() === drInput.trim().toLowerCase()
        );

        if (foundTrip) {
            if (foundTrip.status === 'Paid' && !editingRecord) {
                 return alert("This trip is already marked as Paid.");
            }

            // Check if already in the final list
            if (trips.find(t => t.id === foundTrip.id)) {
                alert("This trip is already in the list.");
            } else {
                if (selectionMode === 'dr' || editingRecord) {
                    setManualTrips(prev => [...prev, foundTrip].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                    // Also add to overrides to ensure it sticks if mode switches
                    setManualOverrides(prev => [...prev, foundTrip]);
                } else {
                    setManualOverrides(prev => [...prev, foundTrip]);
                }
                setDrInput('');
            }
        } else {
            alert("DR Number not found for this client.");
        }
    };

    const handleRemoveTrip = (id: string) => {
        setManualTrips(prev => prev.filter(t => t.id !== id));
        setManualOverrides(prev => prev.filter(t => t.id !== id));
    };

    // Auto-generate next Billing No
    const getNextBillingNo = () => {
        if (editingRecord) return editingRecord.billingNo;
        if (!data.billings || data.billings.length === 0) return '0001';
        const max = data.billings.reduce((max, b) => {
            const num = parseInt(b.billingNo);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        return String(max + 1).padStart(4, '0');
    };

    const billingNo = billingNoOverride || getNextBillingNo();

    // --- CALCULATIONS ---
    const subtotalTrips = trips.reduce((a, t) => a + (Number(t.grossAmount) || 0), 0);
    const totalDropCount = trips.reduce((a, t) => a + (Number(t.dropCount) || 0), 0);
    const subtotalCharges = relatedExpenses.reduce((a, e) => {
        const mano = Number(e.manoChargesClient) || 0;
        const other = Number(e.otherExpChargesClient) || 0;
        const savedTotal = Number(e.total_charges_client) || 0;
        return a + (savedTotal > 0 ? savedTotal : (mano + other));
    }, 0);
    const totalGrossBase = subtotalTrips + subtotalCharges;
    const vatableSales = isVatable ? totalGrossBase / 1.12 : 0;
    const vatAmount = isVatAmount ? vatableSales * 0.12 : 0; 
    const vatTax = isVat ? totalGrossBase * 0.12 : 0; 
    const ewtAmount = isEwt ? vatableSales * 0.02 : 0;
    const totalBillingAmount = totalGrossBase + vatTax - ewtAmount; 

    const handleSaveBilling = async () => {
        if (!client || trips.length === 0) return alert("Select client and ensure trips exist.");
        
        let dueDate = editingRecord?.dueDate;
        if (!dueDate) {
            const defaultDue = new Date(new Date(billingDate).getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
            dueDate = prompt("Please enter the Due Date for this billing (YYYY-MM-DD):", defaultDue) || undefined;
            if (!dueDate) return;
        }

        // Sanitized Record Creation to prevent 'undefined' errors in Firestore
        const record: any = {
            billingNo: billingNo || '0000',
            clientName: client || '',
            clientTin: selectedClient?.tin || '',
            clientAddress: selectedClient?.address || '',
            date: billingDate,
            dueDate: dueDate, 
            periodStart: dateStart || '',
            periodEnd: dateEnd || '',
            items: trips.map(t => ({
                tripId: t.id,
                date: t.date || '',
                plateNumber: t.plateNumber || '',
                truckModel: data.trucks.find(truck => truck.plateNumber === t.plateNumber)?.model || '',
                origin: t.origin || '',
                destination: t.destination || '',
                waybillNo: t.waybillNo || '',
                transmittalNo: t.transmittalNo || '',
                eliNo: t.eliNo || '',
                dropCount: Number(t.dropCount) || 0,
                drNumber: t.drNumber || '',
                rate: Number(t.grossAmount) || 0
            })),
            totalRate: Number(totalGrossBase) || 0,
            totalDropCount: Number(totalDropCount) || 0,
            isVat: !!isVat, 
            isVatable: !!isVatable, 
            isVatAmount: !!isVatAmount, 
            isEwt: !!isEwt,
            vatAmount: Number(vatAmount) || 0, 
            vatableSales: Number(vatableSales) || 0, 
            vatTaxAmount: Number(vatTax) || 0, 
            ewtAmount: Number(ewtAmount) || 0, 
            netAmount: Number(totalBillingAmount) || 0,
            preparedBy: preparedBy || '', 
            checkedBy: checkedBy || ''
        };

        try {
            if (editingRecord) {
                await fbService.update('billings', editingRecord.id, record);
                alert(`Billing #${billingNo} updated successfully!`);
            } else {
                await fbService.add('billings', record);
                alert(`Billing #${billingNo} saved successfully!`);
            }
            setManualTrips([]);
            setManualOverrides([]);
            onSave();
        } catch (error) {
            console.error("Error saving billing:", error);
            alert("Failed to save billing record. Please check the console.");
        }
    };

    const SoaHeader = () => (
        <div className="flex items-center justify-center mb-2">
            <img src="https://image2url.com/images/1766232107704-62599d3b-3b93-4f19-ad67-32f9db0ab9e4.png" className="w-full max-w-[8.5in] object-contain" alt="IPPAN Transport" />
        </div>
    );

    return (
        <div>
            <div className={`no-print bg-white dark:bg-gray-800 p-4 rounded shadow mb-4 ${editingRecord ? 'border-2 border-orange-500' : ''}`}>
                {editingRecord && <div className="bg-orange-100 text-orange-800 p-2 rounded mb-4 font-bold text-center">EDITING BILLING MODE</div>}
                <div className="flex gap-4 items-center flex-wrap mb-4">
                    <select className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" onChange={e=>{setClient(e.target.value); setManualTrips([]); setManualOverrides([]);}} value={client}><option value="">Select Client</option>{clients.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold dark:text-gray-300">Cut-off From:</label>
                        <input type="date" className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={dateStart} onChange={e=>setDateStart(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold dark:text-gray-300">To:</label>
                        <input type="date" className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2 ml-4 border-l pl-4 dark:border-gray-600">
                        <label className="text-xs font-bold dark:text-gray-300">Billing Date:</label>
                        <input type="date" className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={billingDate} onChange={e=>setBillingDate(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold dark:text-gray-300">Billing #:</label>
                        <input placeholder={getNextBillingNo()} className="border p-2 rounded w-20 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={billingNoOverride} onChange={e=>setBillingNoOverride(e.target.value)} />
                    </div>
                </div>

                <div className="flex gap-4 items-center border-t pt-4 dark:border-gray-600">
                    <div className="flex items-center gap-3">
                        <label className="font-bold text-sm dark:text-gray-300">Selection Mode:</label>
                        <div className="flex gap-2">
                            <button onClick={()=>setSelectionMode('all')} className={`px-3 py-1 rounded text-xs border ${selectionMode==='all' ? 'bg-teal-600 text-white border-teal-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200 dark:border-gray-600'}`}>All (Date Range)</button>
                            <button onClick={()=>setSelectionMode('dr')} className={`px-3 py-1 rounded text-xs border ${selectionMode==='dr' ? 'bg-teal-600 text-white border-teal-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200 dark:border-gray-600'}`}>Per DR Number</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4 flex-1">
                        <label className="text-xs font-bold whitespace-nowrap text-orange-600 dark:text-orange-400">Add DR (Manual):</label>
                        <input 
                            placeholder="Enter DR Number" 
                            className="border p-1.5 rounded flex-1 max-w-[200px] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                            value={drInput} 
                            onChange={e=>setDrInput(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleAddDr()}
                        />
                        <button onClick={handleAddDr} className="bg-orange-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-orange-700 flex items-center gap-1"><Plus/> ADD</button>
                    </div>

                    {client && trips.length > 0 && (
                        <div className="ml-auto flex gap-2">
                            <button onClick={handleSaveBilling} className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700">
                                {editingRecord ? 'Update Billing' : 'Save Billing'}
                            </button>
                            <button onClick={()=>window.print()} className="bg-gray-800 text-white px-4 py-2 rounded flex gap-2"><Printer/> Print</button>
                        </div>
                    )}
                </div>
            </div>

            {client && (
                <div id="printable-area" className="bg-white text-gray-800 p-8 max-w-[8.5in] mx-auto shadow-lg text-xs">
                    <SoaHeader />
                    {/* ... (Existing SOA Layout Code remains the same) ... */}
                    <div className="flex justify-center mb-6">
                        <div className="border-y-2 border-gray-800 py-1 px-8">
                            <span className="font-bold text-sm uppercase tracking-wider">Billing Period: {fmtDate(dateStart)} — {fmtDate(dateEnd)}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-1/2">
                            <div className="grid grid-cols-[80px_1fr] gap-1">
                                <span className="font-bold">Bill To:</span> <span>{client}</span>
                                <span className="font-bold">TIN:</span> <span>{selectedClient?.tin || 'N/A'}</span>
                                <span className="font-bold">Address:</span> <span>{selectedClient?.address}</span>
                            </div>
                        </div>
                        <div className="w-1/2 flex justify-end">
                            <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-right">
                                <span className="font-bold">Billing No:</span> <span>{billingNo}</span>
                                <span className="font-bold">Date:</span> <span>{fmtDate(billingDate)}</span>
                            </div>
                        </div>
                    </div>
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
                                <th className="border border-gray-400 p-1 no-print w-6"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {trips.map(t => (
                                <tr key={t.id} className={`text-center text-[11px] ${manualOverrides.find(mo=>mo.id===t.id) ? 'bg-orange-50' : ''}`}>
                                    <td className="border p-1">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="border p-1">{t.plateNumber}</td>
                                    <td className="border p-1">{data.trucks.find(truck => truck.plateNumber === t.plateNumber)?.model || '-'}</td>
                                    <td className="border p-1">{t.origin}</td>
                                    <td className="border p-1">{t.destination}</td>
                                    <td className="border p-1">{t.waybillNo || '-'}</td>
                                    <td className="border p-1">{t.transmittalNo || '-'}</td>
                                    <td className="border p-1">{t.eliNo || '-'}</td>
                                    <td className="border p-1">{t.dropCount}</td>
                                    <td className="border p-1 font-bold">{t.drNumber || '-'}</td>
                                    <td className="border p-1 text-right">{fmtMoney(t.grossAmount)}</td>
                                    <td className="border p-1 no-print">
                                        {(selectionMode === 'dr' || manualOverrides.find(mo=>mo.id===t.id)) && (
                                            <button onClick={()=>handleRemoveTrip(t.id)} className="text-red-500 hover:text-red-700" title="Remove specifically added trip"><Trash2/></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="font-bold bg-gray-50 text-[11px]">
                                <td colSpan={8} className="border p-1 text-right">SUBTOTAL (TRIPS)</td>
                                <td className="border p-1 text-center">{totalDropCount}</td>
                                <td className="border p-1"></td>
                                <td className="border p-1 text-right">{fmtMoney(subtotalTrips)}</td>
                                <td className="border p-1 no-print"></td>
                            </tr>
                        </tfoot>
                    </table>

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
                                <span>{fmtMoney(totalGrossBase)}</span>
                            </div>
                            
                            <div className="flex justify-between items-center mb-1">
                                <label className="flex items-center gap-2 no-print cursor-pointer">
                                    <input type="checkbox" checked={isVat} onChange={e=>setIsVat(e.target.checked)} />
                                    VAT (12% of Total Gross)
                                </label>
                                <span className="print-only">{isVat ? 'VAT (12%)' : ''}</span>
                                {isVat && <span className="font-bold">{fmtMoney(vatTax)}</span>}
                            </div>
                            {/* ... Rest of deductions ... */}
                            <div className="flex justify-between items-center mb-1">
                                <label className="flex items-center gap-2 no-print cursor-pointer">
                                    <input type="checkbox" checked={isVatable} onChange={e=>setIsVatable(e.target.checked)} />
                                    VATABLE SALES (Total/1.12)
                                </label>
                                <span className="print-only">{isVatable ? 'VATABLE SALES' : ''}</span>
                                {isVatable && <span className="font-bold">{fmtMoney(vatableSales)}</span>}
                            </div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="flex items-center gap-2 no-print cursor-pointer">
                                    <input type="checkbox" checked={isVatAmount} onChange={e=>setIsVatAmount(e.target.checked)} />
                                    VAT AMOUNT (Vatable * 0.12)
                                </label>
                                <span className="print-only">{isVatAmount ? 'VAT AMOUNT' : ''}</span>
                                {isVatAmount && <span className="font-bold">{fmtMoney(vatAmount)}</span>}
                            </div>
                            <div className="flex justify-between items-center mb-1 text-red-600">
                                <label className="flex items-center gap-2 no-print cursor-pointer">
                                    <input type="checkbox" checked={isEwt} onChange={e=>setIsEwt(e.target.checked)} />
                                    Less: 2% EWT
                                </label>
                                <span className="print-only text-red-600">{isEwt ? 'Less: 2% EWT' : ''}</span>
                                {isEwt && <span className="font-bold">({fmtMoney(ewtAmount)})</span>}
                            </div>

                            <div className="flex justify-between items-center border-t-2 border-black pt-2 mt-2 text-sm font-bold">
                                <span>Total Billing Amount</span>
                                <span>{fmtMoney(totalBillingAmount)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-end mt-12 gap-8 no-break-inside">
                        <div className="flex-1 text-center">
                            <input className="w-full text-center border-b border-black outline-none mb-1 font-bold no-print" placeholder="Enter Name" value={preparedBy} onChange={e=>setPreparedBy(e.target.value)} />
                            <div className="print-only font-bold border-b border-black mb-1">{preparedBy || '__________________'}</div>
                            <div className="text-xs">Prepared by:</div>
                        </div>
                        <div className="flex-1 text-center">
                            <input className="w-full text-center border-b border-black outline-none mb-1 font-bold no-print" placeholder="Enter Name" value={checkedBy} onChange={e=>setCheckedBy(e.target.value)} />
                            <div className="print-only font-bold border-b border-black mb-1">{checkedBy || '__________________'}</div>
                            <div className="text-xs">Checked and Approved by:</div>
                        </div>
                        <div className="flex-1 text-center">
                            <div className="border-b border-black h-6 mb-1"></div>
                            <div className="text-xs">Received by / Date</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
