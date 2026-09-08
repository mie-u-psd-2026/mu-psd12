// シート管理APIの呼び出しと共通エラーの処理。
// HTTP応答を検証し、JSON本文または空応答を返す。
async function request(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(path === '/ai' ? 120000 : 15000) });
  } catch {
    throw new Error('サーバーに接続できません。起動状態を確認してください。');
  }
  const content = await response.text();
  let data;
  try { data = content ? JSON.parse(content) : null; } catch { data = null; }
  if (!response.ok) {
    throw new Error(data?.error?.message || `サーバー処理に失敗しました（${response.status}）。`);
  }
  if (content && data === null) throw new Error('サーバーの応答がJSONではありません。');
  return data;
}

// シートAPIの各操作を返す。PUTはタイトルと本体を同じオブジェクトで送る。
export function useApiClient() {
  return {
    getSheets: () => request('/sheets'),
    createSheet: title => request('/sheet', 'POST', { title }),
    getSheet: id => request(`/sheet/${encodeURIComponent(id)}`),
    saveSheet: (id, body) => request(`/sheet/${encodeURIComponent(id)}`, 'PUT', body),
    getModels: () => request('/models'),
    getState: () => request('/state'),
    updateState: partial => request('/state', 'PUT', partial),
    deleteSheet: id => request(`/sheet/${encodeURIComponent(id)}`, 'DELETE'),
    requestAi: body => request('/ai', 'POST', body),
  };
}
