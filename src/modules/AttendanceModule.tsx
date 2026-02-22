
import React, { useState } from 'react';
import { AppData, AttendanceRecord, OvertimeRecord, UndertimeRecord, UserAccount } from '../types';
import { fbService } from '../services/firebase';
import { Modal } from '../components/Modal';
import { Plus, Trash2, Printer, FileText } from '../components/Icons';
import { fmtMoney, fmtDate, exportToExcel, exportToPDF, getAllowedNames } from '../utils';
import { AdminAllowanceTab } from './AdminAllowanceTab';
import { PetServiceTab } from './PetServiceTab';

interface Props {
    data: AppData;
    subTab: string;
    setSubTab: (t: string) => void;
    currentUser: UserAccount;
}

export const AttendanceModule: React.FC<Props> = ({ data, subTab, setSubTab, currentUser }) => {
    const [search, setSearch] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [otModal, setOtModal] = useState(false);
    const [otForm, setOtForm] = useState<Partial<OvertimeRecord>>({});
    const [utModal, setUtModal] = useState(false);
    const [utForm, setUtForm] = useState<Partial<UndertimeRecord>>({});
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    const filterEmployees = (employees: any[], path: string) => {
        const allowed = getAllowedNames(currentUser, path);
        if (!allowed) return employees;
        return employees.filter(e => allowed.includes(e.name));
    };

    const filterRecords = (records: any[], path: string) => {
        const allowed = getAllowedNames(currentUser, path);
        if (!allowed) return records;
        return records.filter(r => {
            const emp = data.employees.find(e => e.id === r.employeeId);
            return emp && allowed.includes(emp.name);
        });
    };

    const handleAttendance = async (empId: string, status: AttendanceRecord['status'], dailyRate: number) => {
        const docId = `${date}_${empId}`;
        const existing = data.attendance.find(a => a.date === date && a.employeeId === empId);

        // Toggle logic: Unclick if already selected
        if (existing && existing.status === status) {
            await fbService.remove('attendance', existing.id);
            return;
        }

        let val = dailyRate;
        if (status === 'Absent' || status === 'Rest Day') val = 0;
        if (status === 'Half-Day') val = dailyRate / 2;

        const record: AttendanceRecord = { 
            id: docId, 
            date: date, 
            employeeId: empId, 
            status: status, 
            computedPay: val 
        };

        // Clean up duplicates if any
        const duplicates = data.attendance.filter(a => a.date === date && a.employeeId === empId && a.id !== docId);
        if (duplicates.length > 0) {
            await Promise.all(duplicates.map(d => fbService.remove('attendance', d.id)));
        }
        await fbService.set('attendance', docId, record);
    };

    const handleSaveOT = async () => { /* Same logic */ const emp = data.employees.find(e => e.id === otForm.employeeId); if(!emp) return; const hourlyRate = (emp.dailyRate || 0) / 8; let amount = 0; const hours = Number(otForm.hours) || 0; if (otForm.type === 'Regular') { amount = hours * hourlyRate * 1.25; } else if (otForm.type === 'RestDay/Special') { amount = hours * hourlyRate * 1.69; } else if (otForm.type === 'RegularHoliday') { amount = hours * hourlyRate * 2.30; } const record = { ...otForm, amount, date: otForm.date || date }; if (record.id) await fbService.update('ot_records', record.id, record); else await fbService.add('ot_records', record); setOtModal(false); };
    const handleSaveUt = async () => { /* Same logic */ const emp = data.employees.find(e => e.id === utForm.employeeId); if(!emp) return; const minuteRate = (emp.dailyRate || 0) / 8 / 60; const amount = (Number(utForm.minutes) || 0) * minuteRate; const record = { ...utForm, amount, date: utForm.date || date }; if (record.id) await fbService.update('undertime_records', record.id, record); else await fbService.add('undertime_records', record); setUtModal(false); };
    const confirmDelete = async () => { if (deleteConfirm) { await fbService.remove(deleteConfirm.collection, deleteConfirm.id); setDeleteConfirm(null); } };

    // Exports
    const exportAttendance = (excel=false) => {
        const attData = data.employees.map(e => { const att = data.attendance.find(a => a.date === date && a.employeeId === e.id); return { Name: e.name, Role: e.role, Date: date, Status: att?.status||'Pending', 'Daily Rate': e.dailyRate, Pay: att?.computedPay||0 }; });
        if(excel) return exportToExcel(attData, `Attendance_${date}`);
        const rows = attData.map(a => [a.Name, a.Role, a.Status, fmtMoney(a.Pay)]);
        exportToPDF(`Attendance_${date}`, ['Name', 'Role', 'Status', 'Pay'], rows);
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4 border-b pb-2 overflow-x-auto">
                {['daily', 'admin_allowance', 'pet_service', 'overtime', 'undertime'].filter(t => {
                    const pathMap: any = {
                        daily: 'attendance.daily',
                        admin_allowance: 'attendance.adminAllowance',
                        pet_service: 'attendance.petService',
                        overtime: 'attendance.overtime',
                        undertime: 'attendance.undertime'
                    };
                    // Check if the subtab itself is enabled (implied if the module is enabled, but we check scope)
                    const keys = pathMap[t].split('.');
                    let val = currentUser.permissions as any;
                    for (const k of keys) val = val?.[k];
                    return !!val || currentUser.permissions.accessAll;
                }).map(t => (
                    <button key={t} onClick={()=>setSubTab(t)} className={`font-bold capitalize px-4 py-2 rounded whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-700 ${subTab === t ? 'bg-teal-700 text-white' : 'text-gray-600 dark:text-gray-300'}`}>{t.replace('_', ' ')}</button>
                ))}
            </div>

            {subTab === 'daily' && (
                <div>
                    <div className="flex justify-between mb-4 bg-white dark:bg-gray-800 p-4 rounded shadow flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <label className="font-bold dark:text-gray-200">Date:</label>
                            <input type="date" className="border p-2 rounded" value={date} onChange={e=>setDate(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                             <button onClick={()=>exportAttendance(true)} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                             <button onClick={()=>exportAttendance(false)} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                             <input placeholder="Search employee..." className="border p-2 rounded" value={search} onChange={e=>setSearch(e.target.value)} />
                        </div>
                    </div>
                     {/* Table Render */}
                    <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-teal-700 text-white sticky top-0 z-10">
                                <tr><th className="p-3">Employee</th><th className="p-3">Role</th><th className="p-3">Daily Rate</th><th className="p-3 text-center">Status</th><th className="p-3 text-right">Computed Pay</th></tr>
                            </thead>
                            <tbody>{filterEmployees(data.employees, 'attendance.daily')
                        .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
                        .sort((a,b) => a.name.localeCompare(b.name))
                        .map(e => { const att = data.attendance.find(a => a.date === date && a.employeeId === e.id); const status = att?.status; return (<tr key={e.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"><td className="p-3 font-bold">{e.name}</td><td className="p-3">{e.role}</td><td className="p-3">{fmtMoney(e.dailyRate)}</td><td className="p-3 flex justify-center gap-2"><button onClick={()=>handleAttendance(e.id, 'Present', e.dailyRate)} className={`px-2 py-1 rounded text-xs border ${status==='Present' ? 'bg-green-600 text-white' : 'hover:bg-green-100 dark:hover:bg-green-900 dark:border-green-700'}`}>Present</button><button onClick={()=>handleAttendance(e.id, 'Half-Day', e.dailyRate)} className={`px-2 py-1 rounded text-xs border ${status==='Half-Day' ? 'bg-orange-500 text-white' : 'hover:bg-orange-100 dark:hover:bg-orange-900 dark:border-orange-700'}`}>Half-Day</button><button onClick={()=>handleAttendance(e.id, 'Absent', e.dailyRate)} className={`px-2 py-1 rounded text-xs border ${status==='Absent' ? 'bg-red-600 text-white' : 'hover:bg-red-100 dark:hover:bg-red-900 dark:border-red-700'}`}>Absent</button><button onClick={()=>handleAttendance(e.id, 'Rest Day', e.dailyRate)} className={`px-2 py-1 rounded text-xs border ${status==='Rest Day' ? 'bg-gray-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-500'}`}>Rest Day</button></td><td className="p-3 text-right font-bold text-teal-700 dark:text-teal-400">{fmtMoney(att?.computedPay)}</td></tr>); })}</tbody></table></div>
                </div>
            )}
            
            {subTab === 'admin_allowance' && <AdminAllowanceTab data={data} currentUser={currentUser} />}
            {subTab === 'pet_service' && <PetServiceTab data={data} currentUser={currentUser} />}

            {subTab === 'overtime' && (<div><div className="flex justify-between mb-4"><h3 className="font-bold text-lg dark:text-gray-200">Overtime Records</h3><button onClick={()=>{setOtForm({ date: date }); setOtModal(true)}} className="bg-blue-600 text-white px-4 py-2 rounded flex gap-2"><Plus/> Add Overtime</button></div><div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}><table className="w-full text-sm text-left"><thead className="bg-blue-800 text-white sticky top-0 z-10"><tr><th className="p-3">Date</th><th className="p-3">Employee</th><th className="p-3">Type</th><th className="p-3 text-center">Hours</th><th className="p-3 text-right">Amount</th><th className="p-3"></th></tr></thead><tbody>{filterRecords(data.ot_records, 'attendance.overtime').sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(ot => (<tr key={ot.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"><td className="p-3">{fmtDate(ot.date)}</td><td className="p-3 font-bold">{data.employees.find(e=>e.id===ot.employeeId)?.name}</td><td className="p-3">{ot.type}</td><td className="p-3 text-center">{ot.hours}</td><td className="p-3 text-right font-bold">{fmtMoney(ot.amount)}</td><td className="p-3 text-right"><button type="button" onClick={(e)=>{e.stopPropagation(); setDeleteConfirm({id: ot.id, collection: 'ot_records'})}} className="text-red-500"><Trash2/></button></td></tr>))}</tbody></table></div></div>)}
            {subTab === 'undertime' && (<div><div className="flex justify-between mb-4"><h3 className="font-bold text-lg dark:text-gray-200">Undertime Records</h3><button onClick={()=>{setUtForm({ date: date }); setUtModal(true)}} className="bg-red-600 text-white px-4 py-2 rounded flex gap-2"><Plus/> Add Undertime</button></div><div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}><table className="w-full text-sm text-left"><thead className="bg-red-800 text-white sticky top-0 z-10"><tr><th className="p-3">Date</th><th className="p-3">Employee</th><th className="p-3 text-center">Minutes</th><th className="p-3 text-right">Deduction</th><th className="p-3"></th></tr></thead><tbody>{filterRecords(data.undertime_records, 'attendance.undertime').sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(ut => (<tr key={ut.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"><td className="p-3">{fmtDate(ut.date)}</td><td className="p-3 font-bold">{data.employees.find(e=>e.id===ut.employeeId)?.name}</td><td className="p-3 text-center">{ut.minutes}</td><td className="p-3 text-right font-bold text-red-600 dark:text-red-400">-{fmtMoney(ut.amount)}</td><td className="p-3 text-right"><button type="button" onClick={(e)=>{e.stopPropagation(); setDeleteConfirm({id: ut.id, collection: 'undertime_records'})}} className="text-red-500"><Trash2/></button></td></tr>))}</tbody></table></div></div>)}
             <Modal isOpen={otModal} onClose={()=>setOtModal(false)} title="Add Overtime"><div className="grid gap-4"><input type="date" className="border p-2 rounded" value={otForm.date||''} onChange={e=>setOtForm({...otForm, date: e.target.value})} /><select className="border p-2 rounded" value={otForm.employeeId||''} onChange={e=>setOtForm({...otForm, employeeId: e.target.value})}><option>Select Employee</option>{filterEmployees(data.employees, 'attendance.overtime').map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
<div className="flex gap-2"><input type="number" placeholder="Hours" className="border p-2 rounded flex-1" value={otForm.hours||''} onChange={e=>setOtForm({...otForm, hours: Number(e.target.value)})} /></div><select className="border p-2 rounded" value={otForm.type||''} onChange={e=>setOtForm({...otForm, type: e.target.value as any})}><option value="">Select Type</option><option value="Regular">Regular Overtime (1.25)</option><option value="RestDay/Special">Rest Day / Special Holiday (1.69)</option><option value="RegularHoliday">Regular Holiday (2.30)</option></select><button onClick={handleSaveOT} className="bg-blue-600 text-white p-2 rounded">Save Overtime</button></div></Modal>
             <Modal isOpen={utModal} onClose={()=>setUtModal(false)} title="Add Undertime"><div className="grid gap-4"><input type="date" className="border p-2 rounded" value={utForm.date||''} onChange={e=>setUtForm({...utForm, date: e.target.value})} /><select className="border p-2 rounded" value={utForm.employeeId||''} onChange={e=>setUtForm({...utForm, employeeId: e.target.value})}><option>Select Employee</option>{filterEmployees(data.employees, 'attendance.undertime').map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><input type="number" placeholder="Minutes Late/Undertime" className="border p-2 rounded" value={utForm.minutes||''} onChange={e=>setUtForm({...utForm, minutes: Number(e.target.value)})} /><button onClick={handleSaveUt} className="bg-red-600 text-white p-2 rounded">Save Undertime</button></div></Modal>
             <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete"><div className="space-y-4 p-4"><p className="text-lg">Are you sure you want to delete this record?</p><div className="flex justify-end gap-2 mt-6"><button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button><button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button></div></div></Modal>
        </div>
    );
};
