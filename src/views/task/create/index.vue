<script setup lang="ts">
// MODIFIED: 增加 InstanceType 用于获取组件实例类型
import { computed, onMounted, ref, watch } from 'vue';
import { ElButton, ElCard, ElEmpty, ElForm, ElFormItem, ElMessage, ElOption, ElSelect } from 'element-plus';
import { CircleCheck, CollectionTag, Promotion } from '@element-plus/icons-vue';
import {
  type NewTaskPayload,
  type ProcessListItem,
  type ProcessSchema,
  createNewTask,
  fetchProcessList,
  fetchProcessSchema
} from '@/service/api/task';
// 导入子组件
import DynamicForm from './components/DynamicForm.vue';

const loadingProcesses = ref(false);
const loadingSchema = ref(false);
const submitting = ref(false);
const processList = ref<ProcessListItem[]>([]);
const selectedProcessId = ref<number | undefined>(undefined);
const processSchema = ref<ProcessSchema | null>(null);
const formData = ref<Record<string, any>>({});

// 新增: 创建一个 ref 来引用 DynamicForm 组件实例
const dynamicFormRef = ref<InstanceType<typeof DynamicForm> | null>(null);

const processOptions = computed(() => {
  return processList.value.map(p => ({
    label: p.name,
    value: p.process_id
  }));
});

watch(selectedProcessId, async newId => {
  processSchema.value = null;
  formData.value = {};
  if (newId) {
    loadingSchema.value = true;
    try {
      const response = await fetchProcessSchema(newId);
      processSchema.value = response.data;
    } catch (error) {
      console.error('Failed to fetch process schema:', error);
      ElMessage.error('获取流程参数失败');
    } finally {
      loadingSchema.value = false;
    }
  }
});

async function getProcessList() {
  loadingProcesses.value = true;
  try {
    const response = await fetchProcessList();
    processList.value = response.data ?? [];
  } catch (error) {
    console.error('Failed to fetch process list:', error);
    ElMessage.error('获取流程列表失败');
  } finally {
    loadingProcesses.value = false;
  }
}

// MODIFIED: 重构 handleSubmit 函数
async function handleSubmit() {
  if (!selectedProcessId.value) {
    ElMessage.warning('请选择一个分析流程');
    return;
  }

  // 1. 调用子组件的 validate 方法
  const isFormValid = await dynamicFormRef.value?.validate();

  // 2. 检查验证结果
  if (!isFormValid) {
    ElMessage.error('请检查并填写所有必填参数');
    return; // 如果验证失败，则中断提交
  }

  // 3. 验证通过后，执行后续的提交逻辑
  const payload: NewTaskPayload = {
    process_id: selectedProcessId.value,
    parameter_json: formData.value
  };

  console.log('Submitting payload:', payload);
  submitting.value = true;
  try {
    const data = await createNewTask(payload);
    console.log(data);
    ElMessage.success('任务创建成功！');
    // 可以在这里重置表单或跳转页面
  } catch (error) {
    console.error('Failed to create task:', error);
    ElMessage.error('任务创建失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  getProcessList();
});
</script>

<template>
  <div class="create-task-page">
    <ElCard class="step-card" shadow="never">
      <template #header>
        <div class="card-header">
          <ElIcon class="header-icon"><CollectionTag /></ElIcon>
          <span>第一步：选择分析流程</span>
        </div>
      </template>
      <div v-loading="loadingProcesses">
        <ElForm label-position="left" label-width="120px">
          <ElFormItem label="分析流程">
            <ElSelect
              v-model="selectedProcessId"
              placeholder="请从列表中选择一个分析流程"
              :disabled="loadingSchema"
              clearable
              class="process-select"
            >
              <ElOption v-for="item in processOptions" :key="item.value" :label="item.label" :value="item.value" />
            </ElSelect>
          </ElFormItem>
        </ElForm>
      </div>
    </ElCard>

    <Transition name="fade" mode="out-in">
      <div v-if="processSchema" v-loading="loadingSchema">
        <ElCard class="step-card" shadow="never">
          <template #header>
            <div class="card-header">
              <ElIcon class="header-icon"><CircleCheck /></ElIcon>
              <span>第二步：配置任务参数</span>
            </div>
          </template>

          <DynamicForm ref="dynamicFormRef" v-model="formData" :schema="processSchema.parameter_schema" />

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

      <div v-else-if="!loadingSchema" class="empty-state">
        <ElEmpty description="请先选择一个分析流程以配置参数" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.create-task-page {
  padding: 20px;
  background-color: var(--el-bg-color-page);
}

.step-card {
  margin-bottom: 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.header-icon {
  margin-right: 8px;
  font-size: 18px;
  color: var(--el-color-primary);
}

.process-select {
  width: 100%;
}

/* --- 重点修改区域 --- */
.card-footer {
  display: flex;
  justify-content: center;
  margin-top: 24px; /* 增加与表单的间距 */
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color-light);
}

/* 为提交按钮增加自定义样式 */
.submit-button {
  width: 100%;
  max-width: 400px; /* 在大屏幕上限制最大宽度，避免过长 */
  font-weight: 500;
  letter-spacing: 1px; /* 增加文字间距，更易读 */
  transition: all 0.2s ease-in-out; /* 为所有属性添加平滑过渡 */
}

/* 增加悬停效果 */
.submit-button:hover {
  transform: translateY(-2px); /* 鼠标悬停时轻微上浮 */
  box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.25); /* 添加柔和的阴影 */
}

.empty-state {
  margin-top: 20px;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
