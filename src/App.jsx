import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';

// Lazy loaded page components for code splitting
const LazyFAQ = lazy(() => import('./pages/FAQ.jsx'));
const LazyNotFound = lazy(() => import('./pages/NotFound.jsx'));

// Google Analytics 4 integration
import GoogleAnalytics from './components/GoogleAnalytics.jsx';
// First-visit disclaimer modal
import DisclaimerModal from './components/DisclaimerModal.jsx';
import {
    Map, Search, BookOpen, ShieldCheck, ArrowRight, Heart, Anchor, Lock, UserCheck,
    Menu, X, ShieldAlert, HeartHandshake, CheckCircle, ChevronLeft, DollarSign,
    Shield, AlertTriangle, AlertCircle, Printer, ExternalLink, Building, PlusCircle,
    Trash2, Globe, List, Info, Copy, Check, Building2, LandPlot, Scale, FileText,
    GraduationCap, Phone, ClipboardList, CheckSquare, Square, Stethoscope,
    AlertOctagon, Calendar, Pill, ChevronDown, Share2, Home as HomeIcon,
    MessageCircle, Send, HelpCircle, Lightbulb, Zap, MinimizeIcon, Users, TrendingUp, Clock, Loader2
} from 'lucide-react';

// --- CONSTANTS & DATA ---
import {
    LAST_UPDATED,
    Role,
    TransplantStatus,
    OrganType,
    InsuranceType,
    FinancialStatus,
    TransplantStage
} from './data/constants.js';
import MEDICATIONS_DATA from './data/medications.json';
import DIRECTORY_RESOURCES_DATA from './data/resources.json';
import STATES_DATA from './data/states.json';
import ASSISTANT_KNOWLEDGE_BASE_DATA from './data/knowledge-base.json';
import QUICK_ACTIONS_DATA from './data/quick-actions.json';
import COST_PLUS_EXCLUSIONS_DATA from './data/cost-plus-exclusions.json';
import GOODRX_EXCLUSIONS_DATA from './data/goodrx-exclusions.json';
import AMAZON_EXCLUSIONS_DATA from './data/amazon-exclusions.json';
import CATEGORY_ORDER_DATA from './data/category-order.json';
import APPLICATION_CHECKLIST_DATA from './data/application-checklist.json';
import FAQS_DATA from './data/faqs.json';
import { useMetaTags } from './hooks/useMetaTags.js';
import { seoMetadata } from './data/seo-metadata.js';

// Initialize data from imported JSON files
const MEDICATIONS = MEDICATIONS_DATA;
const DIRECTORY_RESOURCES = DIRECTORY_RESOURCES_DATA;
const STATES = STATES_DATA;
const ASSISTANT_KNOWLEDGE_BASE = ASSISTANT_KNOWLEDGE_BASE_DATA;

// Icon mapping for quick actions
const iconMap = {
    Map,
    Search,
    HeartHandshake,
    Shield,
    ClipboardList
};

// Map quick actions to include actual icon components
const QUICK_ACTIONS = QUICK_ACTIONS_DATA.map(action => ({
    ...action,
    icon: iconMap[action.icon]
}));

// --- COMPONENTS ---

// ScrollToTop Component
const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
};

// --- RULE-BASED ASSISTANT SYSTEM ---

// Rule-based response generator
const getAssistantResponse = (userMessage, context = {}) => {
    const lowerMessage = userMessage.toLowerCase();

    // Check for matches in knowledge base
    for (const [key, entry] of Object.entries(ASSISTANT_KNOWLEDGE_BASE)) {
        if (entry.keywords.some(keyword => lowerMessage.includes(keyword))) {
            return entry.response;
        }
    }

    // Context-aware responses based on wizard state
    if (context.wizardStep) {
        if (context.wizardStep === 5) {
            return "**Selecting Medications:**\n\nChoose all medications you currently take or expect to take. Don't worry if you're not sure - you can always update this later.\n\n💡 **Tip:** If you select medications, we'll show you direct links to their manufacturer assistance programs in your results.";
        }
        if (context.wizardStep === 6) {
            return ASSISTANT_KNOWLEDGE_BASE.specialtyPharmacy.response;
        }
        if (context.wizardStep === 7) {
            return "**Financial Status:**\n\nBe honest about your situation - this helps us prioritize the best programs for you:\n\n• **Manageable**: Focus on copay cards and savings\n• **Challenging**: PAPs + foundations recommended\n• **Unaffordable/Crisis**: Immediate PAP applications + Medicaid check\n\nYour answer is never stored or shared.";
        }
    }

    // Default helpful response
    return "I'm here to help! Here are some things I can assist with:\n\n• **Insurance questions** - Medicare, Medicaid, commercial coverage\n• **Patient Assistance Programs (PAPs)** - How to get free medication\n• **Copay foundations** - Organizations that help pay for medications\n• **Application help** - Step-by-step guidance\n• **Medication information** - Pricing and assistance programs\n\nTry asking about any of these topics, or use the Quick Actions below!";
};

// Smart medication suggestions based on context
const getMedicationSuggestions = (answers) => {
    const suggestions = [];

    if (!answers.organs || answers.organs.length === 0) {
        return suggestions;
    }

    const isPreTransplant = answers.status === TransplantStatus.PRE_EVAL;
    const isKidney = answers.organs.includes(OrganType.KIDNEY);
    const isLiver = answers.organs.includes(OrganType.LIVER);
    const isHeart = answers.organs.includes(OrganType.HEART);
    const isLung = answers.organs.includes(OrganType.LUNG);

    // Pre-transplant suggestions
    if (isPreTransplant) {
        if (isKidney) {
            suggestions.push({
                category: 'ESRD Support',
                medications: ['procrit', 'renvela', 'sensipar'],
                reason: 'Common for kidney patients on dialysis'
            });
        }
        if (isLiver) {
            suggestions.push({
                category: 'Liver Support',
                medications: ['xifaxan', 'lactulose'],
                reason: 'Help manage liver disease symptoms'
            });
        }
        if (isHeart || isLung) {
            suggestions.push({
                category: 'Pulmonary Hypertension',
                medications: ['revatio', 'tracleer'],
                reason: 'Common for heart/lung candidates'
            });
        }
    }

    // Post-transplant suggestions
    if (!isPreTransplant) {
        // Universal post-transplant
        suggestions.push({
            category: 'Immunosuppressants',
            medications: ['tacrolimus', 'mycophenolate', 'prednisone'],
            reason: 'Core anti-rejection medications for all transplants'
        });

        suggestions.push({
            category: 'Anti-viral Prophylaxis',
            medications: ['valcyte', 'bactrim'],
            reason: 'Prevent infections after transplant'
        });

        if (isLiver) {
            suggestions.push({
                category: 'Hepatitis Management',
                medications: ['baraclude', 'vemlidy'],
                reason: 'May be needed for liver transplant patients'
            });
        }
    }

    return suggestions;
};

