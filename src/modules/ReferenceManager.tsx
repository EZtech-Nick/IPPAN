
import React, { useState, useMemo } from 'react';
import { AppData, RateMatrixItem } from '../types';
import { Modal } from '../components/Modal';
import { fbService, db, APP_ID } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { fmtMoney } from '../utils';
import * as XLSX from 'xlsx';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: AppData;
}

export const ReferenceManager: React.FC<Props> = ({ isOpen, onClose, data }) => {
    const [refTab, setRefTab] = useState<'origins' | 'types' | 'rate_matrix'>('origins');
    const [newRef, setNewRef] = useState('');
    const [matrixForm, setMatrixForm] = useState<Partial<RateMatrixItem>>({});
    const [matrixSearch, setMatrixSearch] = useState('');

    // Derived Data with Memoization to prevent lag
    const origins = (data.references?.find(r=>r.id==='origins')?.values || []);
    const types = (data.references?.find(r=>r.id==='types')?.values || []);
    
    const rateMatrix: RateMatrixItem[] = useMemo(() => {
        return (data.references?.find(r=>r.id==='rate_matrix')?.values || []).map(v => {
            try { return JSON.parse(v); } catch(e) { return null; }
        }).filter(v => v !== null);
    }, [data.references]);

    const filteredMatrix = useMemo(() => {
        return rateMatrix.filter(m => m.area.toLowerCase().includes(matrixSearch.toLowerCase()));
    }, [rateMatrix, matrixSearch]);

    const saveRef = async () => { 
        if(refTab === 'rate_matrix') {
            if(!matrixForm.area) {
                alert("Area/Destination is required.");
                return;
            }
            
            const newItem: RateMatrixItem = { 
                area: matrixForm.area, 
                rate: Number(matrixForm.rate) || 0, 
                driverRate: Number(matrixForm.driverRate) || 0, 
                helperRate: Number(matrixForm.helperRate) || 0 
            };

            const currentDoc = data.references.find(r=>r.id==='rate_matrix');
            // Filter out existing entry for same area to update it (replace logic)
            const otherVals = (currentDoc?.values || []).filter(v => { 
                try { return JSON.parse(v).area !== newItem.area } catch(e) { return true; }
            });
            
            const updatedVals = [...otherVals, JSON.stringify(newItem)];
            
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'references', 'rate_matrix'), { values: updatedVals }, { merge: true });
            setMatrixForm({});
        } else {
            if(!newRef) return;
            const currentDoc = data.references.find(r=>r.id===refTab);
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'references', refTab), { values: [...(currentDoc?.values||[]), newRef] }, { merge: true });
            setNewRef('');
        }
    };

    const deleteRef = async (val: string, isMatrix = false) => {
        if(!confirm("Are you sure you want to delete this reference?")) return;
        const id = isMatrix ? 'rate_matrix' : refTab;
        const currentDoc = data.references.find(r=>r.id===id);
        if(!currentDoc) return;
        await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'references', id), { values: currentDoc.values.filter(v => v !== val) }, { merge: true });
    };

    const handleMatrixFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(dataBuffer);
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][];
            const existingMap = new Map(rateMatrix.map(item => [item.area.toLowerCase(), item]));
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row[0]) continue; 
                const newItem: RateMatrixItem = { 
                    area: String(row[0]).trim(), 
                    rate: Number(row[1]) || 0, 
                    driverRate: Number(row[2]) || 0, 
                    helperRate: Number(row[3]) || 0 
                };
                existingMap.set(newItem.area.toLowerCase(), newItem);
            }
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'references', 'rate_matrix'), { values: Array.from(existingMap.values()).map(x => JSON.stringify(x)) }, { merge: true });
            alert("Rate Matrix updated!"); 
            e.target.value = ''; 
        } catch (error) { console.error(error); alert("Failed to parse Excel."); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Reference Manager">
            <div className="space-y-4">
                <div className="flex gap-2 border-b">
                    {['origins', 'types', 'rate_matrix'].map(t => (
                        <button key={t} onClick={()=>setRefTab(t as any)} className={`px-4 py-2 capitalize ${refTab===t ? 'border-b-2 border-teal-600 font-bold' : ''}`}>
                            {t === 'rate_matrix' ? 'Rate Matrix' : t}
                        </button>
                    ))}
                </div>
                {refTab === 'rate_matrix' ? (
                    <div>
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-blue-800">Manage Rates</h4>
                                <input 
                                    type="text" 
                                    placeholder="Search Area..." 
                                    className="border p-1 rounded text-sm w-48"
                                    value={matrixSearch}
                                    onChange={e => setMatrixSearch(e.target.value)}
                                />
                            </div>
                            <input type="file" accept=".xlsx, .xls" onChange={handleMatrixFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-2 p-2 bg-gray-50 rounded">
                            <input 
                                placeholder="Area / Destination" 
                                className="border p-2 rounded" 
                                value={matrixForm.area||''} 
                                onChange={e=>setMatrixForm({...matrixForm, area: e.target.value})} 
                            />
                            <input 
                                placeholder="Trip Rate" 
                                type="number" 
                                className="border p-2 rounded" 
                                value={matrixForm.rate !== undefined ? matrixForm.rate : ''} 
                                onChange={e=>setMatrixForm({...matrixForm, rate: e.target.value === '' ? undefined : Number(e.target.value)})} 
                            />
                            <input 
                                placeholder="Driver Rate" 
                                type="number" 
                                className="border p-2 rounded" 
                                value={matrixForm.driverRate !== undefined ? matrixForm.driverRate : ''} 
                                onChange={e=>setMatrixForm({...matrixForm, driverRate: e.target.value === '' ? undefined : Number(e.target.value)})} 
                            />
                            <input 
                                placeholder="Helper Rate" 
                                type="number" 
                                className="border p-2 rounded" 
                                value={matrixForm.helperRate !== undefined ? matrixForm.helperRate : ''} 
                                onChange={e=>setMatrixForm({...matrixForm, helperRate: e.target.value === '' ? undefined : Number(e.target.value)})} 
                            />
                            <button onClick={saveRef} className="col-span-4 bg-teal-600 text-white p-2 rounded hover:bg-teal-700">Add / Update Entry</button>
                        </div>
                        <div className="h-64 overflow-y-auto pr-6"> {/* Increased padding right for scrollbar space */}
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-gray-100 font-bold sticky top-0"><tr><th className="p-2">Area</th><th className="p-2">Rate</th><th className="p-2">Driver</th><th className="p-2">Helper</th><th className="p-2"></th></tr></thead>
                                <tbody>
                                    {filteredMatrix.map((m, i) => (
                                        <tr key={i} className="border-b hover:bg-gray-50">
                                            <td className="p-2">{m.area}</td>
                                            <td className="p-2">{fmtMoney(m.rate)}</td>
                                            <td className="p-2">{fmtMoney(m.driverRate)}</td>
                                            <td className="p-2">{fmtMoney(m.helperRate)}</td>
                                            <td className="p-2 text-right">
                                                <button onClick={()=>deleteRef(JSON.stringify(m), true)} className="text-red-500 hover:text-red-700 font-bold px-2 ml-4">✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredMatrix.length === 0 && (
                                        <tr><td colSpan={5} className="p-4 text-center text-gray-500 italic">No rates found matching "{matrixSearch}"</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                        <div>
                        <div className="flex gap-2">
                            <input className="border p-2 rounded flex-1" placeholder={`Add new ${refTab}`} value={newRef} onChange={e=>setNewRef(e.target.value)} />
                            <button onClick={saveRef} className="bg-teal-600 text-white px-4 rounded hover:bg-teal-700">Add</button>
                        </div>
                        <div className="bg-gray-50 p-2 rounded h-64 overflow-y-auto mt-2 pr-6"> {/* Increased padding right */}
                            {(refTab==='origins' ? origins : types).map((v, i) => (
                                <div key={i} className="flex justify-between items-center p-2 border-b bg-white mb-1 hover:bg-gray-50">
                                    <span>{v}</span>
                                    <button onClick={()=>deleteRef(v)} className="text-red-500 hover:text-red-700 font-bold px-2 ml-4">✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
