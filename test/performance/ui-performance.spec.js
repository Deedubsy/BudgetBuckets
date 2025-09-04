/**
 * UI Performance Tests with Playwright
 * Tests page load times, interaction responsiveness, and memory usage
 */

const { test, expect } = require('@playwright/test');

test.describe('UI Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set larger viewport for performance testing
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('homepage loads within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check Core Web Vitals using Performance API
    const performanceMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Use PerformanceObserver to capture metrics
        const metrics = {};
        
        // Capture paint metrics
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach(entry => {
          metrics[entry.name] = entry.startTime;
        });
        
        // Capture navigation timing
        const navigationEntry = performance.getEntriesByType('navigation')[0];
        if (navigationEntry) {
          metrics.domContentLoaded = navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart;
          metrics.loadComplete = navigationEntry.loadEventEnd - navigationEntry.loadEventStart;
          metrics.totalTime = navigationEntry.loadEventEnd - navigationEntry.fetchStart;
        }
        
        resolve(metrics);
      });
    });
    
    console.log('Homepage Performance Metrics:', performanceMetrics);
    
    // Performance assertions
    if (performanceMetrics['first-contentful-paint']) {
      expect(performanceMetrics['first-contentful-paint']).toBeLessThan(1500); // 1.5s
    }
    
    if (performanceMetrics.totalTime) {
      expect(performanceMetrics.totalTime).toBeLessThan(3000); // 3s total
    }
  });

  test('smoke test page interactive performance', async ({ page }) => {
    await page.goto('/test/smoke-test.html');
    
    // Wait for page load
    await page.waitForLoadState('domcontentloaded');
    
    // Measure time to interactive elements
    const startTime = Date.now();
    
    const runButton = page.locator('#runAllBtn').or(page.locator('button:has-text("Run All")')).first();
    await expect(runButton).toBeVisible();
    
    const timeToInteractive = Date.now() - startTime;
    expect(timeToInteractive).toBeLessThan(1000); // 1s to interactive
    
    // Test button responsiveness
    const clickStartTime = Date.now();
    await runButton.click();
    
    // Check for immediate feedback (loading state or results appearing)
    await page.waitForTimeout(100);
    const hasResponse = await page.locator('#testResults, .test-results, pre').first().isVisible();
    
    const responseTime = Date.now() - clickStartTime;
    expect(responseTime).toBeLessThan(500); // 500ms response time
    
    console.log(`Smoke test interaction: ${timeToInteractive}ms to interactive, ${responseTime}ms response`);
  });

  test('app page handles large DOM efficiently', async ({ page }) => {
    await page.goto('/app/index.html');
    
    // Wait for initial load
    await page.waitForLoadState('domcontentloaded');
    
    // Measure DOM size and complexity
    const domMetrics = await page.evaluate(() => {
      const elementCount = document.getElementsByTagName('*').length;
      const textNodes = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let textNodeCount = 0;
      while (textNodes.nextNode()) textNodeCount++;
      
      return {
        elementCount,
        textNodeCount,
        bodyHTML: document.body.innerHTML.length
      };
    });
    
    console.log('App DOM Metrics:', domMetrics);
    
    // DOM size should be reasonable
    expect(domMetrics.elementCount).toBeLessThan(5000); // Not too complex
    expect(domMetrics.bodyHTML).toBeLessThan(500000); // <500KB of HTML
  });

  test('scroll performance is smooth', async ({ page }) => {
    await page.goto('/');
    
    // Add some content to make scrolling meaningful
    await page.evaluate(() => {
      const content = document.createElement('div');
      content.style.height = '3000px';
      content.innerHTML = '<p>'.repeat(100).split('').map((_, i) => `<p>Scroll test content ${i}</p>`).join('');
      document.body.appendChild(content);
    });
    
    // Measure scroll performance
    const scrollMetrics = [];
    let frameCount = 0;
    
    // Monitor frame rate during scroll
    const measureFrame = () => {
      frameCount++;
      if (frameCount < 60) { // Measure for ~1 second at 60fps
        requestAnimationFrame(measureFrame);
      }
    };
    
    await page.evaluate(() => {
      let startTime = performance.now();
      window.scrollTo(0, 100);
      
      const measureFrame = () => {
        window.frameCount = (window.frameCount || 0) + 1;
        if (window.frameCount < 30) {
          requestAnimationFrame(measureFrame);
        }
      };
      
      requestAnimationFrame(measureFrame);
    });
    
    // Wait for scroll animation to complete
    await page.waitForTimeout(500);
    
    const frameRate = await page.evaluate(() => window.frameCount || 0);
    
    // Should maintain reasonable frame rate
    expect(frameRate).toBeGreaterThan(20); // At least 20 fps during scroll
    
    console.log(`Scroll performance: ${frameRate} frames measured`);
  });

  test('memory usage stays reasonable during navigation', async ({ page }) => {
    const pages = ['/', '/auth/login.html', '/app/index.html', '/test/smoke-test.html'];
    const memorySnapshots = [];
    
    for (const url of pages) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      // Measure memory usage (if supported)
      const memoryInfo = await page.evaluate(() => {
        if ('memory' in performance) {
          return {
            usedJSMemory: performance.memory.usedJSMemory,
            totalJSMemory: performance.memory.totalJSMemory,
            jsMemoryLimit: performance.memory.jsMemoryLimit
          };
        }
        return null;
      });
      
      if (memoryInfo) {
        memorySnapshots.push({
          url,
          ...memoryInfo
        });
      }
    }
    
    if (memorySnapshots.length > 0) {
      console.log('Memory Usage Snapshots:', memorySnapshots);
      
      // Memory usage should not grow excessively between pages
      const maxMemory = Math.max(...memorySnapshots.map(s => s.usedJSMemory));
      const minMemory = Math.min(...memorySnapshots.map(s => s.usedJSMemory));
      
      // Memory growth should be reasonable (less than 10x increase)
      expect(maxMemory / minMemory).toBeLessThan(10);
    }
  });

  test('network requests are optimized', async ({ page }) => {
    const requests = [];
    const responses = [];
    
    // Track all network activity
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });
    
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        contentLength: response.headers()['content-length'],
        timing: response.request().timing()
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log(`Network requests: ${requests.length} requests, ${responses.length} responses`);
    
    // Analyze network performance
    const failedRequests = responses.filter(r => r.status >= 400);
    const largeRequests = responses.filter(r => 
      r.contentLength && parseInt(r.contentLength) > 1000000 // >1MB
    );
    
    expect(failedRequests).toHaveLength(0);
    expect(largeRequests).toHaveLength(0); // No requests should be >1MB
    
    // Should not make excessive requests
    expect(requests.length).toBeLessThan(50);
  });

  test('JavaScript execution time is reasonable', async ({ page }) => {
    await page.goto('/test/smoke-test.html');
    
    // Test JavaScript execution performance
    const jsPerformance = await page.evaluate(() => {
      const startTime = performance.now();
      
      // Simulate some JavaScript work (like the smoke test would do)
      for (let i = 0; i < 10000; i++) {
        const obj = { test: i, data: `item-${i}` };
        JSON.stringify(obj);
      }
      
      const endTime = performance.now();
      
      return {
        duration: endTime - startTime,
        startTime,
        endTime
      };
    });
    
    console.log(`JavaScript execution: ${jsPerformance.duration.toFixed(2)}ms`);
    
    // JavaScript operations should be fast
    expect(jsPerformance.duration).toBeLessThan(100); // <100ms
  });

  test('CSS rendering performance', async ({ page }) => {
    await page.goto('/');
    
    // Test CSS animation and rendering performance
    const cssPerformance = await page.evaluate(() => {
      // Create elements to test CSS performance
      const testContainer = document.createElement('div');
      testContainer.style.cssText = `
        width: 100px;
        height: 100px;
        background: linear-gradient(45deg, red, blue);
        border-radius: 50%;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(testContainer);
      
      const startTime = performance.now();
      
      // Trigger reflow/repaint
      testContainer.style.transform = 'scale(1.2) rotate(45deg)';
      testContainer.offsetHeight; // Force reflow
      
      const endTime = performance.now();
      
      // Clean up
      document.body.removeChild(testContainer);
      
      return {
        renderTime: endTime - startTime
      };
    });
    
    console.log(`CSS rendering: ${cssPerformance.renderTime.toFixed(2)}ms`);
    
    // CSS operations should be fast
    expect(cssPerformance.renderTime).toBeLessThan(50); // <50ms
  });

  test('mobile performance is acceptable', async ({ page }) => {
    // Set mobile viewport and connection
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Simulate slower connection
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.6 * 1024 * 1024 / 8, // 1.6 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 40 // 40ms
    });
    
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Mobile load time: ${loadTime}ms`);
    
    // Mobile should still load reasonably fast
    expect(loadTime).toBeLessThan(5000); // 5s on slow connection
    
    // Page should be usable
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBe(true);
  });
});