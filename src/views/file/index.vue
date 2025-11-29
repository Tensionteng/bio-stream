<script lang="ts" setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { Search, Upload, UploadFilled } from '@element-plus/icons-vue';
import { createSHA256 } from 'hash-wasm';
import * as echarts from 'echarts';
import {
  FileUploadComplete,
  FileUploadInit,
  fetchFileDetail,
  fetchFileGenealogy,
  fetchFileListInfo,
  fetchFileSchemaInfo,
  fetchFileStatistics
} from '@/service/api/file';
import { usePermissionGuard, useSimplePermissionCheck } from '@/hooks/business/permission-guard';

const schemas = ref<any[]>([]); // 注意：这里初始化为空数组
const selectedSchemaId = ref<string>('');
const selectedSchema = ref<any>(null);
const dynamicForm = reactive<any>({});
const textFields = ref<any[]>([]);
const fileFields = ref<any[]>([]);
const uploadLoading = ref(false);
const totalFileCount = ref(0);
const totalFileSize = ref(0);
const lastUploadTime = ref('');

// 搜索相关
const searchKeyword = ref('');
const filteredSchemas = ref<any[]>([]);

// 历史上传记录（示例数据，可替换为实际接口数据）
const fileList = ref<any[]>([]);
const fileListLoading = ref(false);
const fileListPage = ref(1);
const fileListPageSize = ref(20); // 每页展示20个数据
const fileListTotal = ref(0);

// 进度条相关
const progressDialogVisible = ref(false);
const uploadProgressPercent = ref(0);
const uploadingFileName = ref('');
const uploadError = ref('');
let uploadCancelTokenSource: ReturnType<typeof axios.CancelToken.source> | null = null;

// 权限检查
const { hasPermission } = useSimplePermissionCheck();
const hasGenealogyPermission = hasPermission('genealogy');

// 封装上传进度弹窗控制函数
function showUploadProgressDialog({
  percent = 0,
  fileName = '',
  error = '',
  cancelTokenSource = null
}: {
  percent?: number;
  fileName?: string;
  error?: string;
  cancelTokenSource?: ReturnType<typeof axios.CancelToken.source> | null;
} = {}) {
  uploadProgressPercent.value = percent;
  uploadingFileName.value = fileName;
  uploadError.value = error;
  progressDialogVisible.value = true;
  uploadCancelTokenSource = cancelTokenSource || null;
}

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

// 2. 获取文件统计信息
async function fetchFileStats() {
  try {
    // 假设接口返回 { total_files: 123, total_size: 4567890 }
    const res = await fetchFileStatistics();
    totalFileCount.value = res.data?.total_files || 0;
    totalFileSize.value = res.data?.total_size || 0;
    lastUploadTime.value = res.data?.last_upload_time || 'N/A';
  } catch {
    totalFileCount.value = 0;
    totalFileSize.value = 0;
    lastUploadTime.value = 'N/A';
  }
}

// 递归解析schema属性，生成表单字段
function parseSchemaProperties({
  properties,
  required = [],
  parent = ''
}: {
  properties: any;
  required?: string[];
  parent?: string;
}) {
  if (!properties) return;

  Object.entries(properties).forEach(([propName, prop]: [string, any]) => {
    parseSchemaProperty({ propName, prop, required, parent });
  });
}

