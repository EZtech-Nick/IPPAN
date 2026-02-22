
export interface Trip {
    id: string;
    tripCode?: string; // YYMM####
    date: string;
    status: 'Dispatched' | 'Returned' | 'Cancelled' | 'Paid';
    client: string;
    plateNumber: string;
    origin: string; // Warehouse
    destination: string; // Area
    drNumber: string;
    dropCount: number;
    typeOfTrip: string;
    
    // New Tracking Fields for Billing
    waybillNo?: string;
    transmittalNo?: string;
    eliNo?: string;

    // Financials
    grossAmount: number; // Rate
    
    vatAmount: number; // 12% of Rate (New Requirement)
    vatEx: number; // Rate / 1.12 (New Requirement)
    lessVat: number; // Rate - VatEx
    
    withheld: number; // Rate * 0.02
    vat2551q: number; // Rate * 0.03
    jetsComms: number; // Rate * 0.04
    jbf: number; // Rate * Client.jbfPercent (New)

    totalDeduction: number;
    netRate: number;

    // Personnel
    driverId: string;
    helperId: string;
    driverRate: number; // Specific rate for this trip
    helperRate: number; // Specific rate for this trip

    // Tracking
    billedNo?: string;
    remarks?: string;
}

export interface TripExpense {
    id: string;
    tripId: string; // Link to Trip
    dateEncoded?: string;
    allowance: number;
    poUnioilDiscount: number;
    poUnioil: number;
    autosweep: number;
    easytrip: number;
    dieselCash: number;
    tollgateCash: number;
    meal: number;
    gatePass: number;
    vulcanizing: number;
    parking: number;
    trafficViolation: number;
    carwash: number;
    roro: number;
    mano: number;
    truckMaintenance: number;
    notes_truck_maint?: string;
    otherExpenses: number;
    notes_other_exp?: string;
    caDriver: number;
    caHelper: number;
    manoChargesClient: number;
    otherExpChargesClient: number;
    total_charges_client: number;
    notes_charges_client?: string;
    cashReturnOffice: number;
    cashTotalExpenses: number;
    cashReturn: number;
    totalExpenses: number;
    totalNet: number;
    remarks?: string;
}

export interface CAHistoryItem {
    id: string;
    date: string;
    type: string;
    amount: number;
    action: 'Add' | 'Deduct';
    remarks?: string;
}

export interface LoanPayment {
    id: string;
    date: string;
    amount: number;
    remarks: string;
}

export interface Loan {
    id: string;
    date: string; // Application Date
    type: 'Uniform' | 'Office CA' | 'SSS Loan' | 'Pag-Ibig Loan' | 'Other Deduction';
    description: string;
    amount: number;
    amortization: number; // Payment per Cutoff
    paidAmount: number;
    status: 'Active' | 'Paid';
    remarks?: string;
    payments?: LoanPayment[];
}

export interface Employee {
    id: string;
    name: string;
    role: 'Driver' | 'Helper' | 'Admin';
    status: 'Active' | 'Resigned' | 'Suspended' | 'Probation';
    
    // Dates & Age
    dateHired?: string;
    dateResigned?: string;
    birthday?: string;
    age?: number;

    // Contact & Location
    mobile?: string;
    address?: string;
    emergencyContact?: string;
    emergencyMobile?: string;

    // System IDs
    jayEdId?: string;
    jbfId?: string;
    companyId?: string;
    spxId?: string;
    spxPass?: string;

    // Licenses & IDs
    licenseNo?: string;
    licenseExp?: string;
    idType?: string;
    idNumber?: string;
    idExpiration?: string;

    // Government
    tinNo?: string;
    sssNo?: string;
    philhealthNo?: string;
    pagibigNo?: string;

    // Clearances
    nbi?: string;
    nbiExp?: string;
    drugTest?: string;
    brgyClearance?: string;
    policeClearance?: string;

