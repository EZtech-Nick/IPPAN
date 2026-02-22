
import React, { useState } from 'react';
import { AppData, UserAccount } from '../types';
import { TripListTab } from './TripListTab';
import { TripExpensesTab } from './TripExpensesTab';
import { TruckSummaryTab } from './TruckSummaryTab';
import { ItineraryTab } from './ItineraryTab';

interface Props {
    data: AppData;
    currentUser: UserAccount;
}

export const TripMonitor: React.FC<Props> = ({ data, currentUser }) => {
    const [subTab, setSubTab] = useState<'monitor' | 'expenses' | 'truck_summary' | 'itinerary'>('monitor');

    const hasAccess = (path: string) => {
        if (currentUser.permissions.accessAll) return true;
        const keys = path.split('.');
        let val = currentUser.permissions as any;
        for (const k of keys) val = val?.[k];
        return !!val;
    };

    return (
        <div className="space-y-4">
             <div className="flex gap-4 border-b pb-2">
                {hasAccess('tripMonitor.monitor') && (
                    <button onClick={()=>setSubTab('monitor')} className={`font-bold capitalize px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${subTab === 'monitor' ? 'bg-teal-700 text-white' : 'text-gray-600 dark:text-gray-300'}`}>Trip Monitor</button>
                )}
                {hasAccess('tripMonitor.itinerary') && (
                    <button onClick={()=>setSubTab('itinerary')} className={`font-bold capitalize px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${subTab === 'itinerary' ? 'bg-blue-700 text-white' : 'text-gray-600 dark:text-gray-300'}`}>Itinerary</button>
                )}
                {hasAccess('tripMonitor.expenses') && (
                    <button onClick={()=>setSubTab('expenses')} className={`font-bold capitalize px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${subTab === 'expenses' ? 'bg-orange-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}>Trip Expenses</button>
                )}
                {hasAccess('tripMonitor.truckSummary') && (
                    <button onClick={()=>setSubTab('truck_summary')} className={`font-bold capitalize px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${subTab === 'truck_summary' ? 'bg-purple-700 text-white' : 'text-gray-600 dark:text-gray-300'}`}>Truck Summary</button>
                )}
            </div>

            {subTab === 'monitor' && hasAccess('tripMonitor.monitor') && <TripListTab data={data} currentUser={currentUser} />}
            {subTab === 'itinerary' && hasAccess('tripMonitor.itinerary') && <ItineraryTab data={data} currentUser={currentUser} />}
            {subTab === 'expenses' && hasAccess('tripMonitor.expenses') && <TripExpensesTab data={data} currentUser={currentUser} />}
            {subTab === 'truck_summary' && hasAccess('tripMonitor.truckSummary') && <TruckSummaryTab data={data} />}
        </div>
    );
};
