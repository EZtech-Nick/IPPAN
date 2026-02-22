
import { UserAccount } from '../types';
import { fbService, db, APP_ID } from './firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ADMIN_PERMISSIONS } from '../constants';

export const authService = {
    login: async (email: string, password: string): Promise<UserAccount | null> => {
        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'),
            where('email', '==', email),
            where('password', '==', password)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const doc = snap.docs[0];
        return { ...doc.data(), id: doc.id } as UserAccount;
    },

    initializeAdmin: async () => {
        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'),
            where('email', '==', 'admin@ippan.com')
        );
        const snap = await getDocs(q);
        if (snap.empty) {
            await fbService.add('users', {
                name: 'System Admin',
                position: 'Super Admin',
                email: 'admin@ippan.com',
                password: 'transerv2026',
                createdAt: new Date().toISOString(),
                permissions: ADMIN_PERMISSIONS
            });
            console.log("Initial admin account created.");
        }
    }
};
