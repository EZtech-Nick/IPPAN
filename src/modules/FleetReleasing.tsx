
import React, { useState, useEffect } from 'react';
import { AppData, ReleaseRecord, ReleaseItem, ServiceItem } from '../types';
import { fbService } from '../services/firebase';
import { Plus, Trash2, Printer, Settings } from '../components/Icons';
import { fmtMoney, fmtDate, cleanForPDF } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    data: AppData;
}

export const FleetReleasing: React.FC<Props> = ({ data }) => {
    // Header Info (Default)
    const [header, setHeader] = useState({
        companyName: 'IPPAN Transport Services',
        address: '123 Mechanic Street, Quezon City, Philippines',
        contact: '0917-XXX-XXXX'
    });
    const [editHeader, setEditHeader] = useState(false);

    // Billing Info
    const [billTo, setBillTo] = useState('');
    const [billAddress, setBillAddress] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [plateNumber, setPlateNumber] = useState('');
    const [transactionNo, setTransactionNo] = useState('');

    // Tables
    const [items, setItems] = useState<ReleaseItem[]>([]);
    const [services, setServices] = useState<ServiceItem[]>([]);

    // Signatories
    const [issuedBy, setIssuedBy] = useState('');
    const [receivedBy, setReceivedBy] = useState('');

    // --- Logic ---

    // Generate Transaction ID on mount or data change
    useEffect(() => {
        if (!transactionNo) {
            const d = new Date();
            const yymm = d.getFullYear().toString().substr(-2) + (d.getMonth() + 1).toString().padStart(2, '0');
            const count = (data.releases || []).length + 1;
            setTransactionNo(`REL-${yymm}-${count.toString().padStart(4, '0')}`);
        }
    }, [data.releases]);

    // Item Calculations
    const updateItem = (index: number, field: keyof ReleaseItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        // Auto-detect Logic
        if (field === 'itemCode') {
            const invItem = data.inventory.find(i => i.itemCode === value);
            if (invItem) {
                item.description = invItem.item;
                item.unitPrice = invItem.price || 0;
            }
        }

        // Compute Total
        item.totalPrice = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        newItems[index] = item;
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { itemCode: '', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

    // Service Calculations
    const updateService = (index: number, field: keyof ServiceItem, value: any) => {
        const newServices = [...services];
        newServices[index] = { ...newServices[index], [field]: value };
        setServices(newServices);
    };

    const addService = () => setServices([...services, { description: '', amount: 0 }]);
    const removeService = (idx: number) => setServices(services.filter((_, i) => i !== idx));

    // Totals
    const subtotalParts = items.reduce((sum, i) => sum + i.totalPrice, 0);
    const subtotalLabor = services.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const grandTotal = subtotalParts + subtotalLabor;

    const handleSave = async () => {
        if (!plateNumber) return alert("Please select a Plate Number");
        if (items.length === 0 && services.length === 0) return alert("Please add items or services");

        if(!confirm("Process this release? This will deduct items from inventory.")) return;

        // 1. Create Release Record
        const record: Partial<ReleaseRecord> = {
            companyName: header.companyName,
            companyAddress: header.address,
            companyContact: header.contact,
            billTo,
            billAddress,
            date,
            transactionNo,
            plateNumber,
            items,
            services,
            subtotalParts,
            subtotalLabor,
            grandTotal,
            issuedBy,
            receivedBy
        };

        await fbService.add('releases', record);

        // 2. Deduct Inventory & Create Transaction Logs
        for (const item of items) {
            const invItem = data.inventory.find(i => i.itemCode === item.itemCode);
            if (invItem) {
                // Update Stock
                const newStock = (invItem.stock || 0) - item.quantity;
                await fbService.update('inventory', invItem.id, { stock: newStock });

                // Log Transaction
                await fbService.add('inventory_transactions', {
                    date: new Date().toISOString(), // Use current timestamp for log accuracy
                    itemCode: item.itemCode,
                    itemName: item.description,
                    issuedTo: `${plateNumber} (REL: ${transactionNo})`,
                    quantity: item.quantity,
                    remarks: 'Service Release',
                    type: 'Release'
                });
            }
        }

        alert("Transaction Processed Successfully!");
        // Reset Form
        setItems([]);
        setServices([]);
        setBillTo('');
        setBillAddress('');
        setPlateNumber('');
        setTransactionNo(''); // Will regenerate
    };

    const handlePrint = () => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(header.companyName, 14, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(header.address, 14, 26);
        doc.text(header.contact, 14, 31);

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("SERVICE INVOICE", 195, 20, { align: 'right' });
        doc.setFontSize(10);
        doc.text(transactionNo, 195, 26, { align: 'right' });

        // Bill To Info
        const startY = 45;
        doc.setFont("helvetica", "bold");
        doc.text("Bill To:", 14, startY);
        doc.setFont("helvetica", "normal");
        doc.text(billTo, 35, startY);
        
        doc.setFont("helvetica", "bold");
        doc.text("Address:", 14, startY + 5);
        doc.setFont("helvetica", "normal");
        doc.text(billAddress, 35, startY + 5);

        doc.setFont("helvetica", "bold");
        doc.text("Date:", 140, startY);
        doc.setFont("helvetica", "normal");
        doc.text(fmtDate(date), 165, startY);

        doc.setFont("helvetica", "bold");
        doc.text("Plate No:", 140, startY + 5);
        doc.setFont("helvetica", "normal");
        doc.text(plateNumber, 165, startY + 5);

        let finalY = startY + 15;

        // Table 1: Particulars
        if (items.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.text("Particulars / Parts", 14, finalY);
            autoTable(doc, {
                startY: finalY + 2,
                head: [['Code', 'Description', 'Qty', 'Unit Price', 'Total']],
                body: items.map(i => [
                    i.itemCode,
                    i.description,
                    i.quantity,
                    cleanForPDF(fmtMoney(i.unitPrice)),
                    cleanForPDF(fmtMoney(i.totalPrice))
                ]),
                theme: 'grid',
                headStyles: { fillColor: [66, 66, 66] },
                columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } }
            });
            finalY = (doc as any).lastAutoTable.finalY + 2;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`Subtotal Parts: ${cleanForPDF(fmtMoney(subtotalParts))}`, 195, finalY + 5, { align: 'right' });
            finalY += 10;
        }

        // Table 2: Services
        if (services.length > 0) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("Service Rendered", 14, finalY);
            autoTable(doc, {
                startY: finalY + 2,
                head: [['Description', 'Labor Cost']],
                body: services.map(s => [
                    s.description,
                    cleanForPDF(fmtMoney(s.amount))
                ]),
                theme: 'grid',
                headStyles: { fillColor: [66, 66, 66] },
                columnStyles: { 1: { halign: 'right' } }
            });
            finalY = (doc as any).lastAutoTable.finalY + 2;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`Subtotal Labor: ${cleanForPDF(fmtMoney(subtotalLabor))}`, 195, finalY + 5, { align: 'right' });
            finalY += 10;
        }

        // Grand Total
        doc.setFillColor(240, 240, 240);
        doc.rect(140, finalY, 60, 10, 'F');
        doc.setFontSize(12);
        doc.setTextColor(0,0,0);
        doc.text(`TOTAL: ${cleanForPDF(fmtMoney(grandTotal))}`, 195, finalY + 7, { align: 'right' });

        // Signatories
        finalY += 30;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        doc.text("Issued by:", 14, finalY);
        doc.text(issuedBy, 40, finalY);
        doc.line(40, finalY+1, 90, finalY+1);

        doc.text("Received by:", 110, finalY);
        doc.text(receivedBy, 135, finalY);
        doc.line(135, finalY+1, 195, finalY+1);

        doc.save(`Release_${transactionNo}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded shadow border-t-4 border-teal-600">
                {/* Header Edit Toggle */}
                <div className="flex justify-end mb-2">
                    <button onClick={()=>setEditHeader(!editHeader)} className="text-gray-400 hover:text-teal-600"><Settings/></button>
                </div>
                
                {/* Header Section */}
                <div className="text-center mb-6 border-b pb-4 dark:border-gray-700">
                    {editHeader ? (
                        <div className="grid grid-cols-1 gap-2 max-w-md mx-auto">
                            <input className="border p-1 text-center font-bold text-xl" value={header.companyName} onChange={e=>setHeader({...header, companyName: e.target.value})} />
                            <input className="border p-1 text-center" value={header.address} onChange={e=>setHeader({...header, address: e.target.value})} />
                            <input className="border p-1 text-center" value={header.contact} onChange={e=>setHeader({...header, contact: e.target.value})} />
                        </div>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 uppercase">{header.companyName}</h1>
                            <p className="text-gray-600 dark:text-gray-400">{header.address}</p>
                            <p className="text-gray-600 dark:text-gray-400">{header.contact}</p>
                        </>
                    )}
                </div>

                {/* Billing Details */}
                <div className="grid grid-cols-2 gap-8 mb-6">
                    <div className="space-y-3">
                        <div className="flex items-center">
                            <label className="w-24 font-bold text-gray-600 dark:text-gray-300">Bill To:</label>
                            <input className="border-b p-1 flex-1 outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600" value={billTo} onChange={e=>setBillTo(e.target.value)} placeholder="Client Name" />
                        </div>
                        <div className="flex items-center">
                            <label className="w-24 font-bold text-gray-600 dark:text-gray-300">Address:</label>
                            <input className="border-b p-1 flex-1 outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600" value={billAddress} onChange={e=>setBillAddress(e.target.value)} placeholder="Client Address" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center">
                            <label className="w-32 font-bold text-gray-600 dark:text-gray-300 text-right pr-4">Trans. No:</label>
                            <input className="border-b p-1 flex-1 outline-none font-mono font-bold text-red-600 dark:bg-gray-800 dark:border-gray-600" value={transactionNo} readOnly />
                        </div>
                        <div className="flex items-center">
                            <label className="w-32 font-bold text-gray-600 dark:text-gray-300 text-right pr-4">Date:</label>
                            <input type="date" className="border-b p-1 flex-1 outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600" value={date} onChange={e=>setDate(e.target.value)} />
                        </div>
                        <div className="flex items-center">
                            <label className="w-32 font-bold text-gray-600 dark:text-gray-300 text-right pr-4">Plate No:</label>
                            <select className="border-b p-1 flex-1 outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600" value={plateNumber} onChange={e=>setPlateNumber(e.target.value)}>
                                <option value="">Select Truck</option>
                                {data.trucks.map(t=><option key={t.id} value={t.plateNumber}>{t.plateNumber}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table 1: Particulars */}
                <div className="mb-6">
                    <h3 className="font-bold text-teal-800 dark:text-teal-400 border-b-2 border-teal-600 mb-2 uppercase">Particulars (Spare Parts)</h3>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-2 text-left w-32">Item Code</th>
                                <th className="p-2 text-left">Description</th>
                                <th className="p-2 text-center w-20">Qty</th>
                                <th className="p-2 text-right w-32">Unit Price</th>
                                <th className="p-2 text-right w-32">Total</th>
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx} className="border-b dark:border-gray-700">
                                    <td className="p-1">
                                        <input 
                                            className="w-full border p-1 rounded dark:bg-gray-800 dark:text-white" 
                                            value={item.itemCode} 
                                            onChange={e=>updateItem(idx, 'itemCode', e.target.value)}
                                            list="inv-list"
                                            placeholder="Code"
                                        />
                                    </td>
                                    <td className="p-1">
                                        <input className="w-full border p-1 rounded dark:bg-gray-800 dark:text-white" value={item.description} onChange={e=>updateItem(idx, 'description', e.target.value)} />
                                    </td>
                                    <td className="p-1">
                                        <input type="number" className="w-full border p-1 rounded text-center dark:bg-gray-800 dark:text-white" value={item.quantity} onChange={e=>updateItem(idx, 'quantity', Number(e.target.value))} />
                                    </td>
                                    <td className="p-1">
                                        <input type="number" className="w-full border p-1 rounded text-right dark:bg-gray-800 dark:text-white" value={item.unitPrice} onChange={e=>updateItem(idx, 'unitPrice', Number(e.target.value))} />
                                    </td>
                                    <td className="p-1 text-right font-bold dark:text-gray-200">
                                        {fmtMoney(item.totalPrice)}
                                    </td>
                                    <td className="p-1 text-center">
                                        <button onClick={()=>removeItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={addItem} className="mt-2 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-white px-2 py-1 rounded flex items-center gap-1"><Plus className="w-3 h-3"/> Add Item</button>
                    <datalist id="inv-list">{data.inventory.map(i => <option key={i.id} value={i.itemCode}>{i.item}</option>)}</datalist>
                    
                    <div className="flex justify-end mt-2">
                        <div className="font-bold text-gray-700 dark:text-gray-300">Subtotal Parts: {fmtMoney(subtotalParts)}</div>
                    </div>
                </div>

                {/* Table 2: Services */}
                <div className="mb-6">
                    <h3 className="font-bold text-teal-800 dark:text-teal-400 border-b-2 border-teal-600 mb-2 uppercase">Service Rendered</h3>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-2 text-left">Type of Service / Labor</th>
                                <th className="p-2 text-right w-48">Cost</th>
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map((svc, idx) => (
                                <tr key={idx} className="border-b dark:border-gray-700">
                                    <td className="p-1">
                                        <input className="w-full border p-1 rounded dark:bg-gray-800 dark:text-white" value={svc.description} onChange={e=>updateService(idx, 'description', e.target.value)} placeholder="Service Description" />
                                    </td>
                                    <td className="p-1">
                                        <input type="number" className="w-full border p-1 rounded text-right dark:bg-gray-800 dark:text-white" value={svc.amount} onChange={e=>updateService(idx, 'amount', Number(e.target.value))} />
                                    </td>
                                    <td className="p-1 text-center">
                                        <button onClick={()=>removeService(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={addService} className="mt-2 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-white px-2 py-1 rounded flex items-center gap-1"><Plus className="w-3 h-3"/> Add Service</button>
                    
                    <div className="flex justify-end mt-2">
                        <div className="font-bold text-gray-700 dark:text-gray-300">Subtotal Labor: {fmtMoney(subtotalLabor)}</div>
                    </div>
                </div>

                {/* Grand Total */}
                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-right mb-8">
                    <span className="text-lg font-bold text-gray-600 dark:text-gray-300 mr-4">GRAND TOTAL:</span>
                    <span className="text-2xl font-black text-teal-800 dark:text-teal-400">{fmtMoney(grandTotal)}</span>
                </div>

                {/* Signatories */}
                <div className="grid grid-cols-2 gap-20 mt-8 mb-8">
                    <div>
                        <input className="w-full border-b-2 border-gray-400 dark:bg-gray-800 dark:text-white outline-none text-center font-bold pb-1" value={issuedBy} onChange={e=>setIssuedBy(e.target.value)} placeholder="Name of Issuer" />
                        <div className="text-center text-xs text-gray-500 mt-1 uppercase font-bold">Issued By</div>
                    </div>
                    <div>
                        <input className="w-full border-b-2 border-gray-400 dark:bg-gray-800 dark:text-white outline-none text-center font-bold pb-1" value={receivedBy} onChange={e=>setReceivedBy(e.target.value)} placeholder="Name of Receiver" />
                        <div className="text-center text-xs text-gray-500 mt-1 uppercase font-bold">Received By</div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-4 border-t pt-6 dark:border-gray-700">
                    <button onClick={handlePrint} className="bg-gray-600 text-white px-6 py-3 rounded font-bold hover:bg-gray-700 flex items-center gap-2"><Printer/> Print Invoice</button>
                    <button onClick={handleSave} className="bg-teal-700 text-white px-8 py-3 rounded font-bold hover:bg-teal-800 shadow-lg">Process & Save</button>
                </div>
            </div>
        </div>
    );
};
