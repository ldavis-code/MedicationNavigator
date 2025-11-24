import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, ChevronDown } from 'lucide-react';
import { useMetaTags } from '../hooks/useMetaTags.js';
import { seoMetadata } from '../data/seo-metadata.js';
import FAQS_DATA from '../data/faqs.json';

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
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md transition"
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

export default FAQ;
