// Last updated date - Update this when content changes
// Format: "Month Day, Year" (e.g., "November 24, 2025")
export const LAST_UPDATED = "November 29, 2025";

// User roles (simplified for 6th grade reading level)
export const Role = {
    SELF: 'Me — I take medicine myself',
    CAREGIVER: 'Someone I care for — I help a family member or friend with their medicine',
};

// Legacy role mappings for backwards compatibility
export const LegacyRole = {
    PATIENT: 'Patient',
    CAREPARTNER: 'Carepartner / Family',
    SOCIAL_WORKER: 'Social Worker / Coordinator',
};

// Medicine journey - where they are in the process
export const MedicineJourney = {
    NOT_YET: 'Not yet — My doctor wants me to start soon',
    JUST_STARTED: 'Yes, I just started — Less than 3 months ago',
    ONGOING: 'Yes, I\'ve been taking it — More than 3 months',
};

// Care stage (legacy alias)
export const CareStage = {
    PRE_TREATMENT: 'Pre-treatment (Newly Diagnosed/Evaluation)',
    ACTIVE_TREATMENT: 'Active Treatment (Within 1st year)',
    MAINTENANCE: 'Maintenance (1+ years ongoing care)',
};

// Legacy alias for backwards compatibility
export const TransplantStatus = CareStage;

// Health condition types (expanded for broader population)
export const HealthCondition = {
    LIVER: 'Liver disease (including hepatitis, cirrhosis, or fatty liver)',
    KIDNEY: 'Kidney disease',
    HEART: 'Heart disease or heart failure',
    DIABETES: 'Diabetes (high blood sugar)',
    HIGH_BP: 'High blood pressure',
    CANCER: 'Cancer',
    TRANSPLANT: 'Transplant recipient (received a new organ)',
    AUTOIMMUNE: 'Autoimmune disease (like lupus, rheumatoid arthritis, or MS)',
    MENTAL_HEALTH: 'Mental health (depression, anxiety, bipolar)',
    LUNG: 'Lung disease (COPD, asthma, pulmonary fibrosis)',
    OTHER: 'Other',
};

// Legacy alias for backwards compatibility
export const OrganType = HealthCondition;

// Insurance - Do you have it?
export const HasInsurance = {
    YES: 'Yes',
    NO: 'No',
    NOT_SURE: 'I\'m not sure',
};

// Insurance source - Where does it come from?
export const InsuranceSource = {
    EMPLOYER: 'My job or my spouse\'s job',
    MEDICARE: 'Medicare (the program for people 65+ or with disabilities)',
    MEDICAID: 'Medicaid (state program for people with lower income)',
    MARKETPLACE: 'I bought it myself (from Healthcare.gov or an insurance company)',
    MILITARY: 'Military or VA (Veterans)',
    NOT_SURE: 'I\'m not sure',
};

// Insurance types (legacy - for backwards compatibility)
export const InsuranceType = {
    COMMERCIAL: 'Commercial / Employer',
    MEDICARE: 'Medicare',
    MEDICAID: 'Medicaid (State)',
    TRICARE_VA: 'TRICARE / VA',
    IHS: 'Indian Health Service / Tribal',
    UNINSURED: 'Uninsured / Self-pay',
    OTHER: 'Other / Not Sure',
};

// Has prescription drug plan?
export const HasDrugPlan = {
    YES: 'Yes',
    NO: 'No',
    NOT_SURE: 'I\'m not sure',
};

// Where you get your medicine (pharmacy type)
export const PharmacyType = {
    RETAIL: 'A regular pharmacy (like CVS, Walgreens, Walmart, or a local pharmacy)',
    MAIL_ORDER: 'A mail-order pharmacy (it gets shipped to my home)',
    SPECIALTY: 'A specialty pharmacy (a pharmacy that handles certain high-cost medicines)',
    HOSPITAL: 'The hospital or doctor\'s office gives it to me',
    NOT_YET: 'I haven\'t gotten it yet',
    NOT_SURE: 'I\'m not sure',
};

// Affordability level (simplified language)
export const AffordabilityLevel = {
    CANT_AFFORD: 'Yes, I can\'t afford it at all',
    STRUGGLE: 'Yes, it\'s a real struggle',
    SOMETIMES: 'Sometimes — it depends on the month',
    MANAGEABLE: 'No, I can manage the cost',
    UNKNOWN: 'I don\'t know the cost yet',
};

// Financial status (legacy)
export const FinancialStatus = {
    MANAGEABLE: 'Manageable',
    CHALLENGING: 'Challenging',
    UNAFFORDABLE: 'Unaffordable',
    CRISIS: 'Crisis',
};

// Cost behaviors - things people do when medicine is expensive
export const CostBehaviors = {
    SKIPPED_DOSES: 'Skipped doses to make my medicine last longer',
    CUT_PILLS: 'Cut pills in half (when I wasn\'t supposed to)',
    DIDNT_FILL: 'Didn\'t fill a prescription',
    CHOSE_BILLS: 'Chose between medicine and other bills (like food or rent)',
    ASKED_SAMPLES: 'Asked my doctor for samples or a cheaper option',
    NONE: 'None of these',
};

// Copay ranges
export const CopayRange = {
    RANGE_0_50: '$0 – $50 per month',
    RANGE_51_100: '$51 – $100 per month',
    RANGE_101_250: '$101 – $250 per month',
    RANGE_251_500: '$251 – $500 per month',
    RANGE_500_PLUS: 'More than $500 per month',
    UNKNOWN: 'I don\'t know yet',
};

// Help types - what kind of help do they need?
export const HelpTypes = {
    LOWER_COST: 'Find programs to lower my medicine cost',
    COPAY_CARD: 'Find a copay card (a card from the drug company that lowers your cost)',
    PAP: 'Learn about patient assistance programs (free or low-cost medicine from the company)',
    INSURANCE_HELP: 'Help understanding my insurance benefits',
    EXTRA_HELP: 'Find out if I qualify for extra help programs',
    TALK_TO_SOMEONE: 'Someone to talk to about my medicine questions',
};

// Treatment stage
export const TreatmentStage = {
    PRE: 'Pre-treatment',
    POST: 'Active/Ongoing Treatment',
    BOTH: 'Both (All Stages)',
};

// Legacy alias for backwards compatibility
export const TransplantStage = TreatmentStage;
