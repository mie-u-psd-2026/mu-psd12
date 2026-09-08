// テストだけでCDNの代わりに同一バージョンのnpmモジュールを解決する。
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
// 通常はtestsの依存関係を使い、検証環境では指定された既存依存関係を利用する。
const require = createRequire(process.env.UI_TEST_MODULES ? `${process.env.UI_TEST_MODULES}/package.json` : import.meta.url);
// アプリのVueとテストのVueを同じインスタンスに解決する。
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'vue') {
    const url = pathToFileURL(require.resolve('vue')).href;
    const source = `import Vue from '${url}'; export const { ref, reactive, computed, shallowRef, watch, nextTick, onMounted, onBeforeUnmount, createApp, compile, effectScope } = Vue; export default Vue;`;
    return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
  }
  if (['jsdom', 'feather-icons'].includes(specifier)) {
    return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

// ビルドなしのブラウザ用.jsファイルを、テスト時だけESモジュールとして読む。
export async function load(url, context, nextLoad) {
  if (url.startsWith(new URL('../', import.meta.url).href) && url.endsWith('.js') && !url.includes('/node_modules/')) {
    const { readFile } = await import('node:fs/promises');
    return { format: 'module', source: await readFile(new URL(url), 'utf8'), shortCircuit: true };
  }
  return nextLoad(url, context);
}
