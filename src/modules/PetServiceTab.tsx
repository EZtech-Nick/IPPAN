
import React, { useState } from 'react';
import { AppData, UserAccount } from '../types';
import { fbService } from '../services/firebaseConfig';
import { Printer } from '../components/Icons';
import { exportToPDF, getAllowedNames } from '../utils';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const PetServiceTab: React.FC<Props> = ({ data, currentUser }) => {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);

    // Filter only Admin Employees
    const adminEmployees = data.employees
        .filter(e => e.role === 'Admin')
        .filter(e => {
            const allowed = getAllowedNames(currentUser, 'attendance.petService');
            return !allowed || allowed.includes(e.name);
        })
        .sort((a,b) => a.name.localeCompare(b.name));

    // Helper to get formatted month ID
    const getRecordId = (empId: string) => `${year}-${String(month).padStart(2, '0')}_${empId}`;

    const isQualified = (empId: string) => {
        const record = data.pet_service_records?.find(r => 
            r.year === year && r.month === month && r.employeeId === empId
        );
        return !!record?.qualified;
    };

    const togglePetService = async (empId: string, currentVal: boolean) => {
        const id = getRecordId(empId);
        await fbService.set('pet_service_records', id, {
            id,
            year,
            month,
            employeeId: empId,
            qualified: !currentVal
        });
    };

    const isAllSelected = adminEmployees.length > 0 && adminEmployees.every(e => isQualified(e.id));

    const toggleSelectAll = async () => {
        const newState = !isAllSelected;
        const promises = adminEmployees.map(e => {
            const id = getRecordId(e.id);
            return fbService.set('pet_service_records', id, {
                id,
                year,
                month,
                employeeId: e.id,
                qualified: newState
            });
        });
        await Promise.all(promises);
    };

    const handlePrint = () => {
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
        const title = `Pet Service Qualification - ${monthName} ${year}`;
        const headers = ['Employee Name', 'Position', 'Status', 'Allowance'];
        
        const qualifiedEmps = adminEmployees.filter(e => isQualified(e.id));
        const rows = qualifiedEmps.map(e => [
            e.name,
            e.role,
            'Qualified',
            'Php 2,000.00'
        ]);

        // If list is empty
        if (rows.length === 0) {
            rows.push(['No qualified employees', '-', '-', '-']);
        }

        exportToPDF(title, headers, rows, 'p');
    };

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <div>
                        <h3 className="font-bold text-teal-900 dark:text-teal-400">Pet Service Administration</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Select period to qualify employees for <strong>PHP 2,000.00</strong> monthly allowance.
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <select 
                            className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            value={month} 
                            onChange={e => setMonth(Number(e.target.value))}
                        >
                            {Array.from({length: 12}, (_, i) => (
                                <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                        </select>
                        <select 
                            className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            value={year} 
                            onChange={e => setYear(Number(e.target.value))}
                        >
                            {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-bold hover:bg-gray-900 ml-2">
                            <Printer className="w-4 h-4"/> Print List
                        </button>
                    </div>
                </div>

                <div className="border rounded dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 dark:bg-gray-700 dark:text-white">
                            <tr>
                                <th className="p-3">Employee Name</th>
                                <th className="p-3 text-center">Position</th>
                                <th className="p-3 text-center">
                                    <label className="inline-flex items-center cursor-pointer gap-2">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                            checked={isAllSelected}
                                            onChange={toggleSelectAll}
                                        />
                                        <span>Qualification Status (Select All)</span>
                                    </label>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {adminEmployees.map(e => {
                                const qualified = isQualified(e.id);
                                return (
                                    <tr key={e.id} className={`border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 ${qualified ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}>
                                        <td className="p-3 font-bold dark:text-gray-200">{e.name}</td>
                                        <td className="p-3 text-center dark:text-gray-300">{e.role}</td>
                                        <td className="p-3 text-center">
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 dark:bg-gray-600 dark:border-gray-500"
                                                    checked={qualified}
                                                    onChange={() => togglePetService(e.id, qualified)}
                                                />
                                                <span className={`ml-2 text-xs font-bold ${qualified ? 'text-teal-700 dark:text-teal-400' : 'text-gray-400'}`}>
                                                    {qualified ? 'Qualified (2k)' : 'Not Qualified'}
                                                </span>
                                            </label>
                                        </td>
                                    </tr>
                                );
                            })}
                            {adminEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-6 text-center text-gray-500 italic">No Admin employees found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
