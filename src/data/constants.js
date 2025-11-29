// Last updated date - Update this when content changes
// Format: "Month Day, Year" (e.g., "November 24, 2025")
export const LAST_UPDATED = "November 28, 2025";

// User roles
export const Role = {
    PATIENT: 'Patient',
    CAREPARTNER: 'Carepartner / Family',
    SOCIAL_WORKER: 'Social Worker / Coordinator',
};

// Care stage
export const CareStage = {
    PRE_TREATMENT: 'Pre-treatment (Newly Diagnosed/Evaluation)',
    ACTIVE_TREATMENT: 'Active Treatment (Within 1st year)',
    MAINTENANCE: 'Maintenance (1+ years ongoing care)',
};

// Legacy alias for backwards compatibility
export const TransplantStatus = CareStage;

// Health condition types
export const HealthCondition = {
    KIDNEY: 'Kidney Disease',
    LIVER: 'Liver Disease',
    HEART: 'Heart Condition',
    LUNG: 'Lung/Respiratory',
    DIABETES: 'Diabetes',
    AUTOIMMUNE: 'Autoimmune Condition',
    CANCER: 'Cancer/Oncology',
    OTHER: 'Other',
};

// Legacy alias for backwards compatibility
export const OrganType = HealthCondition;

// Insurance types
export const InsuranceType = {
    COMMERCIAL: 'Commercial / Employer',
    MEDICARE: 'Medicare',
    MEDICAID: 'Medicaid (State)',
    TRICARE_VA: 'TRICARE / VA',
    IHS: 'Indian Health Service / Tribal',
    UNINSURED: 'Uninsured / Self-pay',
    OTHER: 'Other / Not Sure',
};

// Financial status
export const FinancialStatus = {
    MANAGEABLE: 'Manageable',
    CHALLENGING: 'Challenging',
    UNAFFORDABLE: 'Unaffordable',
    CRISIS: 'Crisis',
};

// Treatment stage
export const TreatmentStage = {
    PRE: 'Pre-treatment',
    POST: 'Active/Ongoing Treatment',
    BOTH: 'Both (All Stages)',
};

// Legacy alias for backwards compatibility
export const TransplantStage = TreatmentStage;
