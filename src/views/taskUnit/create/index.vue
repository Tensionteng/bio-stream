<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElNotification, type UploadUserFile } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { createTaskUnit } from '@/service/api/task_unit';

const fileList = ref<UploadUserFile[]>([]);
const isLoading = ref(false);

const hasFiles = computed(() => fileList.value.length > 0);

/** 超出数量提示 */
const handleExceed = () => {
  ElMessage.warning('一次最多上传 20 个文件，如需更多请分批上传');
};

/** 清空文件列表 */
const clearFiles = () => {
  fileList.value = [];
};

/** 文件大小格式化（仅用于显示） */
const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

/** 点击 "提交创建" 按钮 */
const handleSubmitUpload = async () => {
  const filesToUpload = fileList.value;

  if (filesToUpload.length === 0) {
    ElMessage.error('请至少选择一个 .py 文件');
    return;
  }

  // 校验扩展名
  const invalid = filesToUpload.find(f => !f.name.toLowerCase().endsWith('.py'));
  if (invalid) {
    ElMessage.error(`文件 "${invalid.name}" 不是 .py 文件，请检查后重新选择`);
    return;
  }

  isLoading.value = true;

  try {
    const rawFiles: File[] = filesToUpload.map(f => f.raw as File).filter(Boolean);

    const response = await createTaskUnit(rawFiles);

    if (response.error) {
      console.error('Upload failed:', response.error);
      return;
    }

    const results = response.data?.task_unit_files || [];
    // 显示：ID(文件名)，你后端返回的 status/message 也已经在 results 里了
    const resultInfo = results
      .filter(item => item.task_unit_id && item.task_unit_id !== 0)
      .map(item => `${item.task_unit_id} (${item.file_name})`)
      .join(', ');

    ElNotification({
      title: '创建成功',
      message: resultInfo ? `任务单元已创建，${resultInfo}` : '任务单元已创建',
      type: 'success'
    });

    clearFiles();
    // 如果需要刷新列表，可以在这里调用 fetchTaskUnits();
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
        <!-- 顶部说明 -->
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

        <!-- 上传区域 -->
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
              文件，单个文件不要过大，避免创建超时。
            </div>
          </template>
        </ElUpload>

        <!-- 已选文件列表（简洁预览） -->
        <Transition name="fade">
          <div v-if="fileList.length" class="file-list-panel">
            <div class="file-list-header">
              <span>待创建的任务单元（{{ fileList.length }}）</span>
              <ElButton link type="danger" size="small" @click="clearFiles">清空列表</ElButton>
            </div>
            <ul class="file-list">
              <li v-for="file in fileList" :key="file.uid" class="file-item">
                <span class="file-name" :title="file.name">
                  {{ file.name }}
                </span>
                <span v-if="file.size" class="file-size">
                  {{ formatSize(file.size) }}
                </span>
              </li>
            </ul>
          </div>
        </Transition>

        <!-- 底部按钮 -->
        <div class="button-container">
          <ElButton
            class="primary-create-btn"
            type="primary"
            :loading="isLoading"
            :disabled="!hasFiles || isLoading"
            @click="handleSubmitUpload"
          >
            {{ isLoading ? '正在创建...' : '提交创建' }}
          </ElButton>
          <ElButton class="ghost-reset-btn" :disabled="!hasFiles || isLoading" @click="clearFiles">重置</ElButton>
        </div>
      </div>
    </ElCard>
  </div>
</template>

<style scoped>
.task-unit-create-el {
  padding: 24px 28px 32px;
  background: linear-gradient(135deg, #f5f7fb 0%, #f0f4ff 50%, #fdfdff 100%);
  min-height: calc(100vh - 64px);
  box-sizing: border-box;
}

.create-card {
  width: 100%;
  margin: 0 auto; /* 在内容区域里左右居中 */
  border-radius: 16px;
  border: none;
  box-shadow: 0 12px 30px rgba(18, 69, 143, 0.08);
}

/* 头部：标题 + 副标题 */
.card-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
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

/* 内容主体 */
.create-form-container {
  margin: 8px auto 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 顶部说明面板 */
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

/* 上传区域 */
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

/* 底部提示 */
.custom-upload-tip {
  text-align: left;
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

/* 已选文件列表 */
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
  justify-content: space-between;
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
}

.file-size {
  color: #909399;
  flex-shrink: 0;
}

/* 按钮区域 */
.button-container {
  margin-top: 16px;
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 12px;
}

/* 主要按钮：圆角 + 渐变 + 阴影 */
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

/* hover & focus 状态 */
.primary-create-btn:not(.is-disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(92, 124, 255, 0.45);
  background-image: linear-gradient(135deg, #7b90ff, #4c6dff);
}

/* 点击态 */
.primary-create-btn:not(.is-disabled):active {
  transform: translateY(0);
  box-shadow: 0 4px 12px rgba(92, 124, 255, 0.4);
}

/* 禁用态 */
.primary-create-btn.is-disabled {
  background-image: linear-gradient(135deg, #cbd5ff, #b9c6ff) !important;
  box-shadow: none;
}

/* 次要按钮：浅描边 + 透明背景 */
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

/* 次要按钮 hover */
.ghost-reset-btn:not(.is-disabled):hover {
  background: #f5f7ff;
  border-color: #b9c6ff;
  color: #3a57d5;
  box-shadow: 0 4px 12px rgba(185, 198, 255, 0.4);
}

/* 次要按钮禁用态 */
.ghost-reset-btn.is-disabled {
  background: rgba(255, 255, 255, 0.8);
  border-color: #e4e7ed;
  color: #c0c4cc;
  box-shadow: none;
}

/* 淡入动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
