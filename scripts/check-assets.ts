import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

type Asset = {
  id: string; value?: number; productionPath: string; sourcePath: string | null;
  sourceSha256: string | null; productionSha256?: string; status: string;
};
type Manifest = { assets: Asset[]; productionSha256: Record<string, string> };

const root = process.cwd();
const expectedDefenders = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
const expectedEnemies = ['ENEMY_01_CONTRACT', 'ENEMY_02_KPI', 'ENEMY_03_MEETING', 'ENEMY_04_APPROVAL', 'ENEMY_05_REPORT', 'ENEMY_06_RANKING', 'ENEMY_07_EXECUTIVE', 'ENEMY_08_SYSTEM_CORE'];
const manifest = JSON.parse(readFileSync(resolve(root, 'art/manifests/production-assets.json'), 'utf8')) as Manifest;
const errors: string[] = [];
const notices: string[] = [];
const sha256 = (path: string) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');

function pngHasAlpha(path: string): boolean {
  const data = readFileSync(resolve(root, path));
  return data.length >= 29 && data.subarray(1, 4).toString() === 'PNG' && (data[25] === 4 || data[25] === 6);
}

function validateDerived(asset: Asset, requireAlpha: boolean, seen?: Set<string>) {
  for (const [kind, path] of [['derived', asset.productionPath], ['source', asset.sourcePath]] as const) {
    if (!path || !existsSync(resolve(root, path))) errors.push(`${asset.id}: ${kind} file missing: ${path ?? '(null)'}`);
  }
  if (asset.sourcePath && asset.sourceSha256 && existsSync(resolve(root, asset.sourcePath)) && sha256(asset.sourcePath) !== asset.sourceSha256) errors.push(`${asset.id}: source SHA-256 mismatch.`);
  if (!existsSync(resolve(root, asset.productionPath))) return;
  const hash = sha256(asset.productionPath);
  if (!manifest.productionSha256[asset.productionPath]) errors.push(`${asset.id}: derived SHA-256 absent from manifest.`);
  else if (hash !== manifest.productionSha256[asset.productionPath]) errors.push(`${asset.id}: derived SHA-256 mismatch.`);
  if (requireAlpha && !pngHasAlpha(asset.productionPath)) errors.push(`${asset.id}: expected an alpha PNG.`);
  if (seen?.has(hash)) errors.push(`${asset.id}: duplicate production image SHA-256.`);
  seen?.add(hash);
}

const defenders = manifest.assets.filter(asset => asset.id.startsWith('DEFENDER_'));
if (defenders.length !== expectedDefenders.length || defenders.some(asset => !expectedDefenders.includes(asset.value ?? -1))) errors.push('Manifest Defender value set is incomplete.');
const defenderHashes = new Set<string>();
for (const asset of defenders) {
  if (asset.status !== 'APPROVED_PRODUCTION') errors.push(`${asset.id} is not APPROVED_PRODUCTION.`);
  validateDerived(asset, true, defenderHashes);
}

const enemies = manifest.assets.filter(asset => asset.id.startsWith('ENEMY_'));
if (enemies.length !== expectedEnemies.length || expectedEnemies.some(id => !enemies.some(asset => asset.id === id))) errors.push('Manifest Enemy visual set is incomplete.');
const enemyHashes = new Set<string>();
for (const asset of enemies) {
  if (asset.status !== 'APPROVED_PRODUCTION') errors.push(`${asset.id} is not APPROVED_PRODUCTION.`);
  validateDerived(asset, true, enemyHashes);
}

const office = manifest.assets.find(asset => asset.id === 'BACKGROUND_OFFICE_V1');
if (!office) errors.push('Office background asset is absent from manifest.');
else if (office.status === 'MISSING_PRODUCTION_ASSET') errors.push('Office background has not been ingested.');
else if (office.status === 'PRODUCTION_CANDIDATE_REVIEW') {
  validateDerived(office, false);
  notices.push('Office background is a valid REVIEW CANDIDATE awaiting user art approval.');
} else if (office.status === 'APPROVED_PRODUCTION') validateDerived(office, false);
else errors.push(`Office background has unknown status ${office.status}.`);

const assetsTs = readFileSync(resolve(root, 'src/ui/assets.ts'), 'utf8');
const gameScene = readFileSync(resolve(root, 'src/game/GameScene.ts'), 'utf8');
if (!assetsTs.includes('defenders:') || !assetsTs.includes('assets/production/defenders/') || !gameScene.includes('ART.defenders')) errors.push('Runtime Defender mapping has not switched to Production assets.');
if (!assetsTs.includes('assets/production/enemies/') || !gameScene.includes('ART.enemies')) errors.push('Runtime Enemy mapping has not switched to recovered Production art.');
if (!assetsTs.includes('assets/production/backgrounds/battlefield_office_v1.png') || !gameScene.includes('ART.backgrounds.officeReview')) errors.push('Runtime office background is not wired to its Production asset.');
if (gameScene.includes("'battlefield-v0'") || gameScene.includes('ART.backgrounds.legacyCountryside') || gameScene.includes('ART.tempExperienceEnemies')) errors.push('Runtime still references archived countryside or TEMP enemy art.');
if (errors.length) { console.error('Asset check failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`Asset check passed: ${defenders.length} approved Defenders, ${enemies.length} recovered approved Enemies.`);
for (const notice of notices) console.log(`Review notice: ${notice}`);
