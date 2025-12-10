<script lang="ts" setup>
import { ref, watch } from 'vue';
import { ElMessage, ElForm, ElFormItem, ElSelect, ElOption, ElDivider, ElIcon } from 'element-plus';
import { fetchFileSchemaInfo } from '@/service/api/file';

// ==================== Props 与 Emits ====================
// Props: 双向绑定的选中 schema ID
const props = defineProps<{
  modelValue: string;
}>();

// Emits: 向父组件发送更新事件
const emit = defineEmits<{
  'update:modelValue': [value: string];    // 更新选中的 schema ID
  'schemaSelected': [schema: any];         // 发送完整的 schema 对象
}>();

// ==================== 本地状态 ====================
const schemas = ref<any[]>([]); // 所有可用的 schema 列表
const selectedSchemaId = ref(props.modelValue); // 当前选中的 schema ID
const filteredSchemas = ref<any[]>([]); // 搜索过滤后的 schema 列表
const searchKeyword = ref(''); // 搜索关键词
const selectedSchema = ref<any>(null); // 当前选中的完整 schema 对象

/**
 * 从后端获取 schema 列表
 * 包含数据类型定义、字段配置等信息
 */
async function fetchSchemas() {
  try {
    // 调用 API 获取 schema 信息
    const res = await fetchFileSchemaInfo();

    // 从响应中提取 schema 数据
    const schemaData = res.data?.schemas;

    // 检查是否成功获取数据
    if (Array.isArray(schemaData) && schemaData.length > 0) {
      schemas.value = schemaData;
      ElMessage.success(`成功获取到 ${schemaData.length} 个 Schema 数据`);
    } else {
      ElMessage.info('接口无schema数据');
    }
    updateFilteredSchemas();
  } catch (error) {
    console.error('获取 Schema 失败:', error);
    ElMessage.warning('接口获取schema失败');
    updateFilteredSchemas();
  }
}

/**
 * 根据搜索关键词更新过滤的 schema 列表
 * 支持按 name、description 等字段模糊搜索
 */
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
