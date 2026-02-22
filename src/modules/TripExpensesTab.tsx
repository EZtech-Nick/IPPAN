
import React, { useState, useEffect } from 'react';
import { AppData, Trip, TripExpense, UserAccount } from '../types';
import { fbService } from '../services/firebase';
import { Modal } from '../components/Modal';
import { Plus, Edit, Trash2, Printer, FileText } from '../components/Icons';
import { fmtDate, fmtMoney, exportToExcel, exportToPDF, getAllowedNames } from '../utils';
import { TripExpenseForm } from './TripExpenseForm';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const TripExpensesTab: React.FC<Props> = ({ data, currentUser }) => {
    const [expStart, setExpStart] = useState(new Date().toISOString().slice(0, 8) + '01');
    const [expEnd, setExpEnd] = useState(new Date().toISOString().split('T')[0]);
    const [expModal, setExpModal] = useState(false);
    const [expForm, setExpForm] = useState<Partial<TripExpense>>({});
    const [expSearch, setExpSearch] = useState('');
    const [selectedTripForExp, setSelectedTripForExp] = useState<Trip | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    // Filtered data for exports
    const filteredExpenses = data.trip_expenses
        .filter(e => {
            const linkedTrip = data.trips.find(t => t.id === e.tripId);
            if (!linkedTrip) return true; 
            
            const dateMatch = linkedTrip.date >= expStart && linkedTrip.date <= expEnd;
            if (!dateMatch) return false;

            const allowed = getAllowedNames(currentUser, 'tripMonitor.expenses');
            if (!allowed) return true;
            const driver = data.employees.find(emp => emp.id === linkedTrip.driverId);
            const helper = data.employees.find(emp => emp.id === linkedTrip.helperId);
            return (driver && allowed.includes(driver.name)) || (helper && allowed.includes(helper.name));
        })
        .filter(e => JSON.stringify(e).toLowerCase().includes(expSearch.toLowerCase()));

    // Totals Calculation
    const totals = filteredExpenses.reduce((acc, e) => {
        const t = data.trips.find(tr => tr.id === e.tripId);
        
        // Trip Financials (handle if trip is missing safely)
        const grossAmount = t ? (Number(t.grossAmount) || 0) : 0;
        const totalDeduction = t ? (Number(t.totalDeduction) || 0) : 0;
        const netRate = t ? (Number(t.netRate) || 0) : 0;
        const driverRate = t ? (Number(t.driverRate) || 0) : 0;
        const helperRate = t ? (Number(t.helperRate) || 0) : 0;

        return {
            count: acc.count + 1,
            grossAmount: acc.grossAmount + grossAmount,
            totalDeduction: acc.totalDeduction + totalDeduction,
            netRate: acc.netRate + netRate,
            driverRate: acc.driverRate + driverRate,
            helperRate: acc.helperRate + helperRate,
            
            allowance: acc.allowance + (Number(e.allowance) || 0),
            poUnioilDiscount: acc.poUnioilDiscount + (Number(e.poUnioilDiscount) || 0),
            poUnioil: acc.poUnioil + (Number(e.poUnioil) || 0),
            autosweep: acc.autosweep + (Number(e.autosweep) || 0),
            easytrip: acc.easytrip + (Number(e.easytrip) || 0),
            dieselCash: acc.dieselCash + (Number(e.dieselCash) || 0),
            tollgateCash: acc.tollgateCash + (Number(e.tollgateCash) || 0),
            meal: acc.meal + (Number(e.meal) || 0),
            gatePass: acc.gatePass + (Number(e.gatePass) || 0),
            vulcanizing: acc.vulcanizing + (Number(e.vulcanizing) || 0),
            parking: acc.parking + (Number(e.parking) || 0),
            trafficViolation: acc.trafficViolation + (Number(e.trafficViolation) || 0),
            carwash: acc.carwash + (Number(e.carwash) || 0),
            roro: acc.roro + (Number(e.roro) || 0),
            mano: acc.mano + (Number(e.mano) || 0),
            truckMaintenance: acc.truckMaintenance + (Number(e.truckMaintenance) || 0),
            otherExpenses: acc.otherExpenses + (Number(e.otherExpenses) || 0),
            caDriver: acc.caDriver + (Number(e.caDriver) || 0),
            caHelper: acc.caHelper + (Number(e.caHelper) || 0),
            manoChargesClient: acc.manoChargesClient + (Number(e.manoChargesClient) || 0),
            otherExpChargesClient: acc.otherExpChargesClient + (Number(e.otherExpChargesClient) || 0),
            total_charges_client: acc.total_charges_client + (Number(e.total_charges_client) || 0),
            cashTotalExpenses: acc.cashTotalExpenses + (Number(e.cashTotalExpenses) || 0),
            cashReturn: acc.cashReturn + (Number(e.cashReturn) || 0),
            cashReturnOffice: acc.cashReturnOffice + (Number(e.cashReturnOffice) || 0),
            totalExpenses: acc.totalExpenses + (Number(e.totalExpenses) || 0),
            totalNet: acc.totalNet + (Number(e.totalNet) || 0),
        };
    }, {
        count: 0, grossAmount: 0, totalDeduction: 0, netRate: 0, driverRate: 0, helperRate: 0,
        allowance: 0, poUnioilDiscount: 0, poUnioil: 0, autosweep: 0, easytrip: 0, dieselCash: 0, 
        tollgateCash: 0, meal: 0, gatePass: 0, vulcanizing: 0, parking: 0, trafficViolation: 0, 
        carwash: 0, roro: 0, mano: 0, truckMaintenance: 0, otherExpenses: 0, caDriver: 0, caHelper: 0, 
        manoChargesClient: 0, otherExpChargesClient: 0, total_charges_client: 0, cashTotalExpenses: 0, 
        cashReturn: 0, cashReturnOffice: 0, totalExpenses: 0, totalNet: 0
    });

    const handleExportExcel = () => {
        // Export ALL expenses in date range, ignoring search
        const expensesToExport = data.trip_expenses.filter(e => {
            const linkedTrip = data.trips.find(t => t.id === e.tripId);
            if(linkedTrip) return linkedTrip.date >= expStart && linkedTrip.date <= expEnd;
            return false;
        });

        const exportData = expensesToExport.map(e => {
            const t = data.trips.find(x => x.id === e.tripId);
            return {
                'Trip Code': t?.tripCode || '',
                'Date': t ? fmtDate(t.date) : '',
                'Plate No': t?.plateNumber,
                'Driver': data.employees.find(x=>x.id===t?.driverId)?.name,
                'Helper': data.employees.find(x=>x.id===t?.helperId)?.name,
                'DR No': t?.drNumber,
                'Client': t?.client,
                'Warehouse': t?.origin,
                'Area': t?.destination,
                'Drop Count': t?.dropCount,
                'Trip Type': t?.typeOfTrip,
                'Rate': t?.grossAmount,
                'Total Deduction': t?.totalDeduction,
                'Net Rate': t?.netRate,
                'Driver Rate': t?.driverRate,
                'Helper Rate': t?.helperRate,
                'Allowance': e.allowance,
                'PO Unioil Disc': e.poUnioilDiscount,
                'PO Unioil': e.poUnioil,
                'Autosweep': e.autosweep,
                'Easytrip': e.easytrip,
                'Diesel Cash': e.dieselCash,
                'Tollgate Cash': e.tollgateCash,
                'Meal': e.meal,
                'Gate Pass': e.gatePass,
                'Vulcanizing': e.vulcanizing,
                'Parking': e.parking,
                'Traffic Violation': e.trafficViolation,
                'Carwash': e.carwash,
                'Roro': e.roro,
                'Mano': e.mano,
                'Truck Maint': e.truckMaintenance,
                'Maint Notes': e.notes_truck_maint,
                'Other Expenses': e.otherExpenses,
                'Other Notes': e.notes_other_exp,
                'CA Driver': e.caDriver,
                'CA Helper': e.caHelper,
                'Mano (Client)': e.manoChargesClient,
                'Other (Client)': e.otherExpChargesClient,
                'Total Charges Client': e.total_charges_client,
                'Client Notes': e.notes_charges_client,
                'Cash Total Exp': e.cashTotalExpenses,
                'Cash Return': e.cashReturn,
                'Cash Return Office': e.cashReturnOffice,
                'Total Expenses': e.totalExpenses,
                'Total Net': e.totalNet,
                'Remarks': e.remarks,
                'Encoded Date': fmtDate(e.dateEncoded)
            };
        });
        exportToExcel(exportData, `Trip_Expenses_${expStart}_${expEnd}`);
    };

    const handleExportPDF = () => {
        const columns = [
            'Date', 'Plate', 'Driver', 'Client', 'Dest', 
            'Gross', 'Net Rate', 
            'Allow', 'Diesel', 'Toll', 'Maint', 'Other', 
            'Tot Exp', 'Tot Net'
        ];
        
        const rows = filteredExpenses.map(e => {
            const t = data.trips.find(x => x.id === e.tripId);
            return [
                t ? fmtDate(t.date) : '-', 
                t?.plateNumber||'', 
                data.employees.find(x=>x.id===t?.driverId)?.name?.split(' ')[0] || '', 
                t?.client?.substring(0, 10)||'', 
                t?.destination?.substring(0, 10)||'', 
                fmtMoney(t?.grossAmount), 
                fmtMoney(t?.netRate),
                fmtMoney(e.allowance), 
                fmtMoney(e.dieselCash), 
                fmtMoney(e.tollgateCash),
                fmtMoney(e.truckMaintenance),
                fmtMoney(e.otherExpenses),
                fmtMoney(e.totalExpenses), 
                fmtMoney(e.totalNet)
            ];
        });
        exportToPDF(`Trip_Expenses_${expStart}_${expEnd}`, columns, rows, 'l', 'legal');
    };

    useEffect(() => {
        if (expModal) {
            const allowance = Number(expForm.allowance) || 0;
            const poUnioil = Number(expForm.poUnioil)||0;
            const autosweep = Number(expForm.autosweep)||0;
            const easytrip = Number(expForm.easytrip)||0;
            const dieselCash = Number(expForm.dieselCash)||0;
            const tollgateCash = Number(expForm.tollgateCash)||0;
            const meal = Number(expForm.meal)||0;
            const gatePass = Number(expForm.gatePass)||0;
            const vulcanizing = Number(expForm.vulcanizing)||0;
            const parking = Number(expForm.parking)||0;
            const trafficViolation = Number(expForm.trafficViolation)||0;
            const carwash = Number(expForm.carwash)||0;
            const roro = Number(expForm.roro)||0;
            const mano = Number(expForm.mano)||0;
            const truckMaintenance = Number(expForm.truckMaintenance)||0;
            const otherExpenses = Number(expForm.otherExpenses)||0;
            const caDriver = Number(expForm.caDriver)||0;
            const caHelper = Number(expForm.caHelper)||0;
            const manoChargesClient = Number(expForm.manoChargesClient)||0;
            const otherExpChargesClient = Number(expForm.otherExpChargesClient)||0;

            const total_charges_client = manoChargesClient + otherExpChargesClient;
            const cashTotalExpenses = dieselCash + tollgateCash + meal + gatePass + vulcanizing + 
                                      parking + trafficViolation + carwash + roro + mano + 
                                      truckMaintenance + otherExpenses + caDriver + caHelper + 
                                      total_charges_client;
            const cashReturn = allowance - cashTotalExpenses;

            let driverRate = 0, helperRate = 0, netRate = 0;
            if (selectedTripForExp) {
                driverRate = Number(selectedTripForExp.driverRate)||0;
                helperRate = Number(selectedTripForExp.helperRate)||0;
                netRate = Number(selectedTripForExp.netRate)||0;
            }
            const totalExpenses = driverRate + helperRate + poUnioil + autosweep + easytrip + 
                                  dieselCash + tollgateCash + meal + gatePass + vulcanizing + 
                                  parking + trafficViolation + carwash + roro + mano + 
                                  truckMaintenance + otherExpenses;
            const totalNet = netRate - totalExpenses;
            setExpForm(prev => ({ ...prev, total_charges_client, cashTotalExpenses, cashReturn, totalExpenses, totalNet }));
        }
    }, [expForm.allowance, expForm.poUnioil, expForm.autosweep, expForm.easytrip, expForm.dieselCash, expForm.tollgateCash, expForm.meal, expForm.gatePass, expForm.vulcanizing, expForm.parking, expForm.trafficViolation, expForm.carwash, expForm.roro, expForm.mano, expForm.truckMaintenance, expForm.otherExpenses, expForm.caDriver, expForm.caHelper, expForm.manoChargesClient, expForm.otherExpChargesClient, selectedTripForExp, expModal]);

    const handleExpenseTripSelect = (tripId: string) => { const t = data.trips.find(x => x.id === tripId); setSelectedTripForExp(t || null); if (t) setExpForm(prev => ({ ...prev, tripId: t.id })); };
    const handleSaveExpense = async () => { if(expForm.id) await fbService.update('trip_expenses', expForm.id, expForm); else await fbService.add('trip_expenses', expForm); setExpModal(false); };
    const editExpense = (e: TripExpense) => { setExpForm(e); const t = data.trips.find(t => t.id === e.tripId); setSelectedTripForExp(t || null); setExpModal(true); };
    const confirmDelete = async () => { if (deleteConfirm) { await fbService.remove(deleteConfirm.collection, deleteConfirm.id); setDeleteConfirm(null); }};

    return (
        <div>
             <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-400">Trip Expenses</h2>
                <div className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 p-1 rounded border dark:border-gray-700">
                    <span className="dark:text-gray-300">From:</span><input type="date" className="border p-1 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={expStart} onChange={e=>setExpStart(e.target.value)}/>
                    <span className="dark:text-gray-300">To:</span><input type="date" className="border p-1 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={expEnd} onChange={e=>setExpEnd(e.target.value)}/>
                </div>
                <div className="flex gap-2 ml-auto">
                    <button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                    <button onClick={handleExportPDF} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                    <input placeholder="Search expenses..." className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={expSearch} onChange={e=>setExpSearch(e.target.value)} />
                    <button onClick={()=>{setExpForm({}); setSelectedTripForExp(null); setExpModal(true)}} className="bg-orange-600 text-white px-4 py-2 rounded flex gap-2"><Plus/> Add Expenses</button>
                </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-scroll relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-orange-700 text-white sticky top-0 z-20 shadow-md">
                        <tr>
                            <th className="p-3">Trip Code</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Plate No.</th>
                            <th className="p-3">Driver Name</th>
                            <th className="p-3">Helper Name</th>
                            <th className="p-3">DR No.</th>
                            <th className="p-3">Client</th>
                            <th className="p-3">Warehouse</th>
                            <th className="p-3">Area</th>
                            <th className="p-3 text-center">Drop Count</th>
                            <th className="p-3">Trip Type</th>
                            <th className="p-3 text-right">Rate</th>
                            <th className="p-3 text-right text-red-200">Total Deduction</th>
                            <th className="p-3 text-right font-bold text-teal-200">Net Rate</th>
                            <th className="p-3 text-right">Driver Rate</th>
                            <th className="p-3 text-right">Helper Rate</th>
                            <th className="p-3 text-right bg-orange-800">Allowance</th>
                            <th className="p-3 text-right bg-orange-800">PO Unioil Disc.</th>
                            <th className="p-3 text-right bg-orange-800">PO Unioil</th>
                            <th className="p-3 text-right bg-orange-800">Autosweep</th>
                            <th className="p-3 text-right bg-orange-800">Easytrip</th>
                            <th className="p-3 text-right bg-orange-800">Diesel Cash</th>
                            <th className="p-3 text-right bg-orange-800">Tollgate Cash</th>
                            <th className="p-3 text-right bg-orange-800">Meal</th>
                            <th className="p-3 text-right bg-orange-800">Gate Pass</th>
                            <th className="p-3 text-right bg-orange-800">Vulcanizing</th>
                            <th className="p-3 text-right bg-orange-800">Parking</th>
                            <th className="p-3 text-right bg-orange-800">Violation Fine</th>
                            <th className="p-3 text-right bg-orange-800">Carwash</th>
                            <th className="p-3 text-right bg-orange-800">Roro</th>
                            <th className="p-3 text-right bg-orange-800">Mano</th>
                            <th className="p-3 text-right bg-orange-800">Truck Maintenance</th>
                            <th className="p-3 bg-orange-800">Notes (Maint)</th>
                            <th className="p-3 text-right bg-orange-800">Other Expenses</th>
                            <th className="p-3 bg-orange-800">Notes (Other)</th>
                            <th className="p-3 text-right bg-blue-800">CA Driver</th>
                            <th className="p-3 text-right bg-blue-800">CA Helper</th>
                            <th className="p-3 text-right bg-blue-800">Mano (Client)</th>
                            <th className="p-3 text-right bg-blue-800">Other (Client)</th>
                            <th className="p-3 text-right bg-blue-800">Total Charges Client</th>
                            <th className="p-3 bg-blue-800">Notes (Client)</th>
                            <th className="p-3 text-right font-bold">Cash Total Expenses</th>
                            <th className="p-3 text-right">Cash Return</th>
                            <th className="p-3 text-right">Cash Return Office</th>
                            <th className="p-3 text-right font-bold text-red-100 bg-red-800">Total Expenses</th>
                            <th className="p-3 text-right font-bold text-green-100 bg-green-800 sticky right-0">Total Net</th>
                            <th className="p-3">Expenses Remarks</th>
                            <th className="p-3">Date Encoded Payroll</th>
                            <th className="p-3 text-center sticky right-0 z-30 bg-orange-700">Action</th>
                        </tr>
                        {/* TOTALS ROW */}
                        <tr className="bg-yellow-100 text-black font-bold border-b-2 border-orange-800 dark:bg-gray-600 dark:text-white">
                            <td colSpan={9} className="p-2 text-right uppercase">Total ({totals.count} Trips)</td>
                            <td className="p-2 text-center text-orange-800 dark:text-orange-200 bg-yellow-200 dark:bg-gray-500 border-x border-orange-300">Count: {totals.count}</td>
                            <td className="p-2"></td>
                            <td className="p-2 text-right">{fmtMoney(totals.grossAmount)}</td>
                            <td className="p-2 text-right text-red-700 dark:text-red-300">{fmtMoney(totals.totalDeduction)}</td>
                            <td className="p-2 text-right text-teal-800 dark:text-teal-200">{fmtMoney(totals.netRate)}</td>
                            <td className="p-2 text-right text-blue-800 dark:text-blue-300">{fmtMoney(totals.driverRate)}</td>
                            <td className="p-2 text-right text-blue-800 dark:text-blue-300">{fmtMoney(totals.helperRate)}</td>
                            
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.allowance)}</td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-400 bg-orange-200 dark:bg-gray-700">{fmtMoney(totals.poUnioilDiscount)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.poUnioil)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.autosweep)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.easytrip)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.dieselCash)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.tollgateCash)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.meal)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.gatePass)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.vulcanizing)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.parking)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.trafficViolation)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.carwash)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.roro)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.mano)}</td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.truckMaintenance)}</td>
                            <td className="p-2 bg-orange-200 dark:bg-gray-700"></td>
                            <td className="p-2 text-right bg-orange-200 dark:bg-gray-700 dark:text-orange-300">{fmtMoney(totals.otherExpenses)}</td>
                            <td className="p-2 bg-orange-200 dark:bg-gray-700"></td>
                            
                            <td className="p-2 text-right bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200">{fmtMoney(totals.caDriver)}</td>
                            <td className="p-2 text-right bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200">{fmtMoney(totals.caHelper)}</td>
                            <td className="p-2 text-right bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200">{fmtMoney(totals.manoChargesClient)}</td>
                            <td className="p-2 text-right bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200">{fmtMoney(totals.otherExpChargesClient)}</td>
                            <td className="p-2 text-right bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 font-bold">{fmtMoney(totals.total_charges_client)}</td>
                            <td className="p-2 bg-blue-200 dark:bg-blue-900"></td>
                            
                            <td className="p-2 text-right font-bold">{fmtMoney(totals.cashTotalExpenses)}</td>
                            <td className="p-2 text-right">{fmtMoney(totals.cashReturn)}</td>
                            <td className="p-2 text-right">{fmtMoney(totals.cashReturnOffice)}</td>
                            <td className="p-2 text-right text-red-700 dark:text-red-300 font-bold bg-red-200 dark:bg-red-900">{fmtMoney(totals.totalExpenses)}</td>
                            <td className="p-2 text-right text-green-800 dark:text-green-200 font-bold bg-green-200 dark:bg-green-900 sticky right-0">{fmtMoney(totals.totalNet)}</td>
                            <td colSpan={3}></td>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExpenses.map(e => {
                            const t = data.trips.find(t => t.id === e.tripId);
                            if (!t) return null; 
                            return (
                                <tr key={e.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                    <td className="p-2 font-mono font-bold text-teal-700 dark:text-teal-400">{t.tripCode || '-'}</td>
                                    <td className="p-2">{fmtDate(t.date)}</td>
                                    <td className="p-2 font-bold">{t.plateNumber}</td>
                                    <td className="p-2">{data.employees.find(x=>x.id===t.driverId)?.name || '-'}</td>
                                    <td className="p-2">{data.employees.find(x=>x.id===t.helperId)?.name || '-'}</td>
                                    <td className="p-2">{t.drNumber}</td>
                                    <td className="p-2">{t.client}</td>
                                    <td className="p-2">{t.origin}</td>
                                    <td className="p-2">{t.destination}</td>
                                    <td className="p-2 text-center">{t.dropCount}</td>
                                    <td className="p-2">{t.typeOfTrip}</td>
                                    <td className="p-2 text-right">{fmtMoney(t.grossAmount)}</td>
                                    <td className="p-2 text-right text-red-600 dark:text-red-400">{fmtMoney(t.totalDeduction)}</td>
                                    <td className="p-2 text-right font-bold text-teal-700 dark:text-teal-400">{fmtMoney(t.netRate)}</td>
                                    <td className="p-2 text-right text-blue-600 dark:text-blue-400">{fmtMoney(t.driverRate)}</td>
                                    <td className="p-2 text-right text-blue-600 dark:text-blue-400">{fmtMoney(t.helperRate)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.allowance)}</td>
                                    <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtMoney(e.poUnioilDiscount)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.poUnioil)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.autosweep)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.easytrip)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.dieselCash)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.tollgateCash)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.meal)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.gatePass)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.vulcanizing)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.parking)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.trafficViolation)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.carwash)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.roro)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.mano)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.truckMaintenance)}</td>
                                    <td className="p-2 text-xs italic text-gray-500 dark:text-gray-400 max-w-[100px] truncate" title={e.notes_truck_maint}>{e.notes_truck_maint || '-'}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.otherExpenses)}</td>
                                    <td className="p-2 text-xs italic text-gray-500 dark:text-gray-400 max-w-[100px] truncate" title={e.notes_other_exp}>{e.notes_other_exp || '-'}</td>
                                    <td className="p-2 text-right text-blue-800 dark:text-blue-300">{fmtMoney(e.caDriver)}</td>
                                    <td className="p-2 text-right text-blue-800 dark:text-blue-300">{fmtMoney(e.caHelper)}</td>
                                    <td className="p-2 text-right text-blue-600 dark:text-blue-400">{fmtMoney(e.manoChargesClient)}</td>
                                    <td className="p-2 text-right text-blue-600 dark:text-blue-400">{fmtMoney(e.otherExpChargesClient)}</td>
                                    <td className="p-2 text-right text-blue-700 dark:text-blue-300 font-bold">{fmtMoney(e.total_charges_client)}</td>
                                    <td className="p-2 text-xs italic text-gray-500 dark:text-gray-400 max-w-[100px] truncate" title={e.notes_charges_client}>{e.notes_charges_client || '-'}</td>
                                    <td className="p-2 text-right font-bold">{fmtMoney(e.cashTotalExpenses)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.cashReturn)}</td>
                                    <td className="p-2 text-right">{fmtMoney(e.cashReturnOffice)}</td>
                                    <td className="p-2 text-right text-red-600 font-bold bg-red-50 dark:bg-red-900 dark:text-red-200">{fmtMoney(e.totalExpenses)}</td>
                                    <td className="p-2 text-right text-green-700 font-bold bg-green-50 sticky right-0 dark:bg-green-900 dark:text-green-200">{fmtMoney(e.totalNet)}</td>
                                    <td className="p-2 text-xs truncate max-w-[150px]" title={e.remarks}>{e.remarks}</td>
                                    <td className="p-2">{fmtDate(e.dateEncoded)}</td>
                                    <td className="p-2 flex gap-1 justify-center sticky right-0 z-30 bg-gray-50 dark:bg-gray-800">
                                        <button type="button" onClick={(ev)=>{ev.stopPropagation(); editExpense(e);}} className="text-blue-600 dark:text-blue-400"><Edit/></button>
                                        <button type="button" onClick={(ev)=>{ev.stopPropagation(); setDeleteConfirm({id: e.id, collection: 'trip_expenses'})}} className="text-red-600 hover:text-red-800"><Trash2/></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
             <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete">
                <div className="space-y-4 p-4">
                    <p className="text-lg">Are you sure you want to delete this record?</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-white">Cancel</button>
                        <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={expModal} onClose={()=>setExpModal(false)} title="Trip Expenses" large>
                <TripExpenseForm 
                    data={data} 
                    form={expForm} 
                    setForm={setExpForm} 
                    selectedTrip={selectedTripForExp} 
                    onTripSelect={handleExpenseTripSelect} 
                    onSave={handleSaveExpense} 
                />
            </Modal>
        </div>
    );
};
