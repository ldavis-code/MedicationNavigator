# Sitemap Troubleshooting Guide

## Common Google Search Console Errors & Solutions

### Error: "Couldn't fetch"

**Problem:** Google can't access your sitemap file.

**Solutions:**

1. **Check the URL is accessible:**
   - Open your browser
   - Go to: `https://your-actual-domain.com/sitemap.xml`
   - You should see the XML content
   - If you get 404, the file isn't being deployed

2. **Verify the file is in the dist folder:**
   ```bash
   npm run build
   ls -la dist/sitemap.xml
   ```

3. **Check robots.txt allows the sitemap:**
   - Go to: `https://your-actual-domain.com/robots.txt`
   - Should contain: `Sitemap: https://your-actual-domain.com/sitemap.xml`

---

### Error: "Invalid XML" or "Unsupported file format"

**Problem:** The XML format has errors.

**Solution:**

1. **Validate your sitemap online:**
   - Go to: https://www.xml-sitemaps.com/validate-xml-sitemap.html
   - Enter your sitemap URL
   - Fix any reported errors

2. **Check for invisible characters:**
   ```bash
   file public/sitemap.xml
   ```
   Should show: `XML 1.0 document, UTF-8 Unicode text`

---

### Error: "URL not allowed" or "URL not found"

**Problem:** The URLs in your sitemap don't match your actual domain.

**This is the MOST COMMON issue!**

**Solution:**

1. **Find your actual deployed URL:**
   - Netlify: `your-site.netlify.app` or your custom domain
   - Vercel: `your-site.vercel.app` or your custom domain
   - GitHub Pages: `username.github.io/repo-name`

2. **Update the sitemap to match:**

   If your site is at `my-transplant-site.netlify.app`, you need to edit `public/sitemap.xml`:

   **WRONG:**
   ```xml
   <loc>https://medicationnavigator.com/</loc>
   ```

   **CORRECT:**
   ```xml
   <loc>https://my-transplant-site.netlify.app/</loc>
   ```

3. **Use the domain replacement script:**
   ```bash
   # Replace with your actual domain
   sed -i 's/medicationnavigator.com/your-actual-domain.com/g' public/sitemap.xml
   ```

4. **Rebuild and redeploy:**
   ```bash
   npm run build
   netlify deploy --prod
   # or
   vercel --prod
   ```

---

### Error: "Parsing error"

**Problem:** Date format or other XML syntax issue.

**Solution:**

The sitemap has been updated to use proper ISO 8601 date format:
```xml
<lastmod>2025-11-22T00:00:00+00:00</lastmod>
```

If you still get errors, try removing the `lastmod` tags entirely:
```xml
<url>
    <loc>https://your-domain.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
</url>
```

---

## Step-by-Step Fix Process

### 1. Verify Your Deployed Domain

```bash
# Check what domain you deployed to
# Look at the output from your last deployment
```

### 2. Update Sitemap with Correct Domain

**If deploying to a temporary domain (like Netlify/Vercel subdomain):**

Edit `public/sitemap.xml` and replace ALL instances of:
- `https://medicationnavigator.com/`

With your actual domain:
- `https://your-actual-site.netlify.app/` (or whatever your URL is)

**Quick replacement command:**
```bash
# Example for Netlify
sed -i 's|https://medicationnavigator.com/|https://your-site.netlify.app/|g' public/sitemap.xml

# Example for Vercel
sed -i 's|https://medicationnavigator.com/|https://your-site.vercel.app/|g' public/sitemap.xml
```

### 3. Update robots.txt

Edit `public/robots.txt` to match:
```txt
User-agent: *
Allow: /

Sitemap: https://your-actual-domain.com/sitemap.xml
```

### 4. Rebuild and Deploy

```bash
npm run build
netlify deploy --prod
# or
vercel --prod
```

### 5. Test the Sitemap

**Browser test:**
1. Open: `https://your-actual-domain.com/sitemap.xml`
2. You should see XML content (not a 404)

**Online validator:**
1. Go to: https://www.xml-sitemaps.com/validate-xml-sitemap.html
2. Enter your sitemap URL
3. Should show "Valid sitemap"

### 6. Resubmit to Google

1. Go to **Google Search Console**
2. Navigate to **Sitemaps** (left menu)
3. Remove the old sitemap if it shows an error
4. Click "Add a new sitemap"
5. Enter: `sitemap.xml` (just the filename)
6. Click Submit
7. Wait 5-10 minutes for Google to process

---

## Testing Your Sitemap

### Online Validators:
- **XML Sitemaps Validator:** https://www.xml-sitemaps.com/validate-xml-sitemap.html
- **Sitemap Validator:** https://www.websiteplanet.com/webtools/sitemap-validator/

### Command Line Test:
```bash
# Check if sitemap exists in build
npm run build
cat dist/sitemap.xml

# Validate XML syntax
xmllint --noout public/sitemap.xml 2>&1 && echo "Valid XML" || echo "Invalid XML"
```

---

## When You Get a Custom Domain

If you're currently using a temporary domain (like `my-site.netlify.app`) and plan to use a custom domain later:

1. **Update your sitemap** when you add the custom domain
2. **Update robots.txt** with the new domain
3. **Update index.html** meta tags (canonical URL, Open Graph URLs)
4. **Rebuild and redeploy**
5. **Resubmit sitemap** to Google Search Console

---

## Quick Reference

**Check if sitemap is accessible:**
```bash
curl https://your-domain.com/sitemap.xml
```

**Should return:** XML content (not 404 or error)

**Check if robots.txt is accessible:**
```bash
curl https://your-domain.com/robots.txt
```

**Should contain:** Reference to your sitemap

---

## Still Having Issues?

1. **Share the exact error message** from Google Search Console
2. **Share your deployed URL** (e.g., the actual site address)
3. **Check browser console** for any errors when loading the sitemap
4. **Try a simple sitemap** with just the homepage first:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://your-actual-domain.com/</loc>
    </url>
</urlset>
```

If the simple version works, gradually add back the other URLs.