function parseSchemaProperty({
  propName,
  prop,
  required,
  parent
}: {
  propName: string;
  prop: any;
  required: string[];
  parent: string;
}) {
  const fieldKey = parent ? `${parent}.${propName}` : propName;
  const isRequired = required.includes(propName);
  let propType = 'string';

  if (prop && typeof prop === 'object' && 'type' in prop && prop.type) {
    propType = prop.type;
  } else if (prop.enum) {
    propType = 'string';
  }

  // 修正嵌套对象的 dynamicForm 结构
  if (propType === 'object') {
    handleObjectType({ prop, propName, parent, isRequired, fieldKey });
    return;
  }
  if (Array.isArray((prop as any).anyOf) && (prop as any).anyOf.length > 0) {
    if (handleAnyOfType({ prop, fieldKey, propName, isRequired })) return;
  }
  if (isFileLikeField(prop, propType, propName)) {
    handleFileField({ prop, propName, parent, isRequired, fieldKey });
    return;
  }
  if (prop.enum) {
    handleEnumField({ prop, fieldKey, propName, isRequired });
    return;
  }
  if (propType === 'array') {
    handleArrayField({ fieldKey, propName, isRequired, prop });
    return;
  }
  if (propType === 'boolean') {
    handleBooleanField({ fieldKey, propName, isRequired, prop });
    return;
  }
  if (propType === 'integer' || propType === 'number') {
    handleNumberField({ fieldKey, propName, isRequired, prop });
    return;
  }
  if (propType === 'string') {
    handleStringField({ fieldKey, propName, isRequired, prop });
  }
}

// 判断是否为文件相关字段，降低主分支复杂度
function isFileLikeField(prop: any, propType: string, propName: string): boolean {
  if (propType !== 'string') return false;
  // 判断字段是否有file关键字，如果还有pattern的话，就判断为文件
  if (propName.toLowerCase().includes('file')) {
    if (typeof prop.pattern === 'string' && prop.pattern.trim().length > 0) return true;
    return false;
  }
  // 其次根据 description 中关键字判断（兼容已有描述）
  if (typeof prop.description === 'string' && /文件|路径|file|path/i.test(prop.description)) return true;
  return false;
}

// 修正嵌套对象的 dynamicForm 结构
function handleObjectType({
  prop,
  propName,
  isRequired,
  fieldKey
}: {
  prop: any;
  propName: string;
  parent: string;
  isRequired: boolean;
  fieldKey: string;
}) {
  if (prop.properties) {
    // 嵌套对象，递归时传递 fieldKey 作为 parent，保证 dynamicForm 结构嵌套
    setNestedObject(dynamicForm, fieldKey, {});
    parseSchemaProperties({
      properties: prop.properties,
      required: prop.required || [],
      parent: fieldKey
    });
  } else if (prop.additionalProperties) {
    const isDynamicObject =
      prop.additionalProperties &&
      ((typeof prop.additionalProperties === 'object' && prop.additionalProperties.pattern) ||
        propName.toLowerCase().includes('file') ||
        propName.toLowerCase().includes('path') ||
        (prop.description && /文件|路径|file|path/i.test(prop.description)));
    if (isDynamicObject) {
      textFields.value.push({
        name: fieldKey,
        label: prop.description || propName,
        type: 'dynamic-object',
        required: isRequired,
        description: prop.description || `请配置${propName}`,
        additionalProperties: prop.additionalProperties
      });
      setNestedObject(dynamicForm, fieldKey, {});
    } else {
      textFields.value.push({
        name: fieldKey,
        label: prop.description || propName,
        type: 'object',
        required: isRequired,
        description: prop.description || `请配置${propName}`
      });
      setNestedObject(dynamicForm, fieldKey, {});
    }
  }
}

