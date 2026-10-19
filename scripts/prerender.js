// scripts/prerender.js
// Simple prerender script using puppeteer.
// Usage (after running `npm run build` and `npx vite preview --port 4173`):
//   node scripts/prerender.js
//
// It will visit the configured routes and write rendered HTML to dist/<route>/index.html

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), 'client', 'dist');
const PORT = process.env.PREVIEW_PORT || 4173;
const HOST = `http://localhost:${PORT}`;

// Routes to prerender — add any other public-facing routes you want indexed
const ROUTES = ['/', '/kampus', '/organisasi', '/login'];

(async () => {
  console.log('Starting prerender...');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    // Set reasonable viewport for LCP
    await page.setViewport({ width: 1200, height: 800 });

    for (const route of ROUTES) {
      const url = HOST + route;
      console.log('Rendering', url);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

      // Wait a short time to allow any client transitions to complete
      await page.waitForTimeout(250);

      const html = await page.content();

      // Determine output path
      const routePath = route === '/' ? '' : route.replace(/^\//, '');
      const outDir = path.join(OUT_DIR, routePath);
      const outFile = path.join(outDir, 'index.html');

      // Ensure directory exists
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outFile, html, 'utf8');
      console.log('Saved prerendered HTML to', outFile);
    }

    console.log('Prerender finished.');
  } catch (err) {
    console.error('Prerender failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
