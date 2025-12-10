<script setup lang="ts">
// =============================================================================
// 1. 依赖引入
// =============================================================================
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
// Element Plus 组件与图标
import { ElButton, ElCard, ElMessage } from 'element-plus';
import { ArrowLeft, Promotion } from '@element-plus/icons-vue';
// API 接口
import { createNewTask, fetchProcessSchema } from '@/service/api/task';
// 动态表单组件 (核心子组件)
import DynamicForm from './components/DynamicForm.vue';

/**
 * # ===========================================================================
 *
 * # 路由 & 页面级状态管理
 *
 * # ===========================================================================
 */
const route = useRoute();
const router = useRouter();

// --- UI 状态 ---
const loadingSchema = ref(true); // 控制 Schema 加载时的骨架屏或 Loading 状态
const submitting = ref(false); // 控制提交按钮的 Loading 状态

// --- 数据状态 ---
const processSchema = ref<Api.Task.ProcessSchema | null>(null); // 后端返回的流程定义（包含表单结构）
const formData = ref<Record<string, any>>({}); // 收集表单数据的对象 (v-model 绑定目标)

// --- 组件引用 ---
// 获取 DynamicForm 组件实例，以便调用其内部的 validate() 方法
const dynamicFormRef = ref<InstanceType<typeof DynamicForm> | null>(null);

// --- 路由参数 ---
const processId = Number(route.params.id); // 当前要创建任务的流程 ID
const processName = computed(() => (route.query.name as string) || '未命名流程'); // 流程名称 (用于展示)

/**
 * # ===========================================================================
 *
 * # 数据处理工具函数 (Helpers)
 *
 * # 下方函数集中处理接口返回与异常信息，确保主流程代码更清晰
 *
 * # ===========================================================================
 */

/**
 * 标准化 API 响应数据 兼容两种 Axios 拦截器配置情况：
 *
 * 1. 拦截器已解包 data，直接返回数据对象 (无 code 或 code 为空)
 * 2. 拦截器未解包，返回原始 response 结构
 */
function normalizeApiResponse(res: any): any {
  return res.data || (res as any).response?.data;
}

/** - 统一提取错误信息 防御性编程，处理不同层级的错误对象结构 */
function getErrorMessage(error: any): string {
  return error?.response?.data?.message || error?.message || '任务创建失败，请稍后重试';
}

/**
 * # ===========================================================================
 *
 * # 核心业务逻辑
 *
 * # ===========================================================================
 */

/** 1. 获取流程定义 (Schema) 触发时机：页面加载时 (onMounted) 作用：从后端拉取 JSON Schema，传递给 DynamicForm 组件渲染出对应的输入框 */
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

/** 2. 提交创建任务 触发时机：点击“立即创建任务”按钮 流程：子组件校验 -> 组装参数 -> 调用 API -> 跳转页面 */
async function handleSubmit() {
  if (!processId) return;

  // Step 1: 调用子组件 DynamicForm 的 validate 方法进行表单校验
  const isFormValid = await dynamicFormRef.value?.validate();
  if (!isFormValid) {
    ElMessage.warning('请检查并填写所有必填参数');
    return;
  }

  // Step 2: 组装提交载荷 (Payload)
  const payload: Api.Task.NewTaskPayload = {
    process_id: processId,
    parameter_json: formData.value // 这里包含了动态表单收集到的所有数据
  };

  submitting.value = true;

  // Step 3: 发起 API 请求
  try {
    const res = await createNewTask(payload);

    // 处理响应
    const apiResponse = normalizeApiResponse(res);
    // 检查业务状态码 (假设 '0000' 为成功)
    if (apiResponse?.code && apiResponse.code !== '0000') {
      ElMessage.error(apiResponse.message || '创建失败');
      return;
    }

    const taskInfo = apiResponse.data || apiResponse;
    ElMessage.success(apiResponse?.message || '任务创建成功！');

    // Step 4: 成功后跳转到任务列表页 (并带上 task_id 以便高亮显示)
    router.push({
      path: '/scene/list',
      query: { task_id: taskInfo?.task_id }
    });
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error));
  } finally {
    submitting.value = false;
  }
}

/**
 * # ===========================================================================
 *
 * # 生命周期 (Lifecycle)
 *
 * # ===========================================================================
 */
onMounted(() => {
  getSchema(); // 进入页面立即拉取配置
});
</script>

<template>
  <div class="create-task-page">
    <div class="page-content">
      <!-- 顶部返回 + 流程名称概览 -->
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

      <!-- 主卡片：三步引导 + 动态参数表单 -->
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
