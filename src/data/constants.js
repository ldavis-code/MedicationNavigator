// User roles
export const Role = {
    PATIENT: 'Patient',
    CAREPARTNER: 'Carepartner / Family',
    SOCIAL_WORKER: 'Social Worker / Coordinator',
};

// Transplant status
export const TransplantStatus = {
    PRE_EVAL: 'Pre-transplant (Evaluation/Waitlist)',
    POST_ACUTE: 'Post-transplant (Within 1st year)',
    POST_STABLE: 'Post-transplant (1+ years)',
};

// Organ types
export const OrganType = {
    KIDNEY: 'Kidney',
    LIVER: 'Liver',
    HEART: 'Heart',
    LUNG: 'Lung',
    PANCREAS: 'Pancreas',
    MULTI: 'Multi-organ',
    OTHER: 'Other',
};

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

// Transplant stage
export const TransplantStage = {
    PRE: 'Pre-transplant',
    POST: 'Post-transplant',
    BOTH: 'Both (Pre & Post)',
};
