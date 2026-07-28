import type { BuildContext } from '../buildContext';
import type { EdgeSetting, EdgeStyle } from '../../types';

export function createEdgeBevelBlock(ctx: BuildContext, footprint: any, r: number, _style: EdgeStyle, zRef: number, isBottom: boolean): any {
  const outer = ctx.grow(footprint, 0.6);
  const b = footprint.bounds(), W = b.max[0] - b.min[0], H = b.max[1] - b.min[1];
  const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
  const scaleX = W > 0.01 ? Math.max(0.01, (W - 2 * r) / W) : 1;
  const scaleY = H > 0.01 ? Math.max(0.01, (H - 2 * r) / H) : 1;
  
  const boundingVolume = ctx.track(ctx.wasm.Manifold.extrude(ctx.track(outer.translate([-cx, -cy])), r + 0.02));
  const partVolume = ctx.track(ctx.wasm.Manifold.extrude(ctx.track(footprint.translate([-cx, -cy])), r + 0.02, 0, 0, [scaleX, scaleY]));
  
  let cutter = ctx.track(boundingVolume.subtract(partVolume));
  cutter = ctx.track(cutter.translate([cx, cy, 0]));
  
  if (isBottom) cutter = ctx.track(cutter.translate([0, 0, -(r + 0.02) / 2]).scale([1, 1, -1]).translate([0, 0, (r + 0.02) / 2]));
  return ctx.track(cutter.translate([0, 0, isBottom ? zRef - 0.02 : zRef - r]));
}

export function applyEdges(ctx: BuildContext, bodyIn: any, edgeSettings: EdgeSetting[], footprint: any, bottomZ: number, topZ: number): any {
  let result = bodyIn;
  for (const es of edgeSettings) {
    if (es.style === 'none' || es.radius < 0.05) continue;
    const doBodyTop = es.target === 'baseTop' || es.target === 'base-body' || es.target === 'clickerBase';
    const doBodyBottom = es.target === 'baseBottom' || es.target === 'clickerBase';
    if (!doBodyTop && !doBodyBottom) continue;
    const r = Math.min(es.radius, (topZ - bottomZ) * 0.3, 2.5);
    if (r < 0.05) continue;
    if (doBodyTop) { const mb = createEdgeBevelBlock(ctx, footprint, r, es.style, topZ, false); if (mb) result = ctx.track(result.subtract(mb)); }
    if (doBodyBottom) { const mb = createEdgeBevelBlock(ctx, footprint, r, es.style, bottomZ, true); if (mb) result = ctx.track(result.subtract(mb)); }
  }
  return result;
}