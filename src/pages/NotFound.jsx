import { Link } from 'react-router-dom';
import { AlertCircle, Map } from 'lucide-react';
import { useMetaTags } from '../hooks/useMetaTags.js';
import { seoMetadata } from '../data/seo-metadata.js';

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
                        className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2"
                        aria-label="Return to home page"
                    >
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

export default NotFound;
