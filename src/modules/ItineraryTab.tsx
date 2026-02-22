
import React, { useState } from 'react';
import { AppData, Itinerary, UserAccount } from '../types';
import { ItineraryForm } from './ItineraryForm';
import { Modal } from '../components/Modal';
import { Plus, Edit, Trash2, Printer } from '../components/Icons';
import { fbService } from '../services/firebaseConfig';
import { fmtDate, exportToPDF, getAllowedNames } from '../utils';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const ItineraryTab: React.FC<Props> = ({ data, currentUser }) => {
    const [search, setSearch] = useState('');
    const [itStart, setItStart] = useState(new Date().toISOString().slice(0, 8) + '01');
    const [itEnd, setItEnd] = useState(new Date().toISOString().split('T')[0]);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<Itinerary>>({ segments: [] });
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    const filteredItineraries = data.itineraries
        .filter(it => it.date >= itStart && it.date <= itEnd)
        .filter(it => {
            const allowed = getAllowedNames(currentUser, 'tripMonitor.itinerary');
            if (!allowed) return true;
            return allowed.includes(it.driver) || allowed.includes(it.helper);
        })
        .filter(it => 
            it.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
            it.driver.toLowerCase().includes(search.toLowerCase()) ||
            it.helper.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a,b)=>new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleSave = async () => {
        if(form.id) await fbService.update('itineraries', form.id, form);
        else await fbService.add('itineraries', form);
        setModal(false);
    };

    const handleExportPDF = () => {
        const rows = filteredItineraries.map(it => [
            fmtDate(it.date), 
            it.plateNumber, 
            it.driver, 
            it.helper, 
            String(it.segments?.filter(s=>s.type==='Trip').length || 0), 
            String(it.segments?.filter(s=>s.type==='Backload').length || 0)
        ]);
        exportToPDF('Itinerary_List', ['Date', 'Plate', 'Driver', 'Helper', 'Trips', 'Backloads'], rows, 'l');
    };

    const confirmDelete = async () => { if (deleteConfirm) { await fbService.remove(deleteConfirm.collection, deleteConfirm.id); setDeleteConfirm(null); } };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-4 bg-white dark:bg-gray-800 p-4 rounded shadow no-print">
                <div className="flex items-center gap-3 text-sm">
                    <span className="font-bold dark:text-gray-300">Period:</span>
                    <input type="date" className="border p-2 rounded dark:bg-gray-700" value={itStart} onChange={e=>setItStart(e.target.value)} />
                    <span className="dark:text-gray-300 font-bold">to</span>
                    <input type="date" className="border p-2 rounded dark:bg-gray-700" value={itEnd} onChange={e=>setItEnd(e.target.value)} />
                </div>
                <div className="flex gap-2 items-center">
                    <button onClick={handleExportPDF} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF Report</button>
                    <input placeholder="Search Plate/Personnel..." className="border p-2 rounded dark:bg-gray-700 text-sm w-48" value={search} onChange={e=>setSearch(e.target.value)} />
                    <button onClick={()=>{setForm({ segments: [] }); setModal(true)}} className="bg-blue-600 text-white px-4 py-2 rounded flex gap-2 text-sm items-center hover:bg-blue-700 transition-colors"><Plus/> Create Itinerary</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-blue-800 text-white">
                        <tr><th className="p-3">Date</th><th className="p-3">Plate</th><th className="p-3">Driver</th><th className="p-3">Helper</th><th className="p-3 text-center">Trips</th><th className="p-3 text-center">Backloads</th><th className="p-3 text-center">Actions</th></tr>
                    </thead>
                    <tbody>
                        {filteredItineraries.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-500 italic">No itineraries found for this period.</td></tr>
                        ) : (
                            filteredItineraries.map(it => (
                                <tr key={it.id} className="border-b dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-700">
                                    <td className="p-3">{fmtDate(it.date)}</td>
                                    <td className="p-3 font-bold">{it.plateNumber}</td>
                                    <td className="p-3">{it.driver}</td>
                                    <td className="p-3">{it.helper}</td>
                                    <td className="p-3 text-center font-mono">{it.segments?.filter(s=>s.type==='Trip').length || 0}</td>
                                    <td className="p-3 text-center font-mono">{it.segments?.filter(s=>s.type==='Backload').length || 0}</td>
                                    <td className="p-3 text-center flex justify-center gap-3">
                                        <button onClick={()=>{setForm(it); setModal(true)}} className="text-blue-600 hover:text-blue-800" title="Edit"><Edit/></button>
                                        <button onClick={()=>setDeleteConfirm({id: it.id, collection: 'itineraries'})} className="text-red-600 hover:text-red-800" title="Delete"><Trash2/></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete">
                <div className="space-y-4 p-4">
                    <p className="text-lg">Are you sure you want to delete this itinerary?</p>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={modal} onClose={()=>setModal(false)} title={form.id ? "Edit Itinerary" : "Create Itinerary"} large>
                <ItineraryForm data={data} form={form} setForm={setForm} onSave={handleSave} />
            </Modal>
        </div>
    );
};