    // Payroll Config
    rate: number;
    dailyRate: number;
    sss: number;
    philhealth: number;
    pagibig: number;
    mp2: number;
    otherDeduction: number;
    otherDeductionName?: string;
    uniformDed?: number;
    officeCA?: number;
    sssLoan?: number;
    pagibigLoan?: number;
    
    // Allowances
    hasPetService?: boolean; // Deprecated in favor of PetServiceRecord, kept for backward compat if needed

    // Financial History
    cashAdvance: number;
    caHistory?: CAHistoryItem[]; 
    loans: Loan[];
}

export interface PayrollRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    periodStart: string;
    periodEnd: string;
    grossIncome: number;
    netPay: number;
    iponPondo: number;
    thirteenthMonth: number;
    dateGenerated: string;
}

export interface Truck {
    id: string;
    plateNumber: string;
    model: string;
    engine: string;
    chassis: string;
    owner: string;
    investor?: string;
    purchaseDate?: string;
    registrationExpiry: string;
    insuranceExpiry: string;
    fileUrl?: string;

    // New Fields
    yearModel?: string;
    purchaseAmount?: number;
    dealer?: string;
    
    ltoCrDate?: string;
    ltoCrNo?: string;
    ltoOrNo?: string;
    
    ltfrbPaDecision?: string;
    ltfrbDecisionDate?: string;
    ltfrbDateExpiration?: string;
    ltfrbCaseNo?: string;

    compInsBroker?: string;
    compInsCompany?: string;
    compInsPremium?: number;
    compInsCoverage?: number;
    compInsDateInsured?: string;
    compInsDateExpired?: string;

    cargoInsBroker?: string;
    cargoInsCompany?: string;
    cargoInsPremium?: number;
    cargoInsCoverage?: number;
    cargoInsDateInsured?: string;
    cargoInsDateExpired?: string;
}

export interface InsuranceClaim {
    id: string;
    dateIncident: string;
    plateNumber: string;
    driverName: string;
    helperName: string;
    driverLicense: string;
    
    thirdPartyPlate?: string;
    thirdPartyName?: string;
    thirdPartyLicense?: string;
    
    report: string;
    actualAmountClaim?: number;
    totalExpensesOwn?: number;
    totalExpensesThirdParty?: number;
    personelClaim?: number;
    
    dateReceivedOwn?: string;
    dateReceivedThirdParty?: string;
    dateReceivedPersonel?: string;

    // Cargo Specific
    cargoClaimItems?: string;
    clientTotalAmountClaim?: number;
    actualInsuranceAmountClaim?: number;
    dateReceivedCargo?: string;
    cashCheckDetail?: string;
}

export interface MaintenanceLog {
    id: string;
    maintenanceCode?: string; 
    date: string;
    plateNumber: string;
    description: string;
    supplier: string;
    laborCost: number;
    partsCost: number;
    isInvestorCharged: boolean;
    
    mechanicName?: string;
    repairType?: 'Maintenance' | 'Rescue';
    startRepair?: string; 
    endRepair?: string; 
}

export interface InspectionChecklist {
    id: string;
    maintenanceCode?: string; 
    date: string;
    plateNumber: string;
    truckModel: string;
    odometer: string;
    mechanicName: string;
    location: string;
    
    engineFluids?: string;
    enginePerformance?: string;
    transmission?: string;
    brakeSystem?: string;
    steeringSuspension?: string;
    tiresWheels?: string;
    electricalSystem?: string;
    lightsSignals?: string;
    bodyCab?: string;
    vanCargoBody?: string;
    dieselFuelSystem?: string;
    safetyAccessories?: string;
    truckAppearance?: string;
    overallAssessment?: string;

    mechanicSignName?: string;
    mechanicSignDate?: string;
    supervisorSignName?: string;
    supervisorSignDate?: string;
    officeRemarks?: string;
}

export interface InventoryItem {
    id: string;
    itemCode: string; 
    item: string;
    stock: number;
    unit: string;
    reorderLevel: number;
    price?: number; // Selling Price
    cost?: number; // Item Cost
    store?: string;
    lastUpdated?: string;
}

