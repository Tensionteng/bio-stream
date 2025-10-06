<script setup lang="ts">
// --- 核心依赖导入 ---
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router'; // 导入 Vue Router 的 hooks
import { ElButton, ElCard, ElMessage } from 'element-plus'; // 导入 Element Plus UI 组件
import { ArrowLeft, Promotion } from '@element-plus/icons-vue'; // 导入图标
import { type NewTaskPayload, type ProcessSchema, createNewTask, fetchProcessSchema } from '@/service/api/task'; // 导入 API 请求函数和相关类型
// 从同级目录下的 components 文件夹导入子组件
import DynamicForm from './components/DynamicForm.vue';

// --- Vue Router 实例 ---
const route = useRoute(); // 获取当前路由信息，用于访问路由参数 (params) 和查询参数 (query)
const router = useRouter(); // 获取路由实例，用于编程式导航 (e.g., router.push, router.back)

// --- 组件状态定义 (State) ---
const loadingSchema = ref(true); // 控制是否显示加载 schema 的 loading 状态
const submitting = ref(false); // 控制提交按钮的 loading 状态，防止重复提交
const processSchema = ref<ProcessSchema | null>(null); // 存储从 API 获取的流程 schema 定义
const formData = ref<Record<string, any>>({}); // 存储动态表单的数据，通过 v-model 绑定到 DynamicForm 子组件
const dynamicFormRef = ref<InstanceType<typeof DynamicForm> | null>(null); // 获取 DynamicForm 子组件的实例，用于调用其暴露的 (expose) 方法，如 .validate()

// --- 路由派生数据 ---
const processId = Number(route.params.id); // 从路由参数中获取流程 ID
// 使用 computed 属性从路由查询参数中获取流程名称，提供一个默认值
const processName = computed(() => (route.query.name as string) || '');

/** 异步函数，用于根据 processId 从 API 获取表单的 schema */
async function getSchema() {
  if (!processId) return; // 如果没有 ID，则不执行
  loadingSchema.value = true;
  try {
    const response = await fetchProcessSchema(processId);
    processSchema.value = response.data; // 将获取到的 schema 存入 state
  } catch {
    ElMessage.error('获取流程参数失败');
  } finally {
    loadingSchema.value = false; // 无论成功或失败，都结束 loading 状态
  }
}

/** 处理表单提交的异步函数 */
async function handleSubmit() {
  if (!processId) return;

  // 调用子组件 DynamicForm 暴露的 validate 方法进行表单验证
  const isFormValid = await dynamicFormRef.value?.validate();
  if (!isFormValid) {
    ElMessage.error('请检查并填写所有必填参数');
    return; // 验证失败，中断提交
  }

  // 构建提交给 API 的数据 payload
  const payload: NewTaskPayload = {
    process_id: processId,
    parameter_json: formData.value // 表单数据
  };

  submitting.value = true;
  try {
    await createNewTask(payload); // 调用创建任务的 API
    ElMessage.success('任务创建成功！');
    // 成功后跳转到任务列表页
    router.push('/task/list');
  } catch {
    ElMessage.error('任务创建失败');
  } finally {
    submitting.value = false; // 结束提交状态
  }
}

// --- 生命周期钩子 ---
// 在组件挂载完成后，调用 getSchema 函数来加载初始数据
onMounted(() => {
  getSchema();
});
</script>

<template>
  <div class="create-task-page">
    <ElCard class="step-card" shadow="never">
      <template #header>
        <div class="card-header">
          <ElButton type="default" :icon="ArrowLeft" circle style="margin-right: 16px" @click="router.back()" />
          <span>第二步：配置 {{ processName }}</span>
        </div>
      </template>

      <div v-loading="loadingSchema">
        <DynamicForm
          v-if="processSchema"
          ref="dynamicFormRef"
          v-model="formData"
          :schema="processSchema.parameter_schema"
        />
      </div>

      <div class="card-footer">
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
</template>

<style scoped>
/* 卡片底部样式 */
.card-footer {
  display: flex;
  justify-content: center; /* 确保按钮水平居中 */
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color-light); /* 顶部分割线 */
}
/* 提交按钮样式 */
.submit-button {
  width: 100%;
  max-width: 400px; /* 设置最大宽度，避免在大屏幕上过宽 */
}
</style>
