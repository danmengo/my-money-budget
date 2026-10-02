import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const cache = new Map();
export function loadTS(relative) {
  function load(file) {
    const source = ['', '.ts', '.tsx'].map(ext => file + ext).find(candidate => existsSync(candidate));
    if (!source) throw new Error(`Missing source: ${file}`);
    if (cache.has(source)) return cache.get(source);
    const { outputText } = ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } });
    const exports = {}; cache.set(source, exports);
    new Function('require', 'exports', outputText)(name => name.startsWith('@/') ? load(path.join(root, name.slice(2))) : name.startsWith('.') ? load(path.resolve(path.dirname(source), name)) : require(name), exports);
    return exports;
  }
  return load(path.resolve(root, relative));
}
