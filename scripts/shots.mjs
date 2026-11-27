// Node 24: node scripts/shots.mjs [base URL]
// Local preview: node scripts/shots.mjs http://localhost:4321/ML_DL_Vis/
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';

const browsers = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const play = '[role="tab"][data-step="1"]';
const shots = [
  { name: 'knn', path: 'learn/3-classification/knn/', play: true },
  { name: 'compare', path: 'compare/?a=knn&b=tree', board: '.side canvas', boards: 2, viewport: [1120, 777], scrollAnchor: '.sheet.data' },
  { name: 'regression', path: 'learn/2-regression/polynomial/', play: true },
  { name: 'selection', path: 'learn/10-selection/cv/', play: true },
  { name: 'arabic', path: 'ar/', board: '#hero', viewport: [1440, 639], size: [1000, 444] },
  { name: 'phone', path: 'learn/4-clustering/kmeans/', mobile: true, viewport: [375, 812], size: [420, 909], scrollAnchor: '.tabs' },
];

async function until(check, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  do {
    const value = await check();
    if (value) return value;
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

async function connect(socket) {
  let nextId = 0, loads = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const { id, method, result, error } = JSON.parse(data);
    if (method === 'Page.loadEventFired') loads++;
    pending.get(id)?.(result, error);
  });
  await until(() => {
    if (socket.readyState >= WebSocket.CLOSING) throw new Error('DevTools connection failed');
    return socket.readyState === WebSocket.OPEN;
  }, 'DevTools connection');
  const send = async (method, params = {}) => {
    const id = ++nextId;
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20_000);
        pending.set(id, (result, error) => error ? reject(new Error(`${method}: ${error.message}`)) : resolve(result));
        socket.send(JSON.stringify({ id, method, params }));
      });
    } finally {
      clearTimeout(timer);
      pending.delete(id);
    }
  };
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const load = async (method, params) => {
    const before = loads;
    const result = await send(method, params);
    if (result.errorText) throw new Error(result.errorText);
    await until(() => loads > before, 'page load', 20_000);
  };
  return { send, evaluate, load };
}

