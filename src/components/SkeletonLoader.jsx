/**
 * SkeletonLoader components for displaying loading placeholders
 */

/**
 * Base skeleton component for creating custom skeleton loaders
 */
export const Skeleton = ({ className = '', width, height }) => {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className}`}
      style={style}
      role="status"
      aria-label="Loading content"
    />
  );
};

/**
 * Card skeleton for loading card-like content
 */
export const CardSkeleton = () => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <Skeleton className="h-8 w-3/4 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );
};

/**
 * List skeleton for loading lists
 */
export const ListSkeleton = ({ count = 3 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-4 rounded-lg border border-slate-200">
          <Skeleton className="h-5 w-2/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
};

/**
 * Medication card skeleton for medication search results
 */
export const MedicationCardSkeleton = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-slate-200">
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
};

/**
 * Full page loading skeleton
 */
export const PageSkeleton = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
        <Skeleton className="h-10 w-1/2 mb-4" />
        <Skeleton className="h-6 w-3/4 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
};

export default Skeleton;
