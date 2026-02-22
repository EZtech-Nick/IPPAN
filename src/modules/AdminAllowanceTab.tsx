
import React, { useState, useEffect } from 'react';
import { AppData, AdminAllowance, UserAccount } from '../types';
import { fbService } from '../services/firebaseConfig';
import { fmtMoney, getAllowedNames } from '../utils';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const AdminAllowanceTab: React.FC<Props> = ({ data, currentUser }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [allowances, setAllowances] = useState<Record<string, Partial<AdminAllowance>>>({});

    // Filter employees who are Present or Half-Day for the selected date
    const eligibleEmployees = data.employees.filter(e => {
        const allowed = getAllowedNames(currentUser, 'attendance.adminAllowance');
        if (allowed && !allowed.includes(e.name)) return false;
        const attendance = data.attendance.find(a => a.date === date && a.employeeId === e.id);
        return attendance && (attendance.status === 'Present' || attendance.status === 'Half-Day');
    }).sort((a,b) => a.name.localeCompare(b.name));

    // Load existing allowances when date or data changes
    useEffect(() => {
        const loaded: Record<string, Partial<AdminAllowance>> = {};
        eligibleEmployees.forEach(e => {
            const existing = data.admin_allowances?.find(a => a.date === date && a.employeeId === e.id);
            if (existing) {
                loaded[e.id] = { ...existing };
            } else {
                loaded[e.id] = { 
                    employeeId: e.id, 
                    date: date, 
                    transportation: 0, 
                    meal: 0
                };
            }
        });
        setAllowances(loaded);
    }, [date, data.attendance, data.admin_allowances]);

    const handleAmountChange = (empId: string, field: keyof AdminAllowance, value: string) => {
        setAllowances(prev => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                [field]: Number(value)
            }
        }));
    };

    const handleSave = async (empId: string) => {
        const allowance = allowances[empId];
        if (!allowance) return;

        const docId = `${date}_${empId}`; // Consistent ID generation
        const record = { ...allowance, id: docId, date, employeeId: empId };

        // Save to Firestore using set (creates or overwrites)
        await fbService.set('admin_allowances', docId, record);
        alert('Allowance saved!');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded shadow mb-4">
                <label className="font-bold dark:text-gray-200">Select Date:</label>
                <input 
                    type="date" 
                    className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                />
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Note: Only employees marked as "Present" or "Half-Day" in Daily Attendance will appear here.
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-sm text-left">
                    <thead className="bg-teal-700 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Employee</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3">Transportation Allowance</th>
                            <th className="p-3">Meal Allowance</th>
                            <th className="p-3 text-right font-bold">Total Allowance</th>
                            <th className="p-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {eligibleEmployees.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic">No eligible employees found for this date.</td></tr>
                        ) : (
                            eligibleEmployees.map(e => {
                                const att = data.attendance.find(a => a.date === date && a.employeeId === e.id);
                                const item = allowances[e.id] || { transportation: 0, meal: 0 };
                                const total = (item.transportation||0) + (item.meal||0);

                                return (
                                    <tr key={e.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700">
                                        <td className="p-3 font-bold dark:text-gray-200">{e.name}</td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${att?.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                                {att?.status}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    className="border p-1 rounded w-full dark:bg-gray-600 dark:border-gray-500 dark:text-white" 
                                                    placeholder="0.00"
                                                    value={item.transportation || ''}
                                                    onChange={(ev) => handleAmountChange(e.id, 'transportation', ev.target.value)}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    className="border p-1 rounded w-full dark:bg-gray-600 dark:border-gray-500 dark:text-white" 
                                                    placeholder="0.00"
                                                    value={item.meal || ''}
                                                    onChange={(ev) => handleAmountChange(e.id, 'meal', ev.target.value)}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-3 text-right font-bold text-teal-700 dark:text-teal-400">
                                            {fmtMoney(total)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => handleSave(e.id)} 
                                                className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700"
                                            >
                                                Save
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
