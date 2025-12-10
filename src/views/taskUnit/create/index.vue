<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElNotification, type UploadUserFile } from 'element-plus';
import { CircleCheckFilled, CircleCloseFilled, Document, UploadFilled, WarningFilled } from '@element-plus/icons-vue';
import { createTaskUnit } from '@/service/api/task_unit';
import type { TaskUnitFileResult } from '@/service/api/task_unit';

/**
 * # ==========================================
 *
 * 状态定义区域
 */
const fileList = ref<UploadUserFile[]>([]);
const isLoading = ref(false);
const resultDialogVisible = ref(false);
const uploadResults = ref<TaskUnitFileResult[]>([]);

const hasFiles = computed(() => fileList.value.length > 0);

/**
 * # ==========================================
 *
 * 工具函数
 */
const handleExceed = () => {
  ElMessage.warning('一次最多上传 20 个文件，如需更多请分批上传');
};

const clearFiles = () => {
  fileList.value = [];
};

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const handleDialogClose = () => {
  // 弹窗关闭回调
};

/**
 * # ==========================================
 *
 * 核心逻辑
 */
const handleSubmitUpload = async () => {
  const filesToUpload = fileList.value;

  if (filesToUpload.length === 0) {
    ElMessage.error('请至少选择一个 .py 文件');
    return;
  }

  const invalid = filesToUpload.find(f => !f.name.toLowerCase().endsWith('.py'));
  if (invalid) {
    ElMessage.error(`文件 "${invalid.name}" 不是 .py 文件，请检查后重新选择`);
    return;
  }

  isLoading.value = true;
  uploadResults.value = [];

  try {
    const rawFiles: File[] = filesToUpload.map(f => f.raw as File).filter(Boolean);
    const response = await createTaskUnit(rawFiles);

    if (response.error) {
      ElMessage.error(response.error.message || '上传请求失败');
      return;
    }

    const results = response.data?.task_unit_files || [];
    uploadResults.value = results;

    const failItems = results.filter((item: TaskUnitFileResult) => item.status === 'fail');
    const successItems = results.filter((item: TaskUnitFileResult) => item.status === 'success');

    if (failItems.length > 0) {
      resultDialogVisible.value = true;
      if (successItems.length > 0) {
        ElMessage.warning(`部分成功：${successItems.length} 个成功，${failItems.length} 个失败`);
      } else {
        ElMessage.error(`上传失败：${failItems.length} 个文件处理出错`);
      }
    } else {
      ElNotification({
        title: '全部创建成功',
        message: `成功创建 ${successItems.length} 个任务单元`,
        type: 'success'
      });
      clearFiles();
    }
  } catch (e: any) {
    console.error('Unexpected error during upload:', e);
    ElMessage.error('上传时发生未知错误');
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="task-unit-create-el">
    <ElCard shadow="never" class="create-card">
      <template #header>
        <div class="card-header">
          <span>创建任务单元</span>
          <span class="card-subtitle">支持批量上传 .py 文件，每个文件将创建一个任务单元</span>
        </div>
      </template>

      <div class="create-form-container">
        <div class="tips-panel">
          <div class="tips-title">使用说明</div>
          <ul class="tips-list">
            <li>
              每个
              <code>.py</code>
              文件对应一个任务单元，由后端解析脚本生成配置。
            </li>
            <li>文件名可作为任务单元的默认名称，建议命名清晰易读。</li>
            <li>支持一次上传多个文件</li>
          </ul>
        </div>

        <ElUpload
          v-model:file-list="fileList"
          drag
          :multiple="true"
          :limit="20"
          :auto-upload="false"
          accept=".py"
          class="upload-dragger"
          :on-exceed="handleExceed"
        >
          <div class="upload-inner">
            <ElIcon class="upload-icon">
              <UploadFilled />
            </ElIcon>
            <div class="upload-title">拖拽 .py 文件到这里</div>
            <div class="upload-subtitle">
              或
              <span class="upload-link">点击选择文件</span>
            </div>
            <div class="upload-tip">
              已选择
              <span class="upload-count">{{ fileList.length }}</span>
              个文件
            </div>
          </div>
          <template #tip>
            <div class="el-upload__tip custom-upload-tip">
              仅支持
              <strong>.py</strong>
              文件，单个文件不要过大。
            </div>
          </template>
        </ElUpload>

        <Transition name="fade">
          <div v-if="fileList.length" class="file-list-panel">
            <div class="file-list-header">
              <span>待上传列表（{{ fileList.length }}）</span>
              <ElButton link type="danger" size="small" @click="clearFiles">清空列表</ElButton>
            </div>
            <ul class="file-list">
              <li v-for="file in fileList" :key="file.uid" class="file-item">
                <span class="file-name" :title="file.name">
                  <ElIcon class="file-icon-s"><Document /></ElIcon>
                  {{ file.name }}
                </span>
                <span v-if="file.size" class="file-size">{{ formatSize(file.size) }}</span>
              </li>
            </ul>
          </div>
        </Transition>

        <div class="button-container">
          <ElButton
            class="primary-create-btn"
            type="primary"
            :loading="isLoading"
            :disabled="!hasFiles || isLoading"
            @click="handleSubmitUpload"
          >
            {{ isLoading ? '正在处理...' : '提交创建' }}
          </ElButton>
          <ElButton class="ghost-reset-btn" :disabled="!hasFiles || isLoading" @click="clearFiles">重置</ElButton>
        </div>
      </div>
    </ElCard>

    <ElDialog
      v-model="resultDialogVisible"
      title="处理结果详情"
      width="750px"
      align-center
      destroy-on-close
      class="result-dialog"
      @close="handleDialogClose"
    >
      <div class="dialog-tips">
        <ElIcon class="tips-icon"><WarningFilled /></ElIcon>
        <span>部分文件处理失败，请根据下方提示修正文件后重试。</span>
      </div>

      <ElTable
        :data="uploadResults"
        border
        style="width: 100%"
        max-height="500"
        :header-cell-style="{ background: '#f5f7fa', color: '#606266', fontWeight: '600' }"
        row-class-name="result-table-row"
      >
        <ElTableColumn prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <ElTag v-if="row.status === 'success'" type="success" effect="light" round size="small" class="status-tag">
              成功
            </ElTag>
            <ElTag v-else type="danger" effect="light" round size="small" class="status-tag">失败</ElTag>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="file_name" label="文件名" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="filename-cell" :class="{ 'is-fail': row.status === 'fail' }">
              <ElIcon class="file-icon"><Document /></ElIcon>
              <span class="text">{{ row.file_name }}</span>
            </div>
          </template>
        </ElTableColumn>

        <ElTableColumn label="返回信息" min-width="300">
          <template #default="{ row }">
            <div v-if="row.status === 'success'" class="success msg-box">
              <ElIcon class="msg-icon"><CircleCheckFilled /></ElIcon>
              <div class="msg-content">
                <div class="msg-title">创建成功</div>
                <div class="msg-desc">Task ID: {{ row.task_unit_id }}</div>
              </div>
            </div>

            <div v-else class="msg-box error">
              <ElIcon class="msg-icon"><CircleCloseFilled /></ElIcon>
              <div class="msg-content">
                <div class="msg-title">创建失败</div>
                <div class="msg-desc">{{ row.message || '未知错误' }}</div>
              </div>
            </div>
          </template>
        </ElTableColumn>
      </ElTable>

      <template #footer>
        <div class="dialog-footer">
          <ElButton @click="resultDialogVisible = false">关闭</ElButton>
          <ElButton type="primary" @click="resultDialogVisible = false">确定</ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* =========== 原有基础样式 =========== */
.task-unit-create-el {
  padding: 24px 28px 32px;
  background: linear-gradient(135deg, #f5f7fb 0%, #f0f4ff 50%, #fdfdff 100%);
  min-height: calc(100vh - 64px);
  box-sizing: border-box;
}

.create-card {
  width: 100%;
  margin: 0 auto;
  border-radius: 16px;
  border: none;
  box-shadow: 0 12px 30px rgba(18, 69, 143, 0.08);
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 600;
  font-size: 16px;
  color: #303133;
  position: relative;
  padding-left: 10px;
}

.card-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  width: 4px;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(180deg, #409eff, #66b1ff);
}

.card-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}

.create-form-container {
  margin: 8px auto 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tips-panel {
  background: #f7f9fe;
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid #e3e9ff;
}

.tips-title {
  font-size: 13px;
  font-weight: 600;
  color: #5062d9;
  margin-bottom: 4px;
}

.tips-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: #606266;
}

.tips-list li + li {
  margin-top: 2px;
}

/* Upload Area */
.upload-dragger {
  width: 100%;
}
.upload-inner {
  text-align: center;
  padding: 32px 12px;
}
:deep(.el-upload-dragger) {
  border-radius: 12px;
  border-style: dashed;
  border-color: #c0d3ff;
  background: radial-gradient(circle at top left, #f5f8ff 0, #ffffff 55%);
  transition: all 0.18s ease-in-out;
}
:deep(.el-upload-dragger:hover) {
  border-color: #409eff;
  box-shadow: 0 8px 20px rgba(64, 158, 255, 0.15);
  transform: translateY(-1px);
}
.upload-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.upload-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.upload-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #606266;
}
.upload-link {
  color: #409eff;
  font-weight: 500;
}
.upload-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.upload-count {
  color: #409eff;
  font-weight: 600;
}
.custom-upload-tip {
  text-align: left;
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

/* File List Preview */
.file-list-panel {
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fafbff;
  border: 1px dashed #d6ddff;
}
.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
}
.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 220px;
  overflow-y: auto;
}
.file-item {
  display: flex;
  align-items: center;
  font-size: 12px;
  padding: 4px 0;
  border-bottom: 1px dashed #eceefe;
}
.file-item:last-child {
  border-bottom: none;
}
.file-name {
  flex: 1;
  margin-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
}
.file-icon-s {
  margin-right: 4px;
  font-size: 13px;
  color: #909399;
}
.file-size {
  color: #909399;
  flex-shrink: 0;
}

/* Buttons */
.button-container {
  margin-top: 16px;
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 12px;
}
.primary-create-btn {
  min-width: 130px;
  height: 38px;
  border-radius: 999px;
  border: none;
  font-weight: 600;
  letter-spacing: 1px;
  font-size: 14px;
  background-image: linear-gradient(135deg, #8c9dff, #5c7cff);
  box-shadow: 0 8px 16px rgba(92, 124, 255, 0.35);
  transition: all 0.2s ease;
}
.primary-create-btn:not(.is-disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(92, 124, 255, 0.45);
  background-image: linear-gradient(135deg, #7b90ff, #4c6dff);
}
.primary-create-btn:not(.is-disabled):active {
  transform: translateY(0);
  box-shadow: 0 4px 12px rgba(92, 124, 255, 0.4);
}
.primary-create-btn.is-disabled {
  background-image: linear-gradient(135deg, #cbd5ff, #b9c6ff) !important;
  box-shadow: none;
}
.ghost-reset-btn {
  min-width: 96px;
  height: 38px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #d0d5eb;
  background: rgba(255, 255, 255, 0.9);
  color: #606266;
  transition: all 0.2s ease;
}
.ghost-reset-btn:not(.is-disabled):hover {
  background: #f5f7ff;
  border-color: #b9c6ff;
  color: #3a57d5;
  box-shadow: 0 4px 12px rgba(185, 198, 255, 0.4);
}
.ghost-reset-btn.is-disabled {
  background: rgba(255, 255, 255, 0.8);
  border-color: #e4e7ed;
  color: #c0c4cc;
  box-shadow: none;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* =========== 结果弹窗新样式 =========== */

/* 弹窗顶部提示 */
.dialog-tips {
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #fff8e6;
  border: 1px solid #faecd8;
  border-radius: 6px;
  font-size: 13px;
  color: #e6a23c;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tips-icon {
  font-size: 16px;
}

/* 状态标签 */
.status-tag {
  font-weight: 600;
  padding: 0 12px;
}

/* 文件名单元格 */
.filename-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
}
.filename-cell.is-fail {
  color: #f56c6c; /* 失败文件名变红，方便定位 */
  font-weight: 600;
}
.file-icon {
  font-size: 14px;
  color: #909399;
}
.filename-cell.is-fail .file-icon {
  color: #f56c6c;
}
.filename-cell .text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 核心：消息卡片样式 */
.msg-box {
  display: flex;
  align-items: flex-start;
  padding: 8px 12px;
  border-radius: 6px;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
}

/* 成功消息卡片 */
.msg-box.success {
  background-color: #f0f9eb;
  color: #67c23a;
  border: 1px solid transparent;
}
.msg-box.success .msg-icon {
  margin-top: 2px;
  font-size: 16px;
}
.msg-box.success .msg-title {
  font-weight: 600;
  margin-bottom: 2px;
}

/* 失败消息卡片 */
.msg-box.error {
  background-color: #fef0f0;
  border: 1px solid #fde2e2;
  color: #f56c6c;
}
.msg-box.error .msg-icon {
  margin-top: 3px;
  font-size: 16px;
  flex-shrink: 0;
}
.msg-box.error .msg-content {
  flex: 1;
  overflow: hidden; /* 防止溢出 */
}
.msg-box.error .msg-title {
  font-weight: 700;
  margin-bottom: 4px;
}
.msg-box.error .msg-desc {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace; /* 代码体，更适合展示报错 */
  word-break: break-all; /* 关键：强制换行，防止长英文报错不换行 */
  white-space: pre-wrap; /* 保留必要的格式 */
  font-size: 12px;
  opacity: 0.9;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
