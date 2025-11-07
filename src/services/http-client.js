/**
 * 简易的 B 站 API 客户端
 * 在浏览器扩展环境里发起跨域请求时，需要带上 cookie 以复用用户登录态。
 * @param {string} url
 * @param {Object} options
 * @param {'GET'|'POST'} [options.method]
 * @param {Object} [options.params]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.raw]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, { method = 'GET', params = {}, signal, raw = false } = {}) {
  let requestUrl = url;
  const fetchOptions = {
    method,
    credentials: 'include',
    signal
  };

  if (method === 'GET') {
    const search = new URLSearchParams(params);
    const query = search.toString();
    if (query) {
      const separator = url.includes('?') ? '&' : '?';
      requestUrl = `${url}${separator}${query}`;
    }
  } else {
    fetchOptions.headers = {
      'Content-Type': 'application/json'
    };
    fetchOptions.body = JSON.stringify(params);
  }

  const response = await fetch(requestUrl, fetchOptions);
  if (!response.ok) {
    throw new Error(`网络异常：HTTP ${response.status}`);
  }

  const data = raw ? await response.text() : await response.json();

  if (raw) {
    return data;
  }

  const code = typeof data.code === 'number' ? data.code : 0;
  if (code !== 0) {
    const message = data.message || data.msg || `接口返回错误码：${code}`;
    throw new Error(message);
  }

  return data;
}
