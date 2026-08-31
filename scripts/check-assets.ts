import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

type Asset = { id: string; value?: number; productionPath: string; sourcePath: string | null; sourceSha256: string | null; productionSha256?: string; status: string };
const root = process.cwd();
const expectedValues = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
const manifest = JSON.parse(readFileSync(resolve(root, 'art/manifests/production-assets.json'), 'utf8')) as { assets: Asset[]; productionSha256: Record<string, string> };
const errors: string[] = [];
const sha256 = (path: string) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
function pngHasAlpha(path: string): boolean {
  const data = readFileSync(resolve(root, path));
  return data.length >= 29 && data.subarray(1, 4).toString() === 'PNG' && (data[25] === 4 || data[25] === 6);
}
const defenders = manifest.assets.filter(asset => asset.id.startsWith('DEFENDER_'));
if (defenders.length !== expectedValues.length || defenders.some(asset => !expectedValues.includes(asset.value ?? -1))) errors.push('Manifest Defender value set is incomplete.');
const outputHashes = new Set<string>();
for (const asset of defenders) {
  if (asset.status !== 'APPROVED_PRODUCTION') errors.push(`${asset.id} is not APPROVED_PRODUCTION.`);
  for (const [kind, path] of [['Production', asset.productionPath], ['Source', asset.sourcePath]] as const) if (!path || !existsSync(resolve(root, path))) errors.push(`${asset.id}: ${kind} file is missing: ${path ?? '(null)'}`);
  if (asset.sourcePath && asset.sourceSha256 && sha256(asset.sourcePath) !== asset.sourceSha256) errors.push(`${asset.id}: source SHA-256 mismatch.`);
  if (existsSync(resolve(root, asset.productionPath))) {
    if (!pngHasAlpha(asset.productionPath)) errors.push(`${asset.id}: production output is not an alpha PNG.`);
    const hash = sha256(asset.productionPath);
    if (!manifest.productionSha256[asset.productionPath]) errors.push(`${asset.id}: missing production SHA-256 in manifest.`);
    else if (hash !== manifest.productionSha256[asset.productionPath]) errors.push(`${asset.id}: production SHA-256 mismatch.`);
    if (outputHashes.has(hash)) errors.push(`${asset.id}: duplicate Defender production image SHA-256.`);
    outputHashes.add(hash);
  }
}
const office = manifest.assets.find(asset => asset.id === 'BACKGROUND_OFFICE_V1');
if (!office || office.status !== 'APPROVED_PRODUCTION') errors.push('Office background is not APPROVED_PRODUCTION; production runtime migration is intentionally blocked.');
else if (!existsSync(resolve(root, office.productionPath))) errors.push('Approved office background file is missing.');
const assetsTs = readFileSync(resolve(root, 'src/ui/assets.ts'), 'utf8');
const gameScene = readFileSync(resolve(root, 'src/game/GameScene.ts'), 'utf8');
if (!assetsTs.includes('defenders:') || !assetsTs.includes('assets/production/defenders/') || !gameScene.includes('ART.defenders')) {
  errors.push('Runtime Defender mapping has not yet switched to Production assets.');
}
// The approved office background is intentionally still missing. While that
// remains true, the runtime must use only the TEMP / REVIEW procedural scene,
// not silently fall back to the archived countryside background.
if (gameScene.includes("'battlefield-v0'") || gameScene.includes('ART.backgrounds.battlefieldV0')) {
  errors.push('Runtime background still references the archived battlefield_v0 asset.');
}
if (errors.length) { console.error('Asset check failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`Asset check passed: ${defenders.length} Defender assets and one office battlefield background.`);
