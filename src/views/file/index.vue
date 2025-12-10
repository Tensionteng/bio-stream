<script lang="ts" setup>
/**
 * index.vue - 文件管理页面主组件
 * 功能：
 * 1. 协调所有子组件（统计卡片、Schema选择、表单、文件列表等）
 * 2. 管理上传相关的全局状态和事件流
 * 3. 处理文件详情和世系图的模态框交互
 * 4. 初始化各子组件的数据加载
 * 
 * 页面布局：
 * - 左侧（45%）：统计信息 + Schema选择 + 表单填写 + 提交按钮
 * - 右侧（54%）：上传历史文件列表
 * - 浮动面板：上传任务进度条
 * - 模态框：文件详情、数据世系图
 */

import { onMounted, ref } from 'vue';
import { ElCard } from 'element-plus';

// ============ 子组件导入 ============
import StatsCard from './modules/StatsCard.vue';           // 文件统计卡片
import SchemaSelection from './modules/SchemaSelection.vue'; // 数据类型选择
import FormSection from './modules/FormSection.vue';       // 动态表单 + 文件上传
import UploadTaskPanel from './modules/UploadTaskPanel.vue'; // 上传任务面板
import FileList from './modules/FileList.vue';            // 文件列表
import FileDetailDialog from './modules/FileDetailDialog.vue'; // 文件详情弹窗
import LineageDialog from './modules/LineageDialog.vue'; // 世系图弹窗

// ============ 功能模块导入 ============
import { useFileUpload } from './modules/useFileUpload'; // 上传功能Composition API

// ============ 组件引用（用于调用子组件的公开方法） ============
const statsCardRef = ref();        // 统计卡片引用
const schemaSelectionRef = ref();  // Schema选择引用
const formSectionRef = ref();      // 表单引用
const fileListRef = ref();         // 文件列表引用
const fileDetailDialogRef = ref(); // 文件详情弹窗引用
const lineageDialogRef = ref();    // 世系图弹窗引用

// ============ 上传功能状态和事件处理器 ============
const { 
  uploadLoading,     // 上传中标志
  uploadTaskList,    // 上传任务列表
  handleBatchSubmit, // 批量提交处理器
  cancelUploadTask,  // 取消单个上传任务
  removeUploadTask   // 移除单个上传任务
} = useFileUpload();

// ============ 页面状态 ============
const selectedSchemaId = ref('');           // 选中的Schema ID
const selectedSchema = ref<any>(null);      // 选中的完整Schema对象
const fileDetailDialogVisible = ref(false); // 文件详情弹窗可见性
const lineageDialogVisible = ref(false);    // 世系图弹窗可见性
const currentLineageRow = ref<any>(null);   // 当前操作的文件行数据

// ============ 事件处理函数 ============

/**
 * 处理用户选择Schema事件
 * 功能：更新当前选中的Schema，触发表单重新渲染
 * @param {any} schema - 用户选中的数据类型Schema对象
 */
function handleSchemaSelected(schema: any) {
  selectedSchema.value = schema;
}

/**
 * 处理表单提交事件
 * 功能：收集表单数据和文件列表，调用上传接口进行批量上传
 * 流程：
 * 1. 获取表单中的所有数据（文本字段、文件字段、分组配置）
 * 2. 验证文本字段和文件字段
 * 3. 调用useFileUpload中的批量提交处理
 * 4. 上传成功后刷新文件列表
 */
async function handleFormSubmit() {
  if (formSectionRef.value) {
    // 调用上传hook的批量提交处理，传入表单数据和回调函数
    await handleBatchSubmit(
      formSectionRef.value.dynamicForm,           // 动态表单对象
      selectedSchema.value,                        // 当前选中的Schema
      formSectionRef.value.textFields,            // 文本字段映射
      formSectionRef.value.fileFields,            // 文件字段映射
      formSectionRef.value.fileFieldGroupSizes,   // 字段的分组大小配置
      (field) => formSectionRef.value.getUploadedFilesForField(field), // 获取字段文件的回调
      () => formSectionRef.value.validateFileFields(),   // 验证文件字段的回调
      () => formSectionRef.value.validateTextFields(),   // 验证文本字段的回调
      () => formSectionRef.value.resetForm(),           // 重置表单的回调
      () => {
        // 上传成功后的回调：刷新文件列表显示最新数据
        if (fileListRef.value) {
          fileListRef.value.fetchFileList();
        }
      }
    );
  }
}

/**
 * 处理查看文件详情事件
 * 功能：显示文件详情弹窗并加载指定文件的完整信息
 * @param {number} fileId - 要查看的文件ID
 */
function handleShowDetail(fileId: number) {
  fileDetailDialogVisible.value = true;
  if (fileDetailDialogRef.value) {
    fileDetailDialogRef.value.openDialog(fileId);
  }
}

/**
 * 处理查看文件世系图事件
 * 功能：显示数据世系图弹窗，展示该文件的数据流向关系
 * @param {any} row - 选中的文件行对象，包含file_id等信息
 */
function handleShowLineage(row: any) {
  lineageDialogVisible.value = true;
  currentLineageRow.value = row;
  if (lineageDialogRef.value) {
    lineageDialogRef.value.showLineage(row);
  }
}

