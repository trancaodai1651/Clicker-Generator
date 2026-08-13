import { createViewer } from '../viewer/viewer';
import { setupEngine, reprocess, rebuild } from '../core/engine';
import { setupHistoryShortcuts } from '../store/historyManager';
import { SAMPLES } from '../image/sample';
import { ClickerPart } from '../types';
import { createAppModel } from './model';
import { createAppView } from './view';

export function bootstrapApp() {
  const model = createAppModel();
  const view = createAppView();
  const viewer = createViewer(document.getElementById('app')!);
  const base = import.meta.env.BASE_URL;

  const assetsPromise = Promise.all([
    fetch(base + 'assets/switch/mx/mx-socket.3mf').then(async (r) => {
      if (!r.ok) throw new Error('Failed to load mx-socket.3mf');
      model.store.set({ status: 'Loading switch assets... socket' });
      return await r.arrayBuffer();
    }),
    fetch(base + 'assets/switch/mx/mx-stem.3mf').then(async (r) => {
      if (!r.ok) throw new Error('Failed to load mx-stem.3mf');
      model.store.set({ status: 'Loading switch assets... stem' });
      return await r.arrayBuffer();
    }),
    fetch(base + 'assets/switch/mx/mx-switch.3mf').then(async (r) => {
      if (!r.ok) throw new Error('Failed to load mx-switch.3mf');
      model.store.set({ status: 'Loading switch assets... switch' });
      return await r.arrayBuffer();
    }),
    fetch(base + 'assets/blocks/block no sides to connect.3mf').then((r) => r.arrayBuffer()),
    fetch(base + 'assets/blocks/block south side to connect.3mf').then((r) => r.arrayBuffer()),
    fetch(base + 'assets/blocks/block north and south side to connect.3mf').then((r) => r.arrayBuffer()),
    fetch(base + 'assets/blocks/block north and west side to connect.3mf').then((r) => r.arrayBuffer()),
    fetch(base + 'assets/blocks/block north, south and west side to connect.3mf').then((r) => r.arrayBuffer()),
    fetch(base + 'assets/blocks/block all sides to connect.3mf').then((r) => r.arrayBuffer()),
    fetch(base + 'assets/keycap.json').then(async (r) => {
      if (!r.ok) throw new Error('Failed to load keycap.json');
      return await r.json();
    }),
  ]).catch((err) => { console.error('[assets]', err); throw err; });

  async function initAssets() {
    model.store.set({ status: 'Loading switch assets...' });
    try {
      const [socket, stem, sw, blockNoSides, blockSouth, blockNorthSouth, blockNorthWest, blockNorthSouthWest, blockAllSides, keycapJson] = await assetsPromise;
      import('../core/engine').then((m) => m.worker.postMessage({
        type: 'init', socket, stem, switch: sw,
        blockNoSides, blockSouth, blockNorthSouth, blockNorthWest,
        blockNorthSouthWest, blockAllSides, keycapJson,
      }, [socket, stem, sw, blockNoSides, blockSouth, blockNorthSouth, blockNorthWest, blockNorthSouthWest, blockAllSides]));
    } catch {
      model.store.set({ status: 'Failed to load assets' });
      model.appData.isInitialLoad = false;
    }
  }

  async function loadDefaultClicker() {
    try {
      model.store.set({ status: 'Loading default...' });
      const response = await fetch(base + 'assets/default-clicker.json');
      const serializedParts = await response.json();
      model.appData.latestParts = serializedParts.map((p: any) => ({
        ...p,
        vertProperties: new Float32Array(p.vertProperties),
        triVerts: new Uint32Array(p.triVerts),
      })) as ClickerPart[];
      viewer.setParts(model.appData.latestParts, false);
      viewer.setView(model.store.get().view);
      model.store.set({ building: false, hasParts: model.appData.latestParts.length > 0, status: '' });
      model.appData.defaultClickerLoaded = true;
      model.appData.isInitialLoad = false;
    } catch {
      if (model.appData.originalImage) reprocess();
    }
  }

  setupEngine(viewer, initAssets, loadDefaultClicker);
  const history = setupHistoryShortcuts(rebuild);

  view.mountClicker(
    document.getElementById('sidebar-left')!,
    document.getElementById('sidebar-right')!,
    document.getElementById('status')!,
    viewer,
    history
  );

  SAMPLES[0].load().then((img) => {
    model.appData.originalImage = img;
    if (model.appData.assetsReady && !model.appData.defaultClickerLoaded) reprocess();
  });
}
