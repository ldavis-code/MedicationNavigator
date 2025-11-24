# Bundle Size and Performance Analysis

**Generated:** November 24, 2025
**Build Tool:** Vite 5.x with Terser minification

---

## 1. Total JavaScript Bundle Size

| File | Raw Size | Gzipped |
|------|----------|---------|
| `index.js` (main app) | 259.30 KB | 55.97 KB |
| `react-vendor.js` | 161.11 KB | 52.45 KB |
| `icons.js` (lucide-react) | 10.22 KB | 3.66 KB |
| `index.css` | 46.69 KB | 8.03 KB |
| **Total JavaScript** | **430.63 KB** | **112.08 KB** |
| **Total (with CSS)** | **477.32 KB** | **120.11 KB** |

### Assessment

- **Gzipped total of ~120 KB** is acceptable for a feature-rich SPA but has room for optimization
- **Main bundle (259 KB)** is the primary concern - it contains all routes and data
- **React vendor bundle (161 KB)** is standard for React + ReactDOM + Router

---

## 2. Large Dependencies - Analysis & Recommendations

### 2.1 lucide-react (21 MB in node_modules)

**Current State:** Tree-shaken to 10.22 KB (49 icons imported)
**Status:** Well-optimized

The icons are properly chunked separately and tree-shaking is working. Current imports in `App.jsx:3-11`:
```javascript
Map, Search, BookOpen, ShieldCheck, ArrowRight, Heart, Anchor, Lock, UserCheck,
Menu, X, ShieldAlert, HeartHandshake, CheckCircle, ChevronLeft, DollarSign,
Shield, AlertTriangle, AlertCircle, Printer, ExternalLink, Building, PlusCircle,
Trash2, Globe, List, Info, Copy, Check, Building2, LandPlot, Scale, FileText,
GraduationCap, Phone, ClipboardList, CheckSquare, Square, Stethoscope,
AlertOctagon, Calendar, Pill, ChevronDown, Share2, Home, MessageCircle, Send,
HelpCircle, Lightbulb, Zap, MinimizeIcon, Users, TrendingUp, Clock, Loader2
```

### 2.2 JSON Data Files (Bundled in main chunk)

| File | Size |
|------|------|
| `medications.json` | 53.7 KB |
| `faqs.json` | 11.8 KB |
| `states.json` | 4.4 KB |
| `knowledge-base.json` | 4.3 KB |
| `resources.json` | 3.8 KB |
| Other JSON files | ~2.5 KB |
| **Total** | **~80 KB** |

**Issue:** All JSON data is imported statically and bundled in the main chunk
**Impact:** ~30-40 KB after minification added to initial load

**Recommendations:**
1. **Dynamic imports for medications.json** - Only load when user visits `/medications`
2. **Lazy load FAQ data** - Only needed on `/faq` route
3. **Consider fetching from API** for larger datasets if they need frequent updates

### 2.3 Monolithic App.jsx (3,676 lines)

**Critical Issue:** All components are in a single file, preventing code splitting

**Components that could be lazy-loaded:**

| Component | Line Range | Estimated Size | Route |
|-----------|------------|----------------|-------|
| `Wizard` | 778-1350 | ~570 lines | `/wizard` |
| `MedicationSearch` | 1416-2120 | ~700 lines | `/medications` |
| `Education` | 2120-3125 | ~1000 lines | `/education` |
| `ApplicationHelp` | 3125-3513 | ~400 lines | `/application-help` |
| `FAQ` | 3513-3615 | ~100 lines | `/faq` |
| `ChatWidget` | 163-350 | ~190 lines | All pages |

**Recommendation:** Split into separate files and use `React.lazy()`:

