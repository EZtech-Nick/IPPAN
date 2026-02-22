
import React, { useState } from 'react';
import { AppData, BillingRecord, UserAccount } from '../types';
import { BillingSOA } from './BillingSOA';
import { BillingHistory } from './BillingHistory';
import { BillingAnalytics } from './BillingAnalytics';
import { BillingSummary } from './BillingSummary';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const BillingModule: React.FC<Props> = ({ data, currentUser }) => {
    const [subTab, setSubTab] = useState('soa');
    const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);

    const hasAccess = (path: string) => {
        if (currentUser.permissions.accessAll) return true;
        const keys = path.split('.');
        let val = currentUser.permissions as any;
        for (const k of keys) val = val?.[k];
        return !!val;
    };

    const tabs = [
        {id: 'soa', label: 'Generate SOA', permission: 'billing.soa'},
        {id: 'history', label: 'Billing History', permission: 'billing.history'},
        {id: 'summary', label: 'Billing Summary', permission: 'billing.summary'},
        {id: 'analytics', label: 'Analytics', permission: 'billing.analytics'}
    ].filter(t => hasAccess(t.permission));

    const handleEdit = (record: BillingRecord) => {
        setEditingRecord(record);
        setSubTab('soa');
    };

    const handleSaveComplete = () => {
        setEditingRecord(null);
        setSubTab('history');
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4 border-b pb-2 overflow-x-auto">
                {tabs.map(t => (
                    <button key={t.id} onClick={()=>{setSubTab(t.id); setEditingRecord(null);}} className={`font-bold capitalize px-4 py-2 rounded whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-700 ${subTab === t.id ? 'bg-teal-700 text-white' : 'text-gray-600 dark:text-gray-300'}`}>{t.label}</button>
                ))}
            </div>

            {subTab === 'soa' && <BillingSOA data={data} currentUser={currentUser} onSave={handleSaveComplete} editingRecord={editingRecord} />}
            {subTab === 'history' && <BillingHistory data={data} currentUser={currentUser} onProcessPaymentSuccess={()=>setSubTab('summary')} onEditRequest={handleEdit} />}
            {subTab === 'summary' && <BillingSummary data={data} currentUser={currentUser} />}
            {subTab === 'analytics' && <BillingAnalytics data={data} />}
        </div>
    );
};
