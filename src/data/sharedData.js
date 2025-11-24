// Shared data exports for lazy-loaded pages
export { default as MEDICATIONS_DATA } from './medications.json';
export { default as DIRECTORY_RESOURCES_DATA } from './resources.json';
export { default as STATES_DATA } from './states.json';
export { default as ASSISTANT_KNOWLEDGE_BASE_DATA } from './knowledge-base.json';
export { default as QUICK_ACTIONS_DATA } from './quick-actions.json';
export { default as COST_PLUS_EXCLUSIONS_DATA } from './cost-plus-exclusions.json';
export { default as CATEGORY_ORDER_DATA } from './category-order.json';
export { default as APPLICATION_CHECKLIST_DATA } from './application-checklist.json';
export { default as FAQS_DATA } from './faqs.json';

// Re-export constants
export {
    Role,
    TransplantStatus,
    OrganType,
    InsuranceType,
    FinancialStatus,
    TransplantStage
} from './constants.js';

// Re-export SEO
export { seoMetadata } from './seo-metadata.js';
