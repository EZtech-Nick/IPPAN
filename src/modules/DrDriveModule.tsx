
import React, { useState } from 'react';
import { AppData, DrDriveJob } from '../types';
import { Modal } from '../components/Modal';
import { Plus, Edit, Trash2, Printer } from '../components/Icons';
import { fmtDate, fmtMoney } from '../utils';
import { fbService } from '../services/firebaseConfig';
import { DrDriveForm } from './DrDriveForm';

interface Props {
    data: AppData;
}

export const DrDriveModule: React.FC<Props> = ({ data }) => {
    const [search, setSearch] = useState('');
    const [dateStart, setDateStart] = useState(new Date().toISOString().slice(0, 8) + '01');
    const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);
    
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<DrDriveJob>>({});
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    const filteredJobs = (data.dr_drive_jobs || [])
        .filter(j => j.date >= dateStart && j.date <= dateEnd)
        .filter(j => 
            j.customerName.toLowerCase().includes(search.toLowerCase()) || 
            j.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
            j.invoiceNo.includes(search)
        )
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleCreateJob = () => {
        // Auto gen Invoice No
        const now = new Date();
        const yymm = now.getFullYear().toString().substr(-2) + (now.getMonth()+1).toString().padStart(2, '0');
        const count = (data.dr_drive_jobs || []).length + 1;
        const invoiceNo = `DR-${yymm}-${count.toString().padStart(4, '0')}`;
        
        setForm({
            date: new Date().toISOString().split('T')[0],
            invoiceNo,
            jobOrderNo: `JO-${yymm}-${count.toString().padStart(3, '0')}`,
            parts: [],
            services: [],
            totalParts: 0,
            totalLabor: 0,
            grandTotal: 0,
            status: 'Pending',
            issuedBy: 'Admin',
            receivedBy: ''
        });
        setModal(true);
    };

    const confirmDelete = async () => {
        if (deleteConfirm) {
            await fbService.remove(deleteConfirm.collection, deleteConfirm.id);
            setDeleteConfirm(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded shadow flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 uppercase">Dr. Drive</h2>
                    <div className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded border dark:border-gray-600">
                        <span className="font-bold dark:text-gray-300">Period:</span>
                        <input type="date" className="border p-1 rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200" value={dateStart} onChange={e=>setDateStart(e.target.value)} />
                        <span className="dark:text-gray-300">to</span>
                        <input type="date" className="border p-1 rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} />
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <input 
                        placeholder="Search Invoice/Customer..." 
                        className="border p-2 rounded w-64 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                        value={search} 
                        onChange={e=>setSearch(e.target.value)} 
                    />
                    <button onClick={handleCreateJob} className="bg-red-600 text-white px-4 py-2 rounded flex gap-2 hover:bg-red-700 font-bold shadow"><Plus/> New Job Order</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-800 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Invoice No</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Plate No.</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Parts</th>
                            <th className="p-3 text-right">Labor</th>
                            <th className="p-3 text-right">Total</th>
                            <th className="p-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredJobs.length === 0 ? (
                            <tr><td colSpan={9} className="p-8 text-center text-gray-500 italic">No job orders found.</td></tr>
                        ) : (
                            filteredJobs.map(job => (
                                <tr key={job.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                    <td className="p-3 font-mono font-bold">{job.invoiceNo}</td>
                                    <td className="p-3">{fmtDate(job.date)}</td>
                                    <td className="p-3 font-bold">{job.customerName}</td>
                                    <td className="p-3">{job.plateNumber}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${job.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">{fmtMoney(job.totalParts)}</td>
                                    <td className="p-3 text-right">{fmtMoney(job.totalLabor)}</td>
                                    <td className="p-3 text-right font-bold text-red-600 dark:text-red-400">{fmtMoney(job.grandTotal)}</td>
                                    <td className="p-3 text-center flex justify-center gap-2">
                                        <button onClick={()=>{setForm(job); setModal(true)}} className="text-blue-600 dark:text-blue-400 hover:text-blue-800"><Edit/></button>
                                        <button onClick={()=>setDeleteConfirm({id: job.id, collection: 'dr_drive_jobs'})} className="text-red-600 hover:text-red-800"><Trash2/></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete">
                <div className="space-y-4 p-4">
                    <p className="text-lg">Are you sure you want to delete this Job Order?</p>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={modal} onClose={()=>setModal(false)} title="Dr. Drive Job Order & POS" large>
                <DrDriveForm 
                    data={data} 
                    form={form} 
                    setForm={setForm} 
                    onClose={()=>setModal(false)} 
                />
            </Modal>
        </div>
    );
};