```javascript
// Example implementation
const Wizard = lazy(() => import('./components/Wizard'));
const MedicationSearch = lazy(() => import('./components/MedicationSearch'));
const Education = lazy(() => import('./components/Education'));
const ApplicationHelp = lazy(() => import('./components/ApplicationHelp'));
const FAQ = lazy(() => import('./components/FAQ'));

// In Routes
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/wizard" element={<Wizard />} />
    <Route path="/medications" element={<MedicationSearch />} />
    {/* ... */}
  </Routes>
</Suspense>
```

**Potential savings:** Could reduce initial bundle by 100-150 KB (gzipped: ~30-40 KB)

---

## 3. Images - Analysis

### Current State

**No image files found in the project.** This is actually positive from a performance standpoint.

### Missing Images (Referenced but not created)

The following images are referenced in `index.html` for social sharing:
- `/og-image.png` (Open Graph - Facebook, LinkedIn)
- `/twitter-image.png` (Twitter cards)
- `/favicon.svg` and `/favicon.ico`

**Impact:** Social sharing will show blank images

**Recommendations:**
1. Create optimized OG images:
   - Size: 1200x630px for `og-image.png`
   - Size: 1200x675px for `twitter-image.png`
   - Format: Use WebP with PNG fallback, or optimized PNG
   - Compression: Target < 100 KB each
2. Add favicon files to `/public` directory

---

## 4. Render-Blocking Resources

### Current Analysis

| Resource | Blocking? | Notes |
|----------|-----------|-------|
| CSS bundle | Minimal | Bundled with Vite, ~47 KB |
| JavaScript | No | Loaded as `type="module"` at end of body |
| External fonts | No | None loaded |
| Inline scripts | No | Only IE detection (~10 lines) |

### Good Practices Already in Place

1. **JavaScript module at body end** (`src/main.jsx:227`) - Non-blocking
2. **No external font dependencies** - System fonts used via Tailwind
3. **No external CSS files** - All styles bundled
4. **Inline critical IE detection** - Minimal impact

### Potential Improvements

1. **JSON-LD schemas** (lines 34-171 in `index.html`) - ~140 lines of structured data in `<head>`
   - These don't block rendering but add ~4 KB to initial HTML
   - Could be loaded dynamically after hydration if needed

2. **CSS Critical Path**
   - Consider extracting critical CSS for above-the-fold content
   - Tools: `vite-plugin-critical` or `critters`

---

## 5. Performance Optimization Roadmap

### High Priority (Immediate Impact)

1. **Code Split Routes**
   - Split `App.jsx` into separate component files
   - Use `React.lazy()` for route-based code splitting
   - Expected savings: 100-150 KB from initial bundle

2. **Dynamic Import for medications.json**
   - Load only when user navigates to `/medications`
   - Expected savings: ~20 KB from initial bundle

### Medium Priority (Good Practice)

3. **Bundle Analyzer Integration**
   ```bash
   npm install -D vite-plugin-visualizer
   ```
   Add to `vite.config.js` for ongoing bundle monitoring

4. **Add missing social images**
   - Create optimized `og-image.png` and `twitter-image.png`
   - Use WebP format where supported

### Low Priority (Nice to Have)

5. **Critical CSS extraction** for faster First Contentful Paint
6. **Service Worker** for caching static assets
7. **Preconnect hints** if external APIs are added

---

## 6. Vite Configuration Recommendations

Current `vite.config.js` has basic chunking. Recommended enhancements:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console.log in production
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'icons': ['lucide-react']
        }
      }
    },
    // Add chunk size warnings
    chunkSizeWarningLimit: 500
  }
})
```

---

## Summary

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| Initial JS Bundle | 430 KB | < 300 KB | High |
| Gzipped Total | 120 KB | < 80 KB | High |
| Route Code Splitting | None | All routes | High |
| Images | Missing | Optimized | Medium |
| Render Blocking | Minimal | Minimal | Low |

**Overall Assessment:** The application has a solid foundation with proper minification and vendor chunking. The main optimization opportunity is splitting the monolithic `App.jsx` (3,676 lines) into route-based chunks, which could reduce the initial bundle by 30-40%.
