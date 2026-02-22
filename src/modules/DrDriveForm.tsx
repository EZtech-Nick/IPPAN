
import React, { useState, useEffect } from 'react';
import { AppData, DrDriveJob, DrDrivePartItem, DrDriveServiceItem } from '../types';
import { fbService } from '../services/firebaseConfig';
import { Plus, Trash2, Printer } from '../components/Icons';
import { fmtMoney, fmtDate, cleanForPDF } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    data: AppData;
    form: Partial<DrDriveJob>;
    setForm: React.Dispatch<React.SetStateAction<Partial<DrDriveJob>>>;
    onClose: () => void;
}

export const DrDriveForm: React.FC<Props> = ({ data, form, setForm, onClose }) => {
    // Local state for inputs
    const [partCode, setPartCode] = useState('');
    const [partQty, setPartQty] = useState(1);
    
    const [serviceDesc, setServiceDesc] = useState('');
    const [serviceCost, setServiceCost] = useState('');

    // Auto Calculate Totals
    useEffect(() => {
        const tParts = (form.parts || []).reduce((sum, p) => sum + p.totalPrice, 0);
        const tLabor = (form.services || []).reduce((sum, s) => sum + s.amount, 0);
        const tGrand = tParts + tLabor;
        
        if (tParts !== form.totalParts || tLabor !== form.totalLabor || tGrand !== form.grandTotal) {
            setForm(prev => ({ ...prev, totalParts: tParts, totalLabor: tLabor, grandTotal: tGrand }));
        }
    }, [form.parts, form.services]);

    // --- Actions ---

    const handleAddPart = () => {
        const item = data.inventory.find(i => i.itemCode === partCode);
        if (!item) return alert("Item code not found in inventory.");
        
        // Check if already added
        // const existing = form.parts?.find(p => p.itemCode === partCode);
        // if (existing) return alert("Item already added. Please remove and re-add with correct quantity.");

        const unitPrice = item.price || 0; // Assuming price might be in inventory or defaulting 0
        const newItem: DrDrivePartItem = {
            itemCode: item.itemCode,
            itemName: item.item,
            quantity: partQty,
            unit: item.unit,
            unitPrice: unitPrice,
            totalPrice: unitPrice * partQty
        };

        setForm(prev => ({ ...prev, parts: [...(prev.parts || []), newItem] }));
        setPartCode('');
        setPartQty(1);
    };

    const handleRemovePart = (idx: number) => {
        setForm(prev => ({ ...prev, parts: prev.parts?.filter((_, i) => i !== idx) }));
    };

    const handleAddService = () => {
        if (!serviceDesc || !serviceCost) return alert("Please enter description and cost.");
        const newItem: DrDriveServiceItem = {
            description: serviceDesc,
            amount: Number(serviceCost)
        };
        setForm(prev => ({ ...prev, services: [...(prev.services || []), newItem] }));
        setServiceDesc('');
        setServiceCost('');
    };

    const handleRemoveService = (idx: number) => {
        setForm(prev => ({ ...prev, services: prev.services?.filter((_, i) => i !== idx) }));
    };

    const handleSave = async () => {
        if (!form.customerName) return alert("Customer Name required");
        
        // Save Job
        if (form.id) {
            await fbService.update('dr_drive_jobs', form.id, form);
        } else {
            await fbService.add('dr_drive_jobs', form);
            
            // Deduct Inventory Stock for new jobs
            if (form.parts && form.parts.length > 0) {
                for (const p of form.parts) {
                    const invItem = data.inventory.find(i => i.itemCode === p.itemCode);
                    if (invItem) {
                        const newStock = invItem.stock - p.quantity;
                        await fbService.update('inventory', invItem.id, { stock: newStock });
                        await fbService.add('inventory_transactions', {
                            date: new Date().toISOString(),
                            itemCode: p.itemCode,
                            itemName: p.itemName,
                            issuedTo: `JO: ${form.jobOrderNo}`,
                            quantity: p.quantity,
                            remarks: 'Used in Dr. Drive Job Order',
                            type: 'Release'
                        });
                    }
                }
            }
        }
        onClose();
    };

    const handlePrintReceipt = () => {
        const doc = new jsPDF();
        
        // --- HEADER ---
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Dr. DRIVE", 14, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("123 Mechanic Street,", 14, 25);
        doc.text("Quezon City, Philippines", 14, 29);
        doc.text("0917-XXX-XXXX", 14, 33);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("STATEMENT", 195, 20, { align: "right" });
        
        // --- INFO BLOCK ---
        const yStart = 45;
        
        // Bill To
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("BILL TO:", 14, yStart);
        doc.setFontSize(10);
        doc.text(form.customerName || '', 14, yStart + 5);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(form.address || '', 14, yStart + 10);
        doc.text(form.contactNumber || '', 14, yStart + 14);

        // Invoice Details
        doc.setFont("helvetica", "bold");
        doc.text("INVOICE NO.:", 130, yStart);
        doc.setFont("helvetica", "normal");
        doc.text(form.invoiceNo || '', 160, yStart);
        
        doc.setFont("helvetica", "bold");
        doc.text("DATE:", 148, yStart + 5);
        doc.setFont("helvetica", "normal");
        doc.text(fmtDate(form.date), 160, yStart + 5);

        // Divider
        doc.setDrawColor(200);
        doc.line(14, yStart + 18, 195, yStart + 18);

        // Vehicle Info
        const yVeh = yStart + 24;
        doc.setFont("helvetica", "bold");
        doc.text("PLATE NO::", 14, yVeh);
        doc.setFont("helvetica", "normal");
        doc.text(form.plateNumber || '', 35, yVeh);

        doc.setFont("helvetica", "bold");
        doc.text("JOB ORDER #:", 110, yVeh);
        doc.setFont("helvetica", "normal");
        doc.text(`${form.jobOrderNo} ${form.vehicleModel || ''}`, 135, yVeh);

        // --- PARTS TABLE ---
        let finalY = yVeh + 5;
        
        if (form.parts && form.parts.length > 0) {
            autoTable(doc, {
                startY: finalY,
                head: [['QTY', 'PARTICULARS / SPARE PARTS', 'UNIT PRICE', 'TOTAL PRICE']],
                body: form.parts.map(p => [
                    `${p.quantity} ${p.unit}`,
                    p.itemName,
                    cleanForPDF(fmtMoney(p.unitPrice)),
                    cleanForPDF(fmtMoney(p.totalPrice))
                ]),
                theme: 'grid',
                headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', lineColor: 200, lineWidth: 0.1 },
                bodyStyles: { lineColor: 200, lineWidth: 0.1 },
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 20, fontStyle: 'bold' },
                    2: { halign: 'right' },
                    3: { halign: 'right' }
                }
            });
            finalY = (doc as any).lastAutoTable.finalY;
        }

        // Subtotal Parts
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("SUBTOTAL:", 130, finalY + 6);
        doc.text(cleanForPDF(fmtMoney(form.totalParts)), 195, finalY + 6, { align: "right" });
        finalY += 10;

        // --- LABOR / SERVICES ---
        doc.setFillColor(220, 220, 220);
        doc.rect(14, finalY, 181, 6, 'F');
        doc.text("LABOR / SERVICE:", 16, finalY + 4);
        doc.text(cleanForPDF(fmtMoney(form.totalLabor)), 195, finalY + 4, { align: "right" });
        finalY += 7;

        form.services?.forEach(s => {
            doc.setFont("helvetica", "normal");
            doc.text(s.description, 16, finalY);
            finalY += 5;
        });

        // --- GRAND TOTALS ---
        finalY += 5;
        doc.setDrawColor(0);
        doc.line(14, finalY, 195, finalY);
        finalY += 6;
        
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL:", 130, finalY);
        doc.text(cleanForPDF(fmtMoney(form.totalLabor)), 195, finalY, { align: "right" }); // Show labor total again as per receipt? Or just go to grand total. Following logic of receipt
        
        finalY += 6;
        doc.setFillColor(240, 240, 240);
        doc.rect(14, finalY - 4, 181, 8, 'F');
        doc.text("TOTAL AMOUNT DUE:", 130, finalY + 1);
        doc.setFontSize(11);
        doc.text(cleanForPDF(fmtMoney(form.grandTotal)), 195, finalY + 1, { align: "right" });

        // --- FOOTER ---
        finalY += 25;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        
        doc.text("Issued By:", 30, finalY);
        doc.text("Received By:", 120, finalY);
        
        finalY += 10;
        doc.setFont("helvetica", "italic"); // Signature style
        doc.text(form.issuedBy || 'Admin', 30, finalY);
        
        doc.setDrawColor(100);
        doc.line(20, finalY + 1, 80, finalY + 1); // Line for Issued By
        doc.line(110, finalY + 1, 170, finalY + 1); // Line for Received By

        finalY += 15;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Payable upon Receipt of Spare Parts/Services", 105, finalY, { align: "center" });

        doc.save(`DrDrive_${form.invoiceNo}.pdf`);
    };

    return (
        <div className="flex gap-4 text-sm h-[80vh]">
            {/* Left Side: Form */}
            <div className="w-1/2 overflow-y-auto pr-2 space-y-4">
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded dark:bg-gray-700">
                    <h4 className="col-span-2 font-bold text-teal-700 dark:text-teal-400 border-b pb-1 mb-2">Customer & Vehicle</h4>
                    <div><label className="block text-xs font-bold">Customer Name</label><input className="border p-2 rounded w-full dark:bg-gray-600" value={form.customerName||''} onChange={e=>setForm({...form, customerName: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold">Plate Number</label><input className="border p-2 rounded w-full dark:bg-gray-600" value={form.plateNumber||''} onChange={e=>setForm({...form, plateNumber: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold">Address</label><input className="border p-2 rounded w-full dark:bg-gray-600" value={form.address||''} onChange={e=>setForm({...form, address: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold">Vehicle Model</label><input className="border p-2 rounded w-full dark:bg-gray-600" value={form.vehicleModel||''} onChange={e=>setForm({...form, vehicleModel: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold">Contact No.</label><input className="border p-2 rounded w-full dark:bg-gray-600" value={form.contactNumber||''} onChange={e=>setForm({...form, contactNumber: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold">Date</label><input type="date" className="border p-2 rounded w-full dark:bg-gray-600" value={form.date||''} onChange={e=>setForm({...form, date: e.target.value})} /></div>
                </div>

                <div className="bg-blue-50 p-3 rounded dark:bg-blue-900 dark:border-blue-700 border border-blue-100">
                    <h4 className="font-bold text-blue-700 dark:text-blue-300 border-b border-blue-200 pb-1 mb-2">Spare Parts (Inventory)</h4>
                    <div className="flex gap-2 mb-2">
                        <input 
                            list="inv-list" 
                            placeholder="Scan/Type Item Code" 
                            className="border p-2 rounded w-full dark:bg-gray-600 dark:text-white"
                            value={partCode}
                            onChange={e => setPartCode(e.target.value)}
                        />
                        <datalist id="inv-list">
                            {data.inventory.map(i => <option key={i.id} value={i.itemCode}>{i.item} (Stock: {i.stock})</option>)}
                        </datalist>
                        <input 
                            type="number" 
                            placeholder="Qty" 
                            className="border p-2 rounded w-20 dark:bg-gray-600"
                            value={partQty}
                            onChange={e => setPartQty(Number(e.target.value))}
                        />
                        <button onClick={handleAddPart} className="bg-blue-600 text-white px-3 rounded font-bold"><Plus/></button>
                    </div>
                    {/* List */}
                    <div className="space-y-1">
                        {form.parts?.map((p, i) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-white dark:bg-gray-800 p-2 rounded shadow-sm">
                                <div><span className="font-bold">{p.quantity} {p.unit}</span> {p.itemName}</div>
                                <div className="flex items-center gap-4">
                                    <span>{fmtMoney(p.totalPrice)}</span>
                                    <button onClick={()=>handleRemovePart(i)} className="text-red-500"><Trash2/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-orange-50 p-3 rounded dark:bg-orange-900 dark:border-orange-700 border border-orange-100">
                    <h4 className="font-bold text-orange-700 dark:text-orange-300 border-b border-orange-200 pb-1 mb-2">Labor / Services</h4>
                    <div className="flex gap-2 mb-2">
                        <input 
                            placeholder="Service Description" 
                            className="border p-2 rounded w-full dark:bg-gray-600"
                            value={serviceDesc}
                            onChange={e => setServiceDesc(e.target.value)}
                        />
                        <input 
                            type="number" 
                            placeholder="Cost" 
                            className="border p-2 rounded w-24 dark:bg-gray-600"
                            value={serviceCost}
                            onChange={e => setServiceCost(e.target.value)}
                        />
                        <button onClick={handleAddService} className="bg-orange-600 text-white px-3 rounded font-bold"><Plus/></button>
                    </div>
                    {/* List */}
                    <div className="space-y-1">
                        {form.services?.map((s, i) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-white dark:bg-gray-800 p-2 rounded shadow-sm">
                                <div>{s.description}</div>
                                <div className="flex items-center gap-4">
                                    <span>{fmtMoney(s.amount)}</span>
                                    <button onClick={()=>handleRemoveService(i)} className="text-red-500"><Trash2/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side: Receipt Preview / Totals */}
            <div className="w-1/2 flex flex-col bg-gray-100 dark:bg-gray-700 p-4 rounded border dark:border-gray-600">
                <div className="flex-1 bg-white dark:bg-gray-800 shadow-lg p-6 overflow-y-auto text-xs font-mono">
                    <div className="text-center font-bold text-lg mb-1">Dr. DRIVE</div>
                    <div className="text-center text-gray-500 mb-4">Quezon City, Philippines</div>
                    
                    <div className="flex justify-between border-b pb-2 mb-2">
                        <div>
                            <div>Invoice: {form.invoiceNo}</div>
                            <div>Date: {fmtDate(form.date)}</div>
                        </div>
                        <div className="text-right">
                            <div>Bill To: {form.customerName}</div>
                            <div>Plate: {form.plateNumber}</div>
                        </div>
                    </div>

                    <table className="w-full mb-4">
                        <thead><tr className="border-b"><th className="text-left">Item</th><th className="text-right">Total</th></tr></thead>
                        <tbody>
                            {form.parts?.map((p,i) => (
                                <tr key={`p-${i}`}>
                                    <td>{p.quantity}x {p.itemName}</td>
                                    <td className="text-right">{fmtMoney(p.totalPrice)}</td>
                                </tr>
                            ))}
                            {form.services?.map((s,i) => (
                                <tr key={`s-${i}`}>
                                    <td className="italic">{s.description}</td>
                                    <td className="text-right">{fmtMoney(s.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm"><span>Total Parts:</span> <span className="font-bold">{fmtMoney(form.totalParts)}</span></div>
                    <div className="flex justify-between text-sm"><span>Total Labor:</span> <span className="font-bold">{fmtMoney(form.totalLabor)}</span></div>
                    <div className="flex justify-between text-xl text-red-600 font-bold border-t pt-2 border-gray-300"><span>TOTAL DUE:</span> <span>{fmtMoney(form.grandTotal)}</span></div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        <button onClick={handlePrintReceipt} className="bg-gray-800 text-white py-2 rounded flex justify-center items-center gap-2 hover:bg-gray-900"><Printer/> Print Receipt</button>
                        <button onClick={handleSave} className="bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">Save Job Order</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