export interface InventoryTransaction {
    id: string;
    date: string;
    itemCode: string;
    itemName: string;
    issuedTo: string;
    quantity: number;
    remarks: string;
    type: 'Release' | 'Replenish';
}

export interface BankAccount {
    id: string;
    bankName: string;
    accountNumber: string;
    balance: number;
}

export interface BankTransaction {
    id: string;
    bankId: string;
    date: string;
    plateNumber?: string;
    controlNumber?: string;
    driver?: string;
    category: string;
    particulars: string;
    amount: number;
    type: 'Debit' | 'Credit'; // Debit = Increase/Deposit, Credit = Decrease/Expense
}

export interface CompanyLoanPayment {
    id: string;
    date: string;
    amount: number;
    notes?: string;
}

export interface CompanyLoan {
    id: string;
    bank: string;
    principal: number;
    terms: number; 
    balance: number;
    amortization: number;
    payments?: CompanyLoanPayment[]; 
    startDate: string;
}

export interface Client {
    id: string;
    name: string;
    tin?: string;
    address: string;
    contact: string;
    vatExPercent?: number;
    withheldPercent?: number;
    vat2551qPercent?: number;
    jetsPercent?: number;
    jbfPercent?: number; 
    isVatEnabled?: boolean;
    deductionDropThreshold?: number;
}

export interface BillingRecord {
    id: string;
    billingNo: string;
    clientName: string;
    clientTin: string;
    clientAddress: string;
    date: string;
    periodStart: string;
    periodEnd: string;
    items: {
        tripId: string;
        date: string;
        plateNumber: string;
        truckModel: string;
        origin: string;
        destination: string;
        waybillNo: string;
        transmittalNo: string;
        eliNo: string;
        dropCount: number;
        drNumber: string;
        rate: number;
    }[];
    totalRate: number;
    totalDropCount: number;
    isVat: boolean;
    isVatable: boolean;
    isVatAmount: boolean;
    isEwt: boolean;
    vatAmount: number;
    vatableSales: number;
    vatTaxAmount: number;
    ewtAmount: number;
    netAmount: number;
    preparedBy: string;
    checkedBy: string;
    dueDate?: string;
    datePaid?: string;
    orNumber?: string;
    invoiceNumber?: string;
    cashBond?: number;
    commission?: number;
}

export interface Reference {
    id: string;
    values: string[];
}

export interface RateMatrixItem {
    area: string;
    rate: number;
    driverRate: number;
    helperRate: number;
}

export interface AttendanceRecord {
    id: string;
    date: string;
    employeeId: string;
    status: 'Present' | 'Absent' | 'Half-Day' | 'Rest Day';
    computedPay: number;
}

export interface AdminAllowance {
    id: string;
    date: string;
    employeeId: string;
    transportation: number;
    meal: number;
}

export interface PetServiceRecord {
    id: string; // YYYY-MM_employeeId
    year: number;
    month: number;
    employeeId: string;
    qualified: boolean;
}

export interface OvertimeRecord {
    id: string;
    date: string;
    employeeId: string;
    hours: number;
    type: 'Regular' | 'RestDay/Special' | 'RegularHoliday';
    amount: number;
}

export interface UndertimeRecord {
    id: string;
    date: string;
    employeeId: string;
    minutes: number;
    amount: number;
}

export interface Holiday {
    id: string;
    date: string;
    type: 'Regular' | 'Special Non-Working';
    description: string;
}

export interface ItinerarySegment {
    id: string;
    type: 'Trip' | 'Backload';
    tripId: string;
    client: string;
    destination: string;
    tripType: string;
    dropCount: number;
    storeOpening?: string;
    arrival?: string;
    startUnloading?: string;
    finishUnloading?: string;
    departure?: string;
    docs?: string;
}

export interface Itinerary {
    id: string;
    date: string;
    plateNumber: string;
    driver: string;
    helper: string;
    origin: string;
    callTime?: string;
    pickupArrival?: string;
    startLoading?: string;
    finishLoading?: string;
    pickupDocs?: string;
    pickupDeparture?: string;
    segments: ItinerarySegment[];
}

