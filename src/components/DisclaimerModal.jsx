import { useState, useEffect } from 'react';
import { AlertTriangle, Phone } from 'lucide-react';

const STORAGE_KEY = 'disclaimer_accepted';

/**
 * DisclaimerModal Component
 *
 * Shows a medical disclaimer on first visit that must be acknowledged
 * before using the site. Stores acceptance in localStorage.
 */
const DisclaimerModal = () => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if user has already accepted the disclaimer
    const hasAccepted = localStorage.getItem(STORAGE_KEY);
    if (!hasAccepted) {
      setShowModal(true);
      // Prevent scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShowModal(false);
    document.body.style.overflow = '';
  };

  if (!showModal) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      aria-describedby="disclaimer-description"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 md:p-8 animate-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-amber-100 p-4 rounded-full">
            <AlertTriangle size={40} className="text-amber-600" aria-hidden="true" />
          </div>
        </div>

        {/* Title */}
        <h2
          id="disclaimer-title"
          className="text-2xl font-bold text-slate-900 text-center mb-4"
        >
          Important Notice
        </h2>

        {/* Disclaimer Text */}
        <p
          id="disclaimer-description"
          className="text-slate-700 text-center mb-6 leading-relaxed"
        >
          I understand this website is for{' '}
          <strong className="text-slate-900">educational purposes only</strong>{' '}
          and does not constitute medical advice.
        </p>

        {/* Emergency Notice */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-red-800 font-bold">
            <Phone size={20} aria-hidden="true" />
            <span>In an emergency, call 911</span>
          </div>
        </div>

        {/* Additional Info */}
        <p className="text-sm text-slate-600 text-center mb-6">
          Always consult your transplant team or healthcare provider for medical decisions.
        </p>

        {/* Accept Button */}
        <button
          onClick={handleAccept}
          className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-lg rounded-xl transition shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/50"
          autoFocus
        >
          I Agree
        </button>
      </div>
    </div>
  );
};

export default DisclaimerModal;
