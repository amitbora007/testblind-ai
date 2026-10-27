#!/usr/bin/env node
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = '/home/amit.bora/.gemini/antigravity/brain/160e684f-b1f6-421c-823d-a71670a49889/screenshots';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '320px (Mobile S)', width: 320, height: 640, mobile: true },
  { name: '375px (Mobile M)', width: 375, height: 667, mobile: true },
  { name: '768px (Tablet)', width: 768, height: 1024, mobile: false },
  { name: '1024px (Laptop)', width: 1024, height: 768, mobile: false },
  { name: '1440px (Desktop)', width: 1440, height: 900, mobile: false },
];

const ROUTES = [
  'dashboard',
  'projects',
  'repositories',
  'code-lab',
  'gap-discovery',
  'incidents',
  'test-cases',
  'test-scenarios',
  'execution-runs',
  'reports',
  'ai-insights',
  'integrations',
  'team-settings',
];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getWsEndpoint(port = 9222) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const pageTarget = targets.find((t) => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        return pageTarget.webSocketDebuggerUrl;
      }
      // If no page target exists, create one via /json/new
      const newPageRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
      const newPage = await newPageRes.json();
      if (newPage && newPage.webSocketDebuggerUrl) {
        return newPage.webSocketDebuggerUrl;
      }
    } catch {
      await sleep(200);
    }
  }
  throw new Error('Chrome remote debugging page target not found');
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];

    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
        this.consoleErrors.push(text);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(msg.params.exceptionDetails.text);
      }
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log('🚀 Launching Headless Google Chrome on port 9222...');
  const chrome = spawn(
    '/usr/bin/google-chrome',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    const wsUrl = await getWsEndpoint(9222);
    console.log(` Connected to Chrome CDP: ${wsUrl}`);
    const client = new CdpClient(wsUrl);

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    const results = [];
    let totalTested = 0;
    let totalPassed = 0;
    let totalOverflows = 0;

    console.log('\n================================================================================');
    console.log('   TestBlind AI — Multi-Viewport Responsive & Quality Audit Matrix');
    console.log('================================================================================\n');

    for (const vp of VIEWPORTS) {
      console.log(`\n Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);

      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
      });

      for (const route of ROUTES) {
        totalTested++;
        client.consoleErrors = [];

        const targetUrl = `http://127.0.0.1:4173/#${route}`;
        await client.send('Page.navigate', { url: targetUrl });
        await sleep(350); // allow DOM rendering and CSS animations to settle

        // Evaluate layout metrics and error state
        const evalRes = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            const hasHorizontalOverflow = docWidth > winWidth;
            const titleEl = document.querySelector('h1, h2, [role="heading"]');
            const mainEl = document.querySelector('main');
            const hasContent = !!mainEl && mainEl.children.length > 0;
            return {
              docWidth,
              winWidth,
              hasHorizontalOverflow,
              overflowPixels: Math.max(0, docWidth - winWidth),
              titleText: titleEl ? titleEl.textContent.trim() : '',
              hasContent,
            };
          })()`,
          returnByValue: true,
        });

        const metrics = evalRes.result.value || {};
        const isOverflow = metrics.hasHorizontalOverflow;
        if (isOverflow) totalOverflows++;

        // Filter out non-fatal expected favicon or mock warnings
        const seriousErrors = client.consoleErrors.filter(
          (err) => !err.includes('favicon') && !err.includes('Failed to load resource')
        );

        const passed = !isOverflow && seriousErrors.length === 0;
        if (passed) totalPassed++;

        // Capture audit screenshot for key viewports or representative pages
        const screenshotName = `${vp.width}px_${route}.png`;
        if (vp.width === 375 || vp.width === 1440 || isOverflow) {
          try {
            const ssRes = await client.send('Page.captureScreenshot', { format: 'png' });
            if (ssRes.data) {
              writeFileSync(
                join(SCREENSHOT_DIR, screenshotName),
                Buffer.from(ssRes.data, 'base64')
              );
            }
          } catch (e) {
            // ignore screenshot capture errors
          }
        }

        const statusIcon = passed ? '✅' : '❌';
        const overflowText = isOverflow ? `OVERFLOW (+${metrics.overflowPixels}px)` : 'Fit OK';
        console.log(
          `  ${statusIcon} [${vp.width}px] /#${route.padEnd(16)} -> ${overflowText} | ${metrics.titleText || 'Rendered'} (Errors: ${seriousErrors.length})`
        );

        results.push({
          viewport: vp.name,
          width: vp.width,
          route,
          overflow: isOverflow,
          overflowPixels: metrics.overflowPixels,
          passed,
          consoleErrors: seriousErrors,
        });
      }
    }

    client.close();

    console.log('\n================================================================================');
    console.log(` Audit Complete: ${totalPassed}/${totalTested} combinations passed cleanly!`);
    console.log(` Total Horizontal Overflows: ${totalOverflows}`);
    console.log(` Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('================================================================================\n');

    if (totalOverflows > 0) {
      console.error(`❌ Verification failed with ${totalOverflows} horizontal overflows!`);
      process.exit(1);
    } else {
      console.log(' All viewports and routes verified successfully with zero layout overflow!');
      process.exit(0);
    }
  } finally {
    chrome.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('Fatal error during browser verification:', err);
  process.exit(1);
});
