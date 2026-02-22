
import React, { useState } from 'react';
import { AppData, Trip, UserAccount } from '../types';
import { fbService } from '../services/firebase';
import { Modal } from '../components/Modal';
import { Plus, Edit, Trash2, Settings, Printer, FileText } from '../components/Icons';
import { fmtDate, fmtMoney, exportToExcel, exportToPDF, getAllowedNames } from '../utils';
import { TripForm } from './TripForm';
import { ReferenceManager } from './ReferenceManager';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const TripListTab: React.FC<Props> = ({ data, currentUser }) => {
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(false);
    const [settingsModal, setSettingsModal] = useState(false);
    const [form, setForm] = useState<Partial<Trip>>({});
    
    // Filters
    const [monitorStart, setMonitorStart] = useState(new Date().toISOString().slice(0, 8) + '01');
    const [monitorEnd, setMonitorEnd] = useState(new Date().toISOString().split('T')[0]);

    // Delete Modal State
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    // Filter Logic
    const filteredTrips = data.trips
        .filter(t => t.date >= monitorStart && t.date <= monitorEnd)
        .filter(t => {
            const allowed = getAllowedNames(currentUser, 'tripMonitor.monitor');
            if (!allowed) return true;
            const driver = data.employees.find(e => e.id === t.driverId);
            const helper = data.employees.find(e => e.id === t.helperId);
            return (driver && allowed.includes(driver.name)) || (helper && allowed.includes(helper.name));
        })
        .filter(t => JSON.stringify(t).toLowerCase().includes(search.toLowerCase()))
        .sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());

    // Totals Calculation
    const totals = filteredTrips.reduce((acc, t) => ({
        count: acc.count + 1,
        gross: acc.gross + (Number(t.grossAmount)||0),
        vatAmount: acc.vatAmount + (Number(t.vatAmount)||0),
        vatEx: acc.vatEx + (Number(t.vatEx)||0),
        lessVat: acc.lessVat + (Number(t.lessVat)||0),
        withheld: acc.withheld + (Number(t.withheld)||0),
        vat2551q: acc.vat2551q + (Number(t.vat2551q)||0),
        jetsComms: acc.jetsComms + (Number(t.jetsComms)||0),
        jbf: acc.jbf + (Number(t.jbf)||0),
        totalDed: acc.totalDed + (Number(t.totalDeduction)||0),
        netRate: acc.netRate + (Number(t.netRate)||0),
        driver: acc.driver + (Number(t.driverRate)||0),
        helper: acc.helper + (Number(t.helperRate)||0),
    }), { count: 0, gross: 0, vatAmount: 0, vatEx: 0, lessVat: 0, withheld: 0, vat2551q: 0, jetsComms: 0, jbf: 0, totalDed: 0, netRate: 0, driver: 0, helper: 0 });

    // Export Handlers
    const handleExportExcel = () => {
        // Filter by Date Range ONLY
        const tripsToExport = data.trips
            .filter(t => t.date >= monitorStart && t.date <= monitorEnd)
            .sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());

        const exportData = tripsToExport.map(t => ({
            'Trip Code': t.tripCode,
            'Date': fmtDate(t.date),
            'Plate No': t.plateNumber,
            'Driver': data.employees.find(e=>e.id===t.driverId)?.name,
            'Helper': data.employees.find(e=>e.id===t.helperId)?.name,
            'DR No': t.drNumber,
            'Client': t.client,
            'Origin': t.origin,
            'Destination': t.destination,
            'Drop Count': t.dropCount,
            'Trip Type': t.typeOfTrip,
            'Status': t.status,
            'Waybill No': t.waybillNo,
            'Transmittal No': t.transmittalNo,
            'ELI No': t.eliNo,
            'Billed No': t.billedNo,
            'Gross Rate': t.grossAmount,
            'VAT (12%)': t.vatAmount,
            'VAT-Ex': t.vatEx,
            'Less VAT': t.lessVat,
            'Withheld Tax': t.withheld,
            '2551Q': t.vat2551q,
            'JETS': t.jetsComms,
            'JBF': t.jbf,
            'Total Deduction': t.totalDeduction,
            'Net Rate': t.netRate,
            'Driver Rate': t.driverRate,
            'Helper Rate': t.helperRate,
            'Remarks': t.remarks
        }));
        exportToExcel(exportData, `Trip_Monitor_${monitorStart}_${monitorEnd}`);
    };

    const handleExportPDF = () => {
        const rows = filteredTrips.map(t => [
            t.tripCode||'', fmtDate(t.date), t.plateNumber, t.client, t.destination, 
            String(t.dropCount), fmtMoney(t.grossAmount), fmtMoney(t.netRate)
        ]);
        exportToPDF(`Trip_Monitor_${monitorStart}_${monitorEnd}`, ['Code', 'Date', 'Plate', 'Client', 'Dest', 'Drops', 'Gross', 'Net'], rows, 'l');
    };

    const handleSave = async () => { if(form.id) await fbService.update('trips', form.id, form); else await fbService.add('trips', form); setModal(false); };
    const confirmDelete = async () => { if (deleteConfirm) { await fbService.remove(deleteConfirm.collection, deleteConfirm.id); setDeleteConfirm(null); }};

    return (
        <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-400">Trip List</h2>
                    <button onClick={()=>setSettingsModal(true)} className="text-gray-500 hover:text-teal-700 dark:text-gray-400 dark:hover:text-teal-300" title="Manage References"><Settings/></button>
                </div>
                <div className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 p-1 rounded border dark:border-gray-700">
                    <span className="dark:text-gray-300">From:</span><input type="date" className="border p-1 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={monitorStart} onChange={e=>setMonitorStart(e.target.value)}/>
                    <span className="dark:text-gray-300">To:</span><input type="date" className="border p-1 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={monitorEnd} onChange={e=>setMonitorEnd(e.target.value)}/>
                </div>
                <div className="flex gap-2 ml-auto">
                    <button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                    <button onClick={handleExportPDF} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                    <input placeholder="Search..." className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={search} onChange={e=>setSearch(e.target.value)} />
                    <button onClick={()=>{setForm({date: new Date().toISOString().split('T')[0], status: 'Dispatched'}); setModal(true)}} className="bg-teal-600 text-white px-4 py-2 rounded flex gap-2"><Plus/> New Trip</button>
                </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-teal-700 text-white sticky top-0 z-20 shadow-md">
                        <tr>
                            <th className="p-3">Trip Code</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Plate No.</th>
                            <th className="p-3">Driver</th>
                            <th className="p-3">Helper</th>
                            <th className="p-3">DR No.</th>
                            <th className="p-3">Client</th>
                            <th className="p-3">Warehouse</th>
                            <th className="p-3">Area (Dest)</th>
                            <th className="p-3 text-center">Drops</th>
                            <th className="p-3">Trip Type</th>
                            <th className="p-3 text-right bg-teal-800">Rate</th>
                            
                            <th className="p-3 text-right text-gray-200">VAT (12%)</th>
                            <th className="p-3 text-right text-gray-200">VAT-EX</th>
                            <th className="p-3 text-right text-gray-200">Less VAT</th>
                            <th className="p-3 text-right text-gray-200">Withheld</th>
                            <th className="p-3 text-right text-gray-200">2251Q VAT</th>
                            <th className="p-3 text-right text-gray-200">JETS</th>
                            <th className="p-3 text-right text-gray-200">JBF</th>
                            
                            <th className="p-3 text-right font-bold text-red-200">Total Ded.</th>
                            <th className="p-3 text-right font-bold bg-teal-800">Net Rate</th>
                            <th className="p-3 text-right text-yellow-200">Driver Rate</th>
                            <th className="p-3 text-right text-yellow-200">Helper Rate</th>
                            <th className="p-3">Billed No.</th>
                            <th className="p-3">Remarks</th>
                            <th className="p-3 text-center sticky right-0 bg-teal-700 z-30">Action</th>
                        </tr>
                        {/* TOTALS ROW */}
                        <tr className="bg-yellow-100 text-black font-bold border-b-2 border-teal-800 dark:bg-gray-600 dark:text-white">
                            <td colSpan={9} className="p-2 text-right uppercase">Total ({totals.count} Trips)</td>
                            <td className="p-2 text-center text-teal-800 dark:text-teal-200 bg-yellow-200 dark:bg-gray-500 border-x border-teal-300">Count: {totals.count}</td>
                            <td className="p-2"></td>
                            <td className="p-2 text-right">{fmtMoney(totals.gross)}</td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-300">{fmtMoney(totals.vatAmount)}</td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-300">{fmtMoney(totals.vatEx)}</td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-300">{fmtMoney(totals.lessVat)}</td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-300">{fmtMoney(totals.withheld)}</td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-300">{fmtMoney(totals.vat2551q)}</td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-300">{fmtMoney(totals.jetsComms)}</td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-300">{fmtMoney(totals.jbf)}</td>
                            <td className="p-2 text-right text-red-700 dark:text-red-300">{fmtMoney(totals.totalDed)}</td>
                            <td className="p-2 text-right text-teal-800 dark:text-teal-200 bg-green-100 dark:bg-gray-500">{fmtMoney(totals.netRate)}</td>
                            <td className="p-2 text-right text-blue-800 dark:text-blue-300">{fmtMoney(totals.driver)}</td>
                            <td className="p-2 text-right text-blue-800 dark:text-blue-300">{fmtMoney(totals.helper)}</td>
                            <td colSpan={3}></td>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTrips.map(t => (
                            <tr key={t.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                <td className="p-2 font-mono font-bold text-teal-800 dark:text-teal-400">{t.tripCode || '-'}</td>
                                <td className="p-2">{fmtDate(t.date)}</td>
                                <td className="p-2 font-bold">{t.plateNumber}</td>
                                <td className="p-2">{data.employees.find(e=>e.id===t.driverId)?.name || '-'}</td>
                                <td className="p-2">{data.employees.find(e=>e.id===t.helperId)?.name || '-'}</td>
                                <td className="p-2">{t.drNumber}</td>
                                <td className="p-2">{t.client}</td>
                                <td className="p-2">{t.origin}</td>
                                <td className="p-2">{t.destination}</td>
                                <td className="p-2 text-center">{t.dropCount}</td>
                                <td className="p-2">{t.typeOfTrip}</td>
                                <td className="p-2 text-right font-bold">{fmtMoney(t.grossAmount)}</td>
                                <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtMoney(t.vatAmount)}</td>
                                <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtMoney(t.vatEx)}</td>
                                <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtMoney(t.lessVat)}</td>
                                <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtMoney(t.withheld)}</td>
                                <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtMoney(t.vat2551q)}</td>
                                <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtMoney(t.jetsComms)}</td>
                                <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtMoney(t.jbf)}</td>
                                <td className="p-2 text-right text-red-600 dark:text-red-400 font-bold">{fmtMoney(t.totalDeduction)}</td>
                                <td className="p-2 text-right font-bold text-teal-700 dark:text-teal-400">{fmtMoney(t.netRate)}</td>
                                <td className="p-2 text-right text-blue-600 dark:text-blue-400">{fmtMoney(t.driverRate)}</td>
                                <td className="p-2 text-right text-blue-600 dark:text-blue-400">{fmtMoney(t.helperRate)}</td>
                                <td className="p-2">{t.billedNo}</td>
                                <td className="p-2 text-xs truncate max-w-[150px]" title={t.remarks}>{t.remarks}</td>
                                <td className="p-2 flex gap-1 justify-center sticky right-0 bg-gray-50 dark:bg-gray-800 z-20">
                                    <button type="button" onClick={(e)=>{e.stopPropagation(); setForm(t); setModal(true)}} className="text-blue-600 dark:text-blue-400"><Edit/></button>
                                    <button type="button" onClick={(e)=>{e.stopPropagation(); setDeleteConfirm({id: t.id, collection: 'trips'})}} className="text-red-600 hover:text-red-800"><Trash2/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <ReferenceManager 
                isOpen={settingsModal} 
                onClose={()=>setSettingsModal(false)} 
                data={data} 
            />
            
            <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete">
                <div className="space-y-4 p-4">
                    <p className="text-lg">Are you sure you want to delete this record?</p>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                    </div>
                </div>
            </Modal>
             <Modal isOpen={modal} onClose={()=>setModal(false)} title={form.id ? "Edit Trip" : "New Trip"} large>
                 <TripForm data={data} form={form} setForm={setForm} onSave={handleSave} />
            </Modal>
        </div>
    );
};
