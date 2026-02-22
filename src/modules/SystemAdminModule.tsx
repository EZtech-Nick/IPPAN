
import React, { useState } from 'react';
import { AppData, UserAccount, Permissions, PermissionScope } from '../types';
import { fbService } from '../services/firebaseConfig';
import { DEFAULT_PERMISSIONS } from '../constants';
import { Trash2, Edit, Plus, Shield, Users } from '../components/Icons';
import { fmtDate } from '../utils';

interface Props {
    data: AppData;
}

export const SystemAdminModule: React.FC<Props> = ({ data }) => {
    const [subTab, setSubTab] = useState<'list' | 'create'>('list');
    const [form, setForm] = useState<Partial<UserAccount>>({
        permissions: { ...DEFAULT_PERMISSIONS }
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    const users = data.users || [];

    const handleSave = async () => {
        if (!form.name || !form.position || !form.email || !form.password) {
            return alert("Please fill in all required fields.");
        }

        if (!form.email.endsWith('@ippan.com')) {
            return alert("Email must end with @ippan.com");
        }

        const payload = {
            ...form,
            createdAt: form.createdAt || new Date().toISOString(),
        };

        try {
            if (editingId) {
                await fbService.update('users', editingId, payload);
                alert("Account updated successfully!");
            } else {
                await fbService.add('users', payload);
                alert("Account created successfully!");
            }
            setForm({ permissions: { ...DEFAULT_PERMISSIONS } });
            setEditingId(null);
            setSubTab('list');
        } catch (error) {
            console.error("Error saving user:", error);
            alert("Failed to save user account.");
        }
    };

    const handleEdit = (u: UserAccount) => {
        setForm(u);
        setEditingId(u.id);
        setSubTab('create');
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this account?")) {
            await fbService.remove('users', id);
        }
    };

    const togglePermission = (path: string, value: any) => {
        setForm(prev => {
            const newPerms = { ...prev.permissions } as any;
            const keys = path.split('.');
            let current = newPerms;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return { ...prev, permissions: newPerms };
        });
    };

    const PermissionRow = ({ label, path, type = 'checkbox' }: { label: string, path: string, type?: 'checkbox' | 'scope' }) => {
        const keys = path.split('.');
        let val = form.permissions as any;
        for (const k of keys) val = val?.[k];

        const isUserOnly = val === 'UserOnly' || (typeof val === 'object' && val?.scope === 'UserOnly');
        const allowedNames = typeof val === 'object' && val?.scope === 'UserOnly' ? (val.names || []).join(', ') : '';

        return (
            <div className="py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium dark:text-gray-300">{label}</span>
                    <div className="flex items-center gap-4">
                        {type === 'checkbox' ? (
                            <input 
                                type="checkbox" 
                                checked={!!val} 
                                onChange={e => togglePermission(path, e.target.checked)}
                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                            />
                        ) : (
                            <div className="flex gap-4">
                                <label className="flex items-center gap-1 text-xs cursor-pointer font-semibold text-gray-600 dark:text-gray-400">
                                    <input 
                                        type="radio" 
                                        name={path} 
                                        checked={isUserOnly} 
                                        onChange={() => togglePermission(path, 'UserOnly')}
                                        className="text-teal-600 focus:ring-teal-500"
                                    />
                                    User Only
                                </label>
                                <label className="flex items-center gap-1 text-xs cursor-pointer font-semibold text-gray-600 dark:text-gray-400">
                                    <input 
                                        type="radio" 
                                        name={path} 
                                        checked={val === 'All'} 
                                        onChange={() => togglePermission(path, 'All')}
                                        className="text-teal-600 focus:ring-teal-500"
                                    />
                                    All Users
                                </label>
                            </div>
                        )}
                    </div>
                </div>
                {type === 'scope' && isUserOnly && (
                    <div className="mt-2 pl-4 border-l-2 border-teal-500">
                        <label className="block text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase mb-1">
                            Allowed Names (Comma separated, leave empty for current user only)
                        </label>
                        <input 
                            type="text"
                            placeholder="e.g. John Doe, Jane Smith"
                            className="w-full text-xs border rounded p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-1 focus:ring-teal-500 outline-none"
                            value={allowedNames}
                            onChange={e => {
                                const names = e.target.value.split(',').map(n => n.trim()).filter(n => n !== '');
                                togglePermission(path, { scope: 'UserOnly', names });
                            }}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b pb-2 no-print">
                <button 
                    onClick={() => { setSubTab('list'); setEditingId(null); setForm({ permissions: { ...DEFAULT_PERMISSIONS } }); }} 
                    className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition-colors ${subTab === 'list' ? 'bg-teal-700 text-white' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                >
                    <Users size={18}/> Existing Accounts
                </button>
                <button 
                    onClick={() => setSubTab('create')} 
                    className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition-colors ${subTab === 'create' ? 'bg-teal-700 text-white' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                >
                    <Plus size={18}/> {editingId ? 'Edit Account' : 'Create New Account'}
                </button>
            </div>

            {subTab === 'list' ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 uppercase text-xs font-bold">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Position</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Created</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <td className="px-6 py-4 font-medium dark:text-gray-200">{u.name}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{u.position}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{u.email}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">{fmtDate(u.createdAt)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-3">
                                            <button onClick={() => handleEdit(u)} className="text-teal-600 hover:text-teal-800 transition-colors" title="Edit"><Edit size={18}/></button>
                                            <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-800 transition-colors" title="Delete"><Trash2 size={18}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500 italic">No user accounts found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white">
                            <Shield className="text-teal-600" /> Account Information
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name of the User</label>
                                <input 
                                    className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    value={form.name || ''} 
                                    onChange={e => setForm({...form, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Position/Designation</label>
                                <input 
                                    className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    value={form.position || ''} 
                                    onChange={e => setForm({...form, position: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (@ippan.com)</label>
                                <input 
                                    type="email"
                                    className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    value={form.email || ''} 
                                    onChange={e => setForm({...form, email: e.target.value})}
                                    placeholder="user@ippan.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                                <input 
                                    type="password"
                                    className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    value={form.password || ''} 
                                    onChange={e => setForm({...form, password: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="pt-4">
                            <button 
                                onClick={handleSave}
                                className="w-full bg-teal-700 text-white py-3 rounded-lg font-bold hover:bg-teal-800 transition-colors shadow-md"
                            >
                                {editingId ? 'Update Account' : 'Create Account'}
                            </button>
                        </div>
                    </div>

                    {/* Permissions */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-6 max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white sticky top-0 bg-white dark:bg-gray-800 pb-2 z-10">
                            <Shield className="text-teal-600" /> Access & Limitations
                        </h3>
                        
                        <div className="space-y-6">
                            <PermissionRow label="Access All (Super Admin)" path="accessAll" />
                            
                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-teal-700 dark:text-teal-400 border-b pb-1">General</h4>
                                <PermissionRow label="Dashboard" path="dashboard" />
                                <PermissionRow label="Clients" path="clients" />
                                <PermissionRow label="System Admin Tab" path="systemAdmin" />
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-teal-700 dark:text-teal-400 border-b pb-1">Attendance & OT</h4>
                                <PermissionRow label="Enable Module" path="attendance.enabled" />
                                <PermissionRow label="Daily Attendance" path="attendance.daily" type="scope" />
                                <PermissionRow label="Admin Allowance" path="attendance.adminAllowance" type="scope" />
                                <PermissionRow label="Pet Service" path="attendance.petService" type="scope" />
                                <PermissionRow label="Overtime" path="attendance.overtime" type="scope" />
                                <PermissionRow label="Undertime" path="attendance.undertime" type="scope" />
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-teal-700 dark:text-teal-400 border-b pb-1">Trip Monitor</h4>
                                <PermissionRow label="Enable Module" path="tripMonitor.enabled" />
                                <PermissionRow label="Trip Monitor" path="tripMonitor.monitor" type="scope" />
                                <PermissionRow label="Itinerary" path="tripMonitor.itinerary" type="scope" />
                                <PermissionRow label="Trip Expenses" path="tripMonitor.expenses" type="scope" />
                                <PermissionRow label="Truck Summary" path="tripMonitor.truckSummary" />
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-teal-700 dark:text-teal-400 border-b pb-1">Billing & SOA</h4>
                                <PermissionRow label="Enable Module" path="billing.enabled" />
                                <PermissionRow label="Generate SOA" path="billing.generateSoa" />
                                <PermissionRow label="Billing History" path="billing.history" type="scope" />
                                <PermissionRow label="Billing Summary" path="billing.summary" type="scope" />
                                <PermissionRow label="Analytics" path="billing.analytics" type="scope" />
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-teal-700 dark:text-teal-400 border-b pb-1">HR & Payroll</h4>
                                <PermissionRow label="Enable Module" path="hr.enabled" />
                                <PermissionRow label="201 Profile" path="hr.profile201" />
                                <PermissionRow label="Live Payroll" path="hr.livePayroll" />
                                <PermissionRow label="Holidays" path="hr.holidays" />
                                <PermissionRow label="Generated Payroll" path="hr.generatedPayroll" type="scope" />
                                <PermissionRow label="Ipon Pondo / 13th Month" path="hr.iponPondo" type="scope" />
                                <PermissionRow label="Loans Application" path="hr.loansApplication" type="scope" />
                                <PermissionRow label="Loans Summary" path="hr.loansSummary" type="scope" />
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-teal-700 dark:text-teal-400 border-b pb-1">Fleet & Maintenance</h4>
                                <PermissionRow label="Enable Module" path="fleet.enabled" />
                                <PermissionRow label="Truck List" path="fleet.truckList" />
                                <PermissionRow label="Maintenance" path="fleet.maintenance" />
                                <PermissionRow label="Inspection" path="fleet.inspection" />
                                <PermissionRow label="Maint. Summary" path="fleet.maintSummary" />
                                <PermissionRow label="Inventory" path="fleet.inventory" />
                                <PermissionRow label="Releasing" path="fleet.releasing" />
                                <PermissionRow label="History" path="fleet.history" />
                                <PermissionRow label="Insurance" path="fleet.insurance" />
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-teal-700 dark:text-teal-400 border-b pb-1">Finance</h4>
                                <PermissionRow label="Enable Module" path="finance.enabled" />
                                <PermissionRow label="Banks" path="finance.banks" type="scope" />
                                <PermissionRow label="Company Loans" path="finance.companyLoans" />
                                <PermissionRow label="Investor Report" path="finance.investorReport" type="scope" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