async function capture(base, { send, evaluate, load }) {
  await send('Network.enable');
  await send('Network.setBypassServiceWorker', { bypass: true });
  await send('Emulation.setScrollbarsHidden', { hidden: true });
  const viewport = async ([width, height], mobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 2 });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  };
  const settle = async () => {
    await evaluate(`(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
    await delay(350);
  };
  const open = async (path, theme) => {
    await send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' },
    ] });
    const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', { source: `try {
      localStorage.setItem('theme', ${JSON.stringify(theme)});
      localStorage.setItem('mlv-theme', ${JSON.stringify(theme)});
      localStorage.setItem('mlv-rail', 'min');
    } catch {}` });
    await load('Page.navigate', { url: new URL(path, base).href });
    await load('Page.reload');
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    if (await evaluate('document.documentElement.dataset.theme') !== theme) throw new Error(`Could not set ${theme} theme`);
  };
  const painted = (selector, count = 1) => until(() => evaluate(`
    Array.from(document.querySelectorAll(${JSON.stringify(selector)})).filter(canvas =>
      canvas.clientWidth && canvas.clientHeight && canvas.getContext('2d')
        ?.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data[3]).length >= ${count}
  `), `painted canvas: ${selector}`);
  const screenshot = async (clip) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip });
    return Buffer.from(data, 'base64');
  };

  const images = new Map();
  for (const shot of shots) {
    try {
      await viewport(shot.viewport ?? (shot.play ? [1090, 757] : [1200, 833]), shot.mobile);
      await open(shot.path, 'dark');
      if (shot.play) {
        await evaluate(`document.querySelector(${JSON.stringify(play)}).click()`);
        await painted('[role="tabpanel"].on canvas');
      } else if (shot.board) {
        await painted(shot.board, shot.boards);
      } else if (shot.mobile) {
        await until(() => evaluate(`!!document.querySelector('[data-learn-simple]:not([hidden]) .learn-scene > *')`), 'Learn scene');
      }
      await settle();
      if (shot.play) await evaluate(`scrollBy(0, document.querySelector('.tabs').getBoundingClientRect().top - 20)`);
      if (shot.scrollAnchor) await evaluate(`scrollBy({ top:
        document.querySelector(${JSON.stringify(shot.scrollAnchor)}).getBoundingClientRect().top - 8,
        behavior: 'instant' })`);
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      images.set(`docs/img/${shot.name}.jpg`, await sharp(await screenshot())
        .resize(...(shot.size ?? [1000, 694])).jpeg({ quality: 85 }).toBuffer());
    } catch (error) {
      throw new Error(`${shot.name} (${shot.path}): ${error.message}`);
    }
  }

  const template = await readFile(new URL('./shots-banner.html', import.meta.url), 'utf8');
  for (const theme of ['dark', 'light']) {
    await viewport([1560, 900]);
    await open('', theme);
    await painted('#hero');
    await evaluate(`document.querySelector('#stage button[data-m="ksvm"]').click()`);
    await settle();
    const clip = await evaluate(`(() => {
      const { left, top, width, height } = document.querySelector('#hero').getBoundingClientRect();
      return { x: Math.ceil(left + scrollX), y: Math.ceil(top + scrollY),
        width: Math.floor(width) - 1, height: Math.floor(height) - 1, scale: 1 };
    })()`);
    const board = await sharp(await screenshot(clip)).resize(1016, 640).png().toBuffer();
    await viewport([1280, 400]);
    await evaluate(`(async () => {
      const mark = document.querySelector('.brand svg').cloneNode(true);
      document.body.innerHTML = ${JSON.stringify(template)};
      document.querySelector('.banner-brand').prepend(mark);
      const board = document.querySelector('.banner-board');
      board.src = 'data:image/png;base64,${board.toString('base64')}';
      await board.decode();
      scrollTo(0, 0);
    })()`);
    await settle();
    images.set(`docs/banner-${theme}.png`, await sharp(await screenshot()).resize(2560, 800).png().toBuffer());
  }
  return images;
}

async function launch(executable) {
  const profile = await mkdtemp(join(tmpdir(), 'readme-shots-'));
  const browser = spawn(executable, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let launchError, socket;
  browser.on('error', error => { launchError = error; });
  const closed = new Promise(resolve => browser.once('close', resolve));
  const close = async () => {
    socket?.close();
    browser.kill();
    await closed;
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  try {
    const port = await until(async () => {
      if (launchError) throw launchError;
      if (browser.exitCode !== null) throw new Error(`browser exited with code ${browser.exitCode}`);
      const info = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return '';
      });
      return info.match(/^\d+(?=\r?\n)/)?.[0];
    }, 'Chrome debugging port');
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`DevTools returned HTTP ${response.status}`);
    const target = (await response.json()).find(tab => tab.type === 'page');
    if (!target?.webSocketDebuggerUrl) throw new Error('no DevTools page found');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    const cdp = await connect(socket);
    await cdp.send('Page.enable');
    return { cdp, close };
  } catch (error) {
    await close();
    throw error;
  }
}

async function main() {
  const base = new URL(process.argv[2] ?? 'https://mohammad-qt.github.io/ML_DL_Vis/');
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Base URL must use HTTP or HTTPS');
  base.pathname = base.pathname.replace(/\/?$/, '/');
  base.search = base.hash = '';
  const candidates = process.env.CHROME ? [process.env.CHROME] : browsers.filter(existsSync);
  if (!candidates.length) throw new Error('Chrome or Edge not found. Set CHROME to the browser executable path.');

  let browser;
  const failures = [];
  for (const executable of candidates) {
    try { browser = await launch(executable); break; }
    catch (error) { failures.push(`${executable}: ${error.message}`); }
  }
  if (!browser) throw new Error(`Could not start Chrome/Edge:\n${failures.join('\n')}`);
  try {
    for (const [file, image] of await capture(base, browser.cdp)) {
      await writeFile(new URL(`../${file}`, import.meta.url), image);
      console.log(`${file} (${image.length.toLocaleString('en-US')} bytes)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(`README screenshots: ${error.message}`);
  process.exitCode = 1;
});
