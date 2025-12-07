<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElCard, ElMessage } from 'element-plus';
import { ArrowLeft, Promotion } from '@element-plus/icons-vue';
import { createNewTask, fetchProcessSchema } from '@/service/api/task';
import DynamicForm from './components/DynamicForm.vue';

const route = useRoute();
const router = useRouter();

const loadingSchema = ref(true);
const submitting = ref(false);
const processSchema = ref<Api.Task.ProcessSchema | null>(null);
const formData = ref<Record<string, any>>({});
const dynamicFormRef = ref<InstanceType<typeof DynamicForm> | null>(null);

const processId = Number(route.params.id);
const processName = computed(() => (route.query.name as string) || '未命名流程');

async function getSchema() {
  if (!processId) return;
  loadingSchema.value = true;
  try {
    const response = await fetchProcessSchema(processId);
    processSchema.value = response.data;
  } catch {
    ElMessage.error('获取流程参数失败');
  } finally {
    loadingSchema.value = false;
  }
}

async function handleSubmit() {
  if (!processId) return;
  const isFormValid = await dynamicFormRef.value?.validate();
  if (!isFormValid) {
    ElMessage.warning('请检查并填写所有必填参数');
    return;
  }

  const payload: Api.Task.NewTaskPayload = {
    process_id: processId,
    parameter_json: formData.value
  };

  submitting.value = true;
  try {
    const res = await createNewTask(payload);
    const apiResponse = (res.data || (res as any).response?.data) as Api.Task.NewTaskResponse;
    if (apiResponse?.code !== '0000') {
      ElMessage.error(apiResponse.message || '创建失败');
      return;
    }
    const taskInfo = apiResponse?.data;
    ElMessage.success(apiResponse?.message || '任务创建成功！');
    router.push({
      path: '/scene/list',
      query: { task_id: taskInfo.task_id }
    });
  } catch (error: any) {
    const msg = error?.response?.data?.message || error?.message || '任务创建失败，请稍后重试';
    ElMessage.error(msg);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  getSchema();
});
</script>

<template>
  <div class="create-task-page">
    <div class="page-content">
      <div class="page-header-nav">
        <ElButton class="back-btn" :icon="ArrowLeft" circle @click="router.back()" />
        <div class="header-text">
          <h1 class="title">创建新任务</h1>
          <span class="subtitle">
            配置参数以启动
            <span class="highlight">{{ processName }}</span>
            流程
          </span>
        </div>
      </div>

      <ElCard v-loading="loadingSchema" class="main-card" shadow="never">
        <div class="steps-wrapper">
          <div class="step-indicator active">1. 选择流程</div>
          <div class="step-line"></div>
          <div class="step-indicator current">2. 参数配置</div>
          <div class="step-line"></div>
          <div class="step-indicator">3. 启动分析</div>
        </div>

        <div class="form-wrapper">
          <DynamicForm
            v-if="processSchema"
            ref="dynamicFormRef"
            v-model="formData"
            :schema="processSchema.parameter_schema"
          />
          <div v-else-if="!loadingSchema" class="empty-state">暂无参数配置定义</div>
        </div>

        <div class="card-footer">
          <ElButton class="cancel-btn" @click="router.back()">取消</ElButton>
          <ElButton
            type="primary"
            size="large"
            :loading="submitting"
            :icon="Promotion"
            class="submit-button"
            @click="handleSubmit"
          >
            立即创建任务
          </ElButton>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style scoped>
.create-task-page {
  min-height: 100vh;
  background-color: #f3f4f6;
  padding: 24px;
  display: flex;
  justify-content: center;
}

/* --- 修改重点：放宽页面内容宽度 --- */
.page-content {
  width: 98%; /* 占据屏幕绝大部分宽度 */
  max-width: 1600px; /* 设置一个非常大的上限，防止在超宽屏上太散 */
  margin: 0 auto;
}

/* 头部导航 */
.page-header-nav {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}

.back-btn {
  margin-right: 20px;
  background: white;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  color: #606266;
  width: 40px;
  height: 40px;
}
.back-btn:hover {
  color: #409eff;
  transform: translateX(-2px);
}

.header-text {
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  line-height: 1.2;
}

.subtitle {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.highlight {
  color: #409eff;
  font-weight: 600;
}

/* 卡片样式 */
.main-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
  overflow: visible;
}

/* 步骤条装饰 */
.steps-wrapper {
  display: flex;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 1px dashed #e5e7eb;
}

.step-indicator {
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
  padding: 4px 12px;
  border-radius: 20px;
  background: #f9fafb;
}

.step-indicator.active {
  color: #10b981;
  background: #d1fae5;
}

.step-indicator.current {
  color: #fff;
  background: #409eff;
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.3);
}

.step-line {
  flex: 1;
  height: 2px;
  background: #f3f4f6;
  margin: 0 10px;
}

.form-wrapper {
  padding: 0 10px;
}

.empty-state {
  text-align: center;
  color: #909399;
  padding: 40px;
}

/* 底部按钮 */
.card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid #f3f4f6;
  gap: 16px;
}

.submit-button {
  min-width: 160px;
  border-radius: 8px;
  font-weight: 600;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 14px rgba(64, 158, 255, 0.3);
  transition: all 0.3s;
}
.submit-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4);
}

.cancel-btn {
  border: none;
  background: transparent;
  color: #6b7280;
}
.cancel-btn:hover {
  background: #f3f4f6;
  color: #374151;
}
</style>
