import { sleep } from '@/utils/utils';

const REQUEST_PAUSE_RULES = [
  { threshold: 1000, delay: 30_000 },
  { threshold: 100, delay: 5_000 }
].map((rule) => ({
  ...rule,
  nextTrigger: rule.threshold
}));

let requestCounter = 0;
const throttleListeners = new Set();

export function onThrottlePause(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  throttleListeners.add(listener);
  return () => {
    throttleListeners.delete(listener);
  };
}

function notifyThrottle(info) {
  for (const listener of throttleListeners) {
    try {
      listener(info);
    } catch (error) {
      console.error('[ThrottleNotifier] listener error:', error);
    }
  }
}

async function pauseIfNeeded() {
  if (requestCounter === 0) {
    return;
  }

  for (const rule of REQUEST_PAUSE_RULES) {
    if (requestCounter >= rule.nextTrigger) {
      const overshoot = requestCounter - rule.nextTrigger;
      const extraTriggers = Math.floor(overshoot / rule.threshold);
      rule.nextTrigger += rule.threshold * (extraTriggers + 1);

      notifyThrottle({
        threshold: rule.threshold,
        delay: rule.delay,
        requestCount: requestCounter
      });
      // console.warn(`[HTTP Client] Reached ${requestCounter} requests, pausing for ${rule.delay} ms to avoid rate limiting.`);
      await sleep(rule.delay);
      break;
    }
  }
}

export async function incrementThrottleCounter(step = 1) {
  const increment = Number(step);
  if (!Number.isFinite(increment) || increment <= 0) {
    return;
  }
  requestCounter += Math.floor(increment);
  await pauseIfNeeded();
}

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

  try {
    const response = await fetch(requestUrl, fetchOptions);
    // console.debug(requestCounter,'[HTTP Client] Request:', requestUrl, fetchOptions);
    if (!response.ok) {
      const error = new Error(`网络异常：HTTP ${response.status}`);
      error.status = response.status;
      error.url = requestUrl;
      throw error;
    }

    const data = raw ? await response.text() : await response.json();

    if (raw) {
      return data;
    }

    const code = typeof data.code === 'number' ? data.code : 0;
    if (code !== 0) {
      const error = new Error(data.message || data.msg || `接口返回错误码：${code}`);
      error.code = code;
      error.url = requestUrl;
      throw error;
    }

    return data;
  } finally {
    await incrementThrottleCounter();
  }
}
