import { chromium } from 'playwright';

/**
 * Crawls a target enterprise URL using a headless browser.
 * Bypasses dynamic JS rendering limits and standard script blockers.
 * @param {string} url - Target website address
 * @returns {Promise<string>} The fully rendered DOM HTML string
 */
export async function crawlPage(url) {
  console.log(`[Crawler] Spawning headless browser for: ${url}`);
  
  // Launch browser with anti-detection args
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--use-fake-ui-for-media-stream',
      '--window-size=1920,1080'
    ]
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    const page = await context.newPage();
    
    // Set extra headers to look like a real user session
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Upgrade-Insecure-Requests': '1'
    });

    // Navigate and wait for the network layer to settle (crucial for React/Angular/Vue apps)
    await page.goto(url, { 
      waitUntil: 'networkidle', 
      timeout: 45000 
    });

    // Scroll down slowly to trigger any lazy-loaded content or images
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight > 4000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait an extra brief moment for rendering scripts to commit updates
    await page.waitForTimeout(2000);

    // Extract the full, rendered DOM markup string
    const fullyRenderedHtml = await page.content();
    
    await browser.close();
    return fullyRenderedHtml;

  } catch (error) {
    await browser.close();
    console.error(`[Crawler] Failed extracting markup for ${url}:`, error);
    throw new Error(`Browser automation extraction failed: ${error.message}`);
  }
}