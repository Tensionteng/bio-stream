<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { ElIcon } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { fetchFileStatistics } from '@/service/api/file';

// 统计数据
const totalFileCount = ref(0);
const totalFileSize = ref(0);
const lastUploadTime = ref('');

/**
 * 格式化文件大小，自适应 B, KB, MB, GB, TB
 *
 * @param bytes 文件大小（字节）
 * @param decimals 小数位，默认为 2
 */
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  // 计算单位的索引：0=B, 1=KB, 2=MB, 3=GB, 4=TB
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
};

// 2. 获取文件统计信息
async function fetchFileStats() {
  try {
    // 假设接口返回 { total_files: 123, total_size: 4567890 (单位是字节) }
    const res = await fetchFileStatistics();
    totalFileCount.value = res.data?.total_files || 0;
    totalFileSize.value = res.data?.total_size || 0;
    lastUploadTime.value = res.data?.last_upload_time || 'N/A';
  } catch {
    totalFileCount.value = 0;
    totalFileSize.value = 0;
    lastUploadTime.value = 'N/A';
  }
}

onMounted(() => {
  fetchFileStats();
});

defineExpose({
  fetchFileStats
});
</script>

<template>
  <div class="stats-container">
    <div class="title-bar">
      <ElIcon class="title-icon" color="#409EFF"><UploadFilled /></ElIcon>
      <span class="main-title main-title-text">数据入湖</span>
    </div>

    <div class="stats-line">
      <span>入湖数据总数：</span>
      <b class="stats-num">{{ totalFileCount }}</b>
      <span class="stats-gap">总数据量：</span>

      <b class="stats-num">{{ formatBytes(totalFileSize) }}</b>

      <span class="stats-gap">最后上传时间：</span>
      <b class="stats-num">{{ lastUploadTime }}</b>
    </div>
  </div>
</template>

<style scoped>
.stats-container {
  width: 100%;
}

.title-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(12px, 2.2vh, 24px);
}

.title-icon {
  font-size: clamp(24px, 2.2vw, 36px);
  margin-right: 0.875rem;
}

.main-title-text {
  font-size: clamp(1.5rem, 2vw + 0.5rem, 2.25rem);
  letter-spacing: 0.06em;
}

.stats-line {
  text-align: center;
  margin-bottom: clamp(8px, 1.6vh, 16px);
  color: #666;
}

.stats-line .stats-num {
  color: #409eff;
}

.stats-line .stats-gap {
  margin-left: clamp(12px, 2.2vw, 24px);
}

@media (prefers-color-scheme: dark) {
  .stats-line {
    color: #b0b0b0;
  }
}
</style>
