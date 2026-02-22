
import React, { useState } from 'react';
import { AppData, Client } from '../types';
import { fbService } from '../services/firebase';
import { Modal } from '../components/Modal';
import { Plus, Edit, Trash2, Printer, FileText } from '../components/Icons';
import { exportToExcel, exportToPDF } from '../utils';

interface Props {
    data: AppData;
}

export const ClientModule: React.FC<Props> = ({ data }) => {
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<Client>>({});
    const [search, setSearch] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    const handleSave = async () => { /* Same logic */ const cleanForm = { ...form, vatExPercent: Number(form.vatExPercent) || 0, withheldPercent: Number(form.withheldPercent) || 0, vat2551qPercent: Number(form.vat2551qPercent) || 0, jetsPercent: Number(form.jetsPercent) || 0, jbfPercent: Number(form.jbfPercent) || 0, deductionDropThreshold: Number(form.deductionDropThreshold) || 0, isVatEnabled: form.isVatEnabled !== false }; if(form.id) await fbService.update('clients', form.id, cleanForm); else await fbService.add('clients', cleanForm); setModal(false); };
    const confirmDelete = async () => { if (deleteConfirm) { await fbService.remove(deleteConfirm.collection, deleteConfirm.id); setDeleteConfirm(null); } };

    const exportClients = (excel=false) => {
        const list = data.clients.map(c => ({ 
            Name: c.name, 
            TIN: c.tin, 
            Address: c.address, 
            Contact: c.contact, 
            VAT: c.isVatEnabled!==false?'Yes':'No',
            'Withheld %': c.withheldPercent,
            '2551Q %': c.vat2551qPercent,
            'JETS %': c.jetsPercent,
            'JBF %': c.jbfPercent,
            'Drop Threshold': c.deductionDropThreshold
        }));
        if(excel) return exportToExcel(list, 'Client_List');
        const rows = list.map(c => [c.Name, c.TIN||'-', c.Address||'-', c.Contact||'-', c.VAT]);
        exportToPDF('Client_List', ['Name', 'TIN', 'Address', 'Contact', 'VAT'], rows);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-400">Client Management</h2>
                <div className="flex gap-2">
                     <button onClick={()=>exportClients(true)} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                     <button onClick={()=>exportClients(false)} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                    <input placeholder="Search clients..." className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={search} onChange={e=>setSearch(e.target.value)} />
                    <button onClick={()=>{setForm({ isVatEnabled: true }); setModal(true)}} className="bg-teal-600 text-white px-4 py-2 rounded flex gap-2"><Plus/> Add Client</button>
                </div>
            </div>
             {/* Table Render */}
             <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}><table className="w-full text-sm text-left"><thead className="bg-teal-700 text-white sticky top-0 z-10"><tr><th className="p-3">Client Name</th><th className="p-3">TIN Number</th><th className="p-3">Address</th><th className="p-3">Contact</th><th className="p-3 text-center">Config</th><th className="p-3">Actions</th></tr></thead><tbody>{(data.clients||[]).filter(c=>c.name?.toLowerCase().includes(search.toLowerCase())).map(c => (<tr key={c.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"><td className="p-3 font-bold">{c.name}</td><td className="p-3">{c.tin || '-'}</td><td className="p-3">{c.address || '-'}</td><td className="p-3">{c.contact || '-'}</td><td className="p-3 text-center text-xs space-y-1"><div className="flex flex-wrap gap-1 justify-center"><span className={`px-1 rounded ${c.isVatEnabled !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>VAT: {c.isVatEnabled !== false ? 'ON' : 'OFF'}</span>{c.deductionDropThreshold ? <span className="bg-orange-100 px-1 rounded text-orange-800">Min Drop: {c.deductionDropThreshold}</span> : null}</div><div className="text-gray-500 dark:text-gray-400">WH:{c.withheldPercent}% | 2251:{c.vat2551qPercent}% | JETS:{c.jetsPercent}% | JBF:{c.jbfPercent}%</div></td><td className="p-3 flex gap-2"><button type="button" onClick={(e)=>{e.stopPropagation(); setForm(c); setModal(true)}} className="text-blue-600 dark:text-blue-400"><Edit/></button><button type="button" onClick={(e)=>{e.stopPropagation(); setDeleteConfirm({id: c.id, collection: 'clients'})}} className="text-red-600 hover:text-red-800"><Trash2/></button></td></tr>))}</tbody></table></div>
             {/* Modals same as before */}
             <Modal isOpen={modal} onClose={()=>setModal(false)} title="Client Details"><div className="grid gap-4"><div className="grid grid-cols-2 gap-4"><input placeholder="Client Name" className="border p-2 rounded" value={form.name||''} onChange={e=>setForm({...form, name: e.target.value})} /><input placeholder="TIN Number" className="border p-2 rounded" value={form.tin||''} onChange={e=>setForm({...form, tin: e.target.value})} /></div><input placeholder="Address" className="border p-2 rounded" value={form.address||''} onChange={e=>setForm({...form, address: e.target.value})} /><input placeholder="Contact Person/Number" className="border p-2 rounded" value={form.contact||''} onChange={e=>setForm({...form, contact: e.target.value})} /><div className="border-t pt-2 mt-2 bg-gray-50 dark:bg-gray-900 p-3 rounded"><h4 className="font-bold text-teal-800 dark:text-teal-400 mb-2">Billing & Deduction Config</h4><div className="flex gap-4 mb-4 items-center"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isVatEnabled !== false} onChange={e=>setForm({...form, isVatEnabled: e.target.checked})} className="w-4 h-4"/><span className="font-bold text-sm text-gray-700 dark:text-gray-300">VAT Enabled</span></label><div className="flex items-center gap-2 border-l pl-4 dark:border-gray-600"><label className="text-xs font-bold text-gray-700 dark:text-gray-300">Start Deductions at Drop #:</label><input type="number" className="border p-1 rounded w-16 dark:bg-gray-800 dark:border-gray-700" value={form.deductionDropThreshold||''} onChange={e=>setForm({...form, deductionDropThreshold: Number(e.target.value)})} placeholder="0"/></div></div><div className="grid grid-cols-5 gap-2"><div><label className="text-xs text-gray-500 dark:text-gray-400">VAT-EX (Div)</label><input type="number" className="border p-2 rounded w-full bg-gray-100 dark:bg-gray-800 dark:border-gray-700" value={form.vatExPercent||'1.12'} disabled title="Standard 1.12" /></div><div><label className="text-xs text-gray-500 dark:text-gray-400">Withheld %</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700" value={form.withheldPercent||''} onChange={e=>setForm({...form, withheldPercent: Number(e.target.value)})} /></div><div><label className="text-xs text-gray-500 dark:text-gray-400">2251Q %</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700" value={form.vat2551qPercent||''} onChange={e=>setForm({...form, vat2551qPercent: Number(e.target.value)})} /></div><div><label className="text-xs text-gray-500 dark:text-gray-400">JETS %</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700" value={form.jetsPercent||''} onChange={e=>setForm({...form, jetsPercent: Number(e.target.value)})} /></div><div><label className="text-xs text-gray-500 dark:text-gray-400">JBF %</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700" value={form.jbfPercent||''} onChange={e=>setForm({...form, jbfPercent: Number(e.target.value)})} /></div></div></div><button onClick={handleSave} className="bg-teal-600 text-white p-2 rounded mt-2">Save Client</button></div></Modal>
             <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete"><div className="space-y-4 p-4"><p className="text-lg">Are you sure you want to delete this record?</p><div className="flex justify-end gap-2 mt-6"><button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button><button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button></div></div></Modal>
        </div>
    );
};