// 工具函数：设置嵌套对象
function setNestedObject(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (!(keys[i] in cur) || typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) {
      cur[keys[i]] = {};
    }
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function handleAnyOfType({
  prop,
  fieldKey,
  propName,
  isRequired
}: {
  prop: any;
  fieldKey: string;
  propName: string;
  isRequired: boolean;
}) {
  const anyOf = prop.anyOf as any[];
  const options: Array<{ label: string; value: string | number }> = [];
  anyOf.forEach(s => {
    const sType = s?.type;
    if (Array.isArray(s?.enum)) {
      (s.enum as any[]).forEach(v => options.push({ label: String(v), value: v }));
    } else if (
      (sType === 'integer' || sType === 'number') &&
      typeof s.minimum === 'number' &&
      typeof s.maximum === 'number'
    ) {
      const min = Math.ceil(s.minimum);
      const max = Math.floor(s.maximum);
      for (let i = min; i <= max; i += 1) options.push({ label: String(i), value: i });
    }
  });
  if (options.length > 0) {
    textFields.value.push({
      name: fieldKey,
      label: prop.description || propName,
      type: 'select',
      options,
      required: isRequired,
      description: prop.description || `请选择${propName}`
    });
    dynamicForm[fieldKey] = '';
    return true;
  }
  return false;
}

function handleFileField({
  prop,
  propName,
  parent,
  isRequired,
  fieldKey
}: {
  prop: any;
  propName: string;
  parent: string;
  isRequired: boolean;
  fieldKey: string;
}) {
  fileFields.value.push({
    name: fieldKey,
    originalName: propName,
    parentField: parent,
    label: prop.description || propName,
    type: 'file',
    required: isRequired,
    fileType: prop.pattern ? prop.pattern.match(/\\\.([^$]+)\$?/)?.[1] || 'file' : 'file',
    pattern: prop.pattern || '',
    description: prop.description || `请上传${propName}文件`
  });
  // 修正：如果dynamicForm[fieldKey]已存在且有path/file_type/file，保留原有，否则初始化为空对象
  if (
    !dynamicForm[fieldKey] ||
    typeof dynamicForm[fieldKey] !== 'object' ||
    (!('path' in dynamicForm[fieldKey]) && !('file' in dynamicForm[fieldKey]))
  ) {
    dynamicForm[fieldKey] = {};
  }
}

function handleEnumField({
  prop,
  fieldKey,
  propName,
  isRequired
}: {
  prop: any;
  fieldKey: string;
  propName: string;
  isRequired: boolean;
}) {
  textFields.value.push({
    name: fieldKey,
    label: prop.description || propName,
    type: 'select',
    options: prop.enum.map((v: any) => ({ label: v, value: v })),
    required: isRequired,
    description: prop.description || `请选择${propName}`
  });
  dynamicForm[fieldKey] = '';
}

function handleArrayField({
  fieldKey,
  propName,
  isRequired,
  prop
}: {
  fieldKey: string;
  propName: string;
  isRequired: boolean;
  prop: any;
}) {
  textFields.value.push({
    name: fieldKey,
    label: prop.description || propName,
    type: 'array',
    required: isRequired,
    description: prop.description || `请填写${propName}`
  });
  dynamicForm[fieldKey] = [];
}

function handleBooleanField({
  fieldKey,
  propName,
  isRequired,
  prop
}: {
  fieldKey: string;
  propName: string;
  isRequired: boolean;
  prop: any;
}) {
  if (fieldKey === 'position.strand') {
    textFields.value.push({
      name: fieldKey,
      label: prop.description || propName,
      type: 'select',
      options: [
        { label: '正向', value: true },
        { label: '负向', value: false }
      ],
      required: isRequired,
      description: prop.description || `请选择${propName}`
    });
    // 修正：初始化为 null，提交时允许 false
    dynamicForm[fieldKey] = null;
  } else {
    textFields.value.push({
      name: fieldKey,
      label: prop.description || propName,
      type: 'boolean',
      required: isRequired,
      description: prop.description || `请选择${propName}`
    });
    dynamicForm[fieldKey] = false;
  }
}

function handleNumberField({
  fieldKey,
  propName,
  isRequired,
  prop
}: {
  fieldKey: string;
  propName: string;
  isRequired: boolean;
  prop: any;
}) {
  textFields.value.push({
    name: fieldKey,
    label: prop.description || propName,
    type: 'number',
    required: isRequired,
    description: prop.description || `请输入${propName}`
  });
  dynamicForm[fieldKey] = '';
}

function handleStringField({
  fieldKey,
  propName,
  isRequired,
  prop
}: {
  fieldKey: string;
  propName: string;
  isRequired: boolean;
  prop: any;
}) {
  textFields.value.push({
    name: fieldKey,
    label: prop.description || propName,
    type: 'text',
    required: isRequired,
    description: prop.description || `请输入${propName}`
  });
  dynamicForm[fieldKey] = '';
}

// 替换原有的watch(selectedSchemaId...)逻辑
watch(selectedSchemaId, async () => {
  const schema = schemas.value.find((s: any) => s.id === selectedSchemaId.value);
  selectedSchema.value = schema;
}

// 处理提交
async function handleFormSubmit() {
  if (formSectionRef.value) {
    await handleSubmit(
      formSectionRef.value.dynamicForm,
      selectedSchema.value,
      formSectionRef.value.textFields,
      formSectionRef.value.fileFields,
      () => formSectionRef.value.validateFileFields(),
      () => formSectionRef.value.validateTextFields(),
      () => formSectionRef.value.resetForm(),
      () => {
        // 上传成功后刷新文件列表
        if (fileListRef.value) {
          fileListRef.value.fetchFileList();
        }
      }
    );
  }
}

// 处理文件详情
function handleShowDetail(fileId: number) {
  fileDetailDialogVisible.value = true;
  if (fileDetailDialogRef.value) {
    fileDetailDialogRef.value.openDialog(fileId);
  }
}

// 处理世系图
function handleShowLineage(row: any) {
  lineageDialogVisible.value = true;
  currentLineageRow.value = row;
  if (lineageDialogRef.value) {
    lineageDialogRef.value.showLineage(row);
  }
}

// 处理取消上传任务
function handleCancelTask(taskId: string) {
  cancelUploadTask(taskId);
}

// 渲染世系图
function renderLineageGraph(genealogyData: any[]) {
  console.log('Starting renderLineageGraph with data:', genealogyData);

  if (!lineageChartRef.value) {
    console.error('lineageChartRef is not available');
    return;
  }

  // 释放旧图表
  if (lineageChart.value) {
    lineageChart.value.dispose();
  }

  // 初始化新图表
  lineageChart.value = echarts.init(lineageChartRef.value, 'light', {
    renderer: 'canvas',
    useDirtyRect: false
  });

  const graphData = transformLineageData(genealogyData);

  console.log('Graph data:', graphData);

  if (graphData.nodes.length === 0) {
    console.warn('No nodes in graph data');
    ElMessage.warning('无法生成世系图：没有有效的数据');
    return;
  }

  // 计算合理的布局：按层级展示
  const levels = calculateNodeLevels(graphData);

  // 计算节点位置
  const nodePositions = new Map<string, [number, number]>();
  const levelHeight = 120;
  const nodeWidth = 200;

  Object.entries(levels).forEach(([level, nodes]: [string, any[]]) => {
    const levelIndex = Number.parseInt(level, 10);
    const y = levelIndex * levelHeight + 50;
    const totalWidth = nodes.length * nodeWidth;
    const startX = 100 - totalWidth / 2;

    nodes.forEach((node: any, index: number) => {
      const x = startX + index * nodeWidth;
      nodePositions.set(node.id, [x, y]);
    });
  });

  // 更新节点位置
  graphData.nodes.forEach((node: any) => {
    const pos = nodePositions.get(node.id);
    if (pos) {
      node.x = pos[0];
      node.y = pos[1];
      node.fixed = true;
    }
  });

  const option = {
    title: {
      text: '文件数据世系图',
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      borderColor: '#555',
      textStyle: {
        color: '#fff',
        fontSize: 12
      },
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const nodeData = params.data.value;
          return `
            <div style="padding: 8px; max-width: 300px;">
              <b style="font-size: 14px;">📄 文件信息</b><br/>
              <span style="color: #ccc;">文件名:</span> ${nodeData.file_name}<br/>
              <span style="color: #ccc;">类型:</span> ${nodeData.file_type}<br/>
              <span style="color: #ccc;">用户:</span> ${nodeData.user}
            </div>
          `;
        } else if (params.dataType === 'edge') {
          const taskData = params.data.value;
          if (!taskData || !taskData.task_units) {
            return '<div style="padding: 8px;">任务信息加载中...</div>';
          }
          const taskUnits = taskData.task_units.map((u: any) => `<li>${u.id}. ${u.task_unit_name}</li>`).join('');
          return `
            <div style="padding: 8px; max-width: 350px;">
              <b style="font-size: 14px;">⚙️ 任务信息</b><br/>
              <span style="color: #ccc;">任务数:</span> ${taskData.task_units.length}<br/>
              <span style="color: #ccc;">执行用户:</span> ${taskData.user}<br/>
              <span style="color: #ccc;">时间:</span> ${new Date(taskData.time).toLocaleString('zh-CN')}<br/>
              <b style="color: #ffd700;">任务单元列表:</b>
              <ul style="margin: 4px 0; padding-left: 20px;">
                ${taskUnits}
              </ul>
            </div>
          `;
        }
        return '';
      }
    },
    legend: [
      {
        data: ['file'],
        left: 'left',
        top: 50,
        textStyle: {
          color: '#333'
        }
      }
    ],
    animationDuration: 300,
    animationEasingUpdate: 'cubicInOut' as const,
    series: [
      {
        name: 'file',
        type: 'graph',
        layout: 'none',
        data: graphData.nodes,
        links: graphData.links,
        categories: graphData.categories,
        roam: 'scale',
        focusNodeAdjacency: false,
        draggable: true,
        label: {
          show: true,
          position: 'bottom',
          fontSize: 12,
          color: '#333',
          fontWeight: 'bold',
          distance: 5,
          formatter: (params: any) => {
            const name = params.data.name || params.data.id;
            // 限制标签长度
            return name.length > 15 ? `${name.substring(0, 12)}...` : name;
          }
        },
        edgeLabel: {
          show: false
        },
        lineStyle: {
          width: 2,
          color: '#5470c6',
          curveness: 0.3,
          opacity: 0.6
        },
        itemStyle: {
          color: '#5470c6',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: '#f0816d',
            borderColor: '#fff',
            borderWidth: 3,
            shadowBlur: 12,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          },
          label: {
            fontSize: 13,
            fontWeight: 'bold',
            color: '#000',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: 3,
            padding: 3
          },
          lineStyle: {
            width: 3,
            color: '#f0816d',
            opacity: 1
          }
        }
      }
    ],
    grid: {
      containLabel: true
    }
  };

  console.log('Setting option:', option);
  lineageChart.value.setOption(option);

  // 自动调整缩放以显示所有内容
  setTimeout(() => {
    if (lineageChart.value) {
      lineageChart.value.dispatchAction({
        type: 'restore',
        seriesIndex: 0
      });
    }
  }, 100);

  // 清理旧事件监听
  lineageChart.value.off('mouseover');
  lineageChart.value.off('mouseout');
  lineageChart.value.off('click');

  // 绑定正确的交互事件
  lineageChart.value.on('mouseover', (params: any) => {
    if (!params.data) return;

    // 只处理节点高亮
    if (params.dataType === 'node') {
      lineageChart.value?.dispatchAction({
        type: 'highlight',
        seriesIndex: 0,
        dataIndex: params.dataIndex
      });
    }
  });

  lineageChart.value.on('mouseout', () => {
    lineageChart.value?.dispatchAction({
      type: 'downplay',
      seriesIndex: 0
    });
  });

  // 点击节点显示详情
  lineageChart.value.on('click', (params: any) => {
    if (params.dataType === 'node') {
      const nodeData = params.data.value;
      ElMessage.info(`${nodeData.file_name} (${nodeData.file_type})`);
    } else if (params.dataType === 'edge') {
      const taskData = params.data.value;
      const taskNames = taskData.task_units.map((u: any) => u.task_unit_name).join(', ');
      ElMessage.info(`任务: ${taskNames}`);
    }
  });

  // 监听窗口大小变化
  const resizeHandler = () => {
    lineageChart.value?.resize();
  };
  window.addEventListener('resize', resizeHandler);
}

