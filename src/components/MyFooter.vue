<script setup>
import { computed, onMounted, ref } from 'vue';
import MyModal from '@/components/modal/MyModal.vue';
import { downloadLatestPackage, fetchCurrentManifestMd5, fetchRemoteVersionInfo } from '@/services/version-service';

const currentVersion = ref(import.meta.env.VITE_APP_VERSION || '');
const administratorEmail = ref(import.meta.env.VITE_ADMIN_EMAIL || '');
const currentMd5 = ref('');
const remoteVersion = ref('');
const remoteMd5 = ref('');
const downloadedMd5 = ref('');
const downloadedVersion = ref('');
const downloadSize = ref(0);
const downloadStatus = ref('idle');
const statusMessage = ref('');
const lastDownloadedAt = ref('');
const showUpdateModal = ref(false);
const promptedVersion = ref('');

const UPDATE_INFO_STORAGE_KEY = 'bll-extension-update-info';

const needsUpdate = computed(() => {
  if (!remoteVersion.value || !currentVersion.value) {
    return false;
  }
  return remoteVersion.value.trim() !== currentVersion.value.trim();
});

const formattedDownloadSize = computed(() => {
  const size = downloadSize.value;
  if (!size) {
    return '';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
});

const statusBadgeClass = computed(() => {
  switch (downloadStatus.value) {
    case 'downloading':
      return 'text-warning';
    case 'downloaded':
    case 'up_to_date':
      return 'text-success';
    case 'update_available':
      return 'text-primary';
    case 'error':
      return 'text-danger';
    default:
      return 'text-muted';
  }
});

const isDownloading = computed(() => downloadStatus.value === 'downloading');

onMounted(async () => {
  loadCachedUpdateInfo();
  await computeCurrentMd5();
  await checkForUpdates();
});

function loadCachedUpdateInfo() {
  const cached = readStoredUpdateInfo();
  if (!cached) {
    return;
  }
  downloadedMd5.value = cached.md5 || '';
  downloadSize.value = cached.size || 0;
  lastDownloadedAt.value = cached.downloadedAt || '';
  downloadedVersion.value = cached.version || '';
}

function readStoredUpdateInfo() {
  try {
    const raw = localStorage.getItem(UPDATE_INFO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('[VersionUpdate] 读取缓存失败', error);
    return null;
  }
}

function persistUpdateInfo(info) {
  try {
    localStorage.setItem(UPDATE_INFO_STORAGE_KEY, JSON.stringify(info));
  } catch (error) {
    console.warn('[VersionUpdate] 缓存写入失败', error);
  }
}

async function computeCurrentMd5() {
  try {
    currentMd5.value = await fetchCurrentManifestMd5();
  } catch (error) {
    console.error('[VersionUpdate] 计算本地 MD5 失败', error);
    currentMd5.value = '计算失败';
  }
}

async function checkForUpdates() {
  downloadStatus.value = 'checking';
  statusMessage.value = '正在检查远程版本...';
  try {
    const info = await fetchRemoteVersionInfo();
    remoteVersion.value = info.version;
    remoteMd5.value = info.md5 || '';

    if (needsUpdate.value) {
      downloadStatus.value = 'update_available';
      statusMessage.value = '检测到新版本，请点击下载更新包';
      promptUpdateModal();
    } else {
      downloadStatus.value = 'up_to_date';
      statusMessage.value = '当前已是最新版本';
      downloadedMd5.value = currentMd5.value;
      downloadedVersion.value = currentVersion.value;
      downloadSize.value = 0;
    }
  } catch (error) {
    console.error('[VersionUpdate] 版本检查失败', error);
    downloadStatus.value = 'error';
    statusMessage.value = error.message || '版本检查失败';
  }
}

function promptUpdateModal() {
  if (!remoteVersion.value) {
    return;
  }
  if (promptedVersion.value === remoteVersion.value) {
    return;
  }
  promptedVersion.value = remoteVersion.value;
  showUpdateModal.value = true;
}

async function startDownloadUpdate() {
  if (!remoteVersion.value || isDownloading.value) {
    return;
  }
  downloadStatus.value = 'downloading';
  statusMessage.value = '下载更新包中，请稍候...';
  try {
    const result = await downloadLatestPackage();
    downloadedMd5.value = result.md5;
    downloadSize.value = result.size;
    lastDownloadedAt.value = Date.now();
    downloadedVersion.value = remoteVersion.value;
    persistUpdateInfo({
      version: remoteVersion.value,
      md5: result.md5,
      size: result.size,
      downloadedAt: lastDownloadedAt.value
    });
    downloadStatus.value = 'downloaded';
    statusMessage.value = '最新版本已下载，请在扩展管理页面手动替换';
    showUpdateModal.value = false;
  } catch (error) {
    console.error('[VersionUpdate] 下载失败', error);
    downloadStatus.value = 'error';
    statusMessage.value = error.message || '下载失败';
  }
}

function formatTimestamp(ts) {
  if (!ts) {
    return '';
  }
  try {
    return new Date(ts).toLocaleString();
  } catch (error) {
    return '';
  }
}

function handleDownloadButtonClick() {
  if (!needsUpdate.value) {
    return;
  }
  showUpdateModal.value = true;
}
</script>

<template>
  <div>
    <div class="footer border-top position-absolute bottom-0 w-100 bg-white py-2">
      <div class="row justify-content-center text-center g-2">
        <div class="col-auto small">
          当前版本 <span>{{ currentVersion || '-' }}</span>
        </div>
        <div class="col-auto small">
          本地 MD5
          <span v-if="currentMd5">{{ currentMd5 }}</span>
          <span v-else class="text-muted">计算中...</span>
        </div>
        <div class="col-auto small">
          最新版本 <span>{{ remoteVersion || '-' }}</span>
        </div>
        <div class="col-auto small" v-if="remoteMd5">
          最新版本 MD5 <span>{{ remoteMd5 }}</span>
        </div>
      </div>

      <div class="row justify-content-center text-center g-2 mt-1">
        <div class="col-12 col-md-auto small" :class="statusBadgeClass">
          {{ statusMessage }}
        </div>
        <div class="col-12 col-md-auto small text-break" v-if="downloadedMd5">
          下载包 MD5 <span>{{ downloadedMd5 }}</span>
          <span v-if="formattedDownloadSize">（{{ formattedDownloadSize }}）</span>
        </div>
        <div class="col-12 col-md-auto small text-muted" v-if="downloadedVersion">
          下载包版本 {{ downloadedVersion }}
        </div>
        <div class="col-12 col-md-auto small text-muted" v-if="lastDownloadedAt">
          上次下载 {{ formatTimestamp(lastDownloadedAt) }}
        </div>
        <div class="col-12 col-md-auto" v-if="needsUpdate">
          <button class="btn btn-outline-primary btn-sm" type="button" @click="handleDownloadButtonClick"
            :disabled="isDownloading">
            下载最新版
          </button>
        </div>
      </div>

      <div class="row justify-content-center mt-1">
        <div class="col-auto small">
          问题反馈邮箱 <span>{{ administratorEmail }}</span>
        </div>
      </div>
    </div>

    <my-modal title="发现新版本" :show="showUpdateModal" :show_cancel_button="true" :show_confirm_button="true"
    :confirm_text="isDownloading ? '下载中...' : '立即下载'" :cancel_text="isDownloading ? '关闭' : '暂不'"
    :show_loading_icon="isDownloading" @close="showUpdateModal = false" @confirm="startDownloadUpdate">
      <template #content>
        <p class="mb-1">当前版本：{{ currentVersion || '-' }}</p>
        <p class="mb-1">最新版本：<strong>{{ remoteVersion }}</strong></p>
        <p class="mb-1" v-if="remoteMd5">远程 MD5：{{ remoteMd5 }}</p>
        <p class="mb-0 text-muted" v-if="!isDownloading">点击「立即下载」后会拉取新版压缩包，由浏览器保存到下载目录。</p>
        <p class="mb-0 text-muted" v-else>下载完成后请在扩展管理页替换为新版本。</p>
      </template>
    </my-modal>
  </div>
</template>

<style scoped>
.text-break {
  word-wrap: break-word;
  word-break: break-all;
}
</style>
