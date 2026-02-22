
import React, { useState } from 'react';
import { AppData, InsuranceClaim, UserAccount } from '../types';
import { fbService } from '../services/firebase';
import { Modal } from '../components/Modal';
import { Plus, Edit, Trash2, Printer, FileText } from '../components/Icons';
import { fmtMoney, fmtDate, exportToPDF, exportToExcel, getAllowedNames } from '../utils';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const FleetInsurance: React.FC<Props> = ({ data, currentUser }) => {
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<InsuranceClaim>>({});
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    const filtered = (data.insurance_claims || [])
        .filter(c => {
            const allowed = getAllowedNames(currentUser, 'fleet.insurance');
            if (allowed && !allowed.includes(c.plateNumber)) return false;
            return c.plateNumber.toLowerCase().includes(search.toLowerCase()) || 
                   c.driverName.toLowerCase().includes(search.toLowerCase());
        })
        .sort((a,b) => new Date(b.dateIncident).getTime() - new Date(a.dateIncident).getTime());

    const handleSave = async () => {
        if(form.id) await fbService.update('insurance_claims', form.id, form);
        else await fbService.add('insurance_claims', form);
        setModal(false);
    };

    const confirmDelete = async () => {
        if (deleteConfirm) {
            await fbService.remove(deleteConfirm.collection, deleteConfirm.id);
            setDeleteConfirm(null);
        }
    };

    const exportClaims = (excel = false) => {
        if(excel) {
            const fullData = filtered.map(c => ({
                'Date Incident': fmtDate(c.dateIncident),
                'Plate': c.plateNumber,
                'Driver': c.driverName,
                'Helper': c.helperName,
                'Driver Lic': c.driverLicense,
                'Report': c.report,
                '3rd Party Plate': c.thirdPartyPlate,
                '3rd Party Name': c.thirdPartyName,
                '3rd Party Lic': c.thirdPartyLicense,
                'Claim Amt': c.actualAmountClaim,
                'Personnel Claim': c.personelClaim,
                'Own Exp': c.totalExpensesOwn,
                '3rd Exp': c.totalExpensesThirdParty,
                'Recv Own': fmtDate(c.dateReceivedOwn),
                'Recv 3rd': fmtDate(c.dateReceivedThirdParty),
                'Recv Pers': fmtDate(c.dateReceivedPersonel),
                'Cargo Items': c.cargoClaimItems,
                'Client Claim': c.clientTotalAmountClaim,
                'Ins Claim': c.actualInsuranceAmountClaim,
                'Recv Cargo': fmtDate(c.dateReceivedCargo),
                'Details': c.cashCheckDetail
            }));
            return exportToExcel(fullData, 'Insurance_Claims_Report');
        }
        const rows = filtered.map(c => [
            fmtDate(c.dateIncident),
            c.plateNumber,
            c.driverName,
            c.thirdPartyName || 'N/A',
            fmtMoney(c.actualAmountClaim),
            fmtMoney(c.totalExpensesOwn)
        ]);
        exportToPDF('Insurance_Claims_Report', ['Date', 'Plate', 'Driver', '3rd Party', 'Claim Amt', 'Expenses'], rows, 'l');
    };

    return (
        <div>
            <div className="flex justify-between mb-4">
                <h3 className="font-bold text-lg dark:text-gray-200">Comprehensive and Cargo Insurance Claims</h3>
                <div className="flex gap-2">
                    <button onClick={()=>exportClaims(true)} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                    <button onClick={()=>exportClaims(false)} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                    <input placeholder="Search claims..." className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={search} onChange={e=>setSearch(e.target.value)} />
                    <button onClick={()=>{setForm({}); setModal(true)}} className="bg-orange-600 text-white px-4 py-2 rounded flex gap-2"><Plus/> New Claim</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
                    <thead className="bg-orange-700 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-2 border border-orange-600 sticky left-0 bg-orange-700 z-20 text-center">Action</th>
                            <th className="p-2 border border-orange-600">Date Incident</th>
                            <th className="p-2 border border-orange-600">Plate Number</th>
                            <th className="p-2 border border-orange-600">Driver Name</th>
                            <th className="p-2 border border-orange-600">Helper Name</th>
                            <th className="p-2 border border-orange-600">Driver's License</th>
                            <th className="p-2 border border-orange-600">Report Details</th>
                            <th className="p-2 border border-orange-600">3rd Party Plate</th>
                            <th className="p-2 border border-orange-600">3rd Party Name</th>
                            <th className="p-2 border border-orange-600">3rd Party License</th>
                            <th className="p-2 border border-orange-600 text-right">Actual Claim</th>
                            <th className="p-2 border border-orange-600 text-right">Personnel Claim</th>
                            <th className="p-2 border border-orange-600 text-right">Expenses (Own)</th>
                            <th className="p-2 border border-orange-600 text-right">Expenses (3rd)</th>
                            <th className="p-2 border border-orange-600">Date Recv (Own)</th>
                            <th className="p-2 border border-orange-600">Date Recv (3rd)</th>
                            <th className="p-2 border border-orange-600">Date Recv (Pers)</th>
                            <th className="p-2 border border-orange-600">Cargo Items</th>
                            <th className="p-2 border border-orange-600 text-right">Client Claim Amt</th>
                            <th className="p-2 border border-orange-600 text-right">Ins Claim Amt</th>
                            <th className="p-2 border border-orange-600">Date Recv (Cargo)</th>
                            <th className="p-2 border border-orange-600">Cash/Check Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(c => (
                            <tr key={c.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                <td className="p-2 border dark:border-gray-600 sticky left-0 bg-white dark:bg-gray-800 flex gap-2 justify-center shadow-md z-10">
                                    <button onClick={()=>{setForm(c); setModal(true)}} className="text-blue-600 hover:text-blue-800"><Edit/></button>
                                    <button onClick={()=>setDeleteConfirm({id: c.id, collection: 'insurance_claims'})} className="text-red-600 hover:text-red-800"><Trash2/></button>
                                </td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(c.dateIncident)}</td>
                                <td className="p-2 border dark:border-gray-600 font-bold">{c.plateNumber}</td>
                                <td className="p-2 border dark:border-gray-600">{c.driverName}</td>
                                <td className="p-2 border dark:border-gray-600">{c.helperName}</td>
                                <td className="p-2 border dark:border-gray-600">{c.driverLicense}</td>
                                <td className="p-2 border dark:border-gray-600 max-w-[200px] truncate" title={c.report}>{c.report}</td>
                                <td className="p-2 border dark:border-gray-600">{c.thirdPartyPlate || '-'}</td>
                                <td className="p-2 border dark:border-gray-600">{c.thirdPartyName || '-'}</td>
                                <td className="p-2 border dark:border-gray-600">{c.thirdPartyLicense || '-'}</td>
                                <td className="p-2 border dark:border-gray-600 text-right font-bold text-teal-600">{fmtMoney(c.actualAmountClaim)}</td>
                                <td className="p-2 border dark:border-gray-600 text-right">{fmtMoney(c.personelClaim)}</td>
                                <td className="p-2 border dark:border-gray-600 text-right text-red-600">{fmtMoney(c.totalExpensesOwn)}</td>
                                <td className="p-2 border dark:border-gray-600 text-right text-red-600">{fmtMoney(c.totalExpensesThirdParty)}</td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(c.dateReceivedOwn)}</td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(c.dateReceivedThirdParty)}</td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(c.dateReceivedPersonel)}</td>
                                <td className="p-2 border dark:border-gray-600 max-w-[150px] truncate" title={c.cargoClaimItems}>{c.cargoClaimItems || '-'}</td>
                                <td className="p-2 border dark:border-gray-600 text-right">{fmtMoney(c.clientTotalAmountClaim)}</td>
                                <td className="p-2 border dark:border-gray-600 text-right">{fmtMoney(c.actualInsuranceAmountClaim)}</td>
                                <td className="p-2 border dark:border-gray-600">{fmtDate(c.dateReceivedCargo)}</td>
                                <td className="p-2 border dark:border-gray-600 max-w-[150px] truncate" title={c.cashCheckDetail}>{c.cashCheckDetail || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modal} onClose={()=>setModal(false)} title="Insurance Claim Details" large>
                <div className="space-y-4 text-xs">
                    {/* Incident Details */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
                        <div className="col-span-4 font-bold text-orange-800 dark:text-orange-400 uppercase border-b pb-1 mb-2">1. Incident Information</div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Incident</label><input type="date" className="border p-2 rounded dark:bg-gray-800" value={form.dateIncident||''} onChange={e=>setForm({...form, dateIncident: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Plate Number</label><input className="border p-2 rounded dark:bg-gray-800" value={form.plateNumber||''} onChange={e=>setForm({...form, plateNumber: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Driver Name</label><input className="border p-2 rounded dark:bg-gray-800" value={form.driverName||''} onChange={e=>setForm({...form, driverName: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Helper Name</label><input className="border p-2 rounded dark:bg-gray-800" value={form.helperName||''} onChange={e=>setForm({...form, helperName: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Driver's License</label><input className="border p-2 rounded dark:bg-gray-800" value={form.driverLicense||''} onChange={e=>setForm({...form, driverLicense: e.target.value})} /></div>
                        <div className="col-span-3 flex flex-col"><label className="font-bold mb-1">Incident Report / Description</label><textarea className="border p-2 rounded dark:bg-gray-800 h-10" value={form.report||''} onChange={e=>setForm({...form, report: e.target.value})} /></div>
                    </div>

                    {/* Third Party */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
                        <div className="col-span-3 font-bold text-orange-800 dark:text-orange-400 uppercase border-b pb-1 mb-2">2. Third Party Details</div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Third Party Plate No</label><input className="border p-2 rounded dark:bg-gray-700" value={form.thirdPartyPlate||''} onChange={e=>setForm({...form, thirdPartyPlate: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Third Party Name</label><input className="border p-2 rounded dark:bg-gray-700" value={form.thirdPartyName||''} onChange={e=>setForm({...form, thirdPartyName: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Third Party License</label><input className="border p-2 rounded dark:bg-gray-700" value={form.thirdPartyLicense||''} onChange={e=>setForm({...form, thirdPartyLicense: e.target.value})} /></div>
                    </div>

                    {/* Financials */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
                        <div className="col-span-4 font-bold text-orange-800 dark:text-orange-400 uppercase border-b pb-1 mb-2">3. Financials & Claims</div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Actual Amount Claim</label><input type="number" className="border p-2 rounded dark:bg-gray-800" value={form.actualAmountClaim||''} onChange={e=>setForm({...form, actualAmountClaim: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Total Expenses (Own)</label><input type="number" className="border p-2 rounded dark:bg-gray-800" value={form.totalExpensesOwn||''} onChange={e=>setForm({...form, totalExpensesOwn: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Total Expenses (3rd Party)</label><input type="number" className="border p-2 rounded dark:bg-gray-800" value={form.totalExpensesThirdParty||''} onChange={e=>setForm({...form, totalExpensesThirdParty: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Personnel Claim</label><input type="number" className="border p-2 rounded dark:bg-gray-800" value={form.personelClaim||''} onChange={e=>setForm({...form, personelClaim: Number(e.target.value)})} /></div>
                        
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Received (Own)</label><input type="date" className="border p-2 rounded dark:bg-gray-800" value={form.dateReceivedOwn||''} onChange={e=>setForm({...form, dateReceivedOwn: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Received (3rd Party)</label><input type="date" className="border p-2 rounded dark:bg-gray-800" value={form.dateReceivedThirdParty||''} onChange={e=>setForm({...form, dateReceivedThirdParty: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Received (Personnel)</label><input type="date" className="border p-2 rounded dark:bg-gray-800" value={form.dateReceivedPersonel||''} onChange={e=>setForm({...form, dateReceivedPersonel: e.target.value})} /></div>
                    </div>

                    {/* Cargo Insurance Specifics */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
                        <div className="col-span-4 font-bold text-orange-800 dark:text-orange-400 uppercase border-b pb-1 mb-2">4. Cargo Insurance Specifics</div>
                        <div className="col-span-2 flex flex-col"><label className="font-bold mb-1">Client Items (Details)</label><input className="border p-2 rounded dark:bg-gray-700" value={form.cargoClaimItems||''} onChange={e=>setForm({...form, cargoClaimItems: e.target.value})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Client Total Amt Claim</label><input type="number" className="border p-2 rounded dark:bg-gray-700" value={form.clientTotalAmountClaim||''} onChange={e=>setForm({...form, clientTotalAmountClaim: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Actual Ins. Amt Claim</label><input type="number" className="border p-2 rounded dark:bg-gray-700" value={form.actualInsuranceAmountClaim||''} onChange={e=>setForm({...form, actualInsuranceAmountClaim: Number(e.target.value)})} /></div>
                        <div className="flex flex-col"><label className="font-bold mb-1">Date Received (Cargo)</label><input type="date" className="border p-2 rounded dark:bg-gray-700" value={form.dateReceivedCargo||''} onChange={e=>setForm({...form, dateReceivedCargo: e.target.value})} /></div>
                        <div className="col-span-3 flex flex-col"><label className="font-bold mb-1">Cash / Check Detail</label><input className="border p-2 rounded dark:bg-gray-700" value={form.cashCheckDetail||''} onChange={e=>setForm({...form, cashCheckDetail: e.target.value})} /></div>
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={handleSave} className="bg-orange-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-orange-700">Save Claim Record</button>
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
