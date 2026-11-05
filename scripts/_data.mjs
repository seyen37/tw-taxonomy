// Node 端共用：讀取 data/ 並建立索引
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = path.join(ROOT, 'data');
export const TWT = createRequire(import.meta.url)(path.join(ROOT, 'lib', 'taxonomy.js'));

const read = (f) => JSON.parse(readFileSync(path.join(DATA, f), 'utf8'));

export function loadData() {
  return {
    topics: read('topics.json').topics,
    dependencies: read('dependencies.json').dependencies,
    clusters: read('clusters.json').clusters,
    standards: read('curriculum-standards.json').subjects,
  };
}

export const loadIndex = () => TWT.createIndex(loadData());
