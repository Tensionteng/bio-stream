<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { ElIcon } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { fetchFileStatistics } from '@/service/api/file';

// ==================== 本地状态 ====================
// 文件统计数据
const totalFileCount = ref(0); // 总文件数量
const totalFileSize = ref(0); // 总文件大小（字节）
const lastUploadTime = ref(''); // 最后上传时间

/**
 * 格式化文件大小，自适应 B, KB, MB, GB, TB 等单位
 * 使用对数函数自动计算适合的单位
 * @param bytes 文件大小（字节）
 * @param decimals 小数位，默认为 2
 * @returns 格式化后的文件大小字符串
 */
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 B';

  const k = 1024; // 1KB = 1024B
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  // 计算单位索引：通过对数计算文件大小应该显示的单位
  // Math.log(bytes) / Math.log(k) 得出单位级数
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // 返回格式化结果：值 + 单位
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
};

/**
 * 从后端获取文件统计信息
 * 包括总数量、总大小、最后上传时间等
 */
async function fetchFileStats() {
  try {
    // 调用统计数据接口
    const res = await fetchFileStatistics();
    // 提取统计数据（单位：字节）
    totalFileCount.value = res.data?.total_files || 0;
    totalFileSize.value = res.data?.total_size || 0;
    lastUploadTime.value = res.data?.last_upload_time || 'N/A';
  } catch {
    // 出错时使用默认值
    totalFileCount.value = 0;
    totalFileSize.value = 0;
    lastUploadTime.value = 'N/A';
  }
}

// 组件挂载时获取统计数据
onMounted(() => {
  fetchFileStats();
});

// 向父组件暴露刷新方法
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
