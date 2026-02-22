
import React, { useState } from 'react';
import { AppData, Holiday } from '../types';
import { fbService } from '../services/firebase';
import { Modal } from '../components/Modal';
import { Plus, Trash2 } from '../components/Icons';
import { fmtDate } from '../utils';

interface Props {
    data: AppData;
}

export const HRHolidays: React.FC<Props> = ({ data }) => {
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<Holiday>>({
        date: new Date().toISOString().split('T')[0],
        type: 'Regular'
    });
    const currentYear = new Date().getFullYear();

    const holidays = (data.holidays || [])
        .filter(h => new Date(h.date).getFullYear() === currentYear)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const handleSave = async () => {
        if (!form.date || !form.description) {
            alert("Please fill in all fields.");
            return;
        }
        await fbService.add('holidays', form);
        setModal(false);
        setForm({ date: new Date().toISOString().split('T')[0], type: 'Regular', description: '' });
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this holiday?")) {
            await fbService.remove('holidays', id);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg dark:text-gray-200">Holidays ({currentYear})</h3>
                <button onClick={()=>setModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded flex gap-2 font-bold shadow-sm hover:bg-teal-700">
                    <Plus/> Add Holiday
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-teal-800 text-white">
                        <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">Type</th>
                            <th className="p-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {holidays.length === 0 ? (
                            <tr><td colSpan={4} className="p-6 text-center text-gray-500 italic">No holidays encoded for this year.</td></tr>
                        ) : (
                            holidays.map(h => (
                                <tr key={h.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                    <td className="p-3 font-bold">{fmtDate(h.date)}</td>
                                    <td className="p-3">{h.description}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${h.type === 'Regular' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'}`}>
                                            {h.type}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button onClick={()=>handleDelete(h.id)} className="text-red-600 hover:text-red-800"><Trash2/></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modal} onClose={()=>setModal(false)} title="Add Holiday">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold mb-1 dark:text-gray-300">Date</label>
                        <input type="date" className="border p-2 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 dark:text-gray-300">Type</label>
                        <select className="border p-2 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={form.type} onChange={e=>setForm({...form, type: e.target.value as any})}>
                            <option value="Regular">Regular Holiday</option>
                            <option value="Special Non-Working">Special Non-Working Holiday</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 dark:text-gray-300">Description</label>
                        <input className="border p-2 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" placeholder="e.g. New Year's Day" value={form.description||''} onChange={e=>setForm({...form, description: e.target.value})} />
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-xs text-gray-600 italic border dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400">
                        <strong>Payroll Adjustment:</strong><br/>
                        • Regular: 100% pay if rest day/unworked, 200% if worked.<br/>
                        • Special Non-Working: No pay if rest day/unworked, 130% if worked.
                    </div>
                    <button onClick={handleSave} className="bg-teal-600 text-white w-full py-2 rounded font-bold hover:bg-teal-700 mt-2">Save Holiday</button>
                </div>
            </Modal>
        </div>
    );
};
