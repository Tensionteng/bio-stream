<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElCard, ElMessage } from 'element-plus';
import { ArrowLeft, Promotion } from '@element-plus/icons-vue';
import { type NewTaskPayload, type ProcessSchema, createNewTask, fetchProcessSchema } from '@/service/api/task'; // 确认路径正确
// 从同级目录下的 components 文件夹导入
import DynamicForm from './components/DynamicForm.vue';

const route = useRoute();
const router = useRouter();

const loadingSchema = ref(true);
const submitting = ref(false);
const processSchema = ref<ProcessSchema | null>(null);
const formData = ref<Record<string, any>>({});
const dynamicFormRef = ref<InstanceType<typeof DynamicForm> | null>(null);
const processId = Number(route.params.id);
const processName = computed(() => (route.query.name as string) || '');
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
    ElMessage.error('请检查并填写所有必填参数');
    return;
  }

  const payload: NewTaskPayload = {
    process_id: processId,
    parameter_json: formData.value
  };

  submitting.value = true;
  try {
    await createNewTask(payload);
    ElMessage.success('任务创建成功！');
    // 成功后可以跳转到任务列表页或其他页面
    router.push('/task/list');
  } catch {
    ElMessage.error('任务创建失败');
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
/* 在这里粘贴之前的完整CSS样式 */
.card-footer {
  display: flex;
  justify-content: center; /* 确保按钮居中 */
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color-light);
}
.submit-button {
  width: 100%;
  max-width: 400px;
}
</style>
