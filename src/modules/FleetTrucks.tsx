
import React, { useState } from 'react';
import { AppData, Truck, UserAccount } from '../types';
import { fbService } from '../services/firebaseConfig';
import { Modal } from '../components/Modal';
import { Plus, Edit, Trash2, Printer, FileText } from '../components/Icons';
import { fmtMoney, fmtDate, isExpiring, exportToPDF, exportToExcel, getAllowedNames } from '../utils';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const FleetTrucks: React.FC<Props> = ({ data, currentUser }) => {
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<Truck>>({});
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    const filtered = data.trucks.filter(t => {
        const allowed = getAllowedNames(currentUser, 'fleet.truckList');
        if (allowed && !allowed.includes(t.plateNumber)) return false;
        return JSON.stringify(t).toLowerCase().includes(search.toLowerCase());
    });

    const handleSaveTruck = async () => { 
        if(form.id) await fbService.update('trucks', form.id, form); 
        else await fbService.add('trucks', form); 
        setModal(false); 
    };

    const confirmDelete = async () => { 
        if (deleteConfirm) { 
            await fbService.remove(deleteConfirm.collection, deleteConfirm.id); 
            setDeleteConfirm(null); 
        } 
    };

    const exportTrucks = (excel = false) => {
        if(excel) {
            const fullData = filtered.map(t => ({
                'Plate Number': t.plateNumber,
                'Model': t.model,
                'Year Model': t.yearModel,
                'Engine No': t.engine,
                'Chassis No': t.chassis,
                'Owner': t.owner,
                'Investor': t.investor,
                'Dealer': t.dealer,
                'Purchase Date': fmtDate(t.purchaseDate),
                'Purchase Amount': t.purchaseAmount,
                'Reg Expiry': fmtDate(t.registrationExpiry),
                'LTO CR No': t.ltoCrNo,
                'LTO CR Date': fmtDate(t.ltoCrDate),
                'LTO OR No': t.ltoOrNo,
                'LTFRB Case No': t.ltfrbCaseNo,
                'LTFRB Decision': t.ltfrbPaDecision,
                'LTFRB Dec Date': fmtDate(t.ltfrbDecisionDate),
                'LTFRB Expiry': fmtDate(t.ltfrbDateExpiration),
                'Comp Ins Company': t.compInsCompany,
                'Comp Ins Broker': t.compInsBroker,
                'Comp Ins Premium': t.compInsPremium,
                'Comp Ins Coverage': t.compInsCoverage,
                'Comp Ins Start': fmtDate(t.compInsDateInsured),
                'Comp Ins End': fmtDate(t.compInsDateExpired),
                'Cargo Ins Company': t.cargoInsCompany,
                'Cargo Ins Broker': t.cargoInsBroker,
                'Cargo Ins Premium': t.cargoInsPremium,
                'Cargo Ins Coverage': t.cargoInsCoverage,
                'Cargo Ins Start': fmtDate(t.cargoInsDateInsured),
                'Cargo Ins End': fmtDate(t.cargoInsDateExpired),
            }));
            return exportToExcel(fullData, 'Truck_Masterlist');
        }
        const rows = filtered.map(t => [t.plateNumber, t.model, t.owner, t.registrationExpiry ? fmtDate(t.registrationExpiry) : '-', t.insuranceExpiry ? fmtDate(t.insuranceExpiry) : '-']);
        exportToPDF('Truck_Masterlist', ['Plate', 'Model', 'Owner', 'Reg. Expiry', 'Ins. Expiry'], rows);
    };

    return (
        <div>
            <div className="flex justify-between mb-4">
                <input placeholder="Search trucks..." className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={search} onChange={e=>setSearch(e.target.value)} />
                <div className="flex gap-2">
                        <button onClick={()=>exportTrucks(true)} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                        <button onClick={()=>exportTrucks(false)} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                        <button onClick={()=>{setForm({}); setModal(true)}} className="bg-teal-600 text-white px-4 py-2 rounded flex gap-2"><Plus/> Add Truck</button>
                </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
                    <thead className="bg-teal-700 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-2 border border-teal-600 sticky left-0 bg-teal-700 z-20">Action</th>
                            <th className="p-2 border border-teal-600">Plate Number</th>
                            <th className="p-2 border border-teal-600">Model</th>
                            <th className="p-2 border border-teal-600">Year Model</th>
                            <th className="p-2 border border-teal-600">Engine No</th>
                            <th className="p-2 border border-teal-600">Chassis No</th>
                            <th className="p-2 border border-teal-600">Owner</th>
                            <th className="p-2 border border-teal-600">Investor</th>
                            <th className="p-2 border border-teal-600">Dealer</th>
                            <th className="p-2 border border-teal-600">Purch. Date</th>
                            <th className="p-2 border border-teal-600 text-right">Purch. Amt</th>
                            <th className="p-2 border border-teal-600">Reg Expiry</th>
                            <th className="p-2 border border-teal-600">LTO CR No</th>
                            <th className="p-2 border border-teal-600">LTO CR Date</th>
                            <th className="p-2 border border-teal-600">LTO OR No</th>
                            <th className="p-2 border border-teal-600">LTFRB Case</th>
                            <th className="p-2 border border-teal-600">LTFRB Dec</th>
                            <th className="p-2 border border-teal-600">LTFRB Date</th>
                            <th className="p-2 border border-teal-600">LTFRB Exp</th>
                            <th className="p-2 border border-teal-600">Comp. Ins Co</th>
                            <th className="p-2 border border-teal-600">Comp. Broker</th>
                            <th className="p-2 border border-teal-600 text-right">Comp. Prem</th>
                            <th className="p-2 border border-teal-600 text-right">Comp. Cov</th>
                            <th className="p-2 border border-teal-600">Comp. Start</th>
                            <th className="p-2 border border-teal-600">Comp. End</th>
                            <th className="p-2 border border-teal-600">Cargo Ins Co</th>
                            <th className="p-2 border border-teal-600">Cargo Broker</th>
                            <th className="p-2 border border-teal-600 text-right">Cargo Prem</th>
                            <th className="p-2 border border-teal-600 text-right">Cargo Cov</th>
                            <th className="p-2 border border-teal-600">Cargo Start</th>
                            <th className="p-2 border border-teal-600">Cargo End</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(t => (
                            <tr key={t.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                <td className="p-2 border dark:border-gray-600 sticky left-0 bg-white dark:bg-gray-800 flex gap-2 justify-center shadow-md z-10">
                                    <button type="button" onClick={(e)=>{e.stopPropagation(); setForm(t); setModal(true)}} className="text-blue-600 dark:text-blue-400 hover:text-blue-800"><Edit/></button>
                                    <button type="button" onClick={(e)=>{e.stopPropagation(); setDeleteConfirm({id: t.id, collection: 'trucks'})}} className="text-red-600 hover:text-red-800"><Trash2/></button>
                                </td>
                                <td className="p-2 border dark:border-gray-600 font-bold">{t.plateNumber}</td>
                                <td className="p-2 border dark:border-gray-600">{t.model}</td>
                                <td className="p-2 border dark:border-gray-600">{t.yearModel || '-'}</td>
                                <td className="p-2 border dark:border-gray-600 font-mono text-[10px]">{t.engine}</td>
                                <td className="p-2 border dark:border-gray-600 font-mono text-[10px]">{t.chassis}</td>
                                <td className="p-2 border dark:border-gray-600">{t.owner}</td>
                                <td className="p-2 border dark:border-gray-600 text-teal-600 dark:text-teal-400">{t.investor || '-'}</td>
                                <td className="p-2 border dark:border-gray-600">{t.dealer || '-'}</td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(t.purchaseDate)}</td>
                                <td className="p-2 border dark:border-gray-600 text-right">{fmtMoney(t.purchaseAmount)}</td>
                                <td className={`p-2 border dark:border-gray-600 ${isExpiring(t.registrationExpiry)?'text-red-600 font-bold':''}`}>{fmtDate(t.registrationExpiry)}</td>
                                <td className="p-2 border dark:border-gray-600 font-mono">{t.ltoCrNo || '-'}</td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(t.ltoCrDate)}</td>
                                <td className="p-2 border dark:border-gray-600 font-mono">{t.ltoOrNo || '-'}</td>
                                <td className="p-2 border dark:border-gray-600 font-mono">{t.ltfrbCaseNo || '-'}</td>
                                <td className="p-2 border dark:border-gray-600">{t.ltfrbPaDecision || '-'}</td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(t.ltfrbDecisionDate)}</td>
                                <td className={`p-2 border dark:border-gray-600 ${isExpiring(t.ltfrbDateExpiration)?'text-red-600 font-bold':''}`}>{fmtDate(t.ltfrbDateExpiration)}</td>
                                <td className="p-2 border dark:border-gray-600">{t.compInsCompany || '-'}</td>
                                <td className="p-2 border dark:border-gray-600">{t.compInsBroker || '-'}</td>
                                <td className="p-2 border dark:border-gray-600 text-right">{fmtMoney(t.compInsPremium)}</td>
                                <td className="p-2 border dark:border-gray-600 text-right">{fmtMoney(t.compInsCoverage)}</td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(t.compInsDateInsured)}</td>
                                <td className={`p-2 border dark:border-gray-600 ${isExpiring(t.compInsDateExpired)?'text-red-600 font-bold':''}`}>{fmtDate(t.compInsDateExpired)}</td>
                                <td className="p-2 border dark:border-gray-600">{t.cargoInsCompany || '-'}</td>
                                <td className="p-2 border dark:border-gray-600">{t.cargoInsBroker || '-'}</td>
                                <td className="p-2 border dark:border-gray-600 text-right">{fmtMoney(t.cargoInsPremium)}</td>
                                <td className="p-2 border dark:border-gray-600 text-right">{fmtMoney(t.cargoInsCoverage)}</td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(t.cargoInsDateInsured)}</td>
                                <td className={`p-2 border dark:border-gray-600 ${isExpiring(t.cargoInsDateExpired)?'text-red-600 font-bold':''}`}>{fmtDate(t.cargoInsDateExpired)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modal} onClose={()=>setModal(false)} title="Truck Details" large>
                <div className="space-y-4 text-xs">
                    {/* 1. Basic Vehicle Info */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
                        <div className="col-span-4 font-bold text-teal-800 dark:text-teal-400 uppercase border-b pb-1 mb-2">1. Vehicle Information</div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Plate Number</label><input className="border p-2 rounded dark:bg-gray-800" value={form.plateNumber||''} onChange={e=>setForm({...form, plateNumber: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Model</label><input className="border p-2 rounded dark:bg-gray-800" value={form.model||''} onChange={e=>setForm({...form, model: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Year Model</label><input className="border p-2 rounded dark:bg-gray-800" value={form.yearModel||''} onChange={e=>setForm({...form, yearModel: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Engine No.</label><input className="border p-2 rounded dark:bg-gray-800" value={form.engine||''} onChange={e=>setForm({...form, engine: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Chassis No.</label><input className="border p-2 rounded dark:bg-gray-800" value={form.chassis||''} onChange={e=>setForm({...form, chassis: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Purchase Amount</label><input type="number" className="border p-2 rounded dark:bg-gray-800" value={form.purchaseAmount||''} onChange={e=>setForm({...form, purchaseAmount: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Dealer</label><input className="border p-2 rounded dark:bg-gray-800" value={form.dealer||''} onChange={e=>setForm({...form, dealer: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Purchase Date</label><input type="date" className="border p-2 rounded dark:bg-gray-800" value={form.purchaseDate||''} onChange={e=>setForm({...form, purchaseDate: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Owner Name</label><input className="border p-2 rounded dark:bg-gray-800" value={form.owner||''} onChange={e=>setForm({...form, owner: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Investor</label><input className="border p-2 rounded dark:bg-gray-800" value={form.investor||''} onChange={e=>setForm({...form, investor: e.target.value})} /></div>
                    </div>

                    {/* 2. LTO Details */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
                        <div className="col-span-4 font-bold text-teal-800 dark:text-teal-400 uppercase border-b pb-1 mb-2">2. LTO Details</div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Registration Expiry</label><input type="date" className="border p-2 rounded dark:bg-gray-700" value={form.registrationExpiry||''} onChange={e=>setForm({...form, registrationExpiry: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">LTO CR Date</label><input type="date" className="border p-2 rounded dark:bg-gray-700" value={form.ltoCrDate||''} onChange={e=>setForm({...form, ltoCrDate: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">LTO CR No</label><input className="border p-2 rounded dark:bg-gray-700" value={form.ltoCrNo||''} onChange={e=>setForm({...form, ltoCrNo: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">LTO OR No</label><input className="border p-2 rounded dark:bg-gray-700" value={form.ltoOrNo||''} onChange={e=>setForm({...form, ltoOrNo: e.target.value})} /></div>
                    </div>

                    {/* 3. LTFRB Details */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
                        <div className="col-span-4 font-bold text-teal-800 dark:text-teal-400 uppercase border-b pb-1 mb-2">3. LTFRB Details</div>
                        <div className="flex flex-col"><label className="font-bold mb-1">LTFRB P.A / Decision</label><input className="border p-2 rounded dark:bg-gray-800" value={form.ltfrbPaDecision||''} onChange={e=>setForm({...form, ltfrbPaDecision: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Decision Date Stamp</label><input type="date" className="border p-2 rounded dark:bg-gray-800" value={form.ltfrbDecisionDate||''} onChange={e=>setForm({...form, ltfrbDecisionDate: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Expiration</label><input type="date" className="border p-2 rounded dark:bg-gray-800" value={form.ltfrbDateExpiration||''} onChange={e=>setForm({...form, ltfrbDateExpiration: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Case No</label><input className="border p-2 rounded dark:bg-gray-800" value={form.ltfrbCaseNo||''} onChange={e=>setForm({...form, ltfrbCaseNo: e.target.value})} /></div>
                    </div>

                    {/* 4. Comprehensive Insurance */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
                        <div className="col-span-3 font-bold text-teal-800 dark:text-teal-400 uppercase border-b pb-1 mb-2">4. Comprehensive Insurance</div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Broker</label><input className="border p-2 rounded dark:bg-gray-700" value={form.compInsBroker||''} onChange={e=>setForm({...form, compInsBroker: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Insurance Company</label><input className="border p-2 rounded dark:bg-gray-700" value={form.compInsCompany||''} onChange={e=>setForm({...form, compInsCompany: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Premium Amount</label><input type="number" className="border p-2 rounded dark:bg-gray-700" value={form.compInsPremium||''} onChange={e=>setForm({...form, compInsPremium: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Coverage Amount</label><input type="number" className="border p-2 rounded dark:bg-gray-700" value={form.compInsCoverage||''} onChange={e=>setForm({...form, compInsCoverage: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Insured</label><input type="date" className="border p-2 rounded dark:bg-gray-700" value={form.compInsDateInsured||''} onChange={e=>setForm({...form, compInsDateInsured: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Expired</label><input type="date" className="border p-2 rounded dark:bg-gray-700" value={form.compInsDateExpired||''} onChange={e=>setForm({...form, compInsDateExpired: e.target.value})} /></div>
                        {/* Fallback to original insurance expiry if needed */}
                        <div className="hidden"><input value={form.insuranceExpiry||''} onChange={e=>setForm({...form, insuranceExpiry: e.target.value})} /></div>
                    </div>

                    {/* 5. Cargo Insurance */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
                        <div className="col-span-3 font-bold text-teal-800 dark:text-teal-400 uppercase border-b pb-1 mb-2">5. Cargo Insurance</div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Broker</label><input className="border p-2 rounded dark:bg-gray-800" value={form.cargoInsBroker||''} onChange={e=>setForm({...form, cargoInsBroker: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Insurance Company</label><input className="border p-2 rounded dark:bg-gray-800" value={form.cargoInsCompany||''} onChange={e=>setForm({...form, cargoInsCompany: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Premium Amount</label><input type="number" className="border p-2 rounded dark:bg-gray-800" value={form.cargoInsPremium||''} onChange={e=>setForm({...form, cargoInsPremium: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Coverage Amount</label><input type="number" className="border p-2 rounded dark:bg-gray-800" value={form.cargoInsCoverage||''} onChange={e=>setForm({...form, cargoInsCoverage: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Insured</label><input type="date" className="border p-2 rounded dark:bg-gray-800" value={form.cargoInsDateInsured||''} onChange={e=>setForm({...form, cargoInsDateInsured: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Expired</label><input type="date" className="border p-2 rounded dark:bg-gray-800" value={form.cargoInsDateExpired||''} onChange={e=>setForm({...form, cargoInsDateExpired: e.target.value})} /></div>
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={handleSaveTruck} className="bg-teal-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-teal-700">Save Truck Details</button>
                </div>
            </Modal>

            <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete">
                <div className="space-y-4 p-4">
                    <p className="text-lg">Are you sure you want to delete this record?</p>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
