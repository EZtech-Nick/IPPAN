
import React, { useState, useEffect } from 'react';
import { AppData, Employee, UserAccount } from '../types';
import { Plus, Edit, Trash2, FileText } from '../components/Icons';
import { fmtDate, fmtMoney, exportToExcel, getAllowedNames } from '../utils';
import { Modal } from '../components/Modal';
import { fbService } from '../services/firebaseConfig';

interface Props {
    data: AppData;
    search: string;
    currentUser: UserAccount;
    onDelete: (id: string) => void;
}

export const HREmployeeProfile: React.FC<Props> = ({ data, search, currentUser, onDelete }) => {
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<Employee>>({ status: 'Active', role: 'Driver' });

    // Auto-calculate Age
    useEffect(() => {
        if (form.birthday) {
            const birth = new Date(form.birthday);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            if (form.age !== age) setForm(prev => ({ ...prev, age }));
        }
    }, [form.birthday]);

    const handleSaveEmp = async () => {
        const dailyRate = Number(form.dailyRate) || 0;
        const monthlyRate = dailyRate * 26;

        const cleanForm = { 
            ...form, 
            dailyRate: dailyRate,
            rate: monthlyRate, 
            sss: Number(form.sss)||0, 
            philhealth: Number(form.philhealth)||0, 
            pagibig: Number(form.pagibig)||0, 
            mp2: Number(form.mp2)||0, 
            otherDeduction: Number(form.otherDeduction)||0, 
            uniformDed: Number(form.uniformDed)||0, 
            officeCA: Number(form.officeCA)||0, 
            sssLoan: Number(form.sssLoan)||0, 
            pagibigLoan: Number(form.pagibigLoan)||0, 
            age: Number(form.age)||0 
        };

        if(form.id) await fbService.update('employees', form.id, cleanForm);
        else await fbService.add('employees', { ...cleanForm, cashAdvance: 0, loans: [], caHistory: [] });
        setModal(false);
    };

    const filtered = data.employees
        .filter(e => {
            const allowed = getAllowedNames(currentUser, 'hr.profile201');
            return !allowed || allowed.includes(e.name);
        })
        .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    const stats = {
        active: data.employees.filter(e => e.status === 'Active').length,
        probation: data.employees.filter(e => e.status === 'Probation').length,
        resigned: data.employees.filter(e => e.status === 'Resigned').length,
        suspended: data.employees.filter(e => e.status === 'Suspended').length
    };

    const handleExportExcel = () => {
        // Export ALL employees, ignoring search filter
        const allEmployees = [...data.employees].sort((a, b) => a.name.localeCompare(b.name));
        const exportData = allEmployees.map(e => ({
            'Name': e.name,
            'Role': e.role,
            'Status': e.status,
            'Date Hired': fmtDate(e.dateHired),
            'Birthday': fmtDate(e.birthday),
            'Age': e.age,
            'Mobile': e.mobile,
            'Address': e.address,
            'License No': e.licenseNo,
            'License Exp': fmtDate(e.licenseExp),
            'SPX ID': e.spxId,
            'SPX Pass': e.spxPass,
            'JAY-ED ID': e.jayEdId,
            'JBF ID': e.jbfId,
            'Company ID': e.companyId,
            'ID Type': e.idType,
            'ID No': e.idNumber,
            'ID Exp': fmtDate(e.idExpiration),
            'Emergency Contact': e.emergencyContact,
            'Emergency Mobile': e.emergencyMobile,
            'TIN': e.tinNo,
            'SSS': e.sssNo,
            'PhilHealth': e.philhealthNo,
            'PagIbig': e.pagibigNo,
            'NBI': e.nbi,
            'NBI Exp': fmtDate(e.nbiExp),
            'Drug Test': fmtDate(e.drugTest),
            'Brgy Clearance': fmtDate(e.brgyClearance),
            'Police Clearance': fmtDate(e.policeClearance),
            'Date Resigned': fmtDate(e.dateResigned),
            'Daily Rate': e.dailyRate,
            'SSS Ded': e.sss,
            'PhilHealth Ded': e.philhealth,
            'PagIbig Ded': e.pagibig,
            'MP2 Ded': e.mp2
        }));
        exportToExcel(exportData, 'Employee_201_Profile');
    };

    return (
        <div className="animate-in fade-in duration-300">
            {/* Status Counts */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 dark:bg-green-900 border-l-4 border-green-500 p-3 rounded shadow">
                    <div className="text-xs uppercase text-green-800 dark:text-green-300 font-bold">Active</div>
                    <div className="text-xl font-bold text-green-900 dark:text-green-100">{stats.active}</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900 border-l-4 border-orange-500 p-3 rounded shadow">
                    <div className="text-xs uppercase text-orange-800 dark:text-orange-300 font-bold">Probation</div>
                    <div className="text-xl font-bold text-orange-900 dark:text-orange-100">{stats.probation}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-500 p-3 rounded shadow">
                    <div className="text-xs uppercase text-red-800 dark:text-red-300 font-bold">Resigned</div>
                    <div className="text-xl font-bold text-red-900 dark:text-red-100">{stats.resigned}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 border-l-4 border-gray-500 p-3 rounded shadow">
                    <div className="text-xs uppercase text-gray-800 dark:text-gray-300 font-bold">Suspended</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.suspended}</div>
                </div>
            </div>

            <div className="flex justify-between mb-4 flex-wrap gap-2">
                <div className="flex gap-2">
                     <button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-2 rounded flex gap-2 font-bold shadow-sm hover:bg-green-700 text-sm items-center">
                        <FileText className="w-4 h-4"/> Export Excel
                    </button>
                     <button onClick={()=>{setForm({status:'Active', role:'Driver'}); setModal(true)}} className="bg-teal-600 text-white px-4 py-2 rounded flex gap-2 font-bold shadow-sm hover:bg-teal-700">
                        <Plus/> Add Employee
                    </button>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-[10px] text-left whitespace-nowrap border-collapse">
                    <thead className="bg-teal-800 text-white sticky top-0 uppercase z-10">
                        <tr>
                            <th className="p-2 border sticky left-0 bg-teal-800 z-20">Name</th>
                            <th className="p-2 border">Position</th>
                            <th className="p-2 border">Date Hired</th>
                            <th className="p-2 border">Lic. No.</th>
                            <th className="p-2 border">Lic. Exp.</th>
                            <th className="p-2 border">SPX ID</th>
                            <th className="p-2 border">SPX Pass</th>
                            <th className="p-2 border">Age</th>
                            <th className="p-2 border">Birthday</th>
                            <th className="p-2 border">Status</th>
                            <th className="p-2 border">JAY-ED ID</th>
                            <th className="p-2 border">JBF ID</th>
                            <th className="p-2 border">Company ID</th>
                            <th className="p-2 border">Mobile</th>
                            <th className="p-2 border">Address</th>
                            <th className="p-2 border">ID Type</th>
                            <th className="p-2 border">ID No.</th>
                            <th className="p-2 border">ID Exp.</th>
                            <th className="p-2 border">Emergency Contact</th>
                            <th className="p-2 border">Emergency Mobile</th>
                            <th className="p-2 border">TIN</th>
                            <th className="p-2 border">SSS</th>
                            <th className="p-2 border">PhilHealth</th>
                            <th className="p-2 border">Pag-Ibig</th>
                            <th className="p-2 border">NBI</th>
                            <th className="p-2 border">NBI Exp.</th>
                            <th className="p-2 border">Drug Test</th>
                            <th className="p-2 border">Brgy Clearance</th>
                            <th className="p-2 border">Police Clearance</th>
                            <th className="p-2 border">Date Resigned</th>
                            <th className="p-2 border sticky right-0 bg-teal-900 text-center z-20">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(e => (
                            <tr key={e.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">
                                <td className="p-2 border font-bold sticky left-0 bg-white dark:bg-gray-800">{e.name}</td>
                                <td className="p-2 border">{e.role}</td>
                                <td className="p-2 border">{fmtDate(e.dateHired)}</td>
                                <td className="p-2 border font-mono">{e.licenseNo || '-'}</td>
                                <td className="p-2 border">{fmtDate(e.licenseExp)}</td>
                                <td className="p-2 border font-mono">{e.spxId || '-'}</td>
                                <td className="p-2 border font-mono">{e.spxPass || '-'}</td>
                                <td className="p-2 border">{e.age || '-'}</td>
                                <td className="p-2 border">{fmtDate(e.birthday)}</td>
                                <td className="p-2 border">
                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${e.status === 'Active' ? 'bg-green-100 text-green-700' : e.status === 'Probation' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                        {e.status}
                                    </span>
                                </td>
                                <td className="p-2 border font-mono">{e.jayEdId || '-'}</td>
                                <td className="p-2 border font-mono">{e.jbfId || '-'}</td>
                                <td className="p-2 border font-mono">{e.companyId || '-'}</td>
                                <td className="p-2 border">{e.mobile || '-'}</td>
                                <td className="p-2 border truncate max-w-[150px]" title={e.address}>{e.address || '-'}</td>
                                <td className="p-2 border">{e.idType || '-'}</td>
                                <td className="p-2 border">{e.idNumber || '-'}</td>
                                <td className="p-2 border">{fmtDate(e.idExpiration)}</td>
                                <td className="p-2 border">{e.emergencyContact || '-'}</td>
                                <td className="p-2 border">{e.emergencyMobile || '-'}</td>
                                <td className="p-2 border font-mono">{e.tinNo || '-'}</td>
                                <td className="p-2 border font-mono">{e.sssNo || '-'}</td>
                                <td className="p-2 border font-mono">{e.philhealthNo || '-'}</td>
                                <td className="p-2 border font-mono">{e.pagibigNo || '-'}</td>
                                <td className="p-2 border">{e.nbi || '-'}</td>
                                <td className="p-2 border">{fmtDate(e.nbiExp)}</td>
                                <td className="p-2 border">{fmtDate(e.drugTest)}</td>
                                <td className="p-2 border">{fmtDate(e.brgyClearance)}</td>
                                <td className="p-2 border">{fmtDate(e.policeClearance)}</td>
                                <td className="p-2 border">{fmtDate(e.dateResigned)}</td>
                                <td className="p-2 border sticky right-0 bg-white dark:bg-gray-800 flex gap-1 justify-center z-10">
                                    <button onClick={()=>{setForm(e); setModal(true)}} className="text-blue-600 hover:text-blue-800"><Edit className="w-4 h-4"/></button>
                                    <button onClick={()=> onDelete(e.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modal} onClose={()=>setModal(false)} title="Employee Setup" large>
               <div className="space-y-4 text-[11px] overflow-y-auto max-h-[75vh] pr-2">
                    <div className="grid grid-cols-4 gap-x-4 gap-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-800">
                        <div className="col-span-4 font-bold text-teal-800 dark:text-teal-400 uppercase border-b pb-1 mb-2">1. Basic Information</div>
                        
                        <div className="col-span-2"><label className="font-bold block mb-1">Employee Name</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.name||''} onChange={e=>setForm({...form, name: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Position</label><select className="border p-2 rounded w-full dark:bg-gray-800" value={form.role||''} onChange={e=>setForm({...form, role: e.target.value as any})}><option value="Driver">Driver</option><option value="Helper">Helper</option><option value="Admin">Admin</option></select></div>
                        <div><label className="font-bold block mb-1">Date Hired</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.dateHired||''} onChange={e=>setForm({...form, dateHired: e.target.value})} /></div>

                        <div><label className="font-bold block mb-1">Driver's License No.</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.licenseNo||''} onChange={e=>setForm({...form, licenseNo: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">License Expiration</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.licenseExp||''} onChange={e=>setForm({...form, licenseExp: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Driver SPX ID</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.spxId||''} onChange={e=>setForm({...form, spxId: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Driver SPX Password</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.spxPass||''} onChange={e=>setForm({...form, spxPass: e.target.value})} /></div>

                        <div><label className="font-bold block mb-1">Age</label><input disabled className="border p-2 rounded w-full bg-gray-100 dark:bg-gray-800" value={form.age||''} /></div>
                        <div><label className="font-bold block mb-1">Birthday</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.birthday||''} onChange={e=>setForm({...form, birthday: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Status</label><select className="border p-2 rounded w-full dark:bg-gray-800" value={form.status||''} onChange={e=>setForm({...form, status: e.target.value as any})}><option value="Active">Active</option><option value="Resigned">Resigned</option><option value="Suspended">Suspended</option><option value="Probation">Probation</option></select></div>
                        <div><label className="font-bold block mb-1">Date Resigned</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.dateResigned||''} onChange={e=>setForm({...form, dateResigned: e.target.value})} /></div>

                        <div className="col-span-4 font-bold text-teal-800 dark:text-teal-400 uppercase border-b pb-1 mb-2 mt-2">2. ID Numbers & Contact</div>
                        
                        <div><label className="font-bold block mb-1">JAY-ED ID Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.jayEdId||''} onChange={e=>setForm({...form, jayEdId: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">JBF ID Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.jbfId||''} onChange={e=>setForm({...form, jbfId: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Company ID Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.companyId||''} onChange={e=>setForm({...form, companyId: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Mobile Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.mobile||''} onChange={e=>setForm({...form, mobile: e.target.value})} /></div>
                        
                        <div className="col-span-2"><label className="font-bold block mb-1">Address</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.address||''} onChange={e=>setForm({...form, address: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Other ID Type</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.idType||''} onChange={e=>setForm({...form, idType: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">ID Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.idNumber||''} onChange={e=>setForm({...form, idNumber: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">ID Expiration</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.idExpiration||''} onChange={e=>setForm({...form, idExpiration: e.target.value})} /></div>
                        
                        <div><label className="font-bold block mb-1">Person in case of emergency</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.emergencyContact||''} onChange={e=>setForm({...form, emergencyContact: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Emergency Mobile Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.emergencyMobile||''} onChange={e=>setForm({...form, emergencyMobile: e.target.value})} /></div>

                        <div className="col-span-4 font-bold text-teal-800 dark:text-teal-400 uppercase border-b pb-1 mb-2 mt-2">3. Government & Clearances</div>

                        <div><label className="font-bold block mb-1">TIN Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.tinNo||''} onChange={e=>setForm({...form, tinNo: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">SSS Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.sssNo||''} onChange={e=>setForm({...form, sssNo: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">PhilHealth Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.philhealthNo||''} onChange={e=>setForm({...form, philhealthNo: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Pag-Ibig Number</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.pagibigNo||''} onChange={e=>setForm({...form, pagibigNo: e.target.value})} /></div>

                        <div><label className="font-bold block mb-1">NBI</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.nbi||''} onChange={e=>setForm({...form, nbi: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">NBI Expiration</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.nbiExp||''} onChange={e=>setForm({...form, nbiExp: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Drug Test</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.drugTest||''} onChange={e=>setForm({...form, drugTest: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Barangay Clearance</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.brgyClearance||''} onChange={e=>setForm({...form, brgyClearance: e.target.value})} /></div>
                        <div><label className="font-bold block mb-1">Police Clearance</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.policeClearance||''} onChange={e=>setForm({...form, policeClearance: e.target.value})} /></div>

                        <div className="col-span-4 font-bold text-teal-800 dark:text-teal-400 uppercase border-b pb-1 mb-2 mt-2">4. Payroll Rates & Deductions</div>
                        
                        <div><label className="font-bold block mb-1">Daily Rate</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800 font-bold" value={form.dailyRate||''} onChange={e=>setForm({...form, dailyRate: Number(e.target.value)})} /><div className="text-[9px] text-gray-500 mt-1 dark:text-gray-400">~ {fmtMoney((Number(form.dailyRate)||0)*26)} Monthly</div></div>
                        <div><label className="text-[9px] uppercase font-bold text-red-600 block mb-0.5">SSS Deduction</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800" value={form.sss||''} onChange={e=>setForm({...form, sss: Number(e.target.value)})} /></div>
                        <div><label className="text-[9px] uppercase font-bold text-red-600 block mb-0.5">PhilHealth Deduction</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800" value={form.philhealth||''} onChange={e=>setForm({...form, philhealth: Number(e.target.value)})} /></div>
                        <div><label className="text-[9px] uppercase font-bold text-red-600 block mb-0.5">Pag-Ibig Deduction</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800" value={form.pagibig||''} onChange={e=>setForm({...form, pagibig: Number(e.target.value)})} /></div>
                        <div><label className="text-[9px] uppercase font-bold text-red-600 block mb-0.5">MP2 Deduction</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800" value={form.mp2||''} onChange={e=>setForm({...form, mp2: Number(e.target.value)})} /></div>
                    </div>
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                    <button onClick={()=>setModal(false)} className="px-6 py-2 bg-gray-200 rounded">Cancel</button>
                    <button onClick={handleSaveEmp} className="bg-teal-600 text-white px-8 py-2 rounded font-bold shadow-lg">Save Profile</button>
                </div>
            </Modal>
        </div>
    );
};
