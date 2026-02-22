
import React, { useState } from 'react';
import { AppData, Truck, MaintenanceLog, InventoryItem, InventoryTransaction, InspectionChecklist, UserAccount } from '../types';
import { fbService } from '../services/firebaseConfig';
import { Modal } from '../components/Modal';
import { Plus, Edit, Trash2, Printer, Wrench, FileText } from '../components/Icons';
import { fmtMoney, fmtDate, isExpiring, exportToPDF, exportToExcel } from '../utils';
import { jsPDF } from 'jspdf';
import { FleetTrucks } from './FleetTrucks';
import { FleetInsurance } from './FleetInsurance';
import { FleetMaintenanceSummary } from './FleetMaintenanceSummary';
import { FleetInspection } from './FleetInspection';
import { FleetReleasing } from './FleetReleasing';

interface Props {
    data: AppData;
    subTab: string;
    setSubTab: (t: string) => void;
    currentUser: UserAccount;
}

export const FleetModule: React.FC<Props> = ({ data, subTab, setSubTab, currentUser }) => {
    const [search, setSearch] = useState('');
    const [invSearch, setInvSearch] = useState(''); 
    const [histSearch, setHistSearch] = useState('');

    const hasAccess = (path: string) => {
        if (currentUser.permissions.accessAll) return true;
        const keys = path.split('.');
        let val = currentUser.permissions as any;
        for (const k of keys) val = val?.[k];
        return !!val;
    };

    const tabs = [
        {id: 'list', label: 'Truck List', permission: 'fleet.truckList'},
        {id: 'maintenance', label: 'Maintenance', permission: 'fleet.maintenance'},
        {id: 'inspection', label: 'Inspection', permission: 'fleet.inspection'},
        {id: 'maint_summary', label: 'Maint. Summary', permission: 'fleet.maintSummary'},
        {id: 'inventory', label: 'Inventory', permission: 'fleet.inventory'},
        {id: 'releasing', label: 'Releasing', permission: 'fleet.releasing'},
        {id: 'history', label: 'History', permission: 'fleet.history'},
        {id: 'insurance', label: 'Insurance', permission: 'fleet.insurance'}
    ].filter(t => hasAccess(t.permission));
    
    // Maintenance Filters & State
    const [maintStart, setMaintStart] = useState(new Date().toISOString().slice(0, 8) + '01');
    const [maintEnd, setMaintEnd] = useState(new Date().toISOString().split('T')[0]);
    const [modal, setModal] = useState(false);

    // Inventory
    const [invModal, setInvModal] = useState(false);
    const [invForm, setInvForm] = useState<Partial<InventoryItem> & { replenishment?: number, date?: string }>({});
    const [maintForm, setMaintForm] = useState<Partial<MaintenanceLog>>({});

    // Inspection Integration
    const [inspectionPrefill, setInspectionPrefill] = useState<Partial<InspectionChecklist> | undefined>(undefined);

    // Releasing (Deprecated separate modal, now full module) - Keeping deleteConfirm
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    // History Toggle
    const [historyMode, setHistoryMode] = useState<'inventory' | 'releases'>('inventory');

    // Helper to generate code safely
    const getNewMaintenanceCode = (dateStr?: string) => {
        try {
            let d = dateStr ? new Date(dateStr) : new Date();
            if (isNaN(d.getTime())) d = new Date();

            const yy = d.getFullYear().toString().slice(-2);
            const mm = (d.getMonth() + 1).toString().padStart(2, '0');
            const prefix = `MNT-${yy}${mm}`;
            
            const existingSeqs = (data.maintenance || [])
                .filter(m => m.maintenanceCode && m.maintenanceCode.startsWith(prefix))
                .map(m => {
                    const parts = m.maintenanceCode!.split('-');
                    return parts.length >= 3 ? (parseInt(parts[2]) || 0) : 0;
                });
                
            const maxSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;
            return `${prefix}-${(maxSeq + 1).toString().padStart(4, '0')}`;
        } catch (error) {
            console.error("Error generating maintenance code:", error);
            return `MNT-ERR-${Date.now().toString().slice(-4)}`;
        }
    };

    const handleCreateMaintenance = () => {
        try {
            const date = new Date().toISOString().split('T')[0];
            const code = getNewMaintenanceCode(date);
            setMaintForm({ date, repairType: 'Maintenance', maintenanceCode: code });
            setModal(true);
        } catch (e) {
            console.error(e);
            alert("An error occurred initializing the form.");
        }
    };

    const handleEditMaintenance = (m: MaintenanceLog) => {
        try {
            let code = m.maintenanceCode;
            if (!code) {
                code = getNewMaintenanceCode(m.date);
            }
            setMaintForm({ ...m, maintenanceCode: code });
            setModal(true);
        } catch (e) {
            console.error(e);
            setMaintForm(m);
            setModal(true);
        }
    };

    // Inventory logic
    const handleInvCodeChange = (code: string) => { 
        const existing = data.inventory.find(i => i.itemCode === code); 
        if(existing) { 
            // Auto detect details, reset quantity input
            setInvForm({ 
                ...existing, 
                replenishment: 0,
                date: new Date().toISOString().split('T')[0] 
            }); 
        } else { 
            // New item, preserve other manual inputs or reset if necessary
            setInvForm(prev => ({ ...prev, itemCode: code })); 
        } 
    };

    const handleSaveInv = async () => { 
        const replenishment = Number(invForm.replenishment) || 0;
        const currentStock = Number(invForm.stock) || 0;
        
        let finalStock = currentStock;
        if(invForm.id) {
            finalStock = currentStock + replenishment;
        } else {
            finalStock = replenishment;
        }

        const cleanForm = { 
            itemCode: invForm.itemCode || '', 
            item: invForm.item || '', 
            stock: finalStock, 
            unit: invForm.unit || '', 
            reorderLevel: Number(invForm.reorderLevel) || 0,
            store: invForm.store || '',
            cost: Number(invForm.cost) || 0,
            price: Number(invForm.price) || 0,
            lastUpdated: invForm.date || new Date().toISOString().split('T')[0]
        };

        if(invForm.id) await fbService.update('inventory', invForm.id, cleanForm); 
        else await fbService.add('inventory', cleanForm);
        
        // Log transaction
        if(replenishment > 0 || !invForm.id) { 
            await fbService.add('inventory_transactions', { 
                date: cleanForm.lastUpdated, 
                itemCode: cleanForm.itemCode, 
                itemName: cleanForm.item, 
                issuedTo: 'Stock In', 
                quantity: replenishment > 0 ? replenishment : finalStock, 
                remarks: invForm.id ? 'Replenishment' : 'Initial Stock', 
                type: 'Replenish' 
            }); 
        }
        setInvModal(false);
    };

    const confirmDelete = async () => { if (deleteConfirm) { await fbService.remove(deleteConfirm.collection, deleteConfirm.id); setDeleteConfirm(null); } };

    // Filter Maintenance
    const filteredMaint = (data.maintenance || [])
        .filter(m => m.date >= maintStart && m.date <= maintEnd)
        .filter(m => JSON.stringify(m).toLowerCase().includes(search.toLowerCase()))
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate Maintenance Totals
    const totalLabor = filteredMaint.reduce((s, m) => s + (Number(m.laborCost)||0), 0);
    const totalParts = filteredMaint.reduce((s, m) => s + (Number(m.partsCost)||0), 0);
    const totalGrand = totalLabor + totalParts;

    // Export Functions
    const exportMaint = (excel = false) => {
        // Export ALL maintenance within date range, ignoring search
        const logsToExport = (data.maintenance || [])
            .filter(m => m.date >= maintStart && m.date <= maintEnd)
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if(excel) return exportToExcel(logsToExport, 'Maintenance_Logs');
        
        const rows = logsToExport.map(m => [m.maintenanceCode||'-', fmtDate(m.date), m.plateNumber, m.description, m.mechanicName||'-', m.repairType||'-', fmtMoney(m.laborCost), fmtMoney(m.partsCost), fmtMoney((Number(m.laborCost)||0)+(Number(m.partsCost)||0))]);
        exportToPDF('Maintenance_Log', ['Code', 'Date', 'Truck', 'Desc', 'Mechanic', 'Type', 'Labor', 'Parts', 'Total'], rows);
    };
    const exportInventory = (excel = false) => {
        // Export ALL inventory items, ignoring search
        const allInventory = [...data.inventory];
        if(excel) return exportToExcel(allInventory, 'Inventory_Report');
        
        const rows = allInventory.map(i => [fmtDate(i.lastUpdated), i.store||'-', i.item, i.itemCode, i.stock, i.unit, fmtMoney(i.cost), fmtMoney((i.stock||0)*(i.cost||0)), fmtMoney(i.price), fmtMoney((i.stock||0)*(i.price||0))]);
        exportToPDF('Inventory_Report', ['Date', 'Store', 'Item', 'Code', 'Qty', 'Unit', 'Cost', 'T.Cost', 'Price', 'T.Price'], rows, 'l');
    };

    const handleSaveMaint = async () => {
        const { id, ...dataToSave } = maintForm; 
        if(id) await fbService.update('maintenance', id, dataToSave);
        else await fbService.add('maintenance', dataToSave);
        setModal(false);
    };

    const handleOpenInspection = () => {
        if (!maintForm.plateNumber) {
            alert("Please select a Truck first.");
            return;
        }
        let code = maintForm.maintenanceCode;
        if (!code) {
            const dateStr = maintForm.date || new Date().toISOString().split('T')[0];
            code = getNewMaintenanceCode(dateStr);
            setMaintForm(prev => ({ ...prev, maintenanceCode: code }));
        }
        const existingInspection = (data.inspections || []).find(i => i.maintenanceCode === code);
        if (existingInspection) {
            setInspectionPrefill(existingInspection);
        } else {
            const truck = data.trucks.find(t => t.plateNumber === maintForm.plateNumber);
            const newData: Partial<InspectionChecklist> = {
                date: maintForm.date,
                plateNumber: maintForm.plateNumber,
                mechanicName: maintForm.mechanicName,
                truckModel: truck ? truck.model : '',
                maintenanceCode: code
            };
            setInspectionPrefill(newData);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4 border-b pb-2 overflow-x-auto">
                {tabs.map(t => (
                    <button key={t.id} onClick={()=>setSubTab(t.id)} className={`font-bold capitalize px-4 py-2 rounded whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-700 ${subTab === t.id ? 'bg-teal-700 text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {subTab === 'list' && <FleetTrucks data={data} />}
            {subTab === 'insurance' && <FleetInsurance data={data} />}
            {subTab === 'maint_summary' && <FleetMaintenanceSummary data={data} />}
            {subTab === 'inspection' && <FleetInspection data={data} prefillData={inspectionPrefill} onClosePrefill={()=>setInspectionPrefill(undefined)} />}
            {subTab === 'releasing' && <FleetReleasing data={data} />}

            {subTab === 'maintenance' && (
                <div>
                        {inspectionPrefill && (
                            <FleetInspection 
                                data={data} 
                                prefillData={inspectionPrefill} 
                                onClosePrefill={()=>setInspectionPrefill(undefined)}
                                modalOnly={true}
                                zIndex={60}
                            />
                        )}
                        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                            <div className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                                <span className="font-bold dark:text-gray-300">Period:</span>
                                <input type="date" className="border p-1 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={maintStart} onChange={e=>setMaintStart(e.target.value)} />
                                <span className="dark:text-gray-300">to</span>
                                <input type="date" className="border p-1 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={maintEnd} onChange={e=>setMaintEnd(e.target.value)} />
                            </div>
                            <div className="flex gap-2 items-center flex-1 justify-end">
                                <input placeholder="Search logs..." className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 w-48" value={search} onChange={e=>setSearch(e.target.value)} />
                                <button onClick={()=>exportMaint(true)} className="bg-green-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-green-700 text-xs"><FileText/> Excel</button>
                                <button onClick={()=>exportMaint(false)} className="bg-red-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-red-700 text-xs"><Printer/> PDF</button>
                                <button onClick={handleCreateMaintenance} className="bg-orange-600 text-white px-3 py-2 rounded flex gap-2"><Wrench/> Log Repair</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-500 p-3 rounded shadow">
                                <div className="text-xs uppercase text-blue-800 dark:text-blue-300 font-bold">Total Labor</div>
                                <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{fmtMoney(totalLabor)}</div>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900 border-l-4 border-purple-500 p-3 rounded shadow">
                                <div className="text-xs uppercase text-purple-800 dark:text-purple-300 font-bold">Total Parts</div>
                                <div className="text-xl font-bold text-purple-900 dark:text-purple-100">{fmtMoney(totalParts)}</div>
                            </div>
                            <div className="bg-teal-50 dark:bg-teal-900 border-l-4 border-teal-500 p-3 rounded shadow">
                                <div className="text-xs uppercase text-teal-800 dark:text-teal-300 font-bold">Grand Total</div>
                                <div className="text-xl font-bold text-teal-900 dark:text-teal-100">{fmtMoney(totalGrand)}</div>
                            </div>
                        </div>
                     <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-orange-600 text-white">
                                <tr>
                                    <th className="p-3">Code</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Truck</th>
                                    <th className="p-3">Description</th>
                                    <th className="p-3">Mechanic</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Repair Time</th>
                                    <th className="p-3 text-right">Labor</th>
                                    <th className="p-3 text-right">Parts</th>
                                    <th className="p-3 text-right">Total</th>
                                    <th className="p-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMaint.map(m => (
                                    <tr key={m.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300 align-top">
                                        <td className="p-3 font-mono text-xs text-orange-700 dark:text-orange-400">{m.maintenanceCode || '-'}</td>
                                        <td className="p-3">{fmtDate(m.date)}</td>
                                        <td className="p-3 font-bold">{m.plateNumber}</td>
                                        <td className="p-3 max-w-[200px]">{m.description}<div className="text-xs text-gray-500 dark:text-gray-400">Supplier: {m.supplier}</div></td>
                                        <td className="p-3">{m.mechanicName || '-'}</td>
                                        <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${m.repairType==='Rescue'?'bg-red-100 text-red-800':'bg-green-100 text-green-800'}`}>{m.repairType || 'Maintenance'}</span></td>
                                        <td className="p-3 text-xs">
                                            {m.startRepair && <div>Start: {new Date(m.startRepair).toLocaleString()}</div>}
                                            {m.endRepair && <div>End: {new Date(m.endRepair).toLocaleString()}</div>}
                                        </td>
                                        <td className="p-3 text-right">{fmtMoney(m.laborCost)}</td>
                                        <td className="p-3 text-right">{fmtMoney(m.partsCost)}</td>
                                        <td className="p-3 text-right font-bold">{fmtMoney((Number(m.laborCost)||0)+(Number(m.partsCost)||0))}</td>
                                        <td className="p-3 flex gap-2">
                                            <button type="button" onClick={(e)=>{e.stopPropagation(); handleEditMaintenance(m);}} className="text-blue-600 dark:text-blue-400"><Edit/></button>
                                            <button type="button" onClick={(e)=>{e.stopPropagation(); setDeleteConfirm({id: m.id, collection: 'maintenance'})}} className="text-red-600 hover:text-red-800"><Trash2/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {subTab === 'inventory' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded border-l-4 border-blue-600 shadow">
                            <div className="text-sm font-bold text-blue-800 dark:text-blue-300">Total Quantity</div>
                            <div className="text-2xl font-bold dark:text-blue-100">{data.inventory.reduce((a,b)=>a+(b.stock||0),0)}</div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900 p-4 rounded border-l-4 border-orange-600 shadow">
                            <div className="text-sm font-bold text-orange-800 dark:text-orange-300">Total Item Cost</div>
                            <div className="text-2xl font-bold dark:text-orange-100">{fmtMoney(data.inventory.reduce((a,b)=>a+((b.stock||0)*(b.cost||0)),0))}</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900 p-4 rounded border-l-4 border-green-600 shadow">
                            <div className="text-sm font-bold text-green-800 dark:text-green-300">Total Selling Price</div>
                            <div className="text-2xl font-bold dark:text-green-100">{fmtMoney(data.inventory.reduce((a,b)=>a+((b.stock||0)*(b.price||0)),0))}</div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded shadow">
                        <input placeholder="Search inventory..." className="border p-2 rounded w-64 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={invSearch} onChange={e=>setInvSearch(e.target.value)} />
                        <div className="flex gap-2">
                            <button onClick={()=>exportInventory(true)} className="bg-green-600 text-white px-3 py-2 rounded text-xs flex items-center gap-1 hover:bg-green-700"><FileText/> Excel</button>
                            <button onClick={()=>exportInventory(false)} className="bg-gray-600 text-white px-3 py-2 rounded text-xs flex items-center gap-1 hover:bg-gray-700"><Printer/> Print</button>
                            <button onClick={()=>{setInvForm({date: new Date().toISOString().split('T')[0]}); setInvModal(true)}} className="bg-teal-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-700"><Plus/> Add Item</button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-teal-700 text-white">
                                <tr>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Store</th>
                                    <th className="p-3">Spare Parts / Materials</th>
                                    <th className="p-3">Item Code</th>
                                    <th className="p-3 text-center">Quantity</th>
                                    <th className="p-3 text-right">Item Cost</th>
                                    <th className="p-3 text-right">Total Item Cost</th>
                                    <th className="p-3 text-right">Selling Price</th>
                                    <th className="p-3 text-right">Total Selling Price</th>
                                    <th className="p-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.inventory.filter(i=>i.item.toLowerCase().includes(invSearch.toLowerCase()) || i.itemCode.toLowerCase().includes(invSearch.toLowerCase())).map(i => (
                                    <tr key={i.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                        <td className="p-3">{fmtDate(i.lastUpdated)}</td>
                                        <td className="p-3">{i.store || '-'}</td>
                                        <td className="p-3 font-bold">{i.item}</td>
                                        <td className="p-3 font-mono">{i.itemCode}</td>
                                        <td className="p-3 text-center font-bold">{i.stock} {i.unit}</td>
                                        <td className="p-3 text-right">{fmtMoney(i.cost)}</td>
                                        <td className="p-3 text-right">{fmtMoney((i.stock||0)*(i.cost||0))}</td>
                                        <td className="p-3 text-right">{fmtMoney(i.price)}</td>
                                        <td className="p-3 text-right">{fmtMoney((i.stock||0)*(i.price||0))}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={()=>{setInvForm({...i, replenishment: 0, date: i.lastUpdated || new Date().toISOString().split('T')[0]}); setInvModal(true)}} className="text-blue-600 dark:text-blue-400 hover:text-blue-800"><Edit/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* History and Modals same as existing */}
            {subTab === 'history' && (
                <div className="space-y-4">
                    <div className="flex gap-4 items-center mb-4">
                        <button onClick={()=>setHistoryMode('inventory')} className={`px-4 py-2 rounded font-bold text-sm ${historyMode==='inventory' ? 'bg-teal-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>Inventory Logs</button>
                        <button onClick={()=>setHistoryMode('releases')} className={`px-4 py-2 rounded font-bold text-sm ${historyMode==='releases' ? 'bg-teal-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>Service Records (Releases)</button>
                        <input placeholder="Search history..." className="ml-auto border p-2 rounded w-64 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={histSearch} onChange={e=>setHistSearch(e.target.value)} />
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto">
                        {historyMode === 'inventory' ? (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-800 text-white">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Item Code</th>
                                        <th className="p-3">Item Name</th>
                                        <th className="p-3">Issued To / From</th>
                                        <th className="p-3 text-center">Quantity</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.inventory_transactions || []).filter(h => JSON.stringify(h).toLowerCase().includes(histSearch.toLowerCase()))
                                        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(h => (
                                        <tr key={h.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                            <td className="p-3">{new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString()}</td>
                                            <td className="p-3 font-mono text-xs">{h.itemCode}</td>
                                            <td className="p-3 font-bold">{h.itemName}</td>
                                            <td className="p-3">{h.issuedTo}</td>
                                            <td className="p-3 text-center font-bold text-lg">{h.type === 'Release' ? '-' : '+'}{h.quantity}</td>
                                            <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${h.type === 'Release' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{h.type}</span></td>
                                            <td className="p-3 italic text-gray-500 dark:text-gray-400">{h.remarks}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-800 text-white">
                                    <tr>
                                        <th className="p-3">Trans No</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Bill To</th>
                                        <th className="p-3">Plate No</th>
                                        <th className="p-3 text-right">Parts</th>
                                        <th className="p-3 text-right">Labor</th>
                                        <th className="p-3 text-right">Total</th>
                                        <th className="p-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.releases || []).filter(r => JSON.stringify(r).toLowerCase().includes(histSearch.toLowerCase()))
                                        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(r => (
                                        <tr key={r.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                            <td className="p-3 font-mono">{r.transactionNo}</td>
                                            <td className="p-3">{fmtDate(r.date)}</td>
                                            <td className="p-3">{r.billTo}</td>
                                            <td className="p-3 font-bold">{r.plateNumber}</td>
                                            <td className="p-3 text-right">{fmtMoney(r.subtotalParts)}</td>
                                            <td className="p-3 text-right">{fmtMoney(r.subtotalLabor)}</td>
                                            <td className="p-3 text-right font-bold text-teal-600 dark:text-teal-400">{fmtMoney(r.grandTotal)}</td>
                                            <td className="p-3 text-center">
                                                <button onClick={()=>setDeleteConfirm({id: r.id, collection: 'releases'})} className="text-red-500 hover:text-red-700"><Trash2/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Maintenance Modal */}
            <Modal isOpen={modal && subTab==='maintenance'} onClose={()=>setModal(false)} title="Log Maintenance" large>
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 grid grid-cols-4 gap-4">
                        <div><label className="font-bold text-xs text-orange-700 dark:text-orange-400">Maintenance Code</label><input disabled className="border p-2 rounded w-full bg-orange-50 font-mono font-bold dark:bg-gray-700 dark:text-orange-300" value={maintForm.maintenanceCode||'Auto-Generated'} /></div>
                        <div><label className="font-bold text-xs">Date</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.date||''} onChange={e=>setMaintForm({...maintForm, date: e.target.value})} /></div>
                        <div>
                            <label className="font-bold text-xs">Truck</label>
                            <select className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.plateNumber||''} onChange={e=>setMaintForm({...maintForm, plateNumber: e.target.value})}>
                                <option value="">Select Truck</option>
                                {data.trucks.map(t=><option key={t.id} value={t.plateNumber}>{t.plateNumber}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="font-bold text-xs">Repair Type</label>
                            <select className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.repairType||'Maintenance'} onChange={e=>setMaintForm({...maintForm, repairType: e.target.value as any})}>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Rescue">Rescue</option>
                            </select>
                        </div>
                    </div>
                    <div className="col-span-2"><label className="font-bold text-xs">Description of Repair</label><textarea className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.description||''} onChange={e=>setMaintForm({...maintForm, description: e.target.value})} /></div>
                    <div><label className="font-bold text-xs">Supplier / Shop</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.supplier||''} onChange={e=>setMaintForm({...maintForm, supplier: e.target.value})} /></div>
                    <div><label className="font-bold text-xs">Name of Mechanic</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.mechanicName||''} onChange={e=>setMaintForm({...maintForm, mechanicName: e.target.value})} /></div>
                    <div><label className="font-bold text-xs">Start of Repair</label><input type="datetime-local" className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.startRepair||''} onChange={e=>setMaintForm({...maintForm, startRepair: e.target.value})} /></div>
                    <div><label className="font-bold text-xs">End of Repair</label><input type="datetime-local" className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.endRepair||''} onChange={e=>setMaintForm({...maintForm, endRepair: e.target.value})} /></div>
                    <div><label className="font-bold text-xs">Labor Cost</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.laborCost||''} onChange={e=>setMaintForm({...maintForm, laborCost: Number(e.target.value)})} /></div>
                    <div><label className="font-bold text-xs">Parts Cost</label><input type="number" className="border p-2 rounded w-full dark:bg-gray-800" value={maintForm.partsCost||''} onChange={e=>setMaintForm({...maintForm, partsCost: Number(e.target.value)})} /></div>
                    <div className="col-span-2 flex justify-between items-center bg-gray-100 p-2 rounded dark:bg-gray-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={maintForm.isInvestorCharged||false} onChange={e=>setMaintForm({...maintForm, isInvestorCharged: e.target.checked})} />
                            <span className="dark:text-gray-300 font-bold text-sm">Charge to Investor?</span>
                        </label>
                        <button type="button" onClick={handleOpenInspection} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-1">
                            <FileText className="w-3 h-3"/> Add Mechanic Feedback
                        </button>
                    </div>
                    <button onClick={handleSaveMaint} className="col-span-2 bg-orange-600 text-white w-full py-3 rounded font-bold hover:bg-orange-700">Save Log</button>
                </div>
            </Modal>

            {/* Inventory Modal */}
            <Modal isOpen={invModal} onClose={()=>setInvModal(false)} title="Inventory Item Details">
                {/* ... existing inventory modal content ... */}
                <div className="space-y-4 text-sm">
                    <div>
                        <label className="block text-xs font-bold mb-1 dark:text-gray-300">Date</label>
                        <input type="date" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" value={invForm.date||''} onChange={e=>setInvForm({...invForm, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 dark:text-gray-300 text-teal-700 dark:text-teal-400">Item Code (Scan/Type to Auto-detect)</label>
                        <input className="border p-2 rounded w-full font-bold dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 outline-none" value={invForm.itemCode||''} onChange={e=>handleInvCodeChange(e.target.value)} autoFocus placeholder="Enter Item Code" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 dark:text-gray-300">Store</label>
                        <input className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" value={invForm.store||''} onChange={e=>setInvForm({...invForm, store: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 dark:text-gray-300">Spare Parts / Materials (Name)</label>
                        <input className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" value={invForm.item||''} onChange={e=>setInvForm({...invForm, item: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 dark:text-gray-300">Quantity (Add/Stock)</label>
                            <input type="number" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 font-bold text-blue-600" value={invForm.replenishment||''} onChange={e=>setInvForm({...invForm, replenishment: Number(e.target.value)})} placeholder="0" />
                            {invForm.id && <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Current Existing Stock: {invForm.stock}</div>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 dark:text-gray-300">Unit</label>
                            <input className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" value={invForm.unit||''} onChange={e=>setInvForm({...invForm, unit: e.target.value})} placeholder="pcs, set, ltr" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 bg-orange-50 p-3 rounded border border-orange-100 dark:bg-gray-700 dark:border-gray-600">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-orange-800 dark:text-orange-300">Item Cost</label>
                            <input type="number" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-500 dark:text-gray-200" value={invForm.cost||''} onChange={e=>setInvForm({...invForm, cost: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-orange-800 dark:text-orange-300">Total Item Cost (Input)</label>
                            <input disabled className="border p-2 rounded w-full bg-orange-100 font-bold dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200" value={fmtMoney((Number(invForm.replenishment)||0) * (Number(invForm.cost)||0))} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 bg-green-50 p-3 rounded border border-green-100 dark:bg-gray-700 dark:border-gray-600">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-green-800 dark:text-green-300">Selling Price</label>
                            <input type="number" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-500 dark:text-gray-200" value={invForm.price||''} onChange={e=>setInvForm({...invForm, price: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-green-800 dark:text-green-300">Total Selling Price (Input)</label>
                            <input disabled className="border p-2 rounded w-full bg-green-100 font-bold dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200" value={fmtMoney((Number(invForm.replenishment)||0) * (Number(invForm.price)||0))} />
                        </div>
                    </div>
                    <div className="pt-2">
                         <label className="block text-xs font-bold mb-1 dark:text-gray-300">Reorder Level</label>
                         <input type="number" className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" value={invForm.reorderLevel||''} onChange={e=>setInvForm({...invForm, reorderLevel: Number(e.target.value)})} />
                    </div>
                    <button onClick={handleSaveInv} className="bg-teal-600 text-white w-full py-3 rounded font-bold hover:bg-teal-700 mt-4">Save Inventory</button>
                </div>
            </Modal>

            {/* Confirm Delete */}
            <Modal isOpen={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="Confirm Delete">
                <div className="space-y-4 p-4">
                    <p className="text-lg">Are you sure you want to delete this record?</p>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
