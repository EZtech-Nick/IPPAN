
import React, { useState, useEffect } from 'react';
import { AppData, InspectionChecklist } from '../types';
import { fbService } from '../services/firebase';
import { Modal } from '../components/Modal';
import { Plus, Edit, Trash2, Printer } from '../components/Icons';
import { fmtDate, exportToPDF } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    data: AppData;
    prefillData?: Partial<InspectionChecklist>;
    onClosePrefill?: () => void;
    modalOnly?: boolean;
    zIndex?: number;
}

export const FleetInspection: React.FC<Props> = ({ data, prefillData, onClosePrefill, modalOnly, zIndex }) => {
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<InspectionChecklist>>({});
    const [deleteConfirm, setDeleteConfirm] = useState<{id: string, collection: string} | null>(null);

    // Effect to handle external open request (from Maintenance)
    useEffect(() => {
        if (prefillData) {
            setForm({
                ...prefillData,
                date: prefillData.date || new Date().toISOString().split('T')[0],
            });
            setModal(true);
        }
    }, [prefillData]);

    const handleSave = async () => {
        if(form.id) await fbService.update('inspections', form.id, form);
        else await fbService.add('inspections', form);
        setModal(false);
        if(onClosePrefill) onClosePrefill();
    };

    const confirmDelete = async () => {
        if (deleteConfirm) {
            await fbService.remove(deleteConfirm.collection, deleteConfirm.id);
            setDeleteConfirm(null);
        }
    };

    const handlePrint = (item: InspectionChecklist) => {
        const doc = new jsPDF();
        
        doc.setFillColor(15, 118, 110);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text('MECHANIC INSPECTION CHECKLIST', 105, 13, { align: 'center' });
        
        doc.setTextColor(0,0,0);
        doc.setFontSize(10);
        
        // Basic Info
        const infoY = 30;
        doc.text(`Date: ${fmtDate(item.date)}`, 14, infoY);
        doc.text(`Plate No: ${item.plateNumber}`, 14, infoY + 6);
        doc.text(`Truck Model: ${item.truckModel || '-'}`, 14, infoY + 12);
        
        doc.text(`Location: ${item.location || '-'}`, 120, infoY);
        doc.text(`Odometer: ${item.odometer || '-'}`, 120, infoY + 6);
        doc.text(`Mechanic: ${item.mechanicName || '-'}`, 120, infoY + 12);
        if (item.maintenanceCode) {
            doc.text(`Ref: ${item.maintenanceCode}`, 170, 15); // Print code in header area
        }

        // Checklist Items
        const categories = [
            ['Engine and Fluids', item.engineFluids],
            ['Engine Performance', item.enginePerformance],
            ['Transmission & Drivetrain', item.transmission],
            ['Brake System', item.brakeSystem],
            ['Steering & Suspension', item.steeringSuspension],
            ['Tires & Wheels', item.tiresWheels],
            ['Electrical System', item.electricalSystem],
            ['Lights and Signals', item.lightsSignals],
            ['Body & Cab', item.bodyCab],
            ['Van/Cargo Body', item.vanCargoBody],
            ['Diesel / Fuel System', item.dieselFuelSystem],
            ['Safety & Accessories', item.safetyAccessories],
            ['Truck Appearance', item.truckAppearance],
            ['Overall Assessment', item.overallAssessment],
        ];

        autoTable(doc, {
            startY: 50,
            head: [['Category', 'Remarks / Condition']],
            body: categories.map(c => [c[0], c[1] || 'OK']),
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // Signatories Box
        doc.setDrawColor(0);
        doc.rect(14, finalY, 182, 50);
        
        doc.setFontSize(9);
        doc.text("Mechanic Confirmation:", 16, finalY + 6);
        doc.setFontSize(11);
        doc.text(item.mechanicSignName || '______________________', 16, finalY + 20);
        doc.setFontSize(8);
        doc.text("Signature over Printed Name", 16, finalY + 24);
        doc.text(`Date: ${fmtDate(item.mechanicSignDate)}`, 16, finalY + 30);

        doc.setFontSize(9);
        doc.text("Supervisor Confirmation:", 110, finalY + 6);
        doc.setFontSize(11);
        doc.text(item.supervisorSignName || '______________________', 110, finalY + 20);
        doc.setFontSize(8);
        doc.text("Signature over Printed Name", 110, finalY + 24);
        doc.text(`Date: ${fmtDate(item.supervisorSignDate)}`, 110, finalY + 30);

        // Office Remark
        doc.text("Office Remarks:", 16, finalY + 40);
        doc.text(item.officeRemarks || '', 40, finalY + 40);

        doc.save(`Inspection_${item.plateNumber}_${item.date}.pdf`);
    };

    const modalContent = (
        <Modal isOpen={modal} onClose={()=>{setModal(false); if(onClosePrefill) onClosePrefill();}} title="Mechanic Inspection Checklist" large zIndex={zIndex}>
            <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
                    <div className="col-span-4 font-bold text-teal-800 dark:text-teal-400 border-b pb-1 mb-2">1. General Information</div>
                    {form.maintenanceCode && (
                        <div className="col-span-4 bg-orange-100 text-orange-800 p-2 rounded mb-2 border border-orange-200 text-xs font-bold">
                            Linked Maintenance Code: {form.maintenanceCode}
                        </div>
                    )}
                    <div><label className="font-bold block mb-1 text-xs">Date</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-800" value={form.date||''} onChange={e=>setForm({...form, date: e.target.value})} /></div>
                    <div>
                        <label className="font-bold block mb-1 text-xs">Plate No (Auto)</label>
                        <input 
                            className="border p-2 rounded w-full dark:bg-gray-800" 
                            value={form.plateNumber||''} 
                            onChange={e=> {
                                const truck = data.trucks.find(t => t.plateNumber === e.target.value);
                                setForm({...form, plateNumber: e.target.value, truckModel: truck ? truck.model : form.truckModel});
                            }}
                            list="truck-list"
                        />
                        <datalist id="truck-list">{data.trucks.map(t=><option key={t.id} value={t.plateNumber} />)}</datalist>
                    </div>
                    <div><label className="font-bold block mb-1 text-xs">Truck Model</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.truckModel||''} onChange={e=>setForm({...form, truckModel: e.target.value})} /></div>
                    <div><label className="font-bold block mb-1 text-xs">Odometer</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.odometer||''} onChange={e=>setForm({...form, odometer: e.target.value})} /></div>
                    <div><label className="font-bold block mb-1 text-xs">Mechanic Name</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.mechanicName||''} onChange={e=>setForm({...form, mechanicName: e.target.value})} /></div>
                    <div><label className="font-bold block mb-1 text-xs">Location</label><input className="border p-2 rounded w-full dark:bg-gray-800" value={form.location||''} onChange={e=>setForm({...form, location: e.target.value})} /></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {[
                        { key: 'engineFluids', label: 'Engine and Fluids' },
                        { key: 'enginePerformance', label: 'Engine Performance' },
                        { key: 'transmission', label: 'Transmission & Drivetrain' },
                        { key: 'brakeSystem', label: 'Brake System' },
                        { key: 'steeringSuspension', label: 'Steering & Suspension' },
                        { key: 'tiresWheels', label: 'Tires & Wheels' },
                        { key: 'electricalSystem', label: 'Electrical System' },
                        { key: 'lightsSignals', label: 'Lights and Signals' },
                        { key: 'bodyCab', label: 'Body & Cab' },
                        { key: 'vanCargoBody', label: 'Van/Cargo Body' },
                        { key: 'dieselFuelSystem', label: 'Diesel / Fuel System' },
                        { key: 'safetyAccessories', label: 'Safety & Accessories' },
                        { key: 'truckAppearance', label: 'Truck Appearance & Body Condition' },
                        { key: 'overallAssessment', label: 'Overall Assessment' },
                    ].map((field) => (
                        <div key={field.key}>
                            <label className="font-bold block mb-1 text-xs text-gray-600 dark:text-gray-300">{field.label}</label>
                            <textarea 
                                className="border p-2 rounded w-full h-16 text-xs dark:bg-gray-800 dark:border-gray-600" 
                                placeholder="Enter remarks..."
                                value={(form as any)[field.key] || ''} 
                                onChange={e=>setForm({...form, [field.key]: e.target.value})} 
                            />
                        </div>
                    ))}
                </div>

                <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded grid grid-cols-2 gap-6 border dark:border-gray-700">
                    <div className="space-y-2">
                        <h4 className="font-bold text-sm">Mechanic Confirmation</h4>
                        <input className="border p-2 rounded w-full text-xs dark:bg-gray-800" placeholder="Name & Signature" value={form.mechanicSignName||''} onChange={e=>setForm({...form, mechanicSignName: e.target.value})} />
                        <input type="date" className="border p-2 rounded w-full text-xs dark:bg-gray-800" value={form.mechanicSignDate||''} onChange={e=>setForm({...form, mechanicSignDate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-sm">Supervisor Confirmation</h4>
                        <input className="border p-2 rounded w-full text-xs dark:bg-gray-800" placeholder="Name & Signature" value={form.supervisorSignName||''} onChange={e=>setForm({...form, supervisorSignName: e.target.value})} />
                        <input type="date" className="border p-2 rounded w-full text-xs dark:bg-gray-800" value={form.supervisorSignDate||''} onChange={e=>setForm({...form, supervisorSignDate: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                        <h4 className="font-bold text-sm">Office Remarks</h4>
                        <input className="border p-2 rounded w-full text-xs dark:bg-gray-800" placeholder="Office notes..." value={form.officeRemarks||''} onChange={e=>setForm({...form, officeRemarks: e.target.value})} />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button onClick={handleSave} className="bg-teal-700 text-white px-6 py-2 rounded font-bold shadow hover:bg-teal-800">Save Inspection</button>
                </div>
            </div>
        </Modal>
    );

    if (modalOnly) return modalContent;

    return (
        <div>
            <div className="flex justify-between mb-4">
                <input placeholder="Search inspection..." className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" value={search} onChange={e=>setSearch(e.target.value)} />
                <button onClick={()=>{setForm({date: new Date().toISOString().split('T')[0]}); setModal(true)}} className="bg-teal-600 text-white px-4 py-2 rounded flex gap-2"><Plus/> New Inspection</button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-teal-800 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Ref Code</th>
                            <th className="p-3">Plate No</th>
                            <th className="p-3">Mechanic</th>
                            <th className="p-3">Location</th>
                            <th className="p-3">Odometer</th>
                            <th className="p-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data.inspections || []).filter(i => i.plateNumber.toLowerCase().includes(search.toLowerCase()) || i.mechanicName.toLowerCase().includes(search.toLowerCase()))
                        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(i => (
                            <tr key={i.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300">
                                <td className="p-3">{fmtDate(i.date)}</td>
                                <td className="p-3 font-mono text-xs text-orange-600">{i.maintenanceCode || '-'}</td>
                                <td className="p-3 font-bold">{i.plateNumber}</td>
                                <td className="p-3">{i.mechanicName}</td>
                                <td className="p-3">{i.location}</td>
                                <td className="p-3">{i.odometer}</td>
                                <td className="p-3 text-center flex justify-center gap-2">
                                    <button onClick={()=>handlePrint(i)} className="text-gray-600 dark:text-gray-400 hover:text-black"><Printer/></button>
                                    <button onClick={()=>{setForm(i); setModal(true)}} className="text-blue-600 dark:text-blue-400"><Edit/></button>
                                    <button onClick={()=>setDeleteConfirm({id: i.id, collection: 'inspections'})} className="text-red-600 hover:text-red-800"><Trash2/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modalContent}

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
