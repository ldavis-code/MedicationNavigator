import { Loader2 } from 'lucide-react';

/**
 * LoadingSpinner component - displays an animated loading spinner
 * @param {number} size - Size of the spinner (default: 24)
 * @param {string} className - Additional CSS classes
 */
const LoadingSpinner = ({ size = 24, className = '' }) => {
  return (
    <Loader2
      size={size}
      className={`animate-spin ${className}`}
      aria-label="Loading"
      role="status"
    />
  );
};

export default LoadingSpinner;
