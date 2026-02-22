
import React, { useState } from 'react';
import { authService } from '../services/authService';
import { UserAccount } from '../types';
import { TruckIcon, Shield } from './Icons';

interface Props {
    onLogin: (user: UserAccount) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const user = await authService.login(email, password);
            if (user) {
                onLogin(user);
            } else {
                setError('Invalid email or password.');
            }
        } catch (err) {
            console.error(err);
            setError('An error occurred during login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-teal-900 p-4 font-sans">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-8 text-center bg-teal-950 text-white">
                    <div className="flex justify-center mb-4">
                        <img 
                            src="https://i.postimg.cc/Z5q1pqMT/IPPAN-LOGO.jpg" 
                            alt="IPPAN Logo" 
                            className="w-24 h-24 rounded-full border-4 border-teal-700 shadow-xl object-cover"
                            referrerPolicy="no-referrer"
                        />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">IPPAN</h1>
                    <p className="text-teal-400 text-sm uppercase tracking-widest font-medium">Transport Services</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 animate-shake">
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email Address</label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="admin@ippan.com"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Password</label>
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-teal-700 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Shield size={20} />
                                Sign In
                            </>
                        )}
                    </button>
                    
                    <div className="text-center">
                        <p className="text-xs text-gray-400">© 2026 IPPAN Transport Services. All rights reserved.</p>
                    </div>
                </form>
            </div>
        </div>
    );
};
