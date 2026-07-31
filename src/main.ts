import './style.css';
import { createViewer } from './viewer/viewer';
import { setupScreens } from './ui/screenManager';
import { setupUI } from './ui/uiSetup';
import { setupEngine } from './core/engine';
import { setupHistoryShortcuts } from './store/historyManager';
import { store, appData } from './store/appState';
import { SAMPLES } from './image/sample';
import { ClickerPart } from './types';
import { reprocess, rebuild } from './core/engine';

const base = import.meta.env.BASE_URL;
const assetsPromise = Promise.all([
  fetch(base + 'assets/switch/mx/mx-socket.3mf').then(async (r) => {
    if (!r.ok) throw new Error('Failed to load mx-socket.3mf');
    store.set({ status: 'Loading switch assets… socket' });
    return await r.arrayBuffer();
  }),
  fetch(base + 'assets/switch/mx/mx-stem.3mf').then(async (r) => {
    if (!r.ok) throw new Error('Failed to load mx-stem.3mf');
    store.set({ status: 'Loading switch assets… stem' });
    return await r.arrayBuffer();
  }),
  fetch(base + 'assets/switch/mx/mx-switch.3mf').then(async (r) => {
    if (!r.ok) throw new Error('Failed to load mx-switch.3mf');
    store.set({ status: 'Loading switch assets… switch' });
    return await r.arrayBuffer();
  }),
]).catch((err) => { console.error('[assets]', err); throw err; });

async function initAssets() {
    store.set({ status: 'Loading switch assets…' });
  try {
    const [socket, stem, sw] = await assetsPromise;
    import('./core/engine').then(m => m.worker.postMessage({ type: 'init', socket, stem, switch: sw }, [socket, stem, sw]));
  } catch (err) { store.set({ status: 'Failed to load assets' }); appData.isInitialLoad = false; }
}

async function loadDefaultClicker() {
  try {
    store.set({ status: 'Loading default...' });
    const response = await fetch(base + 'assets/default-clicker.json');
    const serializedParts = await response.json();
    appData.latestParts = serializedParts.map((p: any) => ({ ...p, vertProperties: new Float32Array(p.vertProperties), triVerts: new Uint32Array(p.triVerts) })) as ClickerPart[];
    viewer.setParts(appData.latestParts, false); viewer.setView(store.get().view);
    store.set({ building: false, hasParts: appData.latestParts.length > 0, status: '' });
    appData.defaultClickerLoaded = true; appData.isInitialLoad = false;
  } catch (err) { if (appData.originalImage) reprocess(); }
}

const viewer = createViewer(document.getElementById('app')!);
const screens = setupScreens();
setupEngine(viewer, initAssets, loadDefaultClicker);
const history = setupHistoryShortcuts(rebuild);

setupUI(document.getElementById('sidebar-left')!, document.getElementById('sidebar-right')!, document.getElementById('status')!, viewer, screens, history);

SAMPLES[0].load().then((img) => {
  appData.originalImage = img;
  if (appData.assetsReady && !appData.defaultClickerLoaded) reprocess();
});