/**
 * 处理取消上传任务事件
 * 功能：中止正在进行的文件上传
 * @param {string} taskId - 要取消的上传任务ID
 */
function handleCancelTask(taskId: string) {
  cancelUploadTask(taskId);
}

/**
 * 处理移除上传任务事件
 * 功能：从任务列表中移除已完成或失败的上传任务
 * @param {string} taskId - 要移除的上传任务ID
 */
function handleRemoveTask(taskId: string) {
  removeUploadTask(taskId);
}

/**
 * 生命周期：组件挂载
 * 功能：初始化各子组件的数据加载
 * - 加载文件统计信息
 * - 初始化Schema选择组件
 * - 加载文件列表
 */
onMounted(() => {
  // 初始化文件统计卡片：加载文件数量、总大小、最近上传时间等
  if (statsCardRef.value) {
    statsCardRef.value.fetchFileStats();
  }
  // 初始化Schema选择组件：加载所有可用的数据类型
  if (schemaSelectionRef.value) {
    schemaSelectionRef.value.init();
  }
  // 初始化文件列表：加载历史上传文件
  if (fileListRef.value) {
    fileListRef.value.init();
  }
});
</script>

<template>
  <div class="transfer-container equal-height-flex">
    <!-- 主功能区 -->
    <ElCard shadow="hover" class="transfer-card main-card">
      <!-- 统计信息 -->
      <StatsCard ref="statsCardRef" />

      <!-- 数据类型选择 -->
      <SchemaSelection
        ref="schemaSelectionRef"
        :model-value="selectedSchemaId"
        @update:model-value="selectedSchemaId = $event"
        @schema-selected="handleSchemaSelected"
      />

      <!-- 表单填写和文件上传 -->
      <FormSection
        ref="formSectionRef"
        :schema="selectedSchema"
        @upload-start="uploadLoading = true"
        @upload-complete="uploadLoading = false"
      />

      <!-- 未选择数据类型时的提示 -->
      <div v-if="!selectedSchema" class="empty-prompt">
        <div class="prompt-icon">📋</div>
        <div class="prompt-title">请选择数据类型</div>
        <div class="prompt-desc">选择数据类型后，将显示对应的表单字段和文件上传选项</div>
      </div>

      <!-- 提交按钮 -->
      <div v-if="selectedSchema" class="submit-button-area">
        <ElButton type="primary" :loading="uploadLoading" size="large" @click="handleFormSubmit">提交并上传</ElButton>
      </div>
    </ElCard>

    <!-- 文件列表区域 -->
    <div class="history-list-area">
      <ElCard shadow="hover" class="history-card">
        <FileList
          ref="fileListRef"
          @detail="handleShowDetail"
          @lineage="handleShowLineage"
        />
      </ElCard>
    </div>

    <!-- 上传任务面板 -->
    <UploadTaskPanel :tasks="uploadTaskList" @cancel-task="handleCancelTask" @remove-task="handleRemoveTask" />

    <!-- 文件详情弹窗 -->
    <FileDetailDialog
      ref="fileDetailDialogRef"
      :model-value="fileDetailDialogVisible"
      @update:model-value="fileDetailDialogVisible = $event"
    />

    <!-- 数据世系展示弹窗 -->
    <LineageDialog
      ref="lineageDialogRef"
      :model-value="lineageDialogVisible"
      :row="currentLineageRow"
      @update:model-value="lineageDialogVisible = $event"
    />
  </div>
</template>

<style scoped>
.equal-height-flex {
  padding: 1% 1% 1% 1%;
  display: flex;
  gap: 1%;
  align-items: stretch;
  flex-wrap: wrap;
}

.main-card {
  flex: 0 1 45%;
  min-width: 320px;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  box-sizing: border-box;
  border-radius: 20px;
  box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.1);
  padding: clamp(16px, 3vw, 38px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px);
  background: var(--el-bg-color, #fafcff);
  transition: background 0.3s;
}

.submit-button-area {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.empty-prompt {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 200px;
  margin-top: 20px;
  padding: 40px 20px;
  border: 2px dashed #c0c4cc;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.05) 0%, rgba(64, 158, 255, 0) 100%);
}

.prompt-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.7;
}

.prompt-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 8px;
}

.prompt-desc {
  font-size: 14px;
  color: #909399;
  text-align: center;
}

.history-list-area {
  flex: 0 1 54%;
  min-width: 320px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-left: 0;
  box-sizing: border-box;
}

.history-card {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow: visible;
  height: 100%;
  border-radius: 20px;
  box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.1);
  padding: clamp(16px, 3vw, 38px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px);
  background: var(--el-bg-color, #fafcff);
}

@media (max-width: 768px) {
  .main-card,
  .history-card {
    flex: 0 1 100% !important;
    min-width: 100% !important;
  }

  .equal-height-flex {
    flex-direction: column;
  }
}

@media (prefers-color-scheme: dark) {
  .main-card,
  .history-card {
    background: var(--el-bg-color-overlay, #232324);
  }
}

:deep(.el-button[type='primary']) {
  border-radius: 6px;
  font-weight: 500;
  height: 2.25rem;
  line-height: 1;
}
</style>
