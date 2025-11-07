import md5 from 'blueimp-md5';

const DEFAULT_VERSION_URL = 'https://www.modelscope.cn/models/sakmist/Bilibili-Lottery-Local-Extension/resolve/master/verson';
const DEFAULT_PACKAGE_URL = 'https://www.modelscope.cn/models/sakmist/Bilibili-Lottery-Local-Extension/resolve/master/Bilibili-Lottery-Local-Extension.zip';
const DEFAULT_PACKAGE_FILENAME = 'Bilibili-Lottery-Local-Extension.zip';

const VERSION_CHECK_URL = import.meta.env.VITE_VERSION_CHECK_URL || DEFAULT_VERSION_URL;
const UPDATE_PACKAGE_URL = import.meta.env.VITE_UPDATE_PACKAGE_URL || DEFAULT_PACKAGE_URL;
const UPDATE_PACKAGE_FILENAME = import.meta.env.VITE_UPDATE_PACKAGE_FILENAME || DEFAULT_PACKAGE_FILENAME;

function parseRemoteVersionPayload(text) {
  if (!text) {
    return {};
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const payload = JSON.parse(trimmed);
    const version = typeof payload.version === 'string' ? payload.version.trim() : '';
    const remoteMd5 = typeof payload.md5 === 'string' ? payload.md5.trim() : '';
    return { version, md5: remoteMd5 };
  } catch (error) {
    return { version: trimmed };
  }
}

export async function fetchRemoteVersionInfo() {
  if (!VERSION_CHECK_URL) {
    throw new Error('未配置版本号查询地址');
  }
  const response = await fetch(VERSION_CHECK_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`版本检查失败：HTTP ${response.status}`);
  }
  const text = await response.text();
  const info = parseRemoteVersionPayload(text);
  if (!info.version) {
    throw new Error('远程版本号为空');
  }
  return info;
}

export async function fetchCurrentManifestMd5() {
  const manifestUrl = `${import.meta.env.BASE_URL}manifest.json`;
  const response = await fetch(manifestUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('无法读取插件 manifest.json');
  }
  const manifestText = await response.text();
  return md5(manifestText);
}

function triggerBlobDownload(blob, filename) {
  if (typeof document === 'undefined') {
    throw new Error('当前环境不支持下载更新包');
  }
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export async function downloadLatestPackage() {
  if (!UPDATE_PACKAGE_URL) {
    throw new Error('未配置更新包下载地址');
  }

  const response = await fetch(UPDATE_PACKAGE_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`下载更新包失败：HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const fileHash = md5(buffer);
  const blob = new Blob([buffer], { type: 'application/zip' });
  const filename = UPDATE_PACKAGE_FILENAME || 'update.zip';

  triggerBlobDownload(blob, filename);

  return {
    md5: fileHash,
    size: buffer.byteLength,
    fileName: filename
  };
}