// Chat Widget Component
const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'assistant',
            text: "👋 Hi! I'm your Transplant Medication Navigator assistant. I can help you find medication assistance, understand insurance, and navigate our tools.\n\nWhat can I help you with today?",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [wizardContext, setWizardContext] = useState({});
    const messagesEndRef = useCallback(node => {
        if (node) {
            node.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    const handleSendMessage = () => {
        if (!inputValue.trim()) return;

        // Add user message
        const userMessage = {
            id: messages.length + 1,
            type: 'user',
            text: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);

        // Get assistant response
        const response = getAssistantResponse(inputValue, wizardContext);
        const assistantMessage = {
            id: messages.length + 2,
            type: 'assistant',
            text: response,
            timestamp: new Date()
        };

        setTimeout(() => {
            setMessages(prev => [...prev, assistantMessage]);
        }, 500);

        setInputValue('');
    };

    const handleQuickAction = (action) => {
        if (action.link) {
            window.location.href = action.link;
        } else if (action.topic) {
            const response = ASSISTANT_KNOWLEDGE_BASE[action.topic]?.response || '';
            const assistantMessage = {
                id: messages.length + 1,
                type: 'assistant',
                text: response,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);
        }
    };

    // Handle Escape key to close chat
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    return (
        <div className="fixed bottom-6 right-6 z-50 no-print">
            {/* Chat Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full p-4 shadow-lg transition-all duration-300 flex items-center gap-2 group min-h-[44px]"
                    aria-label="Open assistant chat"
                >
                    <MessageCircle size={24} aria-hidden="true" />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
                        Need help?
                    </span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div
                    className="bg-white rounded-2xl shadow-2xl w-[calc(100vw-2rem)] sm:w-96 h-[80vh] sm:h-[600px] max-h-[600px] flex flex-col border border-slate-200 animate-in slide-in-from-bottom-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="chat-widget-title"
                >
                    {/* Header */}
                    <div className="bg-emerald-600 text-white p-4 rounded-t-2xl flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-2 rounded-lg" aria-hidden="true">
                                <HeartHandshake size={20} />
                            </div>
                            <div>
                                <h3 id="chat-widget-title" className="font-bold">Medication Navigator</h3>
                                <p className="text-xs text-emerald-100">Always here to help</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="hover:bg-white/20 p-2 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label="Close chat"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" role="log" aria-live="polite" aria-label="Chat messages">
                        {messages.map((message, index) => (
                            <div
                                key={message.id}
                                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl p-3 ${
                                        message.type === 'user'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white border border-slate-200 text-slate-800'
                                    }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions */}
                    <div className="border-t border-slate-200 p-3 bg-white">
                        <p className="text-sm text-slate-800 mb-2 font-semibold">Quick Actions:</p>
                        <div className="grid grid-cols-2 gap-2">
                            {QUICK_ACTIONS.slice(0, 4).map(action => {
                                const Icon = action.icon;
                                return (
                                    <button
                                        key={action.id}
                                        onClick={() => handleQuickAction(action)}
                                        className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 transition text-left min-h-[48px]"
                                        title={action.description}
                                    >
                                        <Icon size={18} className="text-emerald-700 flex-shrink-0" />
                                        <span className="text-sm text-slate-800 truncate">{action.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Input */}
                    <div className="border-t border-slate-200 p-4 bg-white rounded-b-2xl">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Ask a question..."
                                className="flex-1 px-4 py-3 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base min-h-[44px]"
                                aria-label="Type your message"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim()}
                                className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white p-3 rounded-full transition disabled:cursor-not-allowed min-h-[48px] min-w-[48px] flex items-center justify-center"
                                aria-label="Send message"
                            >
                                <Send size={22} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Layout Component
const Layout = ({ children }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    const navLinks = [
        { path: '/', label: 'Home', ariaLabel: 'Go to home page' },
        { path: '/wizard', label: 'My Path Quiz', ariaLabel: 'Start medication path wizard' },
        { path: '/medications', label: 'Search Meds', ariaLabel: 'Search for medications' },
        { path: '/application-help', label: 'Application Guide', ariaLabel: 'View application help guide' },
        { path: '/education', label: 'Resources & Education', ariaLabel: 'Browse resources and education' },
        { path: '/faq', label: 'FAQ', ariaLabel: 'View frequently asked questions' },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
            {/* Safety Banner */}
            <div className="bg-emerald-800 text-white px-4 py-3 text-base text-center font-medium no-print" role="alert">
                <span className="inline-flex items-center justify-center gap-2">
                    <ShieldAlert size={18} className="text-emerald-100" aria-hidden="true" />
                    Official assistance programs NEVER ask for payment. If a site asks for money, leave immediately.
                </span>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-slate-200 no-print" role="banner">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800 transition" aria-label="Transplant Medication Navigator home">
                        <HeartHandshake size={28} aria-hidden="true" />
                        <span className="font-bold text-lg md:text-xl leading-tight">
                            Transplant Med<br className="md:hidden"/> Navigator
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-4" aria-label="Main navigation">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                aria-label={link.ariaLabel}
                                className={`text-base font-medium transition-colors px-3 py-2 rounded-lg min-h-[44px] flex items-center ${
                                    location.pathname === link.path
                                        ? 'text-emerald-700 font-bold bg-emerald-50 border-b-2 border-emerald-600'
                                        : 'text-slate-700 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden p-2 text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={isMobileMenuOpen}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Nav */}
                {isMobileMenuOpen && (
                    <nav className="md:hidden bg-white border-b border-slate-100 shadow-lg absolute w-full" aria-label="Mobile navigation">
                        <div className="flex flex-col p-4 space-y-2">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    aria-label={link.ariaLabel}
                                    className={`px-4 py-3 rounded-lg text-lg font-medium min-h-[48px] flex items-center ${
                                        location.pathname === link.path
                                            ? 'bg-emerald-100 text-emerald-800 font-bold'
                                            : 'text-slate-800 hover:bg-slate-100'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </nav>
                )}
            </header>

            {/* Main Content */}
            <main id="main-content" className="flex-grow container mx-auto px-4 py-6 md:py-10">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-200 py-8 text-base no-print" role="contentinfo">
                <div className="container mx-auto px-4 text-center">
                    <p className="mb-4">
                        <strong>Disclaimer:</strong> This tool is for educational purposes only. It does not provide medical advice.
                        Prices are estimates. Always verify with your provider and pharmacist.
                    </p>
                    <p className="mb-4 text-slate-400 text-sm max-w-3xl mx-auto">
                        This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.
                    </p>
                    <p className="mb-2 text-emerald-400 font-medium">
                        <Clock className="inline-block w-4 h-4 mr-1 -mt-0.5" aria-hidden="true" />
                        Information last updated: {LAST_UPDATED}
                    </p>
                    <p>© {new Date().getFullYear()} Transplant Medication Navigator. No data is stored on our servers.</p>
                    <p className="mt-4 text-slate-300 text-sm">Created by Lorrinda Gray-Davis. est August 2025</p>
                </div>
            </footer>

            {/* Assistant Chat Widget */}
            <ChatWidget />
        </div>
    );
};

// Home Page
const Home = () => {
    useMetaTags(seoMetadata.home);

    return (
        <article className="space-y-12">
            {/* Hero Section */}
            <section className="text-center max-w-4xl mx-auto py-8 md:py-12">
                <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
                    See your medication options <span className="text-emerald-600">in one place.</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-700 mb-8 max-w-2xl mx-auto">
                    A free, safe guide for transplant patients and care partners to find affordable medications and assistance programs.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <Link
                        to="/wizard"
                        className="w-full sm:w-auto px-8 py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2"
                        aria-label="Start your personalized medication path"
                    >
                        <Map size={20} aria-hidden="true" />
                        Start My Medication Path Quiz
                    </Link>
                    <Link
                        to="/medications"
                        className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 font-bold rounded-xl hover:border-emerald-200 transition flex items-center justify-center gap-2"
                        aria-label="Compare medication prices"
                    >
                        <Search size={20} aria-hidden="true" />
                        Compare Prices & Meds
                    </Link>
                </div>
            </section>

            {/* Features Grid */}
            <section className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto" aria-label="Key features">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-100 transition">
                    <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
                        <BookOpen size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Learn the Process</h2>
                    <p className="text-slate-600 mb-4">
                        Understand how to fill out Patient Assistance Program (PAP) applications yourself, without paying anyone.
                    </p>
                    <Link to="/application-help" className="text-emerald-700 font-medium hover:underline inline-flex items-center gap-1" aria-label="View application guide">
                        View Guide <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-100 transition">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
                        <ShieldCheck size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Coverage Education</h2>
                    <p className="text-slate-600 mb-4">
                        Navigate Insurance, Medicare (including Part B-ID for kidney), Medicaid, and IHS benefits.
                    </p>
                    <Link to="/education" className="text-emerald-700 font-medium hover:underline inline-flex items-center gap-1" aria-label="Learn about coverage options">
                        Learn About Coverage <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-100 transition">
                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
                        <Search size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Resources & Directory</h2>
                    <p className="text-slate-600 mb-4">
                        Direct, safe links to manufacturer programs, foundations, and government sites. No scams.
                    </p>
                    <Link to="/education" className="text-emerald-700 font-medium hover:underline inline-flex items-center gap-1" aria-label="Browse available resources">
                        Browse Resources <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </div>
            </section>

            {/* Mission & Vision Section */}
            <section className="bg-emerald-900 rounded-3xl overflow-hidden shadow-2xl text-white my-16 max-w-6xl mx-auto" aria-labelledby="mission-heading">

                {/* 988 Mental Health Hotline Banner */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 border-b-2 border-blue-800 px-6 py-4">
                    <div className="flex items-center justify-center gap-3 text-center">
                        <Phone size={24} className="text-white flex-shrink-0" aria-hidden="true" />
                        <div>
                            <p className="text-white font-bold text-lg">
                                Mental Health Crisis? Call or Text <a href="tel:988" className="underline hover:text-blue-200 transition-colors">988</a>
                            </p>
                            <p className="text-blue-100 text-sm">
                                24/7 Suicide & Crisis Lifeline - You are not alone
                            </p>
                        </div>
                    </div>
                </div>

                {/* Centered Badge Header */}
                <div className="pt-10 pb-2 text-center">
                    <div className="inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-700/50 px-5 py-2 rounded-full text-emerald-100 text-sm font-bold shadow-lg">
                        <UserCheck size={18} className="text-emerald-400" aria-hidden="true" />
                        Built by a patient, for patients.
                    </div>
                </div>

                <div className="grid md:grid-cols-2">
                    <div className="p-8 md:p-12 md:pt-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-emerald-800">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-emerald-800 p-2 rounded-lg" aria-hidden="true"><Anchor size={24} className="text-emerald-200"/></div>
                            <h2 id="mission-heading" className="text-2xl font-bold tracking-tight">Our Mission</h2>
                        </div>
                        
                        <p className="text-lg text-emerald-100 leading-relaxed">
                            To bridge the critical gap between <strong>prescription</strong> and <strong>possession</strong>. 
                            <br/><br/>
                            We provide a safe, unbiased, and transparent navigator for medication access, empowering transplant patients to overcome financial toxicity and focus on living their lives.
                        </p>
                    </div>
                    <div className="p-8 md:p-12 md:pt-8 flex flex-col justify-center bg-emerald-800/50">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-emerald-700 p-2 rounded-lg" aria-hidden="true"><Heart size={24} className="text-emerald-200"/></div>
                            <h2 className="text-2xl font-bold tracking-tight">Our Vision</h2>
                        </div>
                        <p className="text-lg text-emerald-100 leading-relaxed">
                            Health equity for every transplant recipient.
                            <br/><br/>
                            We envision a world where the gift of life is never compromised by the cost of medication, and where every patient has the knowledge to advocate for their own care.
                        </p>
                    </div>
                </div>
                
                {/* Core Values / "The Why" */}
                <div className="bg-emerald-950/50 p-8 md:p-10 border-t border-emerald-800">
                    <h3 className="text-center font-bold text-emerald-100 uppercase tracking-wider text-sm mb-8">Why We Built This</h3>
                    <div className="grid md:grid-cols-3 gap-8 text-center">
                        <div>
                            <h4 className="font-bold text-white text-lg mb-2">Eliminating "Brain Fog"</h4>
                            <p className="text-emerald-100 text-sm">We simplify complex applications into step-by-step guides, because navigating care shouldn't require a degree.</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-lg mb-2">A Safe Harbor</h4>
                            <p className="text-emerald-100 text-sm">We are a neutral space. We do not sell data, we do not favor pharmacies, and we protect you from predatory scams.</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-lg mb-2">Financial Control</h4>
                            <p className="text-emerald-100 text-sm">By comparing cash prices, PAPs, and foundations side-by-side, we put the power of choice back in your hands.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mental Health Hotline */}
            <section className="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-300 rounded-2xl p-6 md:p-8 text-center max-w-3xl mx-auto mb-12" aria-labelledby="mental-health-hotline">
                <div className="bg-rose-600 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md" aria-hidden="true">
                    <Phone size={32} />
                </div>
                <h3 id="mental-health-hotline" className="text-2xl font-bold text-slate-900 mb-3">
                    Need to Talk to Someone?
                </h3>
                <p className="text-slate-600 mb-4">
                    The transplant journey can be emotionally challenging. Free, confidential support is available 24/7.
                </p>
                <div className="mb-4">
                    <a href="tel:988" className="inline-block text-5xl md:text-6xl font-black text-rose-600 hover:text-rose-700 transition mb-2 tracking-tight">
                        988
                    </a>
                    <p className="text-lg font-bold text-slate-700">National Suicide & Crisis Lifeline</p>
                    <p className="text-sm text-slate-600 mt-1">24/7 • Free • Confidential</p>
                </div>
                <p className="text-sm text-slate-700 max-w-2xl mx-auto mb-6 leading-relaxed">
                    Seeking help for mental health is a sign of strength, not weakness. The transplant journey is physically and emotionally demanding. Taking care of your mental health is just as important as taking your medications. If you're struggling, reach out—there are people who want to help.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left text-sm">
                    <div className="bg-white/80 p-3 rounded-lg">
                        <p className="font-bold text-slate-900 mb-1">Call or Text</p>
                        <p className="text-slate-600">Dial or text <strong>988</strong> from any phone</p>
                    </div>
                    <div className="bg-white/80 p-3 rounded-lg">
                        <p className="font-bold text-slate-900 mb-1">Online Chat</p>
                        <a href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer" className="text-rose-600 font-medium hover:underline flex items-center gap-1">
                            988lifeline.org/chat <ExternalLink size={12} aria-hidden="true" />
                        </a>
                    </div>
                </div>
            </section>

            {/* Privacy Note */}
            <section className="bg-slate-100 rounded-xl p-6 text-center max-w-2xl mx-auto mb-12" aria-labelledby="privacy-heading">
                <div className="flex justify-center mb-2 text-slate-400" aria-hidden="true"><Lock size={20}/></div>
                <h3 id="privacy-heading" className="font-bold text-slate-800 mb-2">Your Privacy is Our Priority</h3>
                <p className="text-slate-600 text-sm">
                    We do not store your data. We do not ask for your social security number.
                    We do not sell your information. This is a purely educational tool.
                </p>
            </section>
        </article>
    );
};

// Contextual Help Component for Wizard
const WizardHelp = ({ step, answers }) => {
    const [showHelp, setShowHelp] = useState(false);

    const helpContent = {
        1: {
            title: "Choosing Your Role",
            content: "Select the option that best describes you. This helps us tailor the guidance:\n\n• **Patient**: You're receiving or awaiting a transplant\n• **Carepartner**: You're helping a loved one\n• **Social Worker**: You're assisting patients professionally\n\nAll roles receive the same resources, but the language may be adjusted."
        },
        2: {
            title: "Transplant Status",
            content: "Your transplant stage determines which medications are relevant:\n\n• **Pre-transplant**: Shows medications for candidates (dialysis support, heart failure meds, etc.)\n• **Post-transplant (1st year)**: Focus on immunosuppressants and anti-infection medications\n• **Post-transplant (1+ years)**: Long-term maintenance medications\n\nDifferent assistance programs may be available at each stage."
        },
        3: {
            title: "Selecting Your Organ",
            content: "Choose all organs that apply to your situation:\n\n• **Single organ**: We'll show medications specific to that organ\n• **Multi-organ**: Select all relevant organs\n• **Other/Not listed**: Shows general transplant medications\n\nThis filters the medication list to show only relevant options."
        },
        4: {
            title: "Insurance Type",
            content: "Your insurance determines which assistance programs you can use:\n\n• **Commercial**: Can use manufacturer copay cards + PAPs\n• **Medicare**: Part B-ID important for kidney patients; can use PAPs but NOT copay cards\n• **Medicaid**: May have full coverage; check state formulary\n• **Uninsured**: Manufacturer PAPs are your primary option\n\n💡 Having insurance doesn't mean you can't get additional help!"
        },
        5: {
            title: "Selecting Medications",
            content: "Choose all medications you currently take or expect to take:\n\n• Don't worry if you're not sure - you can always come back\n• Selecting medications gives you direct links to manufacturer programs\n• You can search for specific meds using the Search Meds tool\n\n💡 If you're pre-transplant, the list shows supportive medications. Post-transplant shows immunosuppressants and prophylaxis."
        },
        6: {
            title: "Specialty Pharmacy",
            content: "**Why this matters:**\n\nCommercial insurance often requires transplant meds be filled at a designated specialty pharmacy (not your local CVS/Walgreens).\n\n**If you use the wrong pharmacy:**\n• Insurance won't cover it\n• You'll pay full price ($1000s)\n\n**What to do:**\nCall your insurance and ask: 'Which specialty pharmacy must I use for my transplant medications?'\n\nCommon ones: Accredo, CVS Specialty, Walgreens Specialty, Optum"
        },
        7: {
            title: "Financial Status",
            content: "**Be honest - this helps us prioritize the best help for you:**\n\n• **Manageable**: We'll show copay savings tips\n• **Challenging**: Focus on PAPs and foundations\n• **Unaffordable**: Urgent PAP applications recommended\n• **Crisis**: Immediate assistance pathways\n\nYour answer is NEVER stored or shared. Many people qualify for help even if costs seem manageable now."
        }
    };

    const help = helpContent[step];
    if (!help) return null;

    return (
        <div className="mb-4">
            <button
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition"
            >
                <HelpCircle size={18} />
                {showHelp ? 'Hide Help' : 'Need help with this step?'}
            </button>

            {showHelp && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in slide-in-from-top-2">
                    <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <Lightbulb size={18} className="text-blue-600" />
                        {help.title}
                    </h3>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{help.content}</p>
                </div>
            )}
        </div>
    );
};

// Smart Suggestions Component for Medication Selection
const MedicationSuggestions = ({ answers, onSelectMedication }) => {
    const suggestions = getMedicationSuggestions(answers);
    const [showSuggestions, setShowSuggestions] = useState(true);

    if (suggestions.length === 0) return null;

    return (
        <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Zap size={20} className="text-indigo-600" />
                    <h3 className="font-bold text-indigo-900">Smart Suggestions Based on Your Profile</h3>
                </div>
                <button
                    onClick={() => setShowSuggestions(!showSuggestions)}
                    className="text-indigo-600 hover:text-indigo-700 text-xs"
                >
                    {showSuggestions ? 'Hide' : 'Show'}
                </button>
            </div>

            {showSuggestions && (
                <div className="space-y-3">
                    {suggestions.map((suggestion, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-indigo-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Pill size={16} className="text-indigo-600" />
                                <span className="font-bold text-sm text-indigo-900">{suggestion.category}</span>
                            </div>
                            <p className="text-xs text-slate-600 mb-2">{suggestion.reason}</p>
                            <div className="flex flex-wrap gap-2">
                                {suggestion.medications.map(medId => {
                                    const med = MEDICATIONS.find(m => m.id === medId);
                                    if (!med) return null;
                                    const isSelected = answers.medications.includes(medId);
                                    return (
                                        <button
                                            key={medId}
                                            onClick={() => onSelectMedication(medId)}
                                            className={`text-xs px-3 py-1 rounded-full border transition ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'
                                            }`}
                                        >
                                            {isSelected && <Check size={12} className="inline mr-1" />}
                                            {med.brandName.split('/')[0]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Wizard Page
const Wizard = () => {
    useMetaTags(seoMetadata.wizard);

    const [step, setStep] = useState(1);
    const [answers, setAnswers] = useState({
        role: null,
        status: null,
        organs: [],
        insurance: null,
        medications: [],
        specialtyPharmacyAware: null,
        financialStatus: null,
    });

    const handleSingleSelect = (key, value) => {
        setAnswers({ ...answers, [key]: value });
    };

    const handleMultiSelect = (key, value) => {
        const current = answers[key];
        const updated = current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value];
        setAnswers({ ...answers, [key]: updated });
    };

    const nextStep = () => setStep(step + 1);
    const prevStep = () => setStep(step - 1);

    // Navigation Logic
    const handleNextFromInsurance = () => setStep(5);
    const handleNextFromMeds = () => {
        if (answers.insurance === InsuranceType.COMMERCIAL) {
            setStep(6);
        } else {
            setStep(7);
        }
    };
    const handleNextFromSpecialty = () => setStep(7);
    const handleNextFromFinancial = () => setStep(8);

    const renderProgress = () => (
        <div className="w-full bg-slate-200 h-2 rounded-full mb-8 no-print" role="progressbar" aria-valuenow={(step / 8) * 100} aria-valuemin="0" aria-valuemax="100" aria-label={`Step ${step} of 8`}>
            <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(step / 8) * 100}%` }}
            ></div>
        </div>
    );

    // Step 1: Role
    if (step === 1) {
        return (
            <div className="max-w-2xl mx-auto">
                {renderProgress()}
                <h1 className="text-2xl font-bold mb-6">Step 1: Who are you?</h1>
                <WizardHelp step={step} answers={answers} />
                <div className="space-y-3" role="radiogroup" aria-label="Select your role">
                    {Object.values(Role).map((r) => (
                        <button
                            key={r}
                            onClick={() => { handleSingleSelect('role', r); nextStep(); }}
                            className={`w-full p-4 text-left rounded-xl border-2 transition flex justify-between items-center ${
                                answers.role === r ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'
                            }`}
                            role="radio"
                            aria-checked={answers.role === r}
                        >
                            <span className="font-medium text-lg">{r}</span>
                            {answers.role === r && <CheckCircle className="text-emerald-600" aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Step 2: Status
    if (step === 2) {
        return (
            <div className="max-w-2xl mx-auto">
                {renderProgress()}
                <button onClick={prevStep} className="text-slate-700 mb-4 flex items-center gap-1 text-sm hover:text-emerald-600 min-h-[44px] min-w-[44px]" aria-label="Go back to previous step"><ChevronLeft size={16} aria-hidden="true" /> Back</button>
                <h1 className="text-2xl font-bold mb-6">Step 2: Where are you in the process?</h1>
                <WizardHelp step={step} answers={answers} />
                <div className="space-y-3" role="radiogroup" aria-label="Select your transplant status">
                    {Object.values(TransplantStatus).map((s) => (
                        <button
                            key={s}
                            onClick={() => { handleSingleSelect('status', s); nextStep(); }}
                            className={`w-full p-4 text-left rounded-xl border-2 transition flex justify-between items-center ${
                                answers.status === s ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'
                            }`}
                            role="radio"
                            aria-checked={answers.status === s}
                        >
                            <span className="font-medium text-lg">{s}</span>
                            {answers.status === s && <CheckCircle className="text-emerald-600" aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Step 3: Organ
    if (step === 3) {
        return (
            <div className="max-w-2xl mx-auto">
                {renderProgress()}
                <button onClick={prevStep} className="text-slate-700 mb-4 flex items-center gap-1 text-sm hover:text-emerald-600 min-h-[44px] min-w-[44px]" aria-label="Go back to previous step"><ChevronLeft size={16} aria-hidden="true" /> Back</button>
                <h1 className="text-2xl font-bold mb-2">Step 3: Organ Type</h1>
                <p className="text-slate-600 mb-6">Select all that apply.</p>
                <WizardHelp step={step} answers={answers} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8" role="group" aria-label="Select organ types">
                    {Object.values(OrganType).map((o) => (
                        <button
                            key={o}
                            onClick={() => handleMultiSelect('organs', o)}
                            className={`p-4 text-left rounded-xl border-2 transition flex justify-between items-center ${
                                answers.organs.includes(o) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'
                            }`}
                            role="checkbox"
                            aria-checked={answers.organs.includes(o)}
                        >
                            <span className="font-medium">{o}</span>
                            {answers.organs.includes(o) && <CheckCircle size={20} className="text-emerald-600" aria-hidden="true" />}
                        </button>
                    ))}
                </div>
                <button
                    disabled={answers.organs.length === 0}
                    onClick={nextStep}
                    className="w-full py-3 bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-lg disabled:cursor-not-allowed"
                    aria-label="Continue to next step"
                >
                    Next Step
                </button>
            </div>
        );
    }

    // Step 4: Insurance
    if (step === 4) {
        return (
            <div className="max-w-2xl mx-auto">
                {renderProgress()}
                <button onClick={prevStep} className="text-slate-700 mb-4 flex items-center gap-1 text-sm hover:text-emerald-600 min-h-[44px] min-w-[44px]" aria-label="Go back to previous step"><ChevronLeft size={16} aria-hidden="true" /> Back</button>
                <h1 className="text-2xl font-bold mb-6">Step 4: Primary Insurance</h1>
                <WizardHelp step={step} answers={answers} />
                <div className="space-y-3" role="radiogroup" aria-label="Select your insurance type">
                    {Object.values(InsuranceType).map((i) => (
                        <button
                            key={i}
                            onClick={() => { handleSingleSelect('insurance', i); handleNextFromInsurance(); }}
                            className={`w-full p-4 text-left rounded-xl border-2 transition flex justify-between items-center ${
                                answers.insurance === i ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'
                            }`}
                            role="radio"
                            aria-checked={answers.insurance === i}
                        >
                            <span className="font-medium text-lg">{i}</span>
                            {answers.insurance === i && <CheckCircle className="text-emerald-600" aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Step 5: Meds
    if (step === 5) {
        const isPreTransplant = answers.status === TransplantStatus.PRE_EVAL;

        return (
            <div className="max-w-3xl mx-auto">
                {renderProgress()}
                <button onClick={prevStep} className="text-slate-700 mb-4 flex items-center gap-1 text-sm hover:text-emerald-600 min-h-[44px] min-w-[44px]" aria-label="Go back to previous step"><ChevronLeft size={16} aria-hidden="true" /> Back</button>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-2">Step 5: Medications</h1>
                    <p className="text-slate-600">
                        Showing medications relevant for: <strong className="text-emerald-700">{isPreTransplant ? 'Pre-Transplant' : 'Post-Transplant'}</strong>
                    </p>
                </div>
                <WizardHelp step={step} answers={answers} />

                <MedicationSuggestions
                    answers={answers}
                    onSelectMedication={(medId) => handleMultiSelect('medications', medId)}
                />

                <div className="space-y-6 mb-8">
                    {(() => {
                        // First, filter all medications by stage and organs
                        const userOrgans = answers.organs;
                        const showAllOrgans = userOrgans.includes(OrganType.OTHER) || userOrgans.includes(OrganType.MULTI);

                        let filteredMeds = MEDICATIONS.filter(m => {
                            // Filter by stage
                            if (m.stage === TransplantStage.BOTH) return true;
                            if (isPreTransplant && m.stage === TransplantStage.PRE) return true;
                            if (!isPreTransplant && m.stage === TransplantStage.POST) return true;
                            return false;
                        });

                        // Filter by organs
                        if (!showAllOrgans) {
                            filteredMeds = filteredMeds.filter(m => {
                                return m.commonOrgans.some(o => userOrgans.includes(o));
                            });
                        }

                        // Get unique categories from filtered medications
                        const categories = [...new Set(filteredMeds.map(m => m.category))];

                        // Define category order for better UX
                        const categoryOrder = CATEGORY_ORDER_DATA;

                        // Sort categories based on defined order, with unknown categories at the end
                        const sortedCategories = categories.sort((a, b) => {
                            const indexA = categoryOrder.indexOf(a);
                            const indexB = categoryOrder.indexOf(b);
                            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                            if (indexA === -1) return 1;
                            if (indexB === -1) return -1;
                            return indexA - indexB;
                        });

                        return sortedCategories.map(cat => {
                            const medsInCat = filteredMeds.filter(m => m.category === cat);

                            return (
                                <div key={cat}>
                                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">{cat}s</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="group" aria-label={`${cat} medications`}>
                                         {medsInCat.map((m) => (
                                            <button
                                            key={m.id}
                                            onClick={() => handleMultiSelect('medications', m.id)}
                                            className={`p-3 text-left rounded-lg border transition flex items-start gap-3 ${
                                                answers.medications.includes(m.id) ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-slate-200 hover:bg-slate-50'
                                            }`}
                                            role="checkbox"
                                            aria-checked={answers.medications.includes(m.id)}
                                            aria-label={`${m.brandName} - ${m.genericName}`}
                                            >
                                            <div className={`w-5 h-5 mt-1 rounded border flex items-center justify-center flex-shrink-0 ${answers.medications.includes(m.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`} aria-hidden="true">
                                                {answers.medications.includes(m.id) && <CheckCircle size={14} className="text-white" />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{m.brandName}</div>
                                                <div className="text-sm text-slate-600">{m.genericName}</div>
                                            </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>

                <button
                    onClick={handleNextFromMeds}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-md"
                    aria-label="Continue to next step"
                >
                    Next Step
                </button>
            </div>
        );
    }

    // Step 6: Specialty Pharmacy
    if (step === 6) {
        return (
            <div className="max-w-2xl mx-auto">
                {renderProgress()}
                <button onClick={prevStep} className="text-slate-700 mb-4 flex items-center gap-1 text-sm hover:text-emerald-600 min-h-[44px] min-w-[44px]" aria-label="Go back to previous step"><ChevronLeft size={16} aria-hidden="true" /> Back</button>
                <h1 className="text-2xl font-bold mb-4">Specialty Pharmacy Check</h1>
                <WizardHelp step={step} answers={answers} />
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6" role="note">
                    <p className="text-blue-800">
                        Most commercial insurance plans require transplant medications to be filled at a specific "Specialty Pharmacy" (mail order), not a local retail pharmacy like CVS or Walgreens.
                    </p>
                </div>
                <h2 className="font-bold text-lg mb-4">Does your plan require you to use a specific Specialty Pharmacy?</h2>
                
                <div className="space-y-3 mb-8" role="radiogroup" aria-label="Specialty pharmacy requirement">
                    {['Yes', 'No', 'Not Sure'].map(opt => (
                         <button
                         key={opt}
                         onClick={() => { 
                             handleSingleSelect('specialtyPharmacyAware', opt === 'Yes'); 
                             handleNextFromSpecialty();
                         }}
                         className="w-full p-4 text-left rounded-xl border-2 border-slate-200 hover:border-emerald-200 hover:bg-slate-50 transition font-medium"
                         role="radio"
                         aria-checked={false}
                       >
                         {opt}
                       </button>
                    ))}
                </div>
            </div>
        );
    }

    // Step 7: Financial Status
    if (step === 7) {
        return (
            <div className="max-w-2xl mx-auto">
                {renderProgress()}
                <button onClick={() => setStep(answers.insurance === InsuranceType.COMMERCIAL ? 6 : 5)} className="text-slate-700 mb-4 flex items-center gap-1 text-sm hover:text-emerald-600 min-h-[44px]" aria-label="Go back to previous step"><ChevronLeft size={16} aria-hidden="true" /> Back</button>
                <h1 className="text-2xl font-bold mb-2">Find Your Best Options</h1>
                <p className="text-slate-600 mb-6">How would you describe your current medication costs?</p>
                <WizardHelp step={step} answers={answers} />
                <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200 text-sm text-slate-600" role="note">
                    This helps us prioritize the best assistance programs for you. We do not store this answer.
                </div>

                <div className="space-y-3" role="radiogroup" aria-label="Select your financial status">
                    {[
                        { val: FinancialStatus.MANAGEABLE, label: 'Manageable', desc: 'I can afford my medications but would like to save money' },
                        { val: FinancialStatus.CHALLENGING, label: 'Challenging', desc: 'Medication costs are a significant burden' },
                        { val: FinancialStatus.UNAFFORDABLE, label: 'Unaffordable', desc: 'I struggle to pay for my medications' },
                        { val: FinancialStatus.CRISIS, label: 'Crisis', desc: 'I cannot afford my medications without help' },
                    ].map(opt => (
                        <button
                            key={opt.val}
                            onClick={() => { handleSingleSelect('financialStatus', opt.val); handleNextFromFinancial(); }}
                            className={`w-full p-4 text-left rounded-xl border-2 transition ${
                                answers.financialStatus === opt.val ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'
                            }`}
                            role="radio"
                            aria-checked={answers.financialStatus === opt.val}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-lg text-slate-900">{opt.label}</span>
                                {answers.financialStatus === opt.val && <CheckCircle className="text-emerald-600" aria-hidden="true" />}
                            </div>
                            <div className="text-slate-600 text-sm">{opt.desc}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Step 8: Results
    if (step === 8) {
        const isKidney = answers.organs.includes(OrganType.KIDNEY);
        const isMedicare = answers.insurance === InsuranceType.MEDICARE;
        const isCommercial = answers.insurance === InsuranceType.COMMERCIAL;
        const isUninsured = answers.insurance === InsuranceType.UNINSURED;
        const financial = answers.financialStatus;

        return (
            <article className="max-w-4xl mx-auto space-y-8 pb-12">
                {/* Header */}
                <div className={`p-8 rounded-2xl shadow-xl text-white flex justify-between items-start ${
                    financial === FinancialStatus.CRISIS || financial === FinancialStatus.UNAFFORDABLE 
                    ? 'bg-indigo-900' 
                    : 'bg-emerald-900'
                }`}>
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Your Medication Strategy</h1>
                        <p className="opacity-90">
                            Based on your inputs, here is how to navigate your costs.
                        </p>
                    </div>
                    <button 
                        onClick={() => window.print()}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 border border-white/20 transition no-print"
                        aria-label="Print your medication plan"
                    >
                        <Printer size={16} aria-hidden="true" /> Print Plan
                    </button>
                </div>

                {/* Critical Alerts */}
                {isKidney && isMedicare && (
                    <aside className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-indigo-600" role="alert" aria-labelledby="medicare-alert">
                        <h2 id="medicare-alert" className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                            <AlertCircle aria-hidden="true" /> Important: Medicare Part B-ID
                        </h2>
                        <p className="mt-2 text-slate-700">
                            Since you are a kidney transplant recipient on Medicare, you may qualify for <strong>Medicare Part B-ID</strong>. 
                            This extends coverage for immunosuppressive drugs for life.
                        </p>
                        <a href="https://www.medicare.gov" target="_blank" rel="noreferrer" className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition no-print">
                            Check Eligibility on Medicare.gov
                        </a>
                    </aside>
                )}
                
                <div className="grid md:grid-cols-2 gap-6">

                    {/* Column 1 (Left): Med List & Tools */}
                    <div className="space-y-6">
                        {answers.medications.length > 0 && (
                            <section className="bg-slate-50 p-6 rounded-xl border border-slate-200" aria-labelledby="med-list-heading">
                                <h2 id="med-list-heading" className="font-bold text-slate-800 mb-4">Your Medication List</h2>
                                <div className="flex flex-wrap gap-2">
                                    {answers.medications.map(id => {
                                        const med = MEDICATIONS.find(m => m.id === id);
                                        return (
                                            <span key={id} className="bg-white text-slate-700 px-3 py-1 rounded-full text-sm border border-slate-200 shadow-sm">
                                                {med?.brandName.split('/')[0]}
                                            </span>
                                        )
                                    })}
                                </div>
                                <div className="mt-4 no-print">
                                    <Link 
                                        to={`/medications?ids=${answers.medications.join(',')}`}
                                        className="w-full block text-center py-2 bg-white border border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50 font-medium text-sm"
                                        aria-label="View price estimates for your selected medications"
                                    >
                                        View Price Estimates for These Meds
                                    </Link>
                                </div>
                            </section>
                        )}

                        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 break-inside-avoid" aria-labelledby="tools-heading">
                            <h2 id="tools-heading" className="font-bold text-slate-800 mb-4">Helpful Tools</h2>
                            <p className="text-sm text-slate-600 mb-4">Once you have identified the program you need (PAP or Foundation), use our guide to help you apply.</p>
                            
                            <Link to="/application-help" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 group transition" aria-label="View application education guide">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded" aria-hidden="true"><HeartHandshake size={18} /></div>
                                    <div>
                                        <span className="font-bold text-slate-800 block text-sm">Application Education</span>
                                        <span className="text-xs text-slate-600">Scripts, checklists, and templates</span>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="text-slate-300 group-hover:text-emerald-600 no-print" aria-hidden="true" />
                            </Link>

                            <Link to="/education" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 group transition mt-2" aria-label="View insurance and resources">
                                <div className="flex items-center gap-3">
                                    <div className="bg-amber-100 text-amber-600 p-2 rounded" aria-hidden="true"><Shield size={18} /></div>
                                    <div>
                                        <span className="font-bold text-slate-800 block text-sm">Insurance & Resources</span>
                                        <span className="text-xs text-slate-600">Medicaid directory, Medicare guides</span>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="text-slate-300 group-hover:text-emerald-600 no-print" aria-hidden="true" />
                            </Link>
                        </section>
                    </div>

                    {/* Column 2 (Right): Strategy / Action Plan */}
                    <div className="space-y-6">
                        {financial === FinancialStatus.MANAGEABLE && (
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200" aria-labelledby="savings-heading">
                                <h2 id="savings-heading" className="text-lg font-bold text-emerald-800 border-b pb-2 mb-4 flex items-center gap-2">
                                    <DollarSign size={20} aria-hidden="true" /> Maximize Your Savings
                                </h2>
                                <ul className="space-y-4 text-slate-700">
                                    {isCommercial && (
                                        <li className="flex gap-3 items-start">
                                            <div className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded mt-0.5" aria-label="Priority recommendation">Priority</div>
                                            <div>
                                                <strong>Use Manufacturer Copay Cards.</strong>
                                                <p className="text-sm text-slate-600 mt-1">Even if you can afford the copay, these cards can lower it to as little as $0. Look up each of your brand name meds.</p>
                                            </div>
                                        </li>
                                    )}
                                    <li className="flex gap-3 items-start">
                                        <div className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded mt-0.5" aria-label="Comparison tip">Compare</div>
                                        <div>
                                            <strong>Check Cash Prices.</strong>
                                            <p className="text-sm text-slate-600 mt-1">Compare your insurance copay against cash prices at Mark Cuban Cost Plus Drugs or using GoodRx.</p>
                                        </div>
                                    </li>
                                    {isCommercial && (
                                        <li className="flex gap-3 items-start">
                                            <div className="bg-slate-100 text-slate-800 text-xs font-bold px-2 py-1 rounded mt-0.5" aria-label="Verification step">Verify</div>
                                            <div>
                                                <strong>Specialty Pharmacy.</strong>
                                                <p className="text-sm text-slate-600 mt-1">Ensure you are using the mandated pharmacy to avoid surprise full-price bills.</p>
                                            </div>
                                        </li>
                                    )}
                                </ul>
                                <div className="mt-6 pt-4 border-t border-slate-100">
                                    <p className="text-sm text-slate-600 italic">Tip: You may still qualify for PAPs based on income, even if costs feel manageable right now.</p>
                                </div>
                            </section>
                        )}

                        {financial === FinancialStatus.CHALLENGING && (
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200" aria-labelledby="burden-heading">
                                <h2 id="burden-heading" className="text-lg font-bold text-amber-700 border-b pb-2 mb-4 flex items-center gap-2">
                                    <Shield size={20} aria-hidden="true" /> Reduce Your Burden
                                </h2>
                                <ul className="space-y-4 text-slate-700">
                                    <li className="flex gap-3 items-start">
                                        <div className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded mt-0.5" aria-label="Step one">Step 1</div>
                                        <div>
                                            <strong>Check Manufacturer PAPs.</strong>
                                            <p className="text-sm text-slate-600 mt-1">Go to the manufacturer website for your brand name meds. If eligible, you could get the med for free.</p>
                                        </div>
                                    </li>
                                    <li className="flex gap-3 items-start">
                                        <div className="bg-sky-100 text-sky-800 text-xs font-bold px-2 py-1 rounded mt-0.5" aria-label="Step two">Step 2</div>
                                        <div>
                                            <strong>Apply to Foundations.</strong>
                                            <p className="text-sm text-slate-600 mt-1">Organizations like HealthWell or PAN Foundation help pay for copays. Apply to them for your specific disease fund.</p>
                                        </div>
                                    </li>
                                    <li className="flex gap-3 items-start">
                                        <div className="bg-slate-100 text-slate-800 text-xs font-bold px-2 py-1 rounded mt-0.5" aria-label="Step three">Step 3</div>
                                        <div>
                                            <strong>Compare vs. Cash.</strong>
                                            <p className="text-sm text-slate-600 mt-1">Sometimes the cash price (e.g. Cost Plus Drugs) is cheaper than your insurance copay.</p>
                                        </div>
                                    </li>
                                </ul>
                            </section>
                        )}

                        {(financial === FinancialStatus.UNAFFORDABLE || financial === FinancialStatus.CRISIS) && (
                            <section className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-rose-500" role="alert" aria-labelledby="assistance-heading">
                                <h2 id="assistance-heading" className="text-lg font-bold text-rose-800 border-b pb-2 mb-4 flex items-center gap-2">
                                    <AlertTriangle size={20} aria-hidden="true" /> Immediate Assistance Path
                                </h2>
                                {financial === FinancialStatus.CRISIS && (
                                    <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded">
                                        You are not alone. Help is available. Please follow these steps in order.
                                    </p>
                                )}
                                <ol className="space-y-4 text-slate-700 list-decimal pl-6">
                                    <li>
                                        <strong>Manufacturer PAPs (Free Drug).</strong>
                                        <p className="text-sm text-slate-600 mt-1">
                                            Most manufacturers have a "Patient Assistance Program". This is your best route for free medication. 
                                            <br/>
                                            <Link to={`/medications?ids=${answers.medications.join(',')}`} className="text-rose-700 font-bold underline">Search your med here</Link> to find the manufacturer link.
                                        </p>
                                    </li>
                                    <li>
                                        <strong>Check Medicaid Eligibility.</strong>
                                        <p className="text-sm text-slate-600 mt-1">If you have low income, check if you qualify for state Medicaid or "Extra Help" (if on Medicare).</p>
                                    </li>
                                    {answers.insurance === InsuranceType.IHS && (
                                        <li>
                                            <strong>Contact IHS / Tribal Health.</strong>
                                            <p className="text-sm text-slate-600 mt-1">You likely have coverage for these medications at $0 cost at IHS facilities.</p>
                                        </li>
                                    )}
                                </ol>
                            </section>
                        )}
                    </div>
                </div>

                <div className="text-center pt-8 border-t border-slate-100 no-print">
                    <button onClick={() => setStep(1)} className="text-slate-700 hover:text-emerald-600 text-sm underline min-h-[44px] px-4" aria-label="Restart the wizard from beginning">Restart Wizard</button>
                </div>
            </article>
        );
    }
    return <div>Loading...</div>;
};

// --- PRICE REPORTING HELPERS ---
const PRICE_REPORTS_KEY = 'transplant_med_price_reports';
const PRICE_ESTIMATES_LAST_UPDATED = '2025-11-24'; // November 2025

const getPriceReports = () => {
    try {
        const stored = localStorage.getItem(PRICE_REPORTS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error reading price reports:', e);
        return {};
    }
};

const savePriceReport = (medicationId, source, price, location, date) => {
    try {
        const reports = getPriceReports();
        const key = `${medicationId}_${source}`;

        if (!reports[key]) {
            reports[key] = [];
        }

        reports[key].push({
            price: parseFloat(price),
            location,
            date,
            timestamp: new Date().toISOString()
        });

        // Keep only last 50 reports per medication-source combo
        if (reports[key].length > 50) {
            reports[key] = reports[key].slice(-50);
        }

        localStorage.setItem(PRICE_REPORTS_KEY, JSON.stringify(reports));
        return true;
    } catch (e) {
        console.error('Error saving price report:', e);
        return false;
    }
};

const getCommunityPriceStats = (medicationId, source) => {
    const reports = getPriceReports();
    const key = `${medicationId}_${source}`;
    const priceData = reports[key] || [];

    if (priceData.length === 0) return null;

    const prices = priceData.map(r => r.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    // Only show community prices from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentReports = priceData.filter(r => new Date(r.timestamp) > ninetyDaysAgo);

    return {
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2),
        count: recentReports.length,
        total: priceData.length
    };
};

// MedicationSearch Page
const MedicationSearch = () => {
    useMetaTags(seoMetadata.medications);

    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [myListIds, setMyListIds] = useState([]);
    const [myCustomMeds, setMyCustomMeds] = useState([]);
    const [activeTab, setActiveTab] = useState('PRICE');
    const [linkCopied, setLinkCopied] = useState(false);
    const [priceReportRefresh, setPriceReportRefresh] = useState(0);
    const [isSearching, setIsSearching] = useState(false);

    // Fuse.js instance for fuzzy search (typo-tolerant)
    const fuse = useMemo(() => new Fuse(MEDICATIONS, {
        keys: ['brandName', 'genericName'],
        threshold: 0.4, // 0 = exact match, 1 = match anything
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2
    }), []);

    useEffect(() => {
        const ids = searchParams.get('ids');
        if (ids) {
            const idArray = ids.split(',').filter(id => id.trim() !== '');
            if (idArray.length > 0) setMyListIds(idArray);
        }
    }, [searchParams]);

    useEffect(() => {
        if (myListIds.length > 0) {
            setSearchParams({ ids: myListIds.join(',') });
        } else {
            setSearchParams({});
        }
    }, [myListIds, setSearchParams]);

    const handleSearch = useCallback(() => {
        if (!searchTerm.trim()) {
            setSearchResult(null);
            setIsSearching(false);
            return;
        }
        // Use Fuse.js for fuzzy matching (handles typos like "tacrolimus" vs "tacrolimis")
        const fuseResults = fuse.search(searchTerm.trim());
        const internalMatches = fuseResults.map(result => result.item);
        setSearchResult({ internal: internalMatches, showExternalOption: true });
        setIsSearching(false);
    }, [searchTerm, fuse]);

    useEffect(() => {
        if (searchTerm.trim()) {
            setIsSearching(true);
        } else {
            setSearchResult(null);
            setIsSearching(false);
        }
        const timer = setTimeout(() => {
            if (searchTerm.trim()) handleSearch();
            else setSearchResult(null);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, handleSearch]);

    const addInternalToList = (id) => {
        if (!myListIds.includes(id)) setMyListIds([...myListIds, id]);
        setSearchTerm('');
        setSearchResult(null);
    };

    const removeInternalFromList = (id) => {
        setMyListIds(myListIds.filter(m => m !== id));
    };

    const addCustomToList = () => {
        const term = searchTerm.trim();
        if (term && !myCustomMeds.some(m => m.toLowerCase() === term.toLowerCase())) {
            setMyCustomMeds([...myCustomMeds, term]);
        }
        setSearchTerm('');
        setSearchResult(null);
    };

    const removeCustomFromList = (name) => {
        setMyCustomMeds(myCustomMeds.filter(m => m !== name));
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
    };

    const displayListInternal = MEDICATIONS.filter(m => myListIds.includes(m.id));
    const hasItems = displayListInternal.length > 0 || myCustomMeds.length > 0;

    return (
        <article className="max-w-5xl mx-auto space-y-8">
            <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Build Your Medication List</h1>
                        <p className="text-slate-600">Search for your medications to build a shareable price list.</p>
                    </div>
                    {hasItems && (
                        <div className="flex gap-2 no-print">
                            <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100 transition border border-indigo-200" aria-label="Share your medication list">
                                {linkCopied ? <Check size={18} aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
                                {linkCopied ? "Link Copied!" : "Share List"}
                            </button>
                            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition border border-slate-200" aria-label="Print your medication list">
                                <Printer size={18} aria-hidden="true" /> Print
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="relative z-20 no-print">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-grow relative">
                            <label htmlFor="med-search" className="sr-only">Search for medications</label>
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} aria-hidden="true" />
                            <input
                                id="med-search"
                                type="text"
                                placeholder="Enter drug name (e.g. Prograf, Ozempic)..."
                                className="w-full pl-12 pr-12 py-4 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none text-lg transition shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSearch();
                                    if (e.key === 'Escape') { setSearchResult(null); setSearchTerm(''); }
                                }}
                                aria-describedby="search-instructions"
                                aria-expanded={!!(searchResult && searchTerm && !isSearching)}
                                aria-controls="search-results-listbox"
                            />
                            <span id="search-instructions" className="sr-only">Type medication name and press enter or click search button</span>
                            {isSearching ? (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2" aria-live="polite" aria-busy="true">
                                    <Loader2 size={20} className="text-emerald-600 animate-spin" aria-label="Searching" />
                                </div>
                            ) : searchTerm && (
                                <button onClick={() => { setSearchTerm(''); setSearchResult(null); setIsSearching(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Clear search">
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                        <button onClick={handleSearch} disabled={!searchTerm.trim()} className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-md transition flex items-center gap-2 justify-center shrink-0 disabled:cursor-not-allowed min-h-[56px]" aria-label="Search for medications">
                            <Search size={22} aria-hidden="true" /> Search
                        </button>
                    </div>

                    {isSearching && !searchResult && searchTerm && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50" role="status" aria-label="Loading search results">
                            <div className="flex items-center justify-center gap-3 text-slate-700 py-4">
                                <Loader2 size={20} className="animate-spin text-emerald-600" />
                                <span>Searching medications...</span>
                            </div>
                        </div>
                    )}
                    {searchResult && searchTerm && !isSearching && (
                        <div id="search-results-listbox" className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-2 max-h-[60vh] overflow-y-auto z-50" role="listbox" aria-label="Search results">
                            <div className="px-4 py-2 text-sm font-bold text-slate-700 uppercase tracking-wider">Search Results</div>
                            {searchResult.internal.length > 0 ? (
                                <div className="space-y-1 mb-2">
                                    {searchResult.internal.map(med => {
                                        const isAlreadyIn = myListIds.includes(med.id);
                                        return (
                                            <button key={med.id} onClick={() => addInternalToList(med.id)} disabled={isAlreadyIn} className="w-full text-left p-3 rounded-lg hover:bg-slate-50 flex justify-between items-center group transition disabled:opacity-50 disabled:cursor-not-allowed" role="option" aria-selected={isAlreadyIn} aria-label={`Add ${med.brandName} to list`}>
                                                <div>
                                                    <span className="font-bold text-slate-900 block">{med.brandName}</span>
                                                    <span className="text-sm text-slate-600">{med.genericName}</span>
                                                </div>
                                                {isAlreadyIn ? (
                                                    <span className="text-emerald-600 text-sm font-bold flex items-center gap-1" aria-label="Already added"><CheckCircle size={16} aria-hidden="true" /> Added</span>
                                                ) : (
                                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-sm font-bold group-hover:bg-emerald-100 flex items-center gap-1"><PlusCircle size={16} aria-hidden="true" /> Add</span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="p-4 text-center">
                                    <div className="text-slate-400 mb-2">
                                        <Search size={24} className="mx-auto" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 font-medium mb-1">No matches in our transplant database</p>
                                    <p className="text-slate-500 text-sm">Try a different spelling, or use the option below to add it as a custom medication.</p>
                                </div>
                            )}
                            {searchResult.showExternalOption && (
                                <div className="border-t border-slate-100 pt-2 mt-1">
                                    <button onClick={addCustomToList} className="w-full text-left p-3 rounded-lg hover:bg-indigo-50 flex justify-between items-center group transition" aria-label={`Add custom medication ${searchTerm} to list`}>
                                        <div>
                                            <span className="font-bold text-indigo-900 block">Add "{searchTerm}" to list</span>
                                            <span className="text-xs text-indigo-600">Check price on external sites</span>
                                        </div>
                                        <span className="text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full text-sm font-bold group-hover:bg-indigo-200 flex items-center gap-1"><PlusCircle size={16} aria-hidden="true" /> Add Custom</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {hasItems && (
                <section className="bg-gradient-to-r from-emerald-50 to-sky-50 border border-emerald-200 rounded-xl p-6 shadow-sm no-print" aria-labelledby="app-guide-heading">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="bg-emerald-600 text-white p-3 rounded-full" aria-hidden="true">
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <h2 id="app-guide-heading" className="text-lg font-bold text-slate-900 mb-1">Need Help Applying for Assistance?</h2>
                                <p className="text-slate-600 text-sm">Learn how to fill out Patient Assistance Program applications step-by-step.</p>
                            </div>
                        </div>
                        <Link
                            to="/application-help"
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition shadow-md whitespace-nowrap"
                            aria-label="View application guide for step-by-step help"
                        >
                            <FileText size={18} aria-hidden="true" />
                            Application Guide
                        </Link>
                    </div>
                </section>
            )}

            {hasItems && (
                <nav className="flex overflow-x-auto gap-2 pb-2 border-b border-slate-200 no-print" role="tablist" aria-label="Medication information tabs">
                    {[
                        { id: 'PRICE', label: 'Price Estimates', icon: DollarSign },
                        { id: 'ASSISTANCE', label: 'Assistance Programs', icon: Building },
                        { id: 'OVERVIEW', label: 'Overview', icon: Info },
                        { id: 'PRINT', label: 'Print Summary', icon: Printer },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            aria-controls={`${tab.id}-panel`}
                            className={`flex items-center gap-2 px-6 py-3 rounded-t-lg font-bold text-base whitespace-nowrap transition min-h-[48px] ${activeTab === tab.id ? 'bg-emerald-700 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-emerald-700'}`}
                        >
                            <tab.icon size={20} aria-hidden="true" /> {tab.label}
                        </button>
                    ))}
                </nav>
            )}

            <div className="space-y-6 pb-12" role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`}>
                {!hasItems ? (
                    <div className="text-center py-16 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
                        <div className="text-slate-400 mb-4" aria-hidden="true"><List size={64} className="mx-auto"/></div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Your list is empty</h2>
                        <p className="text-slate-700 max-w-md mx-auto">Use the search box above to add medications. You can add standard transplant drugs or any other medication you take.</p>
                    </div>
                ) : (
                    <>
                        {displayListInternal.map(med => (
                            <MedicationCard key={med.id} med={med} activeTab={activeTab} onRemove={() => removeInternalFromList(med.id)} onPriceReportSubmit={() => setPriceReportRefresh(prev => prev + 1)} />
                        ))}
                        {myCustomMeds.map((name, idx) => (
                            <ExternalMedCard key={`${name}-${idx}`} name={name} onRemove={() => removeCustomFromList(name)} />
                        ))}
                    </>
                )}
            </div>
        </article>
    );
};

// Price Report Modal Component
const PriceReportModal = ({ isOpen, onClose, medicationId, medicationName, source, onSubmit }) => {
    const [price, setPrice] = useState('');
    const [location, setLocation] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!price || parseFloat(price) <= 0) {
            alert('Please enter a valid price');
            return;
        }

        setSubmitting(true);
        const success = savePriceReport(medicationId, source, price, location, date);

        if (success) {
            onSubmit();
            setPrice('');
            setLocation('');
            setDate(new Date().toISOString().split('T')[0]);
            onClose();
        } else {
            alert('Error saving price report. Please try again.');
        }
        setSubmitting(false);
    };

    // Handle Escape key to close modal
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="price-report-title"
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 id="price-report-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Users size={20} className="text-emerald-600" aria-hidden="true" />
                            Report a Price
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">{medicationName} via {source}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-600 hover:text-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close dialog">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="price" className="block text-sm font-medium text-slate-700 mb-1">
                            Price Paid (USD) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-600">$</span>
                            <input
                                id="price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-1">
                            Pharmacy/Location (Optional)
                        </label>
                        <input
                            id="location"
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="e.g., CVS in Seattle, WA"
                        />
                    </div>

                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">
                            Date Purchased
                        </label>
                        <input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            required
                        />
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 flex items-start gap-2">
                        <Info size={14} className="mt-0.5 flex-shrink-0" />
                        <p>Your report helps other transplant patients estimate costs. Data is stored locally on your device only.</p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                            {submitting ? 'Submitting...' : 'Submit Report'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const MedicationCard = ({ med, activeTab, onRemove, onPriceReportSubmit }) => {
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportModalData, setReportModalData] = useState(null);

    // Pharmacy availability - exclude medications not carried by each pharmacy
    // Excluded: Injectable biologics, IV formulations, hospital-only medications
    const isCostPlusAvailable = !COST_PLUS_EXCLUSIONS_DATA.includes(med.id) && med.manufacturer !== 'Various';
    const isGoodRxAvailable = !GOODRX_EXCLUSIONS_DATA.includes(med.id) && med.manufacturer !== 'Various';
    const isAmazonAvailable = !AMAZON_EXCLUSIONS_DATA.includes(med.id) && med.manufacturer !== 'Various';

    const papLink = med.papUrl || `https://www.drugs.com/search.php?searchterm=${med.brandName.split('/')[0]}`;
    const papLinkText = med.papUrl ? "Visit Manufacturer Program" : "Search for Program on Drugs.com";

    // Get community price stats for each source
    const costPlusStats = getCommunityPriceStats(med.id, 'costplus');
    const goodRxStats = getCommunityPriceStats(med.id, 'goodrx');
    const amazonStats = getCommunityPriceStats(med.id, 'amazon');

    const openReportModal = (source, sourceName) => {
        setReportModalData({ source, sourceName });
        setReportModalOpen(true);
    };

    const handleReportSubmit = () => {
        if (onPriceReportSubmit) {
            onPriceReportSubmit();
        }
    };

    return (
        <>
        {reportModalOpen && reportModalData && (
            <PriceReportModal
                isOpen={reportModalOpen}
                onClose={() => {
                    setReportModalOpen(false);
                    setReportModalData(null);
                }}
                medicationId={med.id}
                medicationName={med.brandName}
                source={reportModalData.source}
                onSubmit={handleReportSubmit}
            />
        )}

        <article className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition hover:shadow-md break-inside-avoid" aria-labelledby={`med-${med.id}-title`}>
            <header className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start md:items-center">
                <div>
                    <h2 id={`med-${med.id}-title`} className="text-xl font-bold text-slate-900">{med.brandName}</h2>
                    <p className="text-slate-600 font-medium text-sm">{med.genericName} • <span className="text-emerald-600">{med.category}</span></p>
                </div>
                <button onClick={onRemove} className="text-slate-600 hover:text-red-500 transition p-2 no-print min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label={`Remove ${med.brandName} from list`} title="Remove from list"><Trash2 size={20} /></button>
            </header>

            <div className="p-6">
                {activeTab === 'OVERVIEW' && (
                    <div className="space-y-4 fade-in">
                        <p className="text-slate-700 leading-relaxed">
                            Manufacturer: <strong>{med.manufacturer}</strong><br/>
                            Commonly prescribed for: <strong>{med.commonOrgans.join(', ')}</strong> recipients.
                            {med.stage && <><br/>Stage: <strong>{med.stage}</strong></>}
                        </p>
                        <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 flex gap-2 items-start" role="note">
                            <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <strong>Tip:</strong> Always verify with your doctor if you can switch between Brand and Generic versions.
                        </div>
                        <div className="flex gap-4 mt-4 no-print">
                            <a href={`https://www.drugs.com/search.php?searchterm=${med.brandName.split('/')[0]}`} target="_blank" rel="noreferrer" className="text-emerald-600 font-medium hover:underline flex items-center gap-1" aria-label={`Read full drug facts for ${med.brandName} on Drugs.com (opens in new tab)`}>Read full drug facts on Drugs.com <ExternalLink size={14} aria-hidden="true" /></a>
                        </div>
                    </div>
                )}
                {activeTab === 'ASSISTANCE' && (
                    <div className="space-y-6 fade-in">
                        <div className="grid md:grid-cols-2 gap-6">
                            <section className="border border-emerald-100 rounded-lg p-4 bg-emerald-50/30">
                                <h3 className="font-bold text-emerald-800 mb-2 flex items-center gap-2"><Building size={18} aria-hidden="true" /> Manufacturer PAP</h3>
                                <p className="text-sm text-slate-700 mb-4">Many manufacturers offer free medication if you are uninsured or have commercial insurance but can't afford copays.</p>
                                <a href={papLink} target="_blank" rel="noreferrer" className="w-full block text-center bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-lg text-sm font-medium transition no-print flex items-center justify-center gap-1" aria-label={`${papLinkText} for ${med.brandName} (opens in new tab)`}>{papLinkText} <ExternalLink size={14} aria-hidden="true" /></a>
                            </section>
                            <section className="border border-sky-100 rounded-lg p-4 bg-sky-50/30">
                                <h3 className="font-bold text-sky-800 mb-2 flex items-center gap-2"><Building size={18} aria-hidden="true" /> Foundations & Grants</h3>
                                <p className="text-sm text-slate-700 mb-4">Check HealthWell, PAN Foundation, and PAF for copay assistance.</p>
                                <a href="https://fundfinder.panfoundation.org/" target="_blank" rel="noreferrer" className="w-full block text-center bg-white border border-sky-600 text-sky-700 hover:bg-sky-50 py-2 rounded-lg text-sm font-medium transition no-print" aria-label="Check PAN Foundation FundFinder Tool (opens in new tab)">Check FundFinder Tool</a>
                            </section>
                        </div>
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-5 shadow-sm no-print">
                            <div className="flex items-start gap-4">
                                <div className="bg-indigo-600 text-white p-2.5 rounded-lg flex-shrink-0" aria-hidden="true">
                                    <FileText size={20} />
                                </div>
                                <div className="flex-grow">
                                    <h4 className="font-bold text-indigo-900 mb-1 flex items-center gap-2">
                                        Need Help Filling Out the Application?
                                    </h4>
                                    <p className="text-sm text-slate-700 mb-3">
                                        Our comprehensive guide walks you through the entire application process with templates, checklists, and step-by-step instructions.
                                    </p>
                                    <Link
                                        to="/application-help"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition text-sm shadow-md"
                                        aria-label="View complete application guide"
                                    >
                                        <BookOpen size={16} aria-hidden="true" />
                                        View Application Guide
                                        <ArrowRight size={16} aria-hidden="true" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'PRICE' && (
                    <div className="fade-in">
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-sm text-left min-w-[500px]">
                                <caption className="sr-only">Price estimates for {med.brandName}</caption>
                                <thead className="bg-slate-100 text-slate-700 font-bold">
                                    <tr><th scope="col" className="p-3">Pharmacy / Tool</th><th scope="col" className="p-3">Est. Cash Price</th><th scope="col" className="p-3 no-print">Action</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {/* Cost Plus Drugs Row - only show if medication is available */}
                                    {isCostPlusAvailable && (
                                    <tr className="bg-white hover:bg-slate-50">
                                        <td className="p-3">
                                            <div className="font-medium text-slate-900">Cost Plus Drugs (Online)</div>
                                            {costPlusStats && (
                                                <div className="text-xs text-emerald-700 flex items-center gap-1 mt-1">
                                                    <Users size={14} />
                                                    Community: ${costPlusStats.min}-${costPlusStats.max} ({costPlusStats.count} reports)
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="text-emerald-600 font-bold">
                                                {med.category === 'Immunosuppressant' ? '$15 - $40' : '$10 - $25'}
                                            </div>
                                            <div className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                                                <Clock size={14} />
                                                Est. updated Nov 2025
                                            </div>
                                        </td>
                                        <td className="p-3 no-print">
                                            <div className="flex flex-col gap-1">
                                                <a href={`https://costplusdrugs.com/medications/?query=${encodeURIComponent(med.genericName)}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium flex items-center gap-1" aria-label="Check live price on Cost Plus Drugs (opens in new tab)">
                                                    Check Live <ExternalLink size={14} aria-hidden="true" />
                                                </a>
                                                <button onClick={() => openReportModal('costplus', 'Cost Plus Drugs')} className="text-emerald-600 hover:underline text-sm flex items-center gap-1 min-h-[44px] px-2">
                                                    <TrendingUp size={14} aria-hidden="true" /> Report Price
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    )}

                                    {/* GoodRx Row - only show if medication is available */}
                                    {isGoodRxAvailable && (
                                    <tr className="bg-white hover:bg-slate-50">
                                        <td className="p-3">
                                            <div className="font-medium text-slate-900">GoodRx Coupon (Retail)</div>
                                            {goodRxStats && (
                                                <div className="text-xs text-emerald-700 flex items-center gap-1 mt-1">
                                                    <Users size={14} />
                                                    Community: ${goodRxStats.min}-${goodRxStats.max} ({goodRxStats.count} reports)
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="text-slate-600">
                                                {med.category === 'Immunosuppressant' ? '$40 - $100' : '$20 - $50'}
                                            </div>
                                            <div className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                                                <Clock size={14} />
                                                Est. updated Nov 2025
                                            </div>
                                        </td>
                                        <td className="p-3 no-print">
                                            <div className="flex flex-col gap-1">
                                                <a href={`https://www.goodrx.com/search?s=${encodeURIComponent(med.genericName)}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium flex items-center gap-1" aria-label={`Check live price on GoodRx for ${med.genericName} (opens in new tab)`}>
                                                    Check Live <ExternalLink size={14} aria-hidden="true" />
                                                </a>
                                                <button onClick={() => openReportModal('goodrx', 'GoodRx')} className="text-emerald-600 hover:underline text-sm flex items-center gap-1 min-h-[44px] px-2">
                                                    <TrendingUp size={14} aria-hidden="true" /> Report Price
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    )}

                                    {/* Amazon Pharmacy Row - only show if medication is available */}
                                    {isAmazonAvailable && (
                                    <tr className="bg-white hover:bg-slate-50">
                                        <td className="p-3">
                                            <div className="font-medium text-slate-900">Amazon Pharmacy</div>
                                            {amazonStats && (
                                                <div className="text-xs text-emerald-700 flex items-center gap-1 mt-1">
                                                    <Users size={14} />
                                                    Community: ${amazonStats.min}-${amazonStats.max} ({amazonStats.count} reports)
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="text-slate-600">Varies</div>
                                            <div className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                                                <Clock size={14} />
                                                Check for current pricing
                                            </div>
                                        </td>
                                        <td className="p-3 no-print">
                                            <div className="flex flex-col gap-1">
                                                <a href={`https://pharmacy.amazon.com/s?k=${encodeURIComponent(med.genericName)}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium flex items-center gap-1" aria-label={`Check live price on Amazon Pharmacy for ${med.genericName} (opens in new tab)`}>
                                                    Check Live <ExternalLink size={14} aria-hidden="true" />
                                                </a>
                                                <button onClick={() => openReportModal('amazon', 'Amazon Pharmacy')} className="text-emerald-600 hover:underline text-sm flex items-center gap-1 min-h-[44px] px-2">
                                                    <TrendingUp size={14} aria-hidden="true" /> Report Price
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Price Info Footer */}
                        <div className="mt-3 space-y-2">
                            <div className="text-xs text-slate-600 italic flex items-start gap-2" role="note">
                                <Info size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                                <p>Price estimates are approximate ranges based on general market research (last updated: November 2025). Always check live prices via the links above for current rates.</p>
                            </div>
                            {isCostPlusAvailable && (
                                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2" role="note">
                                    <DollarSign size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                                    <p><strong>Cost Plus Drugs Pricing Note:</strong> Cost Plus Drugs operates as a cash-based pharmacy. When dealing with insurance deductibles, cash payments will not count toward your deductible. However, your medications may be cheaper paying cash than running through insurance.</p>
                                </div>
                            )}
                            {(costPlusStats || goodRxStats || amazonStats) && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-start gap-2">
                                    <Users size={14} className="flex-shrink-0 mt-0.5" />
                                    <p><strong>Community prices</strong> are real prices reported by other users in the last 90 days. Help others by reporting prices you've paid!</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'PRINT' && (
                    <div className="fade-in">
                        <p className="text-slate-900 text-base">{med.brandName}</p>
                    </div>
                )}
            </div>
        </article>
        </>
    );
};

const ExternalMedCard = ({ name, onRemove }) => {
    const encodedTerm = encodeURIComponent(name);
    return (
        <article className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden transition hover:shadow-md break-inside-avoid" aria-labelledby={`custom-med-${name}`}>
            <header className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
                <div>
                    <h2 id={`custom-med-${name}`} className="text-xl font-bold text-indigo-900 flex items-center gap-2"><Globe size={20} aria-hidden="true" /> {name}</h2>
                    <p className="text-indigo-700 text-xs font-medium">External / Custom Search</p>
                </div>
                <button onClick={onRemove} className="text-indigo-300 hover:text-red-500 transition p-2 no-print" title="Remove from list" aria-label={`Remove ${name} from list`}><Trash2 size={20} /></button>
            </header>
            <div className="p-6">
                <div className="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-400 text-sm text-amber-900 mb-4 flex gap-2 items-start" role="note">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <p><strong>Note:</strong> This drug is not in our education database. Use the links below to find pricing directly.</p>
                </div>
                <nav className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label={`External price check options for ${name}`}>
                    <a href={`https://www.goodrx.com/search?q=${encodedTerm}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-sm transition group" aria-label={`Check ${name} price on GoodRx (opens in new tab)`}>
                        <span className="font-bold text-slate-800 group-hover:text-emerald-800">GoodRx</span>
                        <ExternalLink size={16} className="text-slate-400 group-hover:text-emerald-500" aria-hidden="true" />
                    </a>
                    <a href={`https://costplusdrugs.com/`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-sm transition group" aria-label={`Check ${name} price on Cost Plus Drugs (opens in new tab)`}>
                        <span className="font-bold text-slate-800 group-hover:text-emerald-800">Cost Plus</span>
                        <ExternalLink size={16} className="text-slate-400 group-hover:text-emerald-500" aria-hidden="true" />
                    </a>
                    <a href={`https://pharmacy.amazon.com/search?q=${encodedTerm}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-sm transition group" aria-label={`Check ${name} price on Amazon Pharmacy (opens in new tab)`}>
                        <span className="font-bold text-slate-800 group-hover:text-emerald-800">Amazon</span>
                        <ExternalLink size={16} className="text-slate-400 group-hover:text-emerald-500" aria-hidden="true" />
                    </a>
                </nav>
                <div className="mt-4 pt-4 border-t border-slate-100 text-center no-print">
                    <a href={`https://www.drugs.com/search.php?searchterm=${encodedTerm}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline flex items-center justify-center gap-1" aria-label={`Search for ${name} assistance programs on Drugs.com (opens in new tab)`}>
                        Search "{name}" on Drugs.com for Assistance Programs <ExternalLink size={12} aria-hidden="true" />
                    </a>
                </div>
            </div>
        </article>
    );
};

// Education Page
const Education = () => {
    useMetaTags(seoMetadata.education);

    const [activeTab, setActiveTab] = useState('DEDUCTIBLE_TRAP');
    const [selectedState, setSelectedState] = useState("");
    const [appealName, setAppealName] = useState("");
    const [appealDrug, setAppealDrug] = useState("");
    const [appealReason, setAppealReason] = useState("Financial Hardship");
    const [generatedLetter, setGeneratedLetter] = useState("");
    const [copied, setCopied] = useState(false);

    const generateAppealLetter = () => {
        const date = new Date().toLocaleDateString();
        const text = `Date: ${date}\n\nTo Whom It May Concern:\n\nI am writing to appeal the coverage denial or specialty pharmacy requirement for my medication, ${appealDrug}. \n\nPatient Name: ${appealName}\nMedication: ${appealDrug}\n\nReason for Appeal: ${appealReason}\n\nThis medication is medically necessary for my transplant care. The current requirement creates a significant barrier to my adherence and health outcomes because ${
            appealReason === 'Financial Hardship' 
            ? 'the cost at the required pharmacy is unaffordable compared to available alternatives, putting me at risk of missing doses.' 
            : appealReason === 'Access Issues' 
            ? 'the required pharmacy cannot deliver the medication in a timely manner consistent with my medical needs.' 
            : 'I have been stable on this specific regimen from my current pharmacy and disrupting this care poses a clinical risk.'
        }\n\nPlease review this appeal and allow me to access my medication at my pharmacy of choice.\n\nSincerely,\n${appealName}`;
        setGeneratedLetter(text);
        setCopied(false);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedLetter);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`${id}-panel`}
            aria-label={label}
            className={`flex items-center gap-2 px-3 sm:px-5 py-3 font-bold text-sm sm:text-base transition-all border-b-4 whitespace-nowrap min-h-[48px] ${
                activeTab === id
                    ? 'border-emerald-600 text-emerald-800 bg-emerald-50'
                    : 'border-transparent text-slate-800 hover:text-emerald-700 hover:bg-slate-100'
            }`}
        >
            <Icon size={20} aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
        </button>
    );

    return (
        <article className="max-w-6xl mx-auto space-y-8 pb-12">
            <header className="text-center py-8">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Resources & Education</h1>
                <p className="text-xl text-slate-700 max-w-3xl mx-auto">Understand the difference between Patient Assistance Programs and Foundations, and learn how to navigate medication costs effectively.</p>
            </header>
            <nav className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto" role="tablist" aria-label="Education topics">
                <div className="flex min-w-max">
                    <TabButton id="DEDUCTIBLE_TRAP" label="Deductible Trap" icon={AlertTriangle} />
                    <TabButton id="OOP" label="Out-of-Pocket" icon={DollarSign} />
                    <TabButton id="INSURANCE" label="Insurance(s)" icon={Shield} />
                    <TabButton id="SPECIALTY" label="Specialty Pharmacy" icon={Stethoscope} />
                    <TabButton id="MENTAL" label="Mental Health" icon={Heart} />
                    <TabButton id="DIRECTORY" label="Directory" icon={Search} />
                    <TabButton id="GRANTS" label="Grants/Assistance" icon={HeartHandshake} />
                </div>
            </nav>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 min-h-[500px]" role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`}>
                {activeTab === 'OOP' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div className="prose prose-slate max-w-none">
                            <h2 className="text-2xl font-bold text-slate-900">Combining Programs</h2>
                            <p className="text-lg text-slate-700">Most transplant patients have to mix and match different types of coverage to afford their medication. It is like a puzzle.</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                             <section className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                                 <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">New for 2025</span>
                                    <h3 className="font-bold text-indigo-900">Medicare Prescription Payment Plan</h3>
                                 </div>
                                 <p className="text-sm text-indigo-900 mb-4 font-medium">A major change from the Inflation Reduction Act</p>
                                 <p className="text-slate-700 text-sm mb-4 leading-relaxed">Starting in 2025, Medicare Part D enrollees can choose this option to spread out their prescription drug costs over the course of the year instead of paying large amounts up front (like when hitting the donut hole/coverage gap).</p>
                                 <p className="text-slate-700 text-sm mb-4">This "smoothing" program helps make your out-of-pocket costs more predictable and manageable.</p>
                                 <p className="text-slate-700 text-sm font-medium">Ask your Part D plan about enrolling in the Medicare Prescription Payment Plan during open enrollment.</p>
                             </section>
                             <section className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                                 <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">Coming in 2026</span>
                                    <h3 className="font-bold text-purple-900">Medicare Drug Price Negotiation</h3>
                                 </div>
                                 <p className="text-sm text-purple-900 mb-4 font-medium">A landmark change allowing Medicare to negotiate drug prices for the first time.</p>
                                 <p className="text-slate-700 text-sm mb-4 leading-relaxed">For the first time ever, Medicare will directly negotiate the price for some of the highest-cost drugs. The first negotiated prices will take effect in 2026, which should lead to lower out-of-pocket costs for patients on these specific medications.</p>
                                 <p className="text-slate-700 text-sm">The first 10 drugs selected for negotiation include medications for heart failure (Entresto), diabetes (Jardiance, Farxiga), and autoimmune conditions (Stelara), which are highly relevant for many transplant patients.</p>
                             </section>
                        </div>

                        <div className="border-t border-slate-200 pt-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">Part D vs Medicare Advantage: Choosing Your Plan</h2>
                            <p className="text-slate-600 mb-6">Understanding the differences can save you significant money on transplant medications.</p>
                            <div className="grid md:grid-cols-2 gap-6 mb-8">
                                <section className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                                    <h3 className="font-bold text-blue-900 text-xl mb-3">Medicare Part D (Traditional)</h3>
                                    <p className="text-sm text-slate-600 mb-4">Stand-alone prescription drug coverage that works with Original Medicare.</p>
                                    <ul className="space-y-2 text-slate-700 text-sm">
                                        <li className="flex items-start gap-2"><span className="text-blue-600 font-bold">✓</span><span>Works with any Medicare-accepting provider</span></li>
                                        <li className="flex items-start gap-2"><span className="text-blue-600 font-bold">✓</span><span>Separate deductible and premium</span></li>
                                        <li className="flex items-start gap-2"><span className="text-blue-600 font-bold">✓</span><span>$2,000 out-of-pocket cap (2025)</span></li>
                                    </ul>
                                </section>
                                <section className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                                    <h3 className="font-bold text-green-900 text-xl mb-3">Medicare Advantage (MA-PD)</h3>
                                    <p className="text-sm text-slate-600 mb-4">All-in-one plan that includes medical coverage AND prescription drugs.</p>
                                    <ul className="space-y-2 text-slate-700 text-sm">
                                        <li className="flex items-start gap-2"><span className="text-green-600 font-bold">✓</span><span>Often lower or $0 premiums</span></li>
                                        <li className="flex items-start gap-2"><span className="text-green-600 font-bold">✓</span><span>Provider networks may be limited</span></li>
                                        <li className="flex items-start gap-2"><span className="text-green-600 font-bold">✓</span><span>$2,000 out-of-pocket cap (2025)</span></li>
                                    </ul>
                                </section>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-200 mb-8">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">How to Compare Plans for Your Medications</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-blue-100 text-blue-800 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">1</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-800 mb-1">Check Formularies</h4>
                                            <p className="text-slate-600 text-sm mb-2">Use the Medicare Plan Finder tool at medicare.gov to compare which plans cover your drugs and their tier levels.</p>
                                            <a href="https://www.medicare.gov/plan-compare/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-medium flex items-center gap-1" aria-label="Visit Medicare Plan Finder (opens in new tab)">Medicare Plan Finder <ExternalLink size={12} aria-hidden="true" /></a>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="bg-blue-100 text-blue-800 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">2</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-800 mb-1">Compare Total Costs</h4>
                                            <p className="text-slate-600 text-sm">Look at premiums, deductibles, copays/coinsurance, and pharmacy networks. Include the $2,000 out-of-pocket cap in your calculations.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="bg-blue-100 text-blue-800 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">3</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-800 mb-1">Consider Extra Help</h4>
                                            <p className="text-slate-600 text-sm mb-2">If you have limited income, the Extra Help program can lower costs for both Part D and MA-PD plans, eliminating premiums and deductibles and capping copays (e.g., $4.90 for generics, $12.15 for brand-name drugs in 2025).</p>
                                            <a href="https://www.ssa.gov/medicare/prescriptionhelp" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-medium flex items-center gap-1" aria-label="Apply for Extra Help (opens in new tab)">Apply for Extra Help <ExternalLink size={12} aria-hidden="true" /></a>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="bg-blue-100 text-blue-800 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">4</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-800 mb-1">Get Free Help</h4>
                                            <p className="text-slate-600 text-sm mb-2">Contact your State Health Insurance Assistance Program (SHIP) for free, personalized help comparing plans.</p>
                                            <a href="https://www.shiphelp.org/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-medium flex items-center gap-1" aria-label="Find Your Local SHIP (opens in new tab)">Find Your Local SHIP <ExternalLink size={12} aria-hidden="true" /></a>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">Medicare Parts for Transplant Drugs</h3>
                                <p className="text-slate-600 mb-4">Understanding which part of Medicare covers your transplant medications is crucial.</p>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                                        <h4 className="font-bold text-blue-700 text-lg mb-2">Part A (Hospital)</h4>
                                        <p className="text-xs text-slate-600 mb-3">Covers drugs given during an inpatient hospital stay.</p>
                                        <ul className="text-sm text-slate-700 list-disc pl-4">
                                            <li>Induction agents (Thymoglobulin, Simulect)</li>
                                        </ul>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                                        <h4 className="font-bold text-blue-700 text-lg mb-2">Part B (Medical)</h4>
                                        <p className="text-xs text-slate-600 mb-3">Covers some outpatient drugs, including immunosuppressants if you don't have Part D.</p>
                                        <ul className="text-sm text-slate-700 list-disc pl-4">
                                            <li>IV infusions (Belatacept/Nulojix)</li>
                                        </ul>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                                        <h4 className="font-bold text-blue-700 text-lg mb-2">Part D (Prescription)</h4>
                                        <p className="text-xs text-slate-600 mb-3">Covers most of your daily oral take-home medications.</p>
                                        <ul className="text-sm text-slate-700 list-disc pl-4">
                                            <li>Tacrolimus, Mycophenolate, etc.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-200 pt-8">
                            <h3 className="text-xl font-bold text-slate-900 mb-6">Strategies by Insurance Type</h3>
                            <div className="grid gap-6 md:grid-cols-2">
                                <section className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-900 text-lg mb-3">Commercial Insurance?</h4>
                                    <ol className="space-y-2 text-slate-700 list-decimal pl-5">
                                        <li>Use <strong>Manufacturer PAPs</strong> for copay cards.</li>
                                        <li>Use <strong>Foundations</strong> for deductibles.</li>
                                    </ol>
                                </section>
                                <section className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-900 text-lg mb-3">Medicare?</h4>
                                    <ol className="space-y-2 text-slate-700 list-decimal pl-5">
                                        <li>Use <strong>Foundations</strong> for copays.</li>
                                        <li>Check <strong>Cash Prices</strong> for generics during the coverage gap.</li>
                                    </ol>
                                </section>
                            </div>
                        </div>
                        <aside className="bg-emerald-50 p-6 rounded-xl border border-emerald-100" role="note">
                            <h3 className="font-bold text-emerald-900 mb-2">Key Insight</h3>
                            <p className="text-emerald-800">Many patients combine programs—for example: Medicare patient → foundation grants for copays. Also compare cash pricing for generics.</p>
                        </aside>

                        <div className="border-t border-slate-200 pt-8">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-200">
                                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <BookOpen size={24} className="text-blue-600" aria-hidden="true" />
                                    Insurance Jargon Made Simple
                                </h2>
                                <p className="text-slate-600 mb-6">Understanding insurance terms helps you navigate costs and find the help you need.</p>

                                <div className="space-y-6">
                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Premium</h3>
                                        <p className="text-slate-700 text-sm">The amount you pay each month to have insurance. Think of it like a gym membership - you pay every month whether you use it or not.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Deductible</h3>
                                        <p className="text-slate-700 text-sm">The amount you must pay yourself before your insurance starts helping. If your deductible is $500, you pay the first $500 of medicine costs. After that, insurance helps pay.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Copay (or Co-payment)</h3>
                                        <p className="text-slate-700 text-sm">A fixed amount you pay each time you get medicine. Example: You might pay $10 for each prescription, and insurance pays the rest.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Coinsurance</h3>
                                        <p className="text-slate-700 text-sm">The percentage you pay after meeting your deductible. If you have 20% coinsurance, you pay $20 for every $100 of medicine cost. Insurance pays the other $80.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Out-of-Pocket Maximum</h3>
                                        <p className="text-slate-700 text-sm">The most money you will pay in one year. Once you reach this amount, insurance pays 100% of covered medicines. This is your safety net.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Formulary</h3>
                                        <p className="text-slate-700 text-sm">The list of medicines your insurance will cover. Think of it as the insurance company's menu. If your medicine isn't on the list, you might pay more or need special approval.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Tier</h3>
                                        <p className="text-slate-700 text-sm mb-3">How insurance groups medicines by cost. Lower tiers (1-2) cost less. Higher tiers (3-4-5) cost more.</p>
                                        <ul className="text-slate-600 text-sm space-y-1 ml-4 list-disc">
                                            <li><strong>Tier 1:</strong> Usually generic drugs (lowest cost)</li>
                                            <li><strong>Tier 2:</strong> Preferred brand drugs</li>
                                            <li><strong>Tier 3-5:</strong> Non-preferred or specialty drugs (highest cost)</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Prior Authorization</h3>
                                        <p className="text-slate-700 text-sm">When you need insurance company approval before they will pay for a medicine. Your doctor must explain why you need that specific medicine.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Generic Medicine</h3>
                                        <p className="text-slate-700 text-sm">A medicine that works the same as a brand name but costs less. Like store-brand cereal versus name-brand - same thing, different package.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Brand Name Medicine</h3>
                                        <p className="text-slate-700 text-sm">The original version of a medicine made by the company that invented it. Usually costs more than generic.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Specialty Medication</h3>
                                        <p className="text-slate-700 text-sm">Expensive medicines that need special handling or monitoring. Most transplant medicines are specialty medications. They often cost $600+ per month.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Medicare Part D</h3>
                                        <p className="text-slate-700 text-sm">The part of Medicare that helps pay for prescription medicines. You must sign up for this separately.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Donut Hole (Coverage Gap)</h3>
                                        <p className="text-slate-700 text-sm">A temporary limit in Medicare Part D coverage. After you and your plan spend a certain amount, you pay more until you reach catastrophic coverage. This happens in the middle of the year for some people.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Catastrophic Coverage</h3>
                                        <p className="text-slate-700 text-sm">After you spend a lot on medicines in one year, Medicare pays almost everything. You only pay a small amount (about $4-$12) per prescription.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">In-Network Pharmacy</h3>
                                        <p className="text-slate-700 text-sm">A pharmacy that works with your insurance. You pay less here. Think of it as a preferred partner.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Out-of-Network Pharmacy</h3>
                                        <p className="text-slate-700 text-sm">A pharmacy that doesn't have a deal with your insurance. You might pay more or get no coverage here.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">PBM (Pharmacy Benefit Manager)</h3>
                                        <p className="text-slate-700 text-sm">The company that manages prescription drug coverage for your insurance. They decide which medicines are covered and how much they cost.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Patient Assistance Program (PAP)</h3>
                                        <p className="text-slate-700 text-sm">Free or low-cost medicine programs run by drug companies. If you can't afford your medicine, these programs might help.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Copay Card or Coupon</h3>
                                        <p className="text-slate-700 text-sm">Help from drug companies to lower what you pay for brand name medicines. <strong>Important:</strong> These often don't work with Medicare.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Manufacturer Assistance</h3>
                                        <p className="text-slate-700 text-sm">Help directly from the company that makes your medicine. This can be free medicine, copay help, or discounts.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Mail Order Pharmacy</h3>
                                        <p className="text-slate-700 text-sm">A pharmacy that ships medicine to your home. Usually gives you 90 days of medicine at once. Often costs less than getting 30 days at a local pharmacy.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Step Therapy</h3>
                                        <p className="text-slate-700 text-sm">When insurance requires you to try a cheaper medicine first before they'll pay for a more expensive one. Like having to try the basic version before getting the premium version.</p>
                                    </div>

                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="font-bold text-lg text-blue-800 mb-2">Exclusion</h3>
                                        <p className="text-slate-700 text-sm">A medicine that insurance will not cover at all. You must pay the full price yourself or find other help.</p>
                                    </div>
                                </div>

                                <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                                    <h3 className="font-bold text-yellow-900 text-lg mb-3">Why This Matters for Transplant Patients</h3>
                                    <p className="text-yellow-900 mb-4">Your anti-rejection medicines are specialty medications. They are expensive. Understanding these words helps you:</p>
                                    <ul className="text-yellow-900 space-y-2 ml-6 list-disc">
                                        <li>Know what you'll pay</li>
                                        <li>Find help when costs are too high</li>
                                        <li>Talk to your transplant team about options</li>
                                        <li>Apply for assistance programs</li>
                                    </ul>
                                </div>

                                <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                                    <h3 className="font-bold text-emerald-900 text-lg mb-3">Questions to Ask</h3>
                                    <ul className="text-emerald-900 space-y-2 ml-6 list-disc">
                                        <li>What tier are my transplant medicines?</li>
                                        <li>How much is my deductible?</li>
                                        <li>When do I reach my out-of-pocket maximum?</li>
                                        <li>Are my medicines on the formulary?</li>
                                        <li>Can I use mail order to save money?</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'DIRECTORY' && (
                    <section aria-labelledby="directory-heading">
                        <h2 id="directory-heading" className="text-2xl font-bold text-slate-900 mb-6">Trusted Resource Directory</h2>
                        {DIRECTORY_RESOURCES && DIRECTORY_RESOURCES.length > 0 ? (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {DIRECTORY_RESOURCES.map((res) => (
                                    <a key={res.name} href={res.url} target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition h-full" aria-label={`Visit ${res.name} (opens in new tab)`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-emerald-700 pr-2">{res.name}</h3>
                                            <ExternalLink size={16} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0 mt-1" aria-hidden="true" />
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full font-bold mb-3 inline-block ${res.category === 'Foundation' ? 'bg-rose-50 text-rose-700' : res.category === 'Government' ? 'bg-purple-50 text-purple-700' : res.category === 'Support Group' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{res.category}</span>
                                        <p className="text-slate-600 text-sm leading-relaxed">{res.description}</p>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                                <Globe size={48} className="mx-auto text-slate-300 mb-4" aria-hidden="true" />
                                <h3 className="text-xl font-bold text-slate-900 mb-2">No resources available</h3>
                                <p className="text-slate-600 max-w-md mx-auto">We're working on adding trusted resources. Check back soon for helpful links and organizations.</p>
                            </div>
                        )}
                    </section>
                )}
                {activeTab === 'INSURANCE' && (
                    <div className="max-w-4xl mx-auto space-y-12">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-center mb-8" role="note">
                            <p className="text-blue-900 font-medium">Each insurance type has different benefits, costs, and best strategies.</p>
                        </div>
                        <section aria-labelledby="medicare-guide">
                            <h2 id="medicare-guide" className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">Medicare Guide</h2>
                            <div className="mb-8">
                                <h3 className="font-bold text-lg text-slate-800 mb-4">Medicare Parts for Transplant Drugs</h3>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
                                        <strong className="text-blue-700 text-lg block mb-1">Part A (Hospital)</strong>
                                        <ul className="text-sm font-medium text-slate-800 list-disc pl-4"><li>Induction agents</li><li>(Thymoglobulin, Simulect)</li></ul>
                                    </div>
                                    <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
                                        <strong className="text-blue-700 text-lg block mb-1">Part B (Medical)</strong>
                                        <ul className="text-sm font-medium text-slate-800 list-disc pl-4"><li>IV infusions (Belatacept)</li><li>Immunosuppressants (if Part B-ID eligible)</li></ul>
                                    </div>
                                    <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
                                        <strong className="text-blue-700 text-lg block mb-1">Part D (Prescription)</strong>
                                        <ul className="text-sm font-medium text-slate-800 list-disc pl-4"><li>Tacrolimus</li><li>Mycophenolate</li><li>Valcyte, etc.</li></ul>
                                    </div>
                                </div>
                            </div>
                            <div className="mb-8">
                                <h3 className="font-bold text-lg text-slate-800 mb-4">Part D vs Medicare Advantage: Choosing Your Plan</h3>
                                <div className="overflow-hidden border border-slate-200 rounded-xl">
                                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                                        <div className="p-6">
                                            <h4 className="font-bold text-indigo-700 text-lg mb-2">Part D (Traditional)</h4>
                                            <ul className="space-y-2 text-sm text-slate-800 list-disc pl-5"><li>Works with any Medicare-accepting provider</li><li>Separate deductible and premium</li><li>$2,000 out-of-pocket cap (2025)</li></ul>
                                        </div>
                                        <div className="p-6">
                                            <h4 className="font-bold text-indigo-700 text-lg mb-2">Medicare Advantage (MA-PD)</h4>
                                            <ul className="space-y-2 text-sm text-slate-800 list-disc pl-5"><li>Often lower or $0 premiums</li><li>Provider networks may be limited</li><li>$2,000 out-of-pocket cap (2025)</li></ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section aria-labelledby="commercial-insurance">
                            <h2 id="commercial-insurance" className="text-xl font-bold text-blue-900 bg-blue-50 p-4 rounded-t-xl border-b border-blue-100">Commercial Insurance</h2>
                            <div className="bg-white border border-slate-200 rounded-b-xl p-6 space-y-4">
                                <p className="text-slate-700">Primary payer for first 30 months post-transplant.</p>
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-2">Key Points</h3>
                                        <ul className="list-disc pl-5 text-slate-600 text-sm space-y-1"><li>Eligible for most manufacturer PAPs</li><li>Copay cards often available</li><li>Foundations help with high copays</li><li>May require specialty pharmacy</li></ul>
                                    </div>
                                    <div><h3 className="font-bold text-emerald-700 mb-2">Best Strategy</h3><p className="text-sm text-slate-700">Start with manufacturer PAPs, then foundations for leftover copays and deductibles.</p></div>
                                </div>
                            </div>
                        </section>
                        <div className="grid md:grid-cols-2 gap-6">
                            <section className="border border-slate-200 rounded-xl overflow-hidden" aria-labelledby="va-health">
                                <h2 id="va-health" className="font-bold bg-slate-50 p-3 border-b border-slate-200 text-slate-800">VA Health Care</h2>
                                <div className="p-4 space-y-3"><p className="text-sm text-slate-600">For eligible veterans.</p><div className="text-sm"><strong className="block text-emerald-700">Best Strategy</strong>Priority Groups 1–6: $0 medications. VA pharmacy = primary source. Work with VA transplant coordinator.</div><a href="https://www.va.gov/health-care/eligibility/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-2" aria-label="Visit VA Prescription Information (opens in new tab)">VA Prescription Information <ExternalLink size={12} aria-hidden="true" /></a></div>
                            </section>
                            <section className="border border-slate-200 rounded-xl overflow-hidden" aria-labelledby="tricare">
                                <h2 id="tricare" className="font-bold bg-slate-50 p-3 border-b border-slate-200 text-slate-800">TRICARE</h2>
                                <div className="p-4 space-y-3"><p className="text-sm text-slate-600">Military insurance.</p><div className="text-sm"><strong className="block text-emerald-700">Best Strategy</strong>Use military pharmacy ($0 copay). TRICARE mail order for maintenance meds. Use formulary search tool.</div><a href="https://www.tricare.mil/CoveredServices/Pharmacy" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-2" aria-label="Visit TRICARE Formulary Search (opens in new tab)">TRICARE Formulary Search <ExternalLink size={12} aria-hidden="true" /></a></div>
                            </section>
                        </div>
                        <section className="border border-slate-200 rounded-xl overflow-hidden" aria-labelledby="no-insurance">
                            <h2 id="no-insurance" className="font-bold bg-slate-50 p-3 border-b border-slate-200 text-slate-800">No Insurance</h2>
                            <div className="p-6 bg-white"><p className="text-slate-700 mb-4">For uninsured patients.</p><h3 className="font-bold text-emerald-700 mb-2">Best Strategy</h3><ul className="list-disc pl-5 text-slate-600 text-sm space-y-1"><li>Start with manufacturer PAPs</li><li>Compare Cost Plus pricing</li><li>Use discount tools (GoodRx, SingleCare, etc.)</li><li>Explore Medicaid or Marketplace enrollment</li></ul><a href="https://www.healthcare.gov/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-4" aria-label="Explore Insurance Options on Healthcare.gov (opens in new tab)">Explore Insurance Options <ExternalLink size={12} aria-hidden="true" /></a></div>
                        </section>

                        <section aria-labelledby="medicaid-section">
                            <h2 id="medicaid-section" className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">Medicaid (State-Based)</h2>
                            <p className="text-slate-600 mb-6">Low-income program; coverage varies by state.</p>
                            <div className="bg-slate-50 p-8 rounded-xl border border-slate-200">
                                <label htmlFor="state-select" className="block font-bold text-slate-700 mb-2">Select your State:</label>
                                <div className="relative">
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} aria-hidden="true" />
                                    <select id="state-select" className="w-full appearance-none p-4 pr-10 rounded-lg border border-slate-300 text-lg bg-white focus:ring-2 focus:ring-emerald-500 outline-none" onChange={(e) => setSelectedState(e.target.value)} value={selectedState}>
                                        <option value="">-- Choose a State --</option>
                                        {STATES.map(s => <option key={s.name} value={s.url}>{s.name}</option>)}
                                    </select>
                                </div>
                                {selectedState && (
                                    <div className="mt-6 text-center fade-in">
                                        <a href={selectedState} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-8 rounded-full shadow-lg transition" aria-label="Visit your state's Medicaid website (opens in new tab)">Go to Official Site <ExternalLink size={18} aria-hidden="true" /></a>
                                        <p className="text-xs text-slate-600 mt-3">You are leaving this app to visit a government website.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section aria-labelledby="ihs-section">
                            <h2 id="ihs-section" className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">Indian Health Service / Tribal Programs</h2>
                            <p className="text-slate-600 mb-6">For eligible American Indian and Alaska Native patients.</p>
                            <div className="grid md:grid-cols-2 gap-6">
                                <a href="https://www.ihs.gov/findhealthcare/" target="_blank" rel="noreferrer" className="bg-white p-6 rounded-xl border-2 border-emerald-100 hover:border-emerald-200 transition text-center group" aria-label="Find an IHS facility (opens in new tab)">
                                    <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-700" aria-hidden="true"><LandPlot size={32} /></div>
                                    <h3 className="font-bold text-lg text-slate-900 mb-2">Find a Facility</h3>
                                    <p className="text-sm text-slate-600 mb-6">Use the official IHS locator to find clinics and pharmacies near you.</p>
                                    <span className="inline-block w-full bg-emerald-700 group-hover:bg-emerald-800 text-white font-bold py-2 rounded-lg">Open IHS Locator</span>
                                </a>
                                <section className="bg-white p-6 rounded-xl border border-slate-200" aria-labelledby="ihs-strategy"><h3 id="ihs-strategy" className="font-bold text-slate-900 mb-4">Best Strategy</h3><p className="text-slate-600 text-sm">Use your local IHS or Urban Indian Program — usually $0 cost.</p></section>
                            </div>
                        </section>
                    </div>
                )}
                {activeTab === 'SPECIALTY' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-8 text-center"><h2 className="text-2xl font-bold text-slate-900 mb-4">Specialty Pharmacy Guide</h2><p className="text-lg text-slate-600">Understanding your rights and options when your insurer requires a specific pharmacy.</p></div>
                        <section className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 mb-12" aria-labelledby="appeal-builder">
                            <div className="flex items-center gap-2 mb-4"><FileText className="text-indigo-600" size={24} aria-hidden="true" /><h3 id="appeal-builder" className="text-xl font-bold text-indigo-900">Appeal Letter Builder</h3></div>
                            <p className="text-sm text-indigo-800 mb-6">Enter your details below to generate a professional letter template that you can copy and send to your insurance company.</p>
                            <div className="grid md:grid-cols-3 gap-4 mb-4">
                                <label htmlFor="appeal-name" className="sr-only">Your Name</label>
                                <input id="appeal-name" type="text" placeholder="Your Name" className="p-3 rounded border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400" value={appealName} onChange={(e) => setAppealName(e.target.value)} />
                                <label htmlFor="appeal-drug" className="sr-only">Medication Name</label>
                                <input id="appeal-drug" type="text" placeholder="Medication Name" className="p-3 rounded border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400" value={appealDrug} onChange={(e) => setAppealDrug(e.target.value)} />
                                <label htmlFor="appeal-reason" className="sr-only">Reason for Appeal</label>
                                <select id="appeal-reason" className="p-3 rounded border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={appealReason} onChange={(e) => setAppealReason(e.target.value)}>
                                    <option value="Financial Hardship">Financial Hardship</option>
                                    <option value="Access Issues">Access Issues (Timing/Delivery)</option>
                                    <option value="Clinical Stability">Clinical Stability (Already stable)</option>
                                </select>
                            </div>
                            <button onClick={generateAppealLetter} disabled={!appealName || !appealDrug} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Generate appeal letter">Generate Letter</button>
                            {generatedLetter && (
                                <div className="mt-6 bg-white p-4 rounded border border-indigo-200 relative fade-in">
                                    <h4 className="text-xs font-bold text-slate-600 uppercase mb-2">Preview:</h4>
                                    <pre className="whitespace-pre-wrap font-serif text-sm text-slate-800 leading-relaxed border-l-4 border-slate-200 pl-4">{generatedLetter}</pre>
                                    <button onClick={copyToClipboard} className="absolute top-4 right-4 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded text-xs font-bold transition" aria-label="Copy letter text to clipboard">{copied ? <Check size={14} className="text-green-600" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied!' : 'Copy Text'}</button>
                                </div>
                            )}
                        </section>
                        <div className="space-y-8">
                            <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">How to Appeal: A Step-by-Step Guide</h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                <section className="border border-slate-200 rounded-xl p-5 bg-white" aria-labelledby="medicare-appeals"><h3 id="medicare-appeals" className="font-bold text-slate-800 mb-3">Medicare Appeals</h3><p className="text-xs text-slate-600 mb-3">Crucial: Act within deadlines.</p><ol className="list-decimal pl-4 space-y-2 text-sm text-slate-700"><li><strong>Coverage Determination:</strong> Ask plan to cover at your preferred pharmacy.</li><li><strong>Level 1 (Reconsideration):</strong> File within 65 days of denial.</li><li><strong>Level 2 (IRE):</strong> Independent review if denied again.</li></ol><a href="https://www.medicare.gov/claims-appeals/how-do-i-file-an-appeal" target="_blank" rel="noreferrer" className="block mt-4 text-xs text-blue-600 font-bold uppercase tracking-wide hover:underline" aria-label="Visit Official Medicare Guide (opens in new tab)">Official Medicare Guide</a></section>
                                <section className="border border-slate-200 rounded-xl p-5 bg-white" aria-labelledby="medicaid-appeals"><h3 id="medicaid-appeals" className="font-bold text-slate-800 mb-3">Medicaid Appeals</h3><p className="text-sm text-slate-700 mb-3">Processes are state-run. Contact your state's Medicaid agency.</p></section>
                                <section className="border border-slate-200 rounded-xl p-5 bg-white" aria-labelledby="private-insurance"><h3 id="private-insurance" className="font-bold text-slate-800 mb-3">Private Insurance</h3><p className="text-sm text-slate-700 mb-3">You have the right to an internal appeal, and if that is denied, an external review.</p></section>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'DEDUCTIBLE_TRAP' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div className="text-center mb-8">
                            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">The Deductible Trap</h1>
                            <p className="text-xl text-slate-600">Why Prescription Discount Cards Can Cost Transplant Patients More</p>
                        </div>

                        <div className="bg-gradient-to-br from-red-50 to-orange-50 border-4 border-red-300 rounded-2xl p-8 shadow-lg">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="bg-red-600 text-white p-3 rounded-full flex-shrink-0" aria-hidden="true">
                                    <AlertTriangle size={32} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-red-900 mb-2">⚠️ Critical Warning for Transplant Patients</h2>
                                    <p className="text-lg font-bold text-red-800">Using discount cards like GoodRx or SingleCare can cost you THOUSANDS of extra dollars per year.</p>
                                </div>
                            </div>
                            <div className="bg-white/80 p-6 rounded-xl border-2 border-red-200 mt-4">
                                <h3 className="font-bold text-red-900 text-xl mb-3">The Problem:</h3>
                                <p className="text-red-900 text-lg leading-relaxed mb-4">When you use a discount card, <span className="font-bold bg-yellow-200 px-2 py-1 rounded">the money you pay does NOT count toward your insurance deductible or out-of-pocket maximum (OOPM)</span>.</p>
                                <p className="text-slate-800 leading-relaxed">Transplant patients typically have high medication costs that help them reach their OOPM within a few months—after which insurance pays 100% of covered costs for the rest of the year. Using discount cards delays reaching your OOPM, meaning you pay out-of-pocket for much longer.</p>
                            </div>
                        </div>

                        <section className="bg-slate-50 p-8 rounded-xl border border-slate-200" aria-labelledby="real-example">
                            <h2 id="real-example" className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <DollarSign className="text-emerald-600" size={28} aria-hidden="true" />
                                Real-World Example
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl border-2 border-emerald-200">
                                    <div className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full inline-block mb-3">✅ The Right Way</div>
                                    <h3 className="font-bold text-lg text-slate-900 mb-4">Using Insurance</h3>
                                    <ul className="space-y-3 text-slate-700">
                                        <li className="flex items-start gap-2">
                                            <span className="font-bold text-slate-900">Month 1-3:</span>
                                            <span>Pay $2,000 out-of-pocket (reaching your deductible/OOPM)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="font-bold text-slate-900">Month 4-12:</span>
                                            <span>Insurance pays 100% = $0 out-of-pocket</span>
                                        </li>
                                        <li className="pt-3 border-t-2 border-emerald-200">
                                            <span className="font-bold text-emerald-700 text-xl">Total Annual Cost: $2,000</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-white p-6 rounded-xl border-2 border-red-200">
                                    <div className="bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full inline-block mb-3">❌ The Discount Card Trap</div>
                                    <h3 className="font-bold text-lg text-slate-900 mb-4">Using GoodRx/SingleCare</h3>
                                    <ul className="space-y-3 text-slate-700">
                                        <li className="flex items-start gap-2">
                                            <span className="font-bold text-slate-900">Month 1-12:</span>
                                            <span>Pay discounted price (~$200/month) but NONE counts toward OOPM</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="font-bold text-slate-900">Result:</span>
                                            <span>You NEVER reach your OOPM, so you pay all year long</span>
                                        </li>
                                        <li className="pt-3 border-t-2 border-red-200">
                                            <span className="font-bold text-red-700 text-xl">Total Annual Cost: $2,400</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                            <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg">
                                <p className="text-yellow-900 font-bold text-lg">Small savings today = thousands of dollars in extra costs over the year.</p>
                            </div>
                        </section>

                        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-200" aria-labelledby="when-to-use">
                            <h2 id="when-to-use" className="text-2xl font-bold text-slate-900 mb-6">When Should Transplant Patients Use Discount Cards?</h2>
                            <div className="space-y-4">
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                    <h3 className="font-bold text-emerald-700 mb-2 flex items-center gap-2">
                                        <CheckCircle size={20} aria-hidden="true" />
                                        Scenario 1: Drug NOT Covered by Insurance
                                    </h3>
                                    <p className="text-slate-700 text-sm">For a medication NOT on your insurance formulary with no generic alternative available.</p>
                                </div>
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                    <h3 className="font-bold text-emerald-700 mb-2 flex items-center gap-2">
                                        <CheckCircle size={20} aria-hidden="true" />
                                        Scenario 2: One-Time, Low-Cost Medications
                                    </h3>
                                    <p className="text-slate-700 text-sm">For non-transplant-related, temporary medications (like a short antibiotic course) where the discount price is cheaper than your copay.</p>
                                </div>
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                    <h3 className="font-bold text-emerald-700 mb-2 flex items-center gap-2">
                                        <CheckCircle size={20} aria-hidden="true" />
                                        Scenario 3: Extremely High Deductible
                                    </h3>
                                    <p className="text-slate-700 text-sm">If you have an extremely high deductible AND the cash price is significantly lower—but even then, carefully weigh the cost of not reaching your OOPM.</p>
                                </div>
                            </div>
                            <div className="mt-6 bg-red-100 border-2 border-red-300 rounded-lg p-6">
                                <h3 className="font-bold text-red-900 text-lg mb-3 flex items-center gap-2">
                                    🛑 NEVER Use Discount Cards For:
                                </h3>
                                <p className="text-red-900 font-bold text-lg">Your chronic, lifelong transplant immunosuppressants like Tacrolimus, Mycophenolate, or Cyclosporine.</p>
                                <p className="text-red-800 mt-2">These are the medications that will help you reach your OOPM quickly.</p>
                            </div>
                        </section>

                        <section className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm" aria-labelledby="better-alternatives">
                            <h2 id="better-alternatives" className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <HeartHandshake className="text-emerald-600" size={28} aria-hidden="true" />
                                Better Alternatives
                            </h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200">
                                    <h3 className="font-bold text-emerald-900 text-lg mb-3">Patient Assistance Programs (PAPs)</h3>
                                    <p className="text-slate-700 text-sm mb-4">Free or low-cost medications directly from drug manufacturers.</p>
                                    <p className="text-emerald-800 font-bold text-sm">✅ Counts toward your OOPM</p>
                                </div>
                                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                                    <h3 className="font-bold text-blue-900 text-lg mb-3">Co-pay Foundations</h3>
                                    <p className="text-slate-700 text-sm mb-4">Non-profit organizations that help cover copays and deductibles.</p>
                                    <p className="text-blue-800 font-bold text-sm">✅ Counts toward your OOPM</p>
                                </div>
                                <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
                                    <h3 className="font-bold text-purple-900 text-lg mb-3">Manufacturer Copay Cards</h3>
                                    <p className="text-slate-700 text-sm mb-4">Drug company assistance for brand-name medications (not available for Medicare).</p>
                                    <p className="text-purple-800 font-bold text-sm">✅ Counts toward your OOPM</p>
                                </div>
                            </div>
                        </section>

                        <section className="bg-gradient-to-r from-amber-50 to-yellow-50 p-8 rounded-xl border-2 border-amber-300" aria-labelledby="key-takeaways">
                            <h2 id="key-takeaways" className="text-2xl font-bold text-slate-900 mb-6">Key Takeaways</h2>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <div className="bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                                    <p className="text-slate-800 pt-1"><span className="font-bold">Your goal every year is to hit your out-of-pocket maximum (OOPM).</span> Once you reach it, insurance pays 100% for the rest of the year.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                                    <p className="text-slate-800 pt-1"><span className="font-bold">Discount cards prevent your payments from counting toward this goal.</span> They may save you a few dollars per prescription, but cost you thousands over the year.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                                    <p className="text-slate-800 pt-1"><span className="font-bold">Always prioritize PAPs and co-pay foundations.</span> These programs help you pay for medications AND help you reach your OOPM faster.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">4</div>
                                    <p className="text-slate-800 pt-1"><span className="font-bold">Talk to your transplant team.</span> They can connect you with financial counselors who understand these programs and can help you navigate the system.</p>
                                </li>
                            </ul>
                        </section>

                        <aside className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-r-lg" role="note">
                            <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2 text-lg">
                                <Info size={24} aria-hidden="true" />
                                Questions?
                            </h3>
                            <p className="text-emerald-900 leading-relaxed">
                                If you're unsure whether a discount card is right for your situation, ask your transplant center's financial counselor or social worker. They can review your specific insurance plan and help you make the best choice.
                            </p>
                        </aside>
                    </div>
                )}
                {activeTab === 'MENTAL' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">Mental Health Resources</h2>
                            <p className="text-lg text-slate-600">Your mental health matters. Access free, confidential support when you need it.</p>
                        </div>

                        <section className="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-300 rounded-2xl p-8 shadow-lg text-center" aria-labelledby="crisis-hotline">
                            <div className="bg-rose-600 text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md" aria-hidden="true">
                                <Phone size={40} />
                            </div>
                            <h3 id="crisis-hotline" className="text-3xl font-extrabold text-slate-900 mb-3">
                                Need to Talk to Someone Right Now?
                            </h3>
                            <div className="mb-6">
                                <a href="tel:988" className="inline-block text-6xl md:text-7xl font-black text-rose-600 hover:text-rose-700 transition mb-2 tracking-tight">
                                    988
                                </a>
                                <p className="text-lg font-bold text-slate-700">National Suicide & Crisis Lifeline</p>
                                <p className="text-sm text-slate-600 mt-2">24/7 • Free • Confidential</p>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
                                <div className="bg-white/80 p-4 rounded-lg">
                                    <p className="font-bold text-slate-900 mb-1">Call or Text</p>
                                    <p className="text-sm text-slate-600">Dial or text <strong>988</strong> from any phone</p>
                                </div>
                                <div className="bg-white/80 p-4 rounded-lg">
                                    <p className="font-bold text-slate-900 mb-1">Online Chat</p>
                                    <a href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer" className="text-sm text-rose-600 font-medium hover:underline flex items-center gap-1">
                                        988lifeline.org/chat <ExternalLink size={12} aria-hidden="true" />
                                    </a>
                                </div>
                            </div>
                        </section>

                        <div className="grid md:grid-cols-2 gap-6">
                            <a href="https://www.samhsa.gov/find-support" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-lg transition h-full" aria-label="Visit SAMHSA (opens in new tab)">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-xl text-slate-900 group-hover:text-indigo-700 mb-1">SAMHSA</h3>
                                        <span className="text-xs px-2 py-1 rounded-full font-bold bg-indigo-100 text-indigo-700">Government Resource</span>
                                    </div>
                                    <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                </div>
                                <p className="text-slate-700 text-sm leading-relaxed mb-4">
                                    <strong>Substance Abuse and Mental Health Services Administration</strong> - Find treatment facilities, support groups, and mental health services in your area.
                                </p>
                                <div className="space-y-2 text-sm">
                                    <p className="text-slate-600">
                                        <strong className="text-slate-900">Helpline:</strong>{' '}
                                        <a href="tel:1-800-662-4357" className="text-indigo-600 font-bold hover:underline">1-800-662-HELP (4357)</a>
                                    </p>
                                    <p className="text-slate-600 text-xs">Treatment referral and information service (24/7)</p>
                                </div>
                            </a>

                            <section className="bg-white p-6 rounded-xl border border-slate-200 h-full" aria-labelledby="transplant-mental-health">
                                <h3 id="transplant-mental-health" className="font-bold text-lg text-slate-900 mb-4">Transplant & Mental Health</h3>
                                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                                    It's normal to experience anxiety, depression, or emotional challenges during your transplant journey. You're not alone.
                                </p>
                                <ul className="space-y-2 text-sm text-slate-700">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                        <span>Ask your transplant team about counseling services</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                        <span>Many transplant centers have social workers and psychologists</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                        <span>Medicare and most insurance plans cover mental health services</span>
                                    </li>
                                </ul>
                            </section>

                            <a href="https://www.nami.org/Support-Education/Support-Groups" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition h-full" aria-label="Visit NAMI Support Groups (opens in new tab)">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-purple-700">NAMI Support Groups</h3>
                                    <ExternalLink size={16} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                                    National Alliance on Mental Illness offers free peer support groups for people living with mental health conditions and their families.
                                </p>
                                <p className="text-slate-600 text-sm">
                                    <strong className="text-slate-900">Helpline:</strong>{' '}
                                    <a href="tel:1-800-950-6264" className="text-purple-600 font-bold hover:underline">1-800-950-NAMI (6264)</a>
                                </p>
                            </a>

                            <a href="https://www.mentalhealth.gov/get-help" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition h-full" aria-label="Visit MentalHealth.gov (opens in new tab)">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-emerald-700">MentalHealth.gov</h3>
                                    <ExternalLink size={16} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    Government resource to help you understand mental health conditions, find treatment options, and locate services in your community.
                                </p>
                            </a>
                        </div>

                        <aside className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg" role="note">
                            <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                                <Heart size={20} aria-hidden="true" />
                                Remember
                            </h3>
                            <p className="text-amber-900 text-sm leading-relaxed">
                                Seeking help for mental health is a sign of strength, not weakness. The transplant journey is physically and emotionally demanding. Taking care of your mental health is just as important as taking your medications. If you're struggling, reach out—there are people who want to help.
                            </p>
                        </aside>
                    </div>
                )}
                {activeTab === 'GRANTS' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">Grants/Foundations Patient Assistance Programs</h2>
                            <p className="text-lg text-slate-600">Understanding the types of assistance available and how to access affordable medications</p>
                        </div>

                        <section className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-8 mb-8" aria-labelledby="pap-definition">
                            <h3 id="pap-definition" className="text-xl font-bold text-emerald-900 mb-4">What are Patient Assistance Programs?</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Patient Assistance Programs (PAPs) are programs created by pharmaceutical and medical supply manufacturers to help patients access affordable medications. These programs provide prescription medications at no cost or minimal fee for individuals who need help affording their medications.
                            </p>
                            <p className="text-slate-700 leading-relaxed font-medium">
                                <strong>Important:</strong> Patient Assistance Programs are for everyone who needs affordable medications - not just those without insurance. Many insured patients use these programs to reduce their medication costs.
                            </p>
                        </section>

                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            <section className="bg-blue-50 p-6 rounded-xl border-2 border-blue-200">
                                <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mb-4">
                                    <Pill size={24} aria-hidden="true" />
                                </div>
                                <h3 className="font-bold text-blue-900 text-lg mb-3">Patient Assistance Programs</h3>
                                <p className="text-slate-700 text-sm leading-relaxed">
                                    Programs for everyone who needs affordable medications. Get prescription medications at no cost or minimal fee, regardless of insurance status.
                                </p>
                            </section>

                            <section className="bg-purple-50 p-6 rounded-xl border-2 border-purple-200">
                                <div className="bg-purple-600 text-white w-12 h-12 rounded-full flex items-center justify-center mb-4">
                                    <DollarSign size={24} aria-hidden="true" />
                                </div>
                                <h3 className="font-bold text-purple-900 text-lg mb-3">Copay Assistance</h3>
                                <p className="text-slate-700 text-sm leading-relaxed">
                                    Ask the pharmaceutical company or foundation to assist with the amount you pay after your insurance company has paid for qualifying medications.
                                </p>
                            </section>

                            <section className="bg-indigo-50 p-6 rounded-xl border-2 border-indigo-200">
                                <div className="bg-indigo-600 text-white w-12 h-12 rounded-full flex items-center justify-center mb-4">
                                    <Shield size={24} aria-hidden="true" />
                                </div>
                                <h3 className="font-bold text-indigo-900 text-lg mb-3">Premium Assistance</h3>
                                <p className="text-slate-700 text-sm leading-relaxed">
                                    Ask the foundation to assist with the amount you pay to your insurance company to have medical or prescription coverage.
                                </p>
                            </section>
                        </div>

                        <aside className="bg-rose-50 border-l-4 border-rose-500 p-6 rounded-r-lg mb-8" role="note">
                            <h3 className="font-bold text-rose-900 mb-3 flex items-center gap-2">
                                <AlertCircle size={20} aria-hidden="true" />
                                Important Safety Notice
                            </h3>
                            <p className="text-rose-900 font-bold leading-relaxed">
                                Remember: These organizations will NEVER ask for payment information. If someone asks for payment or credit card details, it is a scam.
                            </p>
                        </aside>

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">Medication Resources</h2>

                            <div className="space-y-4">
                                <a href="http://www.mat.org" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-lg transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-emerald-700 mb-1">PhRMA's Medicine Assistance Tool (M.A.T)</h3>
                                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-emerald-100 text-emerald-700">Search Engine</span>
                                        </div>
                                        <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                                        PhRMA's Medicine Assistance Tool (MAT) is a free SEARCH ENGINE designed to help patients, caregivers and health care providers learn more about the resources available through the various biopharmaceutical industry programs. MAT is not its own patient assistance program, but rather a search engine for many of the patient assistance resources that the biopharmaceutical industry offers.
                                    </p>
                                    <p className="text-emerald-600 font-medium text-sm">www.mat.org</p>
                                </a>

                                <a href="https://www.drugs.com" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-purple-700 mb-1">Drugs.com</h3>
                                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-purple-100 text-purple-700">Medication Database</span>
                                        </div>
                                        <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                                        This website and app is a valuable tool. You can look up and identify medications, it lists all of the manufacturers of the drug and will directly connect you to their specific Patient Assistance Programs.
                                    </p>
                                    <p className="text-purple-600 font-medium text-sm">www.drugs.com</p>
                                </a>

                                <a href="https://www.healthwellfoundation.org" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-lg transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-indigo-700 mb-1">HealthWell Foundation</h3>
                                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-indigo-100 text-indigo-700">Foundation</span>
                                        </div>
                                        <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                                        <strong>Our Mission:</strong> To reduce financial barriers to care for underinsured patients with chronic or life-altering diseases. This includes copays, travel costs, pediatric and insurance premiums.
                                    </p>
                                    <p className="text-indigo-600 font-medium text-sm">www.healthwellfoundation.org</p>
                                </a>

                                <a href="https://fundfinder.panfoundation.org/Home/Index" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-teal-200 hover:border-teal-400 hover:shadow-lg transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-teal-700 mb-1">FundFinder</h3>
                                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-teal-100 text-teal-700">Directory</span>
                                        </div>
                                        <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                                        FundFinder now features a directory of more than 150 patient advocacy organizations that provide dedicated patient services including helplines, peer counseling, disease-specific education, and more.
                                    </p>
                                    <p className="text-teal-600 font-medium text-sm">fundfinder.panfoundation.org</p>
                                </a>

                                <a href="http://www.panfoundation.org" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-cyan-200 hover:border-cyan-400 hover:shadow-lg transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-cyan-700 mb-1">PAN Foundation</h3>
                                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-cyan-100 text-cyan-700">Foundation</span>
                                        </div>
                                        <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                                        We help underinsured people with life-threatening, chronic and rare diseases get the medications and treatments they need by assisting with their out-of-pocket costs and advocating for improved access and affordability.
                                    </p>
                                    <p className="text-cyan-600 font-medium text-sm">www.panfoundation.org</p>
                                </a>

                                <a href="https://www.patientadvocate.org" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-rose-200 hover:border-rose-400 hover:shadow-lg transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-rose-700 mb-1">Patient Advocate Foundation</h3>
                                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-rose-100 text-rose-700">Advocacy</span>
                                        </div>
                                        <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                                        Patient Advocate Foundation provides direct services to patients with chronic, life threatening and debilitating diseases to help access care and treatment recommended by their doctor.
                                    </p>
                                    <p className="text-rose-600 font-medium text-sm">www.patientadvocate.org</p>
                                </a>

                                <a href="https://www.patientservicesinc.org" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-amber-200 hover:border-amber-400 hover:shadow-lg transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-amber-700 mb-1">Patient Services Incorporated (PSI)</h3>
                                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-amber-100 text-amber-700">Support Services</span>
                                        </div>
                                        <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                                        PSI provides help to pay for your medication, provide health insurance premium and copay assistance, navigate health insurance plans, give legal advice, and be there every step of the way.
                                    </p>
                                    <p className="text-amber-600 font-medium text-sm">www.patientservicesinc.org</p>
                                </a>

                                <a href="https://rarediseases.org/" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-violet-200 hover:border-violet-400 hover:shadow-lg transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-violet-700 mb-1">National Organization for Rare Disorders (NORD)</h3>
                                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-violet-100 text-violet-700">Rare Disease Support</span>
                                        </div>
                                        <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                                        <strong>RareCare®:</strong> Since 1987, NORD has provided assistance programs to help patients obtain life-saving or life-sustaining medication they could not otherwise afford. These programs provide medication, financial assistance with insurance premiums and co-pays, and diagnostic testing.
                                    </p>
                                    <p className="text-violet-600 font-medium text-sm">rarediseases.org</p>
                                </a>

                                <a href="https://rxoutreach.org/" target="_blank" rel="noreferrer" className="group block bg-white p-6 rounded-xl border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-green-700 mb-1">Patients Rx Outreach</h3>
                                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-green-100 text-green-700">Affordable Pharmacy</span>
                                        </div>
                                        <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                                        At Rx Outreach, we believe that everyone deserves access to affordable medications. No one should ever have to choose between filling a prescription and feeding their family. Since 2010, we have saved our patients more than $822 million in prescription medication costs.
                                    </p>
                                    <p className="text-green-600 font-medium text-sm">rxoutreach.org</p>
                                </a>
                            </div>
                        </div>

                        <aside className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-r-lg" role="note">
                            <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                                <Lightbulb size={20} aria-hidden="true" />
                                Getting Started
                            </h3>
                            <p className="text-emerald-900 leading-relaxed mb-3">
                                If you're unsure which program is right for you, start with PhRMA's Medicine Assistance Tool (M.A.T) or Drugs.com to search for programs specific to your medications.
                            </p>
                            <p className="text-emerald-900 leading-relaxed">
                                Your transplant center's financial counselor or social worker can also help you navigate these programs and determine which ones you may qualify for.
                            </p>
                        </aside>
                    </div>
                )}
            </div>
        </article>
    );
};

// ApplicationHelp Page
const ApplicationHelp = () => {
    useMetaTags(seoMetadata.applicationHelp);

    const [activeTab, setActiveTab] = useState('START');
    const checklistItems = APPLICATION_CHECKLIST_DATA;
    const [checkedItems, setCheckedItems] = useState({});
    const toggleCheck = (index) => setCheckedItems(prev => ({...prev, [index]: !prev[index]}));
    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    const progress = Math.round((checkedCount / checklistItems.length) * 100);

    // Medication search states
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedMedication, setSelectedMedication] = useState(null);

    // Filter medications based on search term
    const filteredMedications = MEDICATIONS.filter(med =>
        med.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.brandName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const TabButton = ({ id, label, icon: Icon }) => (
        <button onClick={() => setActiveTab(id)} role="tab" id={`${id}-tab`} aria-selected={activeTab === id} aria-controls={`${id}-panel`} tabIndex={activeTab === id ? 0 : -1} className={`flex items-center gap-2 px-4 py-3 font-bold text-sm md:text-base transition-all border-b-4 min-h-[44px] ${activeTab === id ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50' : 'border-transparent text-slate-700 hover:text-emerald-600 hover:bg-slate-50'}`}>
            <Icon size={18} aria-hidden="true" /><span className="hidden md:inline">{label}</span><span className="md:hidden">{label.split(' ')[0]}</span>
        </button>
    );

    return (
        <article className="max-w-5xl mx-auto space-y-8 pb-12">
            <header className="text-center py-8"><h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Application Education</h1><p className="text-xl text-slate-600 max-w-3xl mx-auto">Master the art of assistance applications with step-by-step guidance and insider tips.</p></header>
            <nav className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto" role="tablist" aria-label="Application help sections"><div className="flex min-w-max"><TabButton id="MEDGUIDE" label="Medication Guide" icon={Pill} /><TabButton id="START" label="Getting Started" icon={HeartHandshake} /><TabButton id="INCOME" label="Income" icon={DollarSign} /><TabButton id="STEPS" label="Steps" icon={ArrowRight} /><TabButton id="CHECKLIST" label="Checklist" icon={ClipboardList} /><TabButton id="TEMPLATES" label="Templates" icon={FileText} /></div></nav>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 min-h-[500px]" role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`}>
                {activeTab === 'MEDGUIDE' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-3">Search for Your Medication</h2>
                            <p className="text-lg text-slate-600">Find clear, step-by-step instructions for accessing assistance programs</p>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <label htmlFor="med-search" className="sr-only">Search for medication by generic or brand name</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} aria-hidden="true" />
                                <input
                                    id="med-search"
                                    type="text"
                                    placeholder="Search by generic or brand name (e.g., Tacrolimus, Prograf)"
                                    className="w-full pl-12 pr-4 py-4 text-lg border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setSelectedMedication(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') { setSearchTerm(''); setSelectedMedication(null); }
                                    }}
                                    aria-autocomplete="list"
                                    aria-controls="medication-results"
                                    aria-expanded={!!(searchTerm && !selectedMedication)}
                                />
                            </div>
                        </div>

                        {/* Search Results */}
                        {searchTerm && !selectedMedication && (
                            <div id="medication-results" className="space-y-2" role="listbox" aria-label="Medication search results">
                                {filteredMedications.length > 0 ? (
                                    filteredMedications.slice(0, 10).map((med) => (
                                        <button
                                            key={med.id}
                                            onClick={() => {
                                                setSelectedMedication(med);
                                                setSearchTerm(med.genericName);
                                            }}
                                            className="w-full p-4 border border-slate-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition text-left min-h-[44px]"
                                            role="option"
                                            aria-selected={false}
                                            aria-label={`Select ${med.genericName} (${med.brandName})`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="font-bold text-slate-900">{med.genericName}</div>
                                                    <div className="text-sm text-slate-600">{med.brandName}</div>
                                                </div>
                                                <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold whitespace-nowrap">
                                                    {med.category}
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-6 text-center text-slate-600 bg-slate-50 rounded-lg">
                                        <p className="font-medium mb-2">No medications found</p>
                                        <p className="text-sm">Try searching by generic name (e.g., Tacrolimus) or brand name (e.g., Prograf)</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Selected Medication Details */}
                        {selectedMedication && (
                            <div className="space-y-6 fade-in">
                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div>
                                            <h3 className="text-2xl font-bold text-slate-900 mb-1">{selectedMedication.genericName}</h3>
                                            <p className="text-lg text-slate-700">{selectedMedication.brandName}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedMedication(null);
                                                setSearchTerm("");
                                            }}
                                            className="text-slate-400 hover:text-slate-600 transition"
                                            aria-label="Clear selection and search again"
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1 bg-white border border-emerald-200 rounded-full text-sm font-medium text-slate-700">
                                            {selectedMedication.category}
                                        </span>
                                        <span className="px-3 py-1 bg-white border border-emerald-200 rounded-full text-sm font-medium text-slate-700">
                                            {selectedMedication.manufacturer}
                                        </span>
                                    </div>
                                </div>

                                {/* Step-by-Step Instructions */}
                                <div className="bg-white border-2 border-indigo-200 rounded-xl overflow-hidden">
                                    <div className="bg-indigo-600 text-white px-6 py-4">
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <ClipboardList size={24} aria-hidden="true" />
                                            How to Access Assistance Programs
                                        </h3>
                                    </div>
                                    <div className="p-6 space-y-6">
                                        {/* Step 1: Check Insurance Type */}
                                        <section className="border-l-4 border-emerald-500 pl-6 py-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold" aria-hidden="true">1</div>
                                                <h4 className="text-lg font-bold text-slate-900">Check Your Insurance Type</h4>
                                            </div>
                                            <div className="space-y-2 text-slate-700">
                                                <p className="font-medium">Different programs are available based on your insurance:</p>
                                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                                    <li><strong>Commercial Insurance:</strong> You can use manufacturer Patient Assistance Programs (PAPs) and copay cards</li>
                                                    <li><strong>Medicare:</strong> Use copay foundations (manufacturer PAPs usually don't accept Medicare due to federal law)</li>
                                                    <li><strong>Medicaid:</strong> Contact your state program for coverage options</li>
                                                    <li><strong>Uninsured:</strong> Manufacturer PAPs are your best option</li>
                                                </ul>
                                            </div>
                                        </section>

                                        {/* Step 2: Manufacturer PAP */}
                                        {selectedMedication.papUrl ? (
                                            <section className="border-l-4 border-indigo-500 pl-6 py-2">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold" aria-hidden="true">2</div>
                                                    <h4 className="text-lg font-bold text-slate-900">Apply to Manufacturer's Program</h4>
                                                </div>
                                                <div className="space-y-3 text-slate-700">
                                                    <p><strong>Manufacturer:</strong> {selectedMedication.manufacturer}</p>
                                                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                                        <p className="font-bold text-indigo-900 mb-2">What you'll need:</p>
                                                        <ul className="list-disc pl-5 space-y-1 text-sm text-indigo-900">
                                                            <li>Basic information (name, DOB, address, email)</li>
                                                            <li>Insurance card photos (front and back)</li>
                                                            <li>Proof of income (tax return, pay stubs, or SS letter)</li>
                                                            <li>Prescription information (medication name, dose, pharmacy)</li>
                                                            <li>Doctor's signature on application form</li>
                                                        </ul>
                                                    </div>
                                                    <a
                                                        href={selectedMedication.papUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-lg transition shadow-md"
                                                        aria-label={`Visit ${selectedMedication.manufacturer} Patient Assistance Program (opens in new tab)`}
                                                    >
                                                        <ExternalLink size={18} aria-hidden="true" />
                                                        Visit {selectedMedication.manufacturer} PAP
                                                    </a>
                                                    <p className="text-xs text-slate-600 italic">Approval typically takes 2-4 weeks</p>
                                                </div>
                                            </section>
                                        ) : (
                                            <section className="border-l-4 border-amber-500 pl-6 py-2">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center font-bold" aria-hidden="true">2</div>
                                                    <h4 className="text-lg font-bold text-slate-900">Check for Generic Alternatives</h4>
                                                </div>
                                                <div className="space-y-3 text-slate-700">
                                                    <p>This medication is typically available as a generic. Check these resources for affordable pricing:</p>
                                                    <div className="grid md:grid-cols-2 gap-3">
                                                        <a href="https://costplusdrugs.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-sky-50 border border-sky-200 rounded-lg hover:border-sky-400 transition text-sm">
                                                            <ExternalLink size={16} aria-hidden="true" />
                                                            <span className="font-medium">Cost Plus Drugs</span>
                                                        </a>
                                                        <a href="https://www.goodrx.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-sky-50 border border-sky-200 rounded-lg hover:border-sky-400 transition text-sm">
                                                            <ExternalLink size={16} aria-hidden="true" />
                                                            <span className="font-medium">GoodRx</span>
                                                        </a>
                                                    </div>
                                                </div>
                                            </section>
                                        )}

                                        {/* Step 3: Copay Foundations */}
                                        <section className="border-l-4 border-rose-500 pl-6 py-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-8 h-8 bg-rose-600 text-white rounded-full flex items-center justify-center font-bold" aria-hidden="true">3</div>
                                                <h4 className="text-lg font-bold text-slate-900">Apply to Copay Foundations</h4>
                                            </div>
                                            <div className="space-y-3 text-slate-700">
                                                <p>Foundations help cover copays, deductibles, and premiums. They work with <strong>all insurance types including Medicare</strong>.</p>
                                                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                                                    <p className="font-bold text-rose-900 mb-2">Recommended Foundations for Transplant Medications:</p>
                                                    <ul className="space-y-2 text-sm text-rose-900">
                                                        <li className="flex items-start gap-2">
                                                            <CheckCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                                                            <span><strong>HealthWell Foundation</strong> - Transplant fund often available</span>
                                                        </li>
                                                        <li className="flex items-start gap-2">
                                                            <CheckCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                                                            <span><strong>Patient Advocate Foundation</strong> - Helps with copays and premiums</span>
                                                        </li>
                                                        <li className="flex items-start gap-2">
                                                            <CheckCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                                                            <span><strong>National Kidney Foundation</strong> - If this is a kidney transplant medication</span>
                                                        </li>
                                                        <li className="flex items-start gap-2">
                                                            <CheckCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                                                            <span><strong>American Liver Foundation</strong> - If this is a liver transplant medication</span>
                                                        </li>
                                                    </ul>
                                                </div>
                                                <Link
                                                    to="/education"
                                                    className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-3 rounded-lg transition shadow-md"
                                                    aria-label="View full directory of foundations"
                                                >
                                                    <Search size={18} aria-hidden="true" />
                                                    View Full Directory
                                                </Link>
                                                <p className="text-xs text-slate-600 italic">Approval typically takes 1-3 weeks</p>
                                            </div>
                                        </section>

                                        {/* Step 4: Follow Up */}
                                        <section className="border-l-4 border-purple-500 pl-6 py-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold" aria-hidden="true">4</div>
                                                <h4 className="text-lg font-bold text-slate-900">Follow Up & Stay Organized</h4>
                                            </div>
                                            <div className="space-y-2 text-slate-700 text-sm">
                                                <ul className="list-disc pl-5 space-y-1">
                                                    <li>Call to confirm your application was received (typically within 3-5 business days)</li>
                                                    <li>Follow up with your doctor's office to ensure they submitted their portion</li>
                                                    <li>Keep copies of all documents you submit</li>
                                                    <li>Mark your calendar to reapply before your approval expires (usually annually)</li>
                                                </ul>
                                            </div>
                                        </section>
                                    </div>
                                </div>

                                {/* Additional Resources */}
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                                    <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                                        <Lightbulb size={20} aria-hidden="true" />
                                        Need More Help?
                                    </h3>
                                    <div className="space-y-3 text-sm text-emerald-900">
                                        <p>Your transplant center's social worker or financial coordinator can help you apply to these programs.</p>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => setActiveTab('START')}
                                                className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-lg transition text-center justify-center"
                                            >
                                                <FileText size={16} aria-hidden="true" />
                                                View Getting Started
                                            </button>
                                            <Link
                                                to="/faq"
                                                className="inline-flex items-center gap-2 bg-white hover:bg-emerald-100 border-2 border-emerald-600 text-emerald-700 font-bold px-4 py-2 rounded-lg transition text-center justify-center"
                                            >
                                                <HelpCircle size={16} aria-hidden="true" />
                                                Read FAQs
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Getting Started Prompt */}
                        {!searchTerm && !selectedMedication && (
                            <div className="text-center py-12">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6" aria-hidden="true">
                                    <Pill size={40} className="text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">Start by searching for your medication above</h3>
                                <p className="text-slate-600 max-w-xl mx-auto mb-6">
                                    Enter the generic name (like Tacrolimus) or brand name (like Prograf) to get personalized, step-by-step instructions for accessing assistance programs.
                                </p>
                                <div className="inline-flex flex-wrap gap-2 justify-center">
                                    {['Tacrolimus', 'Mycophenolate', 'Valcyte', 'Prednisone'].map((name) => (
                                        <button
                                            key={name}
                                            onClick={() => setSearchTerm(name)}
                                            className="px-4 py-2 bg-slate-100 hover:bg-emerald-100 border border-slate-300 hover:border-emerald-400 rounded-lg text-sm font-medium text-slate-700 hover:text-emerald-700 transition"
                                        >
                                            Try "{name}"
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'START' && (
                    <div className="space-y-8">
                        <aside className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-r-lg" role="note"><h2 className="text-emerald-800 font-bold text-lg mb-2 flex items-center gap-2"><CheckCircle size={20} aria-hidden="true" /> Good News</h2><ul className="list-disc pl-5 text-emerald-900 space-y-1"><li><strong>PAPs and Foundations ask for the same information.</strong></li><li>Gather documents once → apply to multiple programs.</li></ul></aside>
                        <div className="grid md:grid-cols-2 gap-8">
                            <section className="border border-slate-200 rounded-xl p-6 hover:border-emerald-300 transition-colors" aria-labelledby="pap-heading">
                                <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3"><div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg" aria-hidden="true"><FileText size={24} /></div><div><h2 id="pap-heading" className="font-bold text-lg text-slate-900">Patient Assistance Program (PAP)</h2><p className="text-xs text-slate-600">Direct from Manufacturer</p></div></div>
                                <p className="text-slate-600 mb-4 text-sm min-h-[40px]">Free or low-cost medications provided directly by the pharmaceutical company.</p>
                                <div className="space-y-3 text-sm"><div><span className="font-bold text-slate-800 block">Best for:</span><ul className="list-disc pl-4 text-slate-600"><li>Commercial insurance</li><li>Uninsured</li><li>Underinsured</li></ul></div><div className="flex justify-between py-2 border-t border-slate-100"><span className="text-slate-600">Approval Time</span><span className="font-medium text-emerald-700">2–4 weeks</span></div></div>
                            </section>
                            <section className="border border-slate-200 rounded-xl p-6 hover:border-sky-300 transition-colors" aria-labelledby="foundation-heading">
                                <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3"><div className="p-2 bg-sky-100 text-sky-700 rounded-lg" aria-hidden="true"><HeartHandshake size={24} /></div><div><h2 id="foundation-heading" className="font-bold text-lg text-slate-900">Foundation Grant</h2><p className="text-xs text-slate-600">Non-profit Assistance</p></div></div>
                                <p className="text-slate-600 mb-4 text-sm min-h-[40px]">Helps with copays, premiums, deductibles, and out-of-pocket costs.</p>
                                <div className="space-y-3 text-sm"><div><span className="font-bold text-slate-800 block">Best for:</span><ul className="list-disc pl-4 text-slate-600"><li>Medicare patients</li><li>High copay patients</li><li>Premium burden</li></ul></div><div className="flex justify-between py-2 border-t border-slate-100"><span className="text-slate-600">Approval Time</span><span className="font-medium text-emerald-700">1–3 weeks</span></div></div>
                            </section>
                        </div>
                        <aside className="bg-amber-50 p-6 rounded-xl border border-amber-100" role="note">
                            <h2 className="font-bold text-amber-900 mb-4 flex items-center gap-2"><AlertOctagon size={20} aria-hidden="true" /> Important Reminders</h2>
                            <div className="grid md:grid-cols-2 gap-6 text-amber-800 text-sm"><div><strong className="block text-amber-900">Apply Once Only</strong>Multiple submissions to the same foundation slow down approval.</div><div><strong className="block text-amber-900">Apply Anytime</strong>There is no "season." Apply when cost becomes a barrier.</div><div><strong className="block text-amber-900">People Want to Help</strong>Most PAP and foundation teams are kind and patient.</div><div><strong className="block text-amber-900">Fax is Still Used</strong>Faxed forms go directly to a secure, dedicated team.</div></div>
                        </aside>
                    </div>
                )}
                {activeTab === 'INCOME' && (
                    <div className="space-y-10 max-w-4xl mx-auto">
                        <div><h2 className="text-2xl font-bold text-slate-900 mb-4">Understanding Income Eligibility</h2><p className="text-lg text-slate-600 mb-2">Most pharmaceutical companies publish clear income guidelines. Here's what you need to know:</p><div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r" role="note"><p className="text-emerald-800 font-bold">Don't Self-Disqualify: Many programs have much higher income limits than you might expect.</p></div></div>
                        <div className="grid md:grid-cols-2 gap-8"><div><h3 className="font-bold text-slate-800 text-lg mb-3">How Income Limits Work</h3><ul className="space-y-2 text-slate-600 list-disc pl-5"><li>Based on Federal Poverty Level (FPL) percentages</li><li>Vary by household size</li><li>Updated annually with FPL changes</li></ul></div><div><h3 className="font-bold text-slate-800 text-lg mb-3">Where to Find Guidelines</h3><ul className="space-y-2 text-slate-600 list-disc pl-5"><li>Manufacturer's website</li><li>MAT.org search results</li><li>Call the program directly</li></ul></div></div>
                        <section className="bg-slate-50 p-6 rounded-xl border border-slate-200" aria-labelledby="income-checker"><h3 id="income-checker" className="font-bold text-slate-900 mb-4 flex items-center gap-2"><DollarSign size={20} aria-hidden="true" /> Quick Income Checker</h3><p className="text-slate-600 mb-4">Use these resources to check current Federal Poverty Level guidelines:</p><div className="flex flex-wrap gap-4"><a href="https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines" target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 font-medium hover:border-emerald-500 hover:text-emerald-600 transition" aria-label="Visit HHS Poverty Guidelines (opens in new tab)">HHS Poverty Guidelines <ExternalLink size={16} aria-hidden="true" /></a><a href="https://medicineassistancetool.org/" target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 font-medium hover:border-emerald-500 hover:text-emerald-600 transition" aria-label="Visit MAT.org to search by medication (opens in new tab)">MAT.org (Search by Med) <ExternalLink size={16} aria-hidden="true" /></a></div></section>
                    </div>
                )}
                {activeTab === 'STEPS' && (
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">Apply These Principles to Both PAPs and Foundations</h2>
                        <section className="bg-white p-6 rounded-xl border-l-4 border-emerald-500 shadow-sm" aria-labelledby="requirements-heading">
                            <h3 id="requirements-heading" className="font-bold text-lg text-slate-900 mb-4">Both require:</h3>
                            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-3"><li className="flex items-center gap-2 text-slate-700"><div className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></div>Your name and contact info</li><li className="flex items-center gap-2 text-slate-700"><div className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></div>Doctor / coordinator contact</li><li className="flex items-center gap-2 text-slate-700"><div className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></div>Income and household size</li><li className="flex items-center gap-2 text-slate-700"><div className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></div>Diagnosis + medication list</li><li className="flex items-center gap-2 text-slate-700"><div className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></div>Insurance information</li><li className="flex items-center gap-2 text-slate-700"><div className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></div>Patient history</li></ul>
                        </section>
                    </div>
                )}
                {activeTab === 'CHECKLIST' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-6"><h2 className="text-2xl font-bold text-slate-900">"Before You Apply" Checklist</h2><button onClick={() => window.print()} className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-bold" aria-label="Print checklist"><Printer size={18} aria-hidden="true" /> Print</button></div>
                        <div className="grid lg:grid-cols-5 gap-8">
                            <div className="lg:col-span-3 space-y-6">
                                <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" aria-labelledby="progress-heading"><div className="flex justify-between items-center mb-2"><span id="progress-heading" className="text-sm font-bold text-slate-700">Your Responsibility</span><span className="text-sm font-bold text-emerald-600" aria-live="polite">{progress}% Ready</span></div><div className="w-full bg-slate-100 rounded-full h-3" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label={`Application preparation progress: ${progress} percent complete`}><div className="bg-emerald-500 h-3 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div></div><p className="text-slate-600 text-xs mt-2 italic">Gather these items before you apply. Click to check them off.</p></section>
                                <div className="space-y-3" role="list" aria-label="Application checklist items">{checklistItems.map((item, idx) => { const isChecked = !!checkedItems[idx]; return ( <button key={idx} onClick={() => toggleCheck(idx)} role="checkbox" aria-checked={isChecked} className={`w-full flex items-start gap-4 p-4 rounded-lg border transition-all text-left ${isChecked ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200 hover:border-emerald-300'}`}><div className={`flex-shrink-0 text-emerald-600 mt-0.5 transition-transform duration-200 ${isChecked ? 'scale-110' : 'scale-100 text-slate-300'}`} aria-hidden="true">{isChecked ? <CheckSquare size={20} /> : <Square size={20} />}</div><span className={`font-medium text-sm md:text-base ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>{item}</span></button> ); })}</div>
                                {progress === 100 && ( <div className="p-4 bg-emerald-100 text-emerald-800 rounded-xl text-center fade-in" role="alert" aria-live="polite"><span className="font-bold">🎉 You have everything you need! Time to apply.</span></div> )}
                            </div>
                            <aside className="lg:col-span-2 space-y-6">
                                <section className="bg-slate-50 p-6 rounded-xl border border-slate-200" aria-labelledby="clinic-handles"><h3 id="clinic-handles" className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Stethoscope size={20} className="text-indigo-600" aria-hidden="true" /> What the Clinic Handles</h3><p className="text-xs text-slate-600 mb-4">You do <strong>NOT</strong> need to provide these. Your provider will fill them in:</p><ul className="space-y-3">{["ICD-10 diagnosis codes", "Provider NPI numbers", "Prescriber signatures", "Medical chart notes", "Treatment start dates"].map((item, i) => ( <li key={i} className="flex items-center gap-2 text-sm text-slate-700"><CheckCircle size={14} className="text-indigo-400 flex-shrink-0" aria-hidden="true" />{item}</li> ))}</ul></section>
                                <aside className="bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-sm" role="note"><h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><AlertTriangle size={20} aria-hidden="true" /> Crucial Step</h3><p className="text-sm text-amber-900 leading-relaxed">It is <strong>important to follow up</strong> to make sure the provider is getting the paperwork sent back to the program.</p></aside>
                            </aside>
                        </div>
                    </div>
                )}
                {activeTab === 'TEMPLATES' && (
                    <div className="max-w-3xl mx-auto space-y-8">
                        <h2 className="text-2xl font-bold text-slate-900">Phone Scripts & Templates</h2>
                        <section className="border border-slate-200 rounded-xl overflow-hidden" aria-labelledby="manufacturer-script"><div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex items-center gap-2 font-bold text-slate-700"><Phone size={18} aria-hidden="true" /> <span id="manufacturer-script">calling manufacturers</span></div><div className="p-6 bg-white"><p className="font-serif text-lg text-slate-800 leading-relaxed">"I'm a transplant patient. Do you have a Patient Assistance Program for <span className="bg-yellow-100 px-1">[drug name]</span>?"</p></div></section>
                        <section className="border border-slate-200 rounded-xl overflow-hidden" aria-labelledby="foundation-script"><div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex items-center gap-2 font-bold text-slate-700"><HeartHandshake size={18} aria-hidden="true" /> <span id="foundation-script">calling foundations</span></div><div className="p-6 bg-white"><p className="font-serif text-lg text-slate-800 leading-relaxed">"Hi, I am checking to see if the <span className="bg-yellow-100 px-1">[Disease Fund Name]</span> fund is currently open. I have insurance, but I need help with my <span className="bg-yellow-100 px-1">[Copays / Premiums]</span>."</p></div></section>
                    </div>
                )}
            </div>
        </article>
    );
};

// FAQ Page
const FAQ = () => {
    useMetaTags(seoMetadata.faq);

    const [openIndex, setOpenIndex] = useState(null);

    const toggleQuestion = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    const faqs = FAQS_DATA;

    const FAQItem = ({ question, answer, index }) => {
        const isOpen = openIndex === index;
        return (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                    onClick={() => toggleQuestion(index)}
                    className="w-full px-6 py-4 text-left bg-white hover:bg-slate-50 transition flex items-center justify-between gap-4"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                >
                    <span className="font-semibold text-slate-900 pr-4">{question}</span>
                    <ChevronDown
                        size={20}
                        className={`flex-shrink-0 text-emerald-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>
                {isOpen && (
                    <div
                        id={`faq-answer-${index}`}
                        className="px-6 py-4 bg-slate-50 border-t border-slate-200"
                        role="region"
                    >
                        <p className="text-slate-700 leading-relaxed">{answer}</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <article className="max-w-5xl mx-auto space-y-8 pb-12">
            <header className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                    <Info size={32} className="text-emerald-700" aria-hidden="true" />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Frequently Asked Questions</h1>
                <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                    Find answers to common questions about transplant medications, assistance programs, and using this site.
                </p>
            </header>

            <div className="space-y-8">
                {faqs.map((section, sectionIndex) => (
                    <section key={sectionIndex} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                            <span className="w-1 h-8 bg-emerald-600 rounded-full" aria-hidden="true"></span>
                            {section.category}
                        </h2>
                        <div className="space-y-3">
                            {section.questions.map((faq, faqIndex) => {
                                const globalIndex = `${sectionIndex}-${faqIndex}`;
                                return (
                                    <FAQItem
                                        key={globalIndex}
                                        question={faq.q}
                                        answer={faq.a}
                                        index={globalIndex}
                                    />
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>

            <aside className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 md:p-8 text-center">
                <h2 className="text-xl font-bold text-emerald-900 mb-3">Still have questions?</h2>
                <p className="text-emerald-800 mb-6">
                    Your transplant center's social worker or financial coordinator is your best resource for personalized guidance.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        to="/wizard"
                        className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-md transition"
                    >
                        Start My Path Quiz
                    </Link>
                    <Link
                        to="/education"
                        className="px-6 py-3 bg-white hover:bg-slate-50 text-emerald-700 font-bold rounded-lg shadow-md border border-emerald-200 transition"
                    >
                        Browse Resources
                    </Link>
                </div>
            </aside>
        </article>
    );
};

// NotFound Page
const NotFound = () => {
    useMetaTags(seoMetadata.notFound);

    return (
        <article className="space-y-12">
            <section className="text-center max-w-3xl mx-auto py-16 md:py-24">
                <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-slate-100 rounded-full mb-6">
                        <AlertCircle size={48} className="text-slate-400" aria-hidden="true" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">
                        Page Not Found
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 mb-8">
                        We couldn't find the page you're looking for. It may have been moved or doesn't exist.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <Link
                        to="/"
                        className="w-full sm:w-auto px-8 py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2"
                        aria-label="Return to home page"
                    >
                        <HomeIcon size={20} aria-hidden="true" />
                        Go to Home
                    </Link>
                    <Link
                        to="/wizard"
                        className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 font-bold rounded-xl hover:border-emerald-200 transition flex items-center justify-center gap-2"
                        aria-label="Start medication assistance wizard"
                    >
                        <Map size={20} aria-hidden="true" />
                        Start Medication Path
                    </Link>
                </div>
            </section>
        </article>
    );
};

// Loading fallback for lazy-loaded components
const PageLoadingFallback = () => (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
            <Loader2 size={40} className="animate-spin text-emerald-600 mx-auto mb-4" aria-hidden="true" />
            <p className="text-slate-600 font-medium">Loading...</p>
        </div>
    </div>
);

// App Component
const App = () => {
    return (
        <BrowserRouter>
            <DisclaimerModal />
            <GoogleAnalytics />
            <ScrollToTop />
            <Layout>
                <Suspense fallback={<PageLoadingFallback />}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/wizard" element={<Wizard />} />
                        <Route path="/medications" element={<MedicationSearch />} />
                        <Route path="/education" element={<Education />} />
                        <Route path="/application-help" element={<ApplicationHelp />} />
                        <Route path="/faq" element={<LazyFAQ />} />
                        <Route path="*" element={<LazyNotFound />} />
                    </Routes>
                </Suspense>
            </Layout>
        </BrowserRouter>
    );
};

export default App;
