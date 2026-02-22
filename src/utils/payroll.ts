
import { Employee, Trip, TripExpense } from '../types';
import { calculatePHTax } from '../utils';

export const calculatePayroll = (
    emp: Employee, 
    trips: Trip[], 
    expenses: TripExpense[], 
    payStart: string, 
    payEnd: string
) => {
    const applyingFixedDeductions = (dateStr: string) => {
        const d = new Date(dateStr);
        const nextDay = new Date(d);
        nextDay.setDate(d.getDate() + 1);
        return nextDay.getDate() === 1;
    };
    const endOfMonth = applyingFixedDeductions(payEnd);
    
    let tripCount = 0; 
    let grossIncome = 0;
    let periodTrips: Trip[] = [];
    let periodCAItems: TripExpense[] = [];

    if (emp.role === 'Admin') { 
        grossIncome = parseFloat(String(emp.rate)) || 0; 
    } else { 
        periodTrips = trips.filter(t => t.date >= payStart && t.date <= payEnd && (t.driverId === emp.id || t.helperId === emp.id)); 
        periodTrips.forEach(t => { 
            if (t.driverId === emp.id) { grossIncome += (t.driverRate || 0); tripCount++; } 
            else if (t.helperId === emp.id) { grossIncome += (t.helperRate || 0); tripCount++; } 
        });
        const tripIds = new Set(periodTrips.map(pt => pt.id));
        periodCAItems = expenses.filter(e => tripIds.has(e.tripId));
    }

    const sss = endOfMonth ? (Number(emp.sss) || 0) : 0; 
    const ph = endOfMonth ? (Number(emp.philhealth) || 0) : 0; 
    const hdmf = endOfMonth ? (Number(emp.pagibig) || 0) : 0; 
    const mp2 = endOfMonth ? (Number(emp.mp2) || 0) : 0; 

    const iponPondo = grossIncome * 0.05;
    const tripCA = periodCAItems.reduce((acc, exp) => {
        const trip = periodTrips.find(t => t.id === exp.tripId);
        return acc + (trip?.driverId === emp.id ? Number(exp.caDriver||0) : Number(exp.caHelper||0));
    }, 0);

    const totalFixedDed = sss + ph + hdmf + mp2 + (Number(emp.uniformDed)||0) + (Number(emp.officeCA)||0) + (Number(emp.sssLoan)||0) + (Number(emp.pagibigLoan)||0) + (Number(emp.otherDeduction)||0) + iponPondo + tripCA;
    const taxableIncome = grossIncome - sss - ph - hdmf;
    const tax = calculatePHTax(taxableIncome > 0 ? (taxableIncome / 2) : 0);
    const netPay = grossIncome - totalFixedDed - tax;

    return { ...emp, tripCount, grossIncome, sss, ph, hdmf, mp2, iponPondo, tripCA, tax, netPay, periodTrips, periodCAItems };
};