// 计算节点层级（按拓扑排序）
function calculateNodeLevels(graphData: any): Record<number, any[]> {
  const levels: Record<number, any[]> = {};
  const visited = new Set<string>();
  const nodeLevel: Record<string, number> = {};

  // 找出所有源节点（没有入边的节点）
  const inDegree: Record<string, number> = {};
  graphData.nodes.forEach((node: any) => {
    inDegree[node.id] = 0;
  });

  graphData.links.forEach((link: any) => {
    inDegree[link.target] = (inDegree[link.target] || 0) + 1;
  });

  // 拓扑排序
  const queue: any[] = [];
  graphData.nodes.forEach((node: any) => {
    if (inDegree[node.id] === 0) {
      queue.push(node);
      nodeLevel[node.id] = 0;
      if (!levels[0]) levels[0] = [];
      levels[0].push(node);
    }
  });

  while (queue.length > 0) {
    const node = queue.shift();
    visited.add(node.id);

    // 找出所有从这个节点出发的边
    graphData.links.forEach((link: any) => {
      if (link.source === node.id) {
        const targetNode = graphData.nodes.find((n: any) => n.id === link.target);
        if (targetNode && !visited.has(link.target)) {
          const newLevel = (nodeLevel[node.id] || 0) + 1;
          nodeLevel[link.target] = Math.max(nodeLevel[link.target] || 0, newLevel);

          if (!levels[newLevel]) levels[newLevel] = [];
          if (!levels[newLevel].includes(targetNode)) {
            levels[newLevel].push(targetNode);
          }

          queue.push(targetNode);
        }
      }
    });
  }

  return levels;
}

