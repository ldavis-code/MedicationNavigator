/**
 * SEO metadata configuration for all pages
 * Each page has unique title, description, and social media tags
 */

const BASE_URL = 'https://medicationnavigator.com';
const SITE_NAME = 'Medication Navigator';

export const seoMetadata = {
  home: {
    title: 'Medication Navigator - Free Medication Assistance Guide',
    description: 'Find free medication assistance programs. Search Patient Assistance Programs, compare copay foundations, and get help paying for your medications.',
    canonical: `${BASE_URL}/`,
    ogTitle: 'Medication Navigator - Free Medication Assistance',
    ogDescription: 'Free guide helping patients find medication assistance programs, Patient Assistance Programs (PAPs), and copay support for medications.',
    twitterTitle: 'Medication Navigator',
    twitterDescription: 'Find free medication assistance programs. Search PAPs, copay foundations, and get help paying for your medications.',
  },

  wizard: {
    title: 'Personalized Medication Path | Medication Navigator',
    description: 'Take our free personalized quiz to discover the best medication assistance programs for your needs. Get tailored recommendations in minutes.',
    canonical: `${BASE_URL}/wizard`,
    ogTitle: 'Find Your Medication Assistance Path',
    ogDescription: 'Answer a few questions to get personalized recommendations for Patient Assistance Programs and copay support tailored to your journey.',
    twitterTitle: 'Personalized Medication Assistance Quiz',
    twitterDescription: 'Take our free quiz to discover the best medication assistance programs for your needs. Get tailored recommendations in minutes.',
  },

  medications: {
    title: 'Search Medications & Assistance Programs | Medication Navigator',
    description: 'Search and compare medications, prices, and Patient Assistance Programs. Find help paying for tacrolimus, mycophenolate, prednisone, and more.',
    canonical: `${BASE_URL}/medications`,
    ogTitle: 'Search Medications & Assistance',
    ogDescription: 'Comprehensive database of medications with pricing, manufacturer PAPs, and copay foundation eligibility. Find help paying for your medications.',
    twitterTitle: 'Search Medications',
    twitterDescription: 'Search medications, compare prices, and find Patient Assistance Programs. Get help paying for tacrolimus, mycophenolate, and more.',
  },

  education: {
    title: 'Resources & Education | Medication Navigator',
    description: 'Learn about insurance coverage, copay foundations, specialty pharmacies, and medication assistance options. Expert guidance and resources.',
    canonical: `${BASE_URL}/education`,
    ogTitle: 'Medication Education & Resources',
    ogDescription: 'Comprehensive guides on insurance, Medicare, Medicaid, copay foundations, specialty pharmacies, and financial assistance for medications.',
    twitterTitle: 'Medication Resources',
    twitterDescription: 'Learn about insurance, copay foundations, specialty pharmacies, and medication assistance options.',
  },

  applicationHelp: {
    title: 'How to Apply for Medication Assistance | Medication Navigator',
    description: 'Step-by-step guide to applying for Patient Assistance Programs. Learn what documents you need, how to complete applications, and get approval faster.',
    canonical: `${BASE_URL}/application-help`,
    ogTitle: 'Apply for Patient Assistance Programs',
    ogDescription: 'Complete guide to applying for medication assistance. Get templates, checklists, and step-by-step instructions for Patient Assistance Program applications.',
    twitterTitle: 'Patient Assistance Program Grants & Foundations',
    twitterDescription: 'Step-by-step guide to applying for Patient Assistance Programs. Learn what documents you need and how to get approval faster.',
  },

  faq: {
    title: 'Frequently Asked Questions | Medication Navigator',
    description: 'Find answers to common questions about Patient Assistance Programs, copay foundations, medication costs, and financial help.',
    canonical: `${BASE_URL}/faq`,
    ogTitle: 'Medication Assistance FAQs',
    ogDescription: 'Get answers to common questions about medication assistance, Patient Assistance Programs, copay support, and financial help.',
    twitterTitle: 'Medication Assistance FAQs',
    twitterDescription: 'Answers to common questions about Patient Assistance Programs, copay foundations, and financial help.',
  },

  notFound: {
    title: 'Page Not Found | Medication Navigator',
    description: 'The page you are looking for could not be found. Visit our homepage to find medication assistance programs and resources.',
    canonical: `${BASE_URL}/`,
    ogTitle: 'Page Not Found',
    ogDescription: 'This page could not be found. Visit Medication Navigator to find medication assistance programs.',
    twitterTitle: 'Page Not Found',
    twitterDescription: 'This page could not be found. Visit our homepage to find medication assistance programs.',
  },
};

/**
 * Helper function to get metadata for a specific page
 * @param {string} page - Page key (home, wizard, medications, etc.)
 * @returns {Object} Meta tag configuration
 */
export function getPageMetadata(page) {
  return seoMetadata[page] || seoMetadata.home;
}
