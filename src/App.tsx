
import React, { useEffect, useState } from 'react';
import { auth, db, APP_ID, signIn } from './services/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { AppData, UserAccount } from './types';
import { LayoutDashboard, TruckIcon, Briefcase, FileText, Users, Wrench, PesoSign, Shield, LogOut } from './components/Icons';
import { authService } from './services/authService';
import { Login } from './components/Login';

// Import Modules
import { Dashboard } from './modules/Dashboard';
import { TripMonitor } from './modules/TripMonitor';
import { ClientModule } from './modules/ClientModule';
import { BillingModule } from './modules/BillingModule';
import { HRModule } from './modules/HRModule';
import { FleetModule } from './modules/FleetModule';
import { FinanceModule } from './modules/FinanceModule';
import { AttendanceModule } from './modules/AttendanceModule';
import { SystemAdminModule } from './modules/SystemAdminModule';

// Icons
const CalendarClock = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M13 10h7"/><circle cx="12" cy="12" r="1"/><path d="M18 22a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M18 16v2l1.5 1.5"/></svg>;
const Moon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;
const Sun = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>;

const App: React.FC = () => {
    const [fbUser, setFbUser] = useState<User | null>(null);
    const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [darkMode, setDarkMode] = useState(false);
    
    // Lifted State for SubTabs to persist navigation
    const [hrSubTab, setHrSubTab] = useState('201');
    const [fleetSubTab, setFleetSubTab] = useState('list');
    const [attSubTab, setAttSubTab] = useState('daily');

    const [data, setData] = useState<AppData>({ 
        trips: [], trip_expenses: [], employees: [], payroll_records: [], trucks: [], maintenance: [], accounts: [], clients: [], 
        inventory: [], inventory_transactions: [], company_loans: [], references: [], bank_transactions: [],
        attendance: [], admin_allowances: [], pet_service_records: [], ot_records: [], undertime_records: [], holidays: [], 
        billings: [], itineraries: [], dr_drive_jobs: [], insurance_claims: [], releases: [], users: []
    });

    useEffect(() => {
        signIn();
        authService.initializeAdmin();
        return onAuthStateChanged(auth, (u) => setFbUser(u));
    }, []);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    useEffect(() => {
        if (!fbUser) return;
        const cols = [
            'trips', 'trip_expenses', 'employees', 'payroll_records', 'trucks', 'maintenance', 'accounts', 'clients', 
            'inventory', 'inventory_transactions', 'company_loans', 'references', 'bank_transactions',
            'attendance', 'admin_allowances', 'pet_service_records', 'ot_records', 'undertime_records', 'holidays',
            'billings', 'itineraries', 'inspections', 'dr_drive_jobs', 'insurance_claims', 'releases', 'users'
        ];
        const unsubs = cols.map(c => onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', c), 
            (snap) => setData(prev => ({ ...prev, [c]: snap.docs.map(d => ({ ...d.data(), id: d.id })) }))
        ));
        return () => unsubs.forEach(u => u());
    }, [fbUser]);

    // Session persistence
    useEffect(() => {
        const saved = localStorage.getItem('ippan_user');
        if (saved) {
            try {
                setCurrentUser(JSON.parse(saved));
            } catch (e) {
                localStorage.removeItem('ippan_user');
            }
        }
    }, []);

    const handleLogin = (user: UserAccount) => {
        setCurrentUser(user);
        localStorage.setItem('ippan_user', JSON.stringify(user));
        
        // Set initial tab based on permissions
        if (user.permissions.accessAll || user.permissions.dashboard) setActiveTab('dashboard');
        else if (user.permissions.attendance.enabled) setActiveTab('attendance');
        else if (user.permissions.tripMonitor.enabled) setActiveTab('trips');
        else if (user.permissions.clients) setActiveTab('clients');
        else if (user.permissions.billing.enabled) setActiveTab('billing');
        else if (user.permissions.hr.enabled) setActiveTab('hr');
        else if (user.permissions.fleet.enabled) setActiveTab('fleet');
        else if (user.permissions.finance.enabled) setActiveTab('finance');
        else if (user.permissions.systemAdmin) setActiveTab('system-admin');
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('ippan_user');
    };

    const hasAccess = (path: string) => {
        if (!currentUser) return false;
        if (currentUser.permissions.accessAll) return true;
        
        const keys = path.split('.');
        let val = currentUser.permissions as any;
        for (const k of keys) {
            val = val?.[k];
        }
        
        if (typeof val === 'boolean') return val;
        if (val === 'All' || val === 'UserOnly') return true;
        
        return !!val;
    };

    if (!fbUser) return <div className="h-screen flex items-center justify-center bg-teal-900 text-white animate-pulse">Loading IPPAN V2...</div>;

    if (!currentUser) return <Login onLogin={handleLogin} />;

    const navItems = [
        { id: 'dashboard', icon: <LayoutDashboard/>, label: 'Dashboard', access: 'dashboard' },
        { id: 'attendance', icon: <CalendarClock/>, label: 'Attendance & OT', access: 'attendance.enabled' },
        { id: 'trips', icon: <TruckIcon/>, label: 'Trip Monitor', access: 'tripMonitor.enabled' },
        { id: 'clients', icon: <Briefcase/>, label: 'Clients', access: 'clients' },
        { id: 'billing', icon: <FileText/>, label: 'Billing & SOA', access: 'billing.enabled' },
        { id: 'hr', icon: <Users/>, label: 'HR & Payroll', access: 'hr.enabled' },
        { id: 'fleet', icon: <Wrench/>, label: 'Fleet & Maint.', access: 'fleet.enabled' },
        { id: 'finance', icon: <PesoSign/>, label: 'Finance', access: 'finance.enabled' },
        { id: 'system-admin', icon: <Shield/>, label: 'System Admin', access: 'systemAdmin' },
    ].filter(item => hasAccess(item.access));

    return (
        <div className="flex h-screen bg-gray-100 text-gray-800 font-sans dark:bg-gray-900 dark:text-gray-100 transition-colors duration-200">
            <div className="w-64 bg-teal-900 text-teal-100 flex flex-col no-print shadow-xl z-20 dark:bg-gray-800 dark:border-r dark:border-gray-700">
                <div className="p-6 flex items-center border-b border-teal-800 bg-teal-950 dark:bg-gray-900 dark:border-gray-700">
                    <img src="https://image2url.com/images/1765270216642-ce5ebb17-554f-4612-9023-165349620aeb.jpg" className="w-10 h-10 rounded-full mr-3 border-2 border-teal-400" alt="Logo" />
                    <div><div className="font-bold text-xl tracking-wide text-white">IPPAN</div><div className="text-xs text-teal-400">Transport Services</div></div>
                </div>
                <nav className="flex-1 overflow-y-auto py-4 space-y-1">
                    {navItems.map(item => (
                        <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center px-6 py-3 hover:bg-teal-800 dark:hover:bg-gray-700 transition-all duration-200 ${activeTab === item.id ? 'bg-teal-800 dark:bg-gray-700 border-r-4 border-teal-400 text-white font-bold' : ''}`}>
                            <div className="mr-3">{item.icon}</div> {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-teal-800 bg-teal-950 dark:bg-gray-900 dark:border-gray-700 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center text-xs font-bold text-white border border-teal-500">
                            {currentUser.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                            <div className="text-[10px] text-teal-400 truncate">{currentUser.position}</div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <button 
                            onClick={handleLogout}
                            className="p-2 rounded-full hover:bg-red-800 transition-colors text-white"
                            title="Logout"
                        >
                            <LogOut size={18} />
                        </button>
                        <button 
                            onClick={() => setDarkMode(!darkMode)} 
                            className="p-2 rounded-full hover:bg-teal-800 dark:hover:bg-gray-700 transition-colors text-white"
                            title="Toggle Dark Mode"
                        >
                            {darkMode ? <Sun /> : <Moon />}
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-auto relative">
                <div className="p-8 pb-20">
                    {activeTab === 'dashboard' && hasAccess('dashboard') && <Dashboard data={data} />}
                    {activeTab === 'attendance' && hasAccess('attendance.enabled') && <AttendanceModule data={data} subTab={attSubTab} setSubTab={setAttSubTab} currentUser={currentUser} />}
                    {activeTab === 'clients' && hasAccess('clients') && <ClientModule data={data} />}
                    {activeTab === 'trips' && hasAccess('tripMonitor.enabled') && <TripMonitor data={data} currentUser={currentUser} />}
                    {activeTab === 'hr' && hasAccess('hr.enabled') && <HRModule data={data} subTab={hrSubTab} setSubTab={setHrSubTab} currentUser={currentUser} />}
                    {activeTab === 'fleet' && hasAccess('fleet.enabled') && <FleetModule data={data} subTab={fleetSubTab} setSubTab={setFleetSubTab} currentUser={currentUser} />}
                    {activeTab === 'billing' && hasAccess('billing.enabled') && <BillingModule data={data} currentUser={currentUser} />}
                    {activeTab === 'finance' && hasAccess('finance.enabled') && <FinanceModule data={data} currentUser={currentUser} />}
                    {activeTab === 'system-admin' && hasAccess('systemAdmin') && <SystemAdminModule data={data} />}
                </div>
            </div>
        </div>
    );
}

export default App;