onMounted(async () => {
  // 检查文件管理权限
  const { checkPermissionAndNotify } = usePermissionGuard();
  const hasFilePermission = await checkPermissionAndNotify('file');
  if (!hasFilePermission) {
    return;
  }

  fetchSchemas();
  fetchFileStats();
  fetchFileList();
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

      <!-- 提交按钮 -->
      <div class="submit-button-area">
        <el-button type="primary" :loading="uploadLoading" @click="handleFormSubmit" size="large">
          提交并上传
        </el-button>
      </div>
    </ElCard>

    <!-- 文件列表区域 -->
    <div class="history-list-area">
      <ElCard shadow="hover" class="history-card">
        <div style="font-weight: bold; font-size: large; color: #409eff; margin-bottom: 10px">文件列表</div>
        <!-- 搜索区域 -->
        <div class="search-area" style="margin-bottom: 10px">
          <ElInput
            v-model="searchKeyword"
            placeholder="搜索文件名或样本名称"
            class="search-input"
            clearable
            @input="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <ElIcon><Search /></ElIcon>
            </template>
          </ElInput>
        </div>
        <ElEmpty v-if="!fileList.length && !fileListLoading" description="暂无上传记录" :image-size="60" />
        <div class="history-table-scroll">
          <ElTable :data="fileList" :style="{ width: '100%' }" size="small" border stripe>
            <ElTableColumn prop="file_id" label="ID" show-overflow-tooltip />
            <ElTableColumn prop="file_name" label="文件名" show-overflow-tooltip />
            <ElTableColumn prop="file_size" label="文件大小（字节）" show-overflow-tooltip />
            <ElTableColumn prop="created_time" label="上传时间" show-overflow-tooltip />
            <ElTableColumn prop="upload_user.user_id" label="上传用户" show-overflow-tooltip />
            <ElTableColumn label="操作" width="200" align="center">
              <template #default="scope">
                <ElButton
                  type="primary"
                  size="small"
                  style="margin-right: 6px"
                  @click="ShowFileDetail(scope.row.file_id)"
                >
                  详情
                </ElButton>
                <ElButton v-if="hasGenealogyPermission" type="success" size="small" @click="showLineage(scope.row)">
                  查看世系
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
        <div class="history-pagination" style="padding-top: 1%; padding-bottom: 1%">
          <ElPagination
            v-if="fileListTotal > 0"
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="fileListTotal"
            :page-size="fileListPageSize"
            :current-page="fileListPage"
            :page-sizes="[10, 20, 50, 100]"
            @current-change="handleCurrentChange"
            @size-change="handlePageSizeChange"
          />
        </div>
      </ElCard>
    </div>

    <!-- 上传任务面板 -->
    <UploadTaskPanel
      :tasks="uploadTaskList"
      @cancel-task="handleCancelTask"
      @remove-task="handleRemoveTask"
    />

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
