import md5 from 'blueimp-md5';
import { fetchJson } from './http-client';

const MIXIN_ENCODE_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
];

let mixinKeyCache = '';
let mixinKeyExpireAt = 0;
const MIXIN_CACHE_TTL = 10 * 60 * 1000; // 10 分钟

async function ensureMixinKey() {
  const now = Date.now();
  if (mixinKeyCache && now < mixinKeyExpireAt) {
    return mixinKeyCache;
  }

  const { data } = await fetchJson('https://api.bilibili.com/x/web-interface/nav');
  const img = data?.wbi_img?.img_url || '';
  const sub = data?.wbi_img?.sub_url || '';

  const imgKey = img.split('/').pop()?.split('.')[0] || '';
  const subKey = sub.split('/').pop()?.split('.')[0] || '';

  const origin = `${imgKey}${subKey}`;
  if (!origin || origin.length < 64) {
    throw new Error('无法获取 WBI 密钥');
  }

  let mixin = '';
  for (const index of MIXIN_ENCODE_TABLE) {
    mixin += origin[index] || '';
  }
  mixinKeyCache = mixin.slice(0, 32);
  mixinKeyExpireAt = now + MIXIN_CACHE_TTL;

  return mixinKeyCache;
}

/**
 * 对参数添加 w_rid / wts
 * @param {Record<string, any>} params
 * @returns {Promise<Record<string, any>>}
 */
export async function withWbiSignature(params = {}) {
  const mixinKey = await ensureMixinKey();
  const signed = { ...params };
  signed.wts = Math.floor(Date.now() / 1000);

  const filteredEntries = Object.keys(signed)
    .sort()
    .map((key) => {
      let value = signed[key];
      if (value === undefined || value === null) {
        value = '';
      }
      const sanitized = String(value).replace(/[!'()*]/g, '');
      return [key, sanitized];
    });

  const queryString = filteredEntries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  signed.w_rid = md5(`${queryString}${mixinKey}`);

  return signed;
}

export function resetWbiCache() {
  mixinKeyCache = '';
  mixinKeyExpireAt = 0;
}
