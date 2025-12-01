<script lang="ts" setup>
import { ref, watch } from 'vue';
import { ElMessage, ElForm, ElFormItem, ElSelect, ElOption, ElDivider, ElIcon } from 'element-plus';
import { fetchFileSchemaInfo } from '@/service/api/file';

// Props
const props = defineProps<{
  modelValue: string;
}>();

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string];
  'schemaSelected': [schema: any];
}>();

// 本地状态
const schemas = ref<any[]>([]);
const selectedSchemaId = ref(props.modelValue);
const filteredSchemas = ref<any[]>([]);
const searchKeyword = ref('');
const selectedSchema = ref<any>(null);

// 1. 获取 schema 列表
async function fetchSchemas() {
  try {
    // 直接请求 Apifox Mock 地址
    const res = await fetchFileSchemaInfo();

    // 从 Apifox 响应中提取 schema 数据
    const schemaData = res.data?.schemas;

    // 如果接口无数据，则用 schemas_list 展示
    if (Array.isArray(schemaData) && schemaData.length > 0) {
      schemas.value = schemaData;
      ElMessage.success(`成功获取到 ${schemaData.length} 个 Schema 数据`);
    } else {
      ElMessage.info('接口无schema数据');
    }
    updateFilteredSchemas();
  } catch (error) {
    console.error('获取 Schema 失败:', error); // 调试日志
    ElMessage.warning('接口获取schema失败');
    updateFilteredSchemas();
  }
}

// 搜索过滤功能
function updateFilteredSchemas() {
  if (!searchKeyword.value) {
    filteredSchemas.value = schemas.value;
  } else {
    const keyword = searchKeyword.value.toLowerCase();
    filteredSchemas.value = schemas.value.filter(schema => schema.name.toLowerCase().includes(keyword));
  }
}

// 监听搜索关键词变化
watch(searchKeyword, updateFilteredSchemas);

// 监听 selectedSchemaId 变化
watch(selectedSchemaId, (newValue) => {
  emit('update:modelValue', newValue);
  
  const schema = schemas.value.find((s: any) => s.id === newValue);
  selectedSchema.value = schema;
  
  if (schema) {
    emit('schemaSelected', schema);
  }
});

// 监听 props.modelValue 变化
watch(() => props.modelValue, (newValue) => {
  selectedSchemaId.value = newValue;
});

// 初始化
function init() {
  fetchSchemas();
}

// 暴露给父组件
defineExpose({
  fetchSchemas,
  init,
  schemas,
  selectedSchema,
  selectedSchemaId
});
</script>

<template>
  <div class="schema-selection-container">
    <ElDivider content-position="center" style="font-size: 16px">数据类型选择</ElDivider>
    <div class="schema-selection-section">
      <ElForm label-width="90px" style="font-size: 15px">
        <ElFormItem label="数据类型">
          <div style="display: flex; gap: 10px; align-items: center">
            <ElSelect 
              v-model="selectedSchemaId" 
              placeholder="请选择数据类型" 
              class="schema-select" 
              filterable
            >
              <ElOption 
                v-for="item in filteredSchemas" 
                :key="item.id" 
                :label="`${item.name}`" 
                :value="item.id"
              >
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%">
                  <span>{{ item.name }}</span>
                </div>
              </ElOption>
              <template #empty>
                <span style="color: #aaa">暂无可选数据类型</span>
              </template>
            </ElSelect>
          </div>
        </ElFormItem>
      </ElForm>
    </div>
  </div>
</template>

<style scoped>
.schema-selection-container {
  width: 100%;
}

.schema-selection-section {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 40px;
}

.schema-selection-section .el-form {
  display: flex;
  align-items: center;
}

.schema-select {
  width: min(32rem, 100%);
}

@media (max-width: 768px) {
  .schema-select {
    width: 100% !important;
  }
}
</style>
