import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(process.env.SPECLYNX_PREVIEW_ASSETS ?? 'client/src/preview/webview');
const templates = [
  ...readFileSync('client/src/preview/index.ts', 'utf8').matchAll(/return `([\s\S]*?)`;/g),
].map((m) => m[1]);
assert.equal(templates.length, 2);
let origin;
const server = createServer((request, response) => {
  const url = new URL(request.url, origin);
  if (['/scalar', '/swagger-ui'].includes(url.pathname)) {
    const scalar = url.pathname === '/scalar';
    const names = scalar
      ? {
          scalarJSAsset: 'scalar.js',
          scalarInitializeJSAsset: 'scalar.initialize.js',
          scalarCSSAsset: 'scalar.css',
          scalarOverrideCSSAsset: 'scalar.override.css',
        }
      : {
          swaggerUIJSAsset: 'swagger-ui.js',
          swaggerUIInitializeJSAsset: 'swagger-ui.initialize.js',
          swaggerUICSSAsset: 'swagger-ui.css',
          swaggerUIOverrideCSSAsset: 'swagger-ui.override.css',
        };
    let html = templates[scalar ? 1 : 0].replaceAll('${cspSource}', origin);
    for (const [name, file] of Object.entries(names))
      html = html.replaceAll(
        '${' + name + '.toString()}',
        `${origin}/assets${url.pathname}/${file}`,
      );
    response.setHeader('Content-Type', 'text/html');
    response.end(html);
    return;
  }
  const file = path.resolve(root, '.' + url.pathname.replace(/^\/assets/, ''));
  if (!url.pathname.startsWith('/assets/') || !file.startsWith(root + path.sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/css');
    response.end(readFileSync(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const renderer of ['scalar', 'swagger-ui']) {
    const context = await browser.newContext();
    const external = new Set();
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        external.add(url.hostname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      globalThis.acquireVsCodeApi = () => ({
        postMessage: (message) => {
          if (message.command === 'init') globalThis.previewReady = true;
        },
      });
    });
    await page.goto(`${origin}/${renderer}`);
    await page.waitForFunction(() => globalThis.previewReady === true);
    for (const title of ['Publication preview smoke', 'Updated publication preview']) {
      const spec = {
        openapi: '3.0.3',
        info: { title, version: '1.0.0' },
        paths: {
          '/pets': {
            get: {
              summary: 'List synthetic pets',
              responses: { 200: { description: 'Synthetic response' } },
            },
          },
        },
      };
      await page.evaluate(
        (text) => globalThis.postMessage({ command: 'preview', text }, '*'),
        JSON.stringify(spec),
      );
      await page
        .getByText(title, { exact: false })
        .first()
        .waitFor({ state: 'visible', timeout: 30000 });
    }
    assert.deepEqual(errors, [], `${renderer} browser errors`);
    assert.deepEqual(
      [...external],
      [],
      `${renderer} must render and update without automatic external requests`,
    );
    console.log(
      `${renderer}: initial render and document update passed; external hosts blocked: ${[...external].join(', ') || 'none'}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