export interface DrDrivePartItem {
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
}

export interface DrDriveServiceItem {
    description: string;
    amount: number;
}

export interface DrDriveJob {
    id: string;
    date: string;
    invoiceNo: string;
    jobOrderNo: string;
    customerName: string;
    address?: string;
    contactNumber?: string;
    plateNumber: string;
    vehicleModel?: string;
    parts?: DrDrivePartItem[];
    services?: DrDriveServiceItem[];
    totalParts: number;
    totalLabor: number;
    grandTotal: number;
    status: 'Pending' | 'Paid';
    issuedBy: string;
    receivedBy?: string;
}

export interface ReleaseItem {
    itemCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export interface ServiceItem {
    description: string;
    amount: number;
}

export interface ReleaseRecord {
    id: string;
    // Header
    companyName: string;
    companyAddress: string;
    companyContact: string;
    
    // Billing
    billTo: string;
    billAddress: string;
    date: string;
    transactionNo: string;
    plateNumber: string;
    
    // Details
    items: ReleaseItem[];
    services: ServiceItem[];
    
    // Totals
    subtotalParts: number;
    subtotalLabor: number;
    grandTotal: number;
    
    // Signatories
    issuedBy: string;
    receivedBy: string;
}

export type PermissionScope = 'All' | 'UserOnly' | { scope: 'UserOnly', names: string[] };

export interface Permissions {
    accessAll: boolean;
    dashboard: boolean;
    attendance: {
        enabled: boolean;
        daily: PermissionScope;
        adminAllowance: PermissionScope;
        petService: PermissionScope;
        overtime: PermissionScope;
        undertime: PermissionScope;
    };
    tripMonitor: {
        enabled: boolean;
        monitor: PermissionScope;
        itinerary: PermissionScope;
        expenses: PermissionScope;
        truckSummary: boolean;
    };
    clients: boolean;
    billing: {
        enabled: boolean;
        generateSoa: boolean;
        history: PermissionScope;
        summary: PermissionScope;
        analytics: PermissionScope;
    };
    hr: {
        enabled: boolean;
        profile201: boolean;
        livePayroll: boolean;
        holidays: boolean;
        generatedPayroll: PermissionScope;
        iponPondo: PermissionScope;
        loansApplication: PermissionScope;
        loansSummary: PermissionScope;
    };
    fleet: {
        enabled: boolean;
        truckList: boolean;
        maintenance: boolean;
        inspection: boolean;
        maintSummary: boolean;
        inventory: boolean;
        releasing: boolean;
        history: boolean;
        insurance: boolean;
    };
    finance: {
        enabled: boolean;
        banks: PermissionScope;
        companyLoans: boolean;
        investorReport: PermissionScope;
    };
    systemAdmin: boolean;
}

export interface UserAccount {
    id: string;
    name: string;
    position: string;
    email: string;
    password?: string;
    createdAt: string;
    permissions: Permissions;
}

export interface AppData {
    trips: Trip[];
    trip_expenses: TripExpense[];
    employees: Employee[];
    payroll_records: PayrollRecord[];
    trucks: Truck[];
    maintenance: MaintenanceLog[];
    inspections?: InspectionChecklist[]; 
    accounts: BankAccount[];
    bank_transactions?: BankTransaction[];
    clients: Client[];
    inventory: InventoryItem[];
    inventory_transactions: InventoryTransaction[];
    company_loans: CompanyLoan[];
    insurance_claims?: InsuranceClaim[];
    references: Reference[];
    attendance: AttendanceRecord[];
    admin_allowances?: AdminAllowance[];
    pet_service_records?: PetServiceRecord[]; 
    ot_records: OvertimeRecord[];
    undertime_records: UndertimeRecord[];
    holidays: Holiday[]; // New
    billings: BillingRecord[];
    itineraries: Itinerary[];
    dr_drive_jobs?: DrDriveJob[];
    releases?: ReleaseRecord[];
    users?: UserAccount[];
}
