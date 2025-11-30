<script lang="ts" setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { Search, Upload, UploadFilled, CaretTop } from '@element-plus/icons-vue';
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

// 文件列表
const fileList = ref<any[]>([]);
const fileListLoading = ref(false);
const fileListPage = ref(1);
const fileListPageSize = ref(20); // 每页展示20个数据
const fileListTotal = ref(0);
const fileListFileId = ref(0);
const fileListFileName = ref('');
const fileListFileType = ref('');


// 上传任务列表相关
const uploadTaskList = ref<any[]>([]);
const uploadTaskPanelCollapsed = ref(false);

// 添加上传任务到列表
function addUploadTask(fileName: string): string {
  const taskId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  uploadTaskList.value.push({
    id: taskId,
    fileName,
    progress: 0,
    status: 'uploading'
  });
  return taskId;
}

// 更新上传任务进度
function updateUploadTaskProgress(taskId: string, progress: number) {
  const task = uploadTaskList.value.find(t => t.id === taskId);
  if (task) {
    task.progress = progress;
  }
}

// 更新上传任务状态
function updateUploadTaskStatus(taskId: string, status: 'uploading' | 'success' | 'error', error?: string) {
  const task = uploadTaskList.value.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    if (error) {
      task.error = error;
    }
  }
}

// 取消单个上传任务
function cancelUploadTask(taskId: string) {
  const task = uploadTaskList.value.find(t => t.id === taskId);
  if (task) {
    task.canceling = true;
    if (task.cancelTokenSource) {
      task.cancelTokenSource.cancel('用户取消上传');
    }
    // 延迟更新状态，确保UI能显示取消中的状态
    setTimeout(() => {
      if (task.status === 'uploading') {
        task.status = 'error';
        task.error = '已取消';
      }
      task.canceling = false;
    }, 300);
  }
}

// 删除上传任务
function removeUploadTask(taskId: string) {
  const index = uploadTaskList.value.findIndex(t => t.id === taskId);
  if (index > -1) {
    uploadTaskList.value.splice(index, 1);
  }
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

  // 清空表单数据，但不删除动态计算的属性键
  Object.keys(dynamicForm).forEach(key => {
    if (typeof dynamicForm[key] === 'object' && dynamicForm[key] !== null) {
      // 对于对象类型，清空内容但保留结构
      if (Array.isArray(dynamicForm[key])) {
        dynamicForm[key] = [];
      } else {
        dynamicForm[key] = {};
      }
    } else {
      // 对于基本类型，重置为默认值
      dynamicForm[key] = '';
    }
  });
  textFields.value = [];
  fileFields.value = [];

  if (!schema) return;

  // 递归解析schema
  if (schema.schema_json && schema.schema_json.properties) {
    parseSchemaProperties({
      properties: schema.schema_json.properties,
      required: schema.schema_json.required || []
    });
  }
});

// 处理文件变更（支持多文件）
function handleFileChange(field: string, files: File[], key?: string | number) {
  // 确保 dynamicForm[field] 已初始化为对象
  if (!dynamicForm[field] || typeof dynamicForm[field] !== 'object') {
    dynamicForm[field] = {};
  }
  console.log('dynamicform after selected:', dynamicForm);
  // 动态对象子项
  if (key !== undefined) {
    // 动态对象不支持多文件，只取第一个
    if (files && files.length > 0) {
      handleDynamicObjectFileChange(field, files[0], key);
    }
    return;
  }
  console.log('files received:', files);
  
  // 先在 fileFields 中查找
  let fieldConfig = fileFields.value.find(f => f.name === field);
  
  // 如果没找到，再在 textFields 中查找动态对象字段
  if (!fieldConfig) {
    fieldConfig = textFields.value.find(f => f.name === field && f.type === 'dynamic-object');
  }
  
  if (!fieldConfig) {
    ElMessage.error('字段配置错误');
    return;
  }

  // 验证所有文件格式
  for (const file of files) {
    if (!validateFileFormat(fieldConfig, file.name)) return;
  }

  // 更新文件字段（支持多文件）
  updateFileFieldMultiple(fieldConfig, files);
}

// 从文件名获取文件类型
function getFileTypeFromExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    json: 'application/json',
    txt: 'text/plain',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    fasta: 'text/plain',
    fa: 'text/plain',
    fastq: 'text/plain',
    fq: 'text/plain',
    bam: 'application/octet-stream',
    sam: 'text/plain',
    vcf: 'text/plain',
    bed: 'text/plain',
    gtf: 'text/plain',
    gff: 'text/plain',
    gff3: 'text/plain'
  };

  return typeMap[extension] || 'application/octet-stream';
}

// 从完整路径中提取文件名
function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
}

// 清理文件字段的旧信息
function clearFileField(fieldName: string, parentField?: string) {
  if (parentField) {
    if (dynamicForm[parentField] && dynamicForm[parentField][fieldName]) {
      // 重置为默认值，而不是删除动态计算的属性键
      dynamicForm[parentField][fieldName] = {
        path: '',
        file_type: ''
      };
    }
  } else if (dynamicForm[fieldName]) {
    // 重置为默认值，而不是删除动态计算的属性键
    dynamicForm[fieldName] = {
      path: '',
      file_type: ''
    };
  }
}

// 遍历 dynamicForm，收集所有含有 file 的叶子节点
function collectFileEntries(
  obj: Record<string, any>,
  basePath: string[] = []
): Array<{ path: string[]; field_name: string; file: File }> {
  const results: Array<{ path: string[]; field_name: string; file: File }> = [];
  if (!obj || typeof obj !== 'object') return results;

  Object.entries(obj).forEach(([k, v]) => {
    const currentPath = [...basePath, k];
    if (v && typeof v === 'object') {
      // 检查是否是单文件模式（含有 file 属性但不是嵌套对象）
      if ('file' in v && v.file && !(v as any).hidden) {
        const fieldName = k;
        results.push({ path: currentPath, field_name: fieldName, file: v.file as File });
      } else if (!Array.isArray(v)) {
        // 检查是否是多文件模式（对象中的每个值都可能含有 file）
        let hasMultipleFiles = false;
        const multiFiles: Array<{ path: string[]; field_name: string; file: File }> = [];
        
        Object.entries(v).forEach(([subKey, subValue]) => {
          if (subValue && typeof subValue === 'object' && 'file' in subValue && subValue.file && !(subValue as any).hidden) {
            hasMultipleFiles = true;
            multiFiles.push({
              path: [...currentPath, subKey],
              field_name: k,
              file: subValue.file as File
            });
          }
        });
        
        if (hasMultipleFiles) {
          results.push(...multiFiles);
        } else {
          // 继续递归
          results.push(...collectFileEntries(v as Record<string, any>, currentPath));
        }
      }
    }
  });
  return results;
}

// 将点分隔的键设置为嵌套对象中的值
function setNestedValue(target: Record<string, any>, path: string, value: any) {
  const segments = path.split('.');
  let current = target;
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (isLast) {
      current[seg] = value;
    } else {
      if (typeof current[seg] !== 'object' || current[seg] === null || Array.isArray(current[seg])) {
        current[seg] = {};
      }
      current = current[seg];
    }
  }
}

// 从文件名获取用于键名/描述的后缀（不带点），兼容 fastq.gz / fq.gz
function getSuffixFromFileName(fileName: string): string {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.fastq.gz')) return 'fastq.gz';
  if (lower.endsWith('.fq.gz')) return 'fq.gz';
  const parts = lower.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

// 计算文件哈希编码
async function hashFile(file: File) {
  const sha256 = await createSHA256();
  const chunkSize = 4 * 1024 * 1024; // 4MB 一块
  let offset = 0;
  const chunks: Blob[] = [];
  while (offset < file.size) {
    chunks.push(file.slice(offset, offset + chunkSize));
    offset += chunkSize;
  }
  // 并发读取所有 chunk 的 arrayBuffer
  const buffers = await Promise.all(chunks.map(chunk => chunk.arrayBuffer()));
  for (const buffer of buffers) {
    sha256.update(new Uint8Array(buffer));
  }
  return sha256.digest('hex');
}

// 根据 schema 获取文件名：如果有 sampleid 则使用，否则随机生成
function getFileNameFromSchema(): string {
  // 检查 dynamicForm 中是否有 sampleid 字段
  if (dynamicForm.sample_id && dynamicForm.sample_id.trim()) {
    return dynamicForm.sample_id.trim();
  }

  // 如果没有 sampleid，则随机生成文件名
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `bioFile_${timestamp}_${randomSuffix}`;
}

// 处理动态对象文件变更
function handleDynamicObjectFileChange(field: string, file: File, key: string | number) {
  if (!dynamicForm[field] || !dynamicForm[field][key]) return;
  console.log('dynamicform in dynamic object change:', dynamicForm);
  // 直接更新文件信息，不删除动态计算的属性键，并确保组件可见
  dynamicForm[field][key] = {
    path: file.name,
    file_type: getFileTypeFromExtension(file.name),
    file,
    hidden: false // 确保组件可见
  };
}

// 验证文件格式
function validateFileFormat(fileField: any, fileName: string): boolean {
  if (!fileField.pattern || !fileField.pattern.trim()) return true;

  console.log('Validating file:', fileName, 'against pattern:', fileField.pattern);
  
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // 先尝试从 pattern 中提取扩展名（支持 *.ext 格式）
  let expectedExtension = '';
  if (fileField.pattern.startsWith('*')) {
    // 处理 *.ext 格式
    const match = fileField.pattern.match(/\*\.([a-zA-Z0-9]+)$/);
    if (match) {
      expectedExtension = match[1].toLowerCase();
    }
  } else {
    // 处理 \\.ext$ 格式
    const match = fileField.pattern.match(/\\\.([^$]+)\$?/);
    if (match) {
      expectedExtension = match[1].toLowerCase();
    }
  }

  console.log('File extension:', fileExtension, 'Expected extension:', expectedExtension);

  let isValidFormat = false;
  if (expectedExtension && fileExtension === expectedExtension) {
    isValidFormat = true;
  }

  if (!isValidFormat) {
    try {
      // 将 glob 模式转换为正则表达式
      let regexPattern = fileField.pattern;
      if (regexPattern.startsWith('*')) {
        // *.ext 转换为正则
        regexPattern = '^.*\\' + regexPattern.replace(/\*/g, '.*') + '$';
      }
      const patternRegex = new RegExp(regexPattern);
      console.log('Testing against regex:', patternRegex);
      if (patternRegex.test(fileName)) {
        isValidFormat = true;
      }
    } catch (e) {
      console.warn('Invalid regex pattern:', fileField.pattern, 'Error:', e);
    }
  }

  if (!isValidFormat) {
    const expectedFormat = expectedExtension
      ? `.${expectedExtension}`
      : fileField.pattern.replace(/\\\./g, '.').replace(/\$/g, '').replace(/\*/g, '*');
    ElMessage.error(`文件格式不正确，请上传 ${expectedFormat} 格式的文件`);
    return false;
  }

  return true;
}

// 更新文件字段（多文件）
function updateFileFieldMultiple(fileField: any, files: File[]) {
  // 获取当前字段的数据
  let currentData = fileField.parentField
    ? dynamicForm[fileField.parentField]?.[fileField.originalName]
    : dynamicForm[fileField.name];

  // 如果不存在或不是多文件模式，初始化为空对象
  if (!currentData || typeof currentData !== 'object' || 'file' in currentData) {
    currentData = {};
  }

  // 找出下一个可用的 key（从已有的最大 key 开始）
  const existingKeys = Object.keys(currentData)
    .map(k => parseInt(k, 10))
    .filter(k => !Number.isNaN(k));
  let nextKey = existingKeys.length > 0 ? Math.max(...existingKeys) + 1 : 1;

  // 追加新文件到现有的文件列表
  files.forEach(file => {
    currentData[nextKey] = {
      path: file.name,
      file_type: getFileTypeFromExtension(file.name),
      file,
      hidden: false
    };
    nextKey++;
  });

  // 确保 dynamicForm 结构存在并更新
  if (fileField.parentField) {
    if (!dynamicForm[fileField.parentField] || typeof dynamicForm[fileField.parentField] !== 'object') {
      dynamicForm[fileField.parentField] = {};
    }
    dynamicForm[fileField.parentField][fileField.originalName] = currentData;
  } else {
    if (!dynamicForm[fileField.name] || typeof dynamicForm[fileField.name] !== 'object') {
      dynamicForm[fileField.name] = {};
    }
    dynamicForm[fileField.name] = currentData;
  }
}

// 获取字段已上传的文件数
function getUploadedFileCount(field: any): number {
  const fieldData = field.parentField
    ? ((dynamicForm[field.parentField] || {})[field.originalName] || {})
    : (dynamicForm[field.name] || {});
  
  if (typeof fieldData !== 'object') return 0;
  
  // 如果是含有 file 属性的对象（单文件模式），返回 1
  if ('file' in fieldData && !Array.isArray(fieldData)) {
    return (fieldData as any).file ? 1 : 0;
  }
  
  // 如果是对象数组（多文件模式），统计不隐藏的文件
  const count = Object.values(fieldData).filter(
    (f: any) => f && typeof f === 'object' && 'file' in f && !(f as any).hidden
  ).length;
  return count;
}

// 获取字段已上传的文件列表
function getUploadedFilesForField(field: any): Array<{ path: string; hidden?: boolean }> {
  const fieldData = field.parentField
    ? ((dynamicForm[field.parentField] || {})[field.originalName] || {})
    : (dynamicForm[field.name] || {});
  
  if (typeof fieldData !== 'object') return [];
  
  // 如果是含有 file 属性的对象（单文件模式），返回该文件
  if ('file' in fieldData && !Array.isArray(fieldData)) {
    return (fieldData as any).file && !(fieldData as any).hidden ? [fieldData as any] : [];
  }
  
  // 如果是对象数组（多文件模式），返回不隐藏的文件
  return Object.values(fieldData).filter(
    (f: any) => f && typeof f === 'object' && 'file' in f && !(f as any).hidden
  ) as Array<{ path: string; hidden?: boolean }>;
}

// 从字段中移除文件
function removeFileFromField(field: any, fileIndex: number) {
  const fieldData = field.parentField
    ? dynamicForm[field.parentField]?.[field.originalName]
    : dynamicForm[field.name];
  
  if (!fieldData || typeof fieldData !== 'object') return;
  
  // 如果是单文件模式
  if ('file' in fieldData && !Array.isArray(fieldData)) {
    clearFileField(field.originalName || field.name, field.parentField);
    return;
  }
  
  // 如果是多文件模式，找到对应的文件并标记为隐藏或删除
  const files = Object.entries(fieldData);
  let count = 0;
  for (const [key, file] of files) {
    if (file && typeof file === 'object' && 'file' in file && !(file as any).hidden) {
      if (count === fileIndex) {
        // 标记为隐藏或删除
        delete fieldData[key];
        return;
      }
      count++;
    }
  }
}

// 验证文件字段
function validateFileFields(): boolean {
  for (const field of fileFields.value) {
    const value = field.parentField
      ? ((dynamicForm[field.parentField] || {}) as any)[field.originalName] || {}
      : dynamicForm[field.name] || ({} as any);
    
    // 检查是否有文件被选择（支持单文件和多文件模式）
    let hasFile = false;
    if (typeof value === 'object') {
      if ('file' in value && !value.hidden) {
        // 单文件模式
        hasFile = Boolean(value.file);
      } else if (!('file' in value)) {
        // 多文件模式：检查是否有任何包含 file 的项
        hasFile = Object.values(value).some(
          (v: any) => v && typeof v === 'object' && 'file' in v && !v.hidden
        );
      }
    }
    
    if (field.required && !hasFile) {
      ElMessage.warning(`请上传${field.label}`);
      return false;
    }
  }
  return true;
}

// 验证文本字段
function validateTextFields(): boolean {
  for (const field of textFields.value) {
    if (field.type === 'dynamic-object') {
      const container = dynamicForm[field.name] || {};
      const visibleKeys = Object.keys(container).filter(key => !(container[key] as any).hidden);
      const hasAny = visibleKeys.length > 0;
      if (field.required && !hasAny) {
        ElMessage.warning(`请添加${field.label}`);
        return false;
      }
    }
    // 修正：允许 boolean/select 字段为 false
    if (
      field.required &&
      (dynamicForm[field.name] === '' ||
        dynamicForm[field.name] === undefined ||
        (dynamicForm[field.name] === null && field.type !== 'boolean' && field.type !== 'select'))
    ) {
      ElMessage.warning(`请填写${field.label}`);
      return false;
    }
    // 针对 select 类型的链方向，允许 false
    if (
      field.required &&
      field.type === 'select' &&
      (dynamicForm[field.name] === null || dynamicForm[field.name] === undefined || dynamicForm[field.name] === '')
    ) {
      ElMessage.warning(`请选择${field.label}`);
      return false;
    }
  }
  return true;
}

// 处理文件上传 - 改为异步处理
async function processFileUploads(): Promise<any[]> {
  const uploads: any[] = [];
  const fileEntries = collectFileEntries(dynamicForm);
  console.log('before collect dynamicForm:', dynamicForm);
  fileEntries.forEach(({ field_name, file }) => {
    uploads.push({
      field_name,
      filename: file.name,
      content_type: file.type || 'application/octet-stream'
    });
  });

  const initiateRes: any = await FileUploadInit(selectedSchema.value.id, uploads);
  const currentUploadUrls = (initiateRes.data?.upload_urls || initiateRes.response.data?.upload_urls || []) as any[];

  const uploadedFiles: any[] = [];
  const uploadPromises: Promise<void>[] = [];
  
  try {
    currentUploadUrls.forEach((u: any) => {
      const promise = (async () => {
        const entry = fileEntries.find(e => e.field_name === u.field_name);
        if (!entry) {
          throw new Error(`上传时未找到对应的文件字段: ${u.field_name}`);
        }

        // 创建上传任务
        const taskId = addUploadTask(entry.file.name);
        const cancelTokenSource = axios.CancelToken.source();
        
        const task = uploadTaskList.value.find(t => t.id === taskId);
        if (task) {
          task.cancelTokenSource = cancelTokenSource;
          task.cancelable = true;
        }

        try {
          await axios.put(u.upload_url, entry.file, {
            headers: {
              'Content-Type': entry.file.type || 'application/octet-stream'
            },
            onUploadProgress: progressEvent => {
              if (progressEvent.total) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                updateUploadTaskProgress(taskId, percent);
              }
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            cancelToken: cancelTokenSource.token
          });

          // 上传成功
          updateUploadTaskStatus(taskId, 'success');

          // 回填路径信息
          const stack: Array<{ obj: Record<string, any>; keyPath: string[] }> = [{ obj: dynamicForm, keyPath: [] }];
          while (stack.length) {
            const { obj, keyPath } = stack.pop()!;
            Object.entries(obj).forEach(([k, v]) => {
              const nextPath = [...keyPath, k];
              if (k === u.field_name && v && typeof v === 'object') {
                (v as any).path = u.s3_key;
              }
              if (v && typeof v === 'object' && !Array.isArray(v)) {
                stack.push({ obj: v as Record<string, any>, keyPath: nextPath });
              }
            });
          }

          // 处理文件信息
          try {
            const sha256 = await hashFile(entry.file);
            uploadedFiles.push({
              field_name: u.field_name,
              origin_filename: entry.file.name,
              s3_key: u.s3_key,
              file_type: entry.file.type || 'application/octet-stream',
              file_size: entry.file.size,
              file_hash: sha256
            });
          } catch {
            uploadedFiles.push({
              field_name: u.field_name,
              origin_filename: entry.file.name,
              s3_key: u.s3_key,
              file_type: entry.file.type || 'application/octet-stream',
              file_size: entry.file.size,
              file_hash: 'error'
            });
          }
        } catch (err: any) {
          if (axios.isCancel(err)) {
            console.log(`任务 ${taskId} 已被用户取消`);
            updateUploadTaskStatus(taskId, 'error', '已取消');
          } else {
            console.error(`任务 ${taskId} 上传失败:`, err?.message);
            updateUploadTaskStatus(taskId, 'error', err?.message || '上传失败');
          }
          // 不再向上抛出错误，允许其他文件继续上传
        }
      })();
      uploadPromises.push(promise);
    });

    // 等待所有上传完成
    await Promise.all(uploadPromises);
  } catch (err: any) {
    console.error('上传过程中出错:', err);
  }

  return uploadedFiles;
}

// 构建描述JSON
function buildDescriptionJson(uploadedFiles: any[]): any {
  const descriptionJson: any = {};

  // 处理非文件字段
  textFields.value.forEach(f => {
    if (f.type === 'dynamic-object') return;
    const val = (dynamicForm as any)[f.name];
    if (val !== undefined) setNestedValue(descriptionJson, f.name, val);
  });

  // 处理文件字段
  uploadedFiles.forEach(uf => {
    setNestedValue(descriptionJson, uf.field_name, {
      path: uf.s3_key,
      file_type: `.${getSuffixFromFileName(uf.origin_filename)}`
    });
  });

  return descriptionJson;
}

// 重置表单
function resetForm() {
  Object.keys(dynamicForm).forEach(k => {
    if (typeof dynamicForm[k] === 'object') {
      dynamicForm[k] = Array.isArray(dynamicForm[k]) ? [] : {};
    } else {
      dynamicForm[k] = '';
    }
  });
}

// 4. 提交表单并上传
async function handleSubmit() {
  if (!selectedSchema.value) return;

  // 验证字段
  if (!validateFileFields() || !validateTextFields()) return;

  uploadLoading.value = true;
  try {
    // 处理文件上传
    const uploadedFiles = await processFileUploads();
    if (uploadedFiles.length === 0) {
      ElMessage.error('文件上传失败');
      uploadLoading.value = false;
      return;
    }
    // 构建描述JSON
    const descriptionJson = buildDescriptionJson(uploadedFiles);

    // 完成上传
    console.log('上传文件信息:', uploadedFiles);
    await FileUploadComplete({
      file_type_id: selectedSchema.value.id,
      file_name: getFileNameFromSchema(),
      description_json: descriptionJson,
      uploaded_files: uploadedFiles
    });
    // 文件上传成功，提示并重置表单
    ElMessage.success('文件上传成功');
    resetForm();
    fetchFileList(); // 刷新文件列表
  } catch (e: any) {
    ElMessage.error(`上传失败: ${e.message || '未知错误'}`);
  } finally {
    uploadLoading.value = false;
  }
}

// 获取分页文件列表
async function fetchFileList(page?: number, pageSize?: number,
  id?: number, name?: string, type?: string) {
  // 如果没有传递参数，使用当前状态中的值
  const currentPage = page ?? fileListPage.value;
  const currentPageSize = pageSize ?? fileListPageSize.value;
  const currentId = id ?? fileListFileId.value;
  const currentName = name ?? fileListFileName.value;
  const currentType = type ?? fileListFileType.value;

  fileListLoading.value = true;
  try {
    const res = await fetchFileListInfo(currentPage, currentPageSize, currentId, currentName, currentType);

    if (Array.isArray(res.data?.results) && res.data?.results.length > 0) {
      fileList.value = res.data.results;
      fileListTotal.value = res.data.count || res.data.results.length;
    } else {
      console.warn('当前系统不存在任何文件');
    }
    fileListPage.value = currentPage;
    fileListPageSize.value = currentPageSize;
  } catch {
    console.warn('获取文件列表失败');
  } finally {
    fileListLoading.value = false;
  }
}

// 获取短标签名称
function getShortLabel(label: string): string {
  if (label.length <= 8) return label;

  // 常见的长标签映射
  const labelMap: Record<string, string> = {
    JSON格式数据文件路径: 'JSON文件',
    bam格式序列文件路径: 'BAM文件',
    'FASTQ格式序列文件路径，双端测序的第一端': 'FASTQ文件1',
    'FASTQ格式序列文件路径，双端测序的另一端': 'FASTQ文件2',
    vcf格式变异文件路径: 'VCF文件',
    count表达文件路径: 'Count文件',
    'count表达文件路径，也许还有更多的file，没删掉这行就说明没确认': 'Count文件',
    raw_count_file: 'Count文件',
    tpm表达文件路径: 'TPM文件',
    fpkm表达文件路径: 'FPKM文件',
    ref的fa文件路径: 'FA文件',
    ref的vcf文件路径: 'VCF文件',
    样本唯一标识符: '样本ID',
    样本来源的生物分子类型: '样本类型',
    基因名称: '基因名',
    '染色体编号，可以是1-22的整数，或X、Y字符串': '染色体',
    关联的文件路径: '文件路径',
    起始位置: '起始位',
    结束位置: '结束位',
    '链方向，true表示正链，false表示负链': '链方向',
    // 添加嵌套字段的标签映射
    json_file: 'JSON文件',
    bam_file: 'BAM文件',
    fq_file1: 'FASTQ文件1',
    fq_file2: 'FASTQ文件2',
    vcf_file: 'VCF文件',
    count_file: 'Count文件',
    tpm_file: 'TPM文件',
    fpkm_file: 'FPKM文件',
    raw_file: '原始文件'
  };

  return labelMap[label] || `${label.substring(0, 8)}...`;
}

// 获取字段的文件类型限制
function getFieldFileAccept(field: any): string {
  // 如果是普通文件字段，使用其 fileType
  if (field.fileType) {
    return getFileAcceptTypes(field.fileType);
  }
  // 如果是动态对象字段（如 Reference_data 的 filePaths），默认不限制
  return getFileAcceptTypes('*');
}

// 获取文件接受类型
function getFileAcceptTypes(fileType: string): string {
  // 根据文件类型返回对应的MIME类型和扩展名
  const typeMap: Record<string, string> = {
    json: '.json,application/json',
    bam: '.bam,application/octet-stream',
    'fastq.gz': '.fastq.gz,.fq.gz,application/gzip',
    fq: '.fq,.fastq,text/plain',
    vcf: '.vcf,text/plain',
    count: '.count,text/plain',
    tpm: '.tpm,text/plain',
    fpkm: '.fpkm,text/plain',
    csu: '.csu,application/octet-stream',
    fa: '.fa,.fasta,text/plain',
    txt: '.txt,text/plain',
    gz: '.gz,application/gzip',
    file: '*/*', // 默认接受所有文件
    path: '*/*' // 路径类型也接受所有文件
  };

  return typeMap[fileType] || '*/*';
}

// 处理搜索
function handleSearch() {
  // 重置到第一页
  fileListPage.value = 1;
  // 更新筛选条件变量
  fileListFileName.value = fileListFileName.value;
  fileListFileId.value = fileListFileId.value ? Number(fileListFileId.value) : 0;
  fileListFileType.value = fileListFileType.value;
  fetchFileList();
}

// 重置筛选条件
function handleResetFilters() {
  fileListFileId.value = 0;
  fileListFileName.value = '';
  fileListFileType.value = '';
  fileListPage.value = 1;
  fetchFileList();
}

// 处理页码变化
function handleCurrentChange(newPage: number) {
  fileListPage.value = newPage;
  fetchFileList();
}

// 处理分页大小变化
function handlePageSizeChange(newSize: number) {
  fileListPageSize.value = newSize;
  fileListPage.value = 1;
  fetchFileList();
}

// 文件详情弹窗相关
const fileDetailDialogVisible = ref(false);
const fileDetailLoading = ref(false);
const fileDetailData = ref<any>(null);

// 获取文件详情接口
async function ShowFileDetail(file_id: number) {
  fileDetailLoading.value = true;
  fileDetailData.value = null;
  try {
    const res = await fetchFileDetail(file_id);
    console.log('file detail response:', res);
    const file_detail = res.data || res.response.data;
    if (file_detail) {
      fileDetailData.value = file_detail;
      fileDetailDialogVisible.value = true;
    } else {
      ElMessage.error('未获取到文件详情');
    }
  } catch (e: any) {
    ElMessage.error(`获取文件详情失败: ${e.message || '未知错误'}`);
  } finally {
    fileDetailLoading.value = false;
  }
}

// 世系弹窗可见性
const lineageDialogVisible = ref(false);
const lineageLoading = ref(false);
const lineageChartRef = ref<HTMLElement>();
const lineageChart = ref<echarts.ECharts>();
const currentFileGenealogy = ref<any>(null);

// 处理世系图对话框关闭
async function handleLineageDialogClose() {
  lineageDialogVisible.value = false;
  lineageChart.value?.dispose();
  lineageChart.value = undefined;
}

// 数据世系相关
async function showLineage(row: any) {
  lineageDialogVisible.value = true;
  lineageLoading.value = true;
  currentFileGenealogy.value = null;

  try {
    const res = await fetchFileGenealogy(row.file_id);
    console.log('genealogy response:', res);

    const genealogyData = res.response?.data || res.data;
    console.log('genealogyData:', genealogyData);

    if (genealogyData && Array.isArray(genealogyData.data) && genealogyData.data.length > 0) {
      currentFileGenealogy.value = genealogyData;
      // 延迟确保DOM已渲染
      await nextTick();
      setTimeout(() => {
        renderLineageGraph(genealogyData.data as any[]);
      }, 100);
    } else {
      ElMessage.warning('暂无世系数据');
      lineageDialogVisible.value = false;
    }
  } catch (e: any) {
    ElMessage.error(`获取世系数据失败: ${e.message || '未知错误'}`);
    lineageDialogVisible.value = false;
  } finally {
    lineageLoading.value = false;
  }
}

// 转换世系数据为ECharts格式
function transformLineageData(data: any[]) {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('No lineage data provided');
    return { nodes: [], links: [], categories: [{ name: 'file' }] };
  }

  const nodeMap = new Map<string, any>();
  const links: any[] = [];
  const fileTypeColorMap = new Map<string, string>();
  
  // 专业配色方案：使用现代渐变色和谐配色
  const colors = [
    { primary: '#4A90E2', light: 'rgba(74, 144, 226, 0.15)' },    // 蓝
    { primary: '#7ED321', light: 'rgba(126, 211, 33, 0.15)' },    // 绿
    { primary: '#F5A623', light: 'rgba(245, 166, 35, 0.15)' },    // 橙
    { primary: '#E94B3C', light: 'rgba(233, 75, 60, 0.15)' },     // 红
    { primary: '#50E3C2', light: 'rgba(80, 227, 194, 0.15)' },    // 青
    { primary: '#BD10E0', light: 'rgba(189, 16, 224, 0.15)' },    // 紫
    { primary: '#FF6B6B', light: 'rgba(255, 107, 107, 0.15)' },   // 珊瑚红
    { primary: '#4ECDC4', light: 'rgba(78, 205, 196, 0.15)' }     // 绿松石
  ];
  let colorIndex = 0;

  // 第一遍：收集所有文件类型
  data.forEach((genealogy) => {
    if (genealogy.file1 && !fileTypeColorMap.has(genealogy.file1.file_type)) {
      fileTypeColorMap.set(genealogy.file1.file_type, colors[colorIndex % colors.length].primary);
      colorIndex++;
    }
    if (genealogy.file2 && !fileTypeColorMap.has(genealogy.file2.file_type)) {
      fileTypeColorMap.set(genealogy.file2.file_type, colors[colorIndex % colors.length].primary);
      colorIndex++;
    }
  });

  // 第二遍：创建节点和连接
  data.forEach((genealogy, index) => {
    console.log(`Processing genealogy ${index}:`, genealogy);

    if (!genealogy.file1 || !genealogy.file2) {
      console.warn(`Skipping genealogy ${index}: missing file1 or file2`);
      return;
    }

    const color1 = fileTypeColorMap.get(genealogy.file1.file_type) || colors[0].primary;
    const color2 = fileTypeColorMap.get(genealogy.file2.file_type) || colors[1].primary;

    // 添加file1节点
    if (!nodeMap.has(genealogy.file1.file_id)) {
      nodeMap.set(genealogy.file1.file_id, {
        id: genealogy.file1.file_id,
        name: genealogy.file1.file_name,
        value: genealogy.file1,
        category: 0,
        symbolSize: 55,
        label: {
          show: true,
          position: 'bottom',
          formatter: (params: any) => {
            const name = genealogy.file1.file_name;
            return name.length > 25 ? `${name.substring(0, 25)}...` : name;
          },
          fontSize: 11,
          color: '#333',
          fontWeight: 'bold',
          distance: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          borderRadius: 3,
          borderColor: '#e0e0e0',
          borderWidth: 0.5,
          padding: [4, 7],
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          shadowBlur: 3
        },
        itemStyle: {
          color: color1,
          borderColor: '#ffffff',
          borderWidth: 3.5,
          shadowBlur: 16,
          shadowColor: color1 + '40',
          shadowOffsetY: 4,
          opacity: 0.95
        },
        emphasis: {
          itemStyle: {
            color: color1,
            borderColor: '#fff',
            borderWidth: 4,
            shadowBlur: 24,
            shadowColor: color1 + '60',
            shadowOffsetY: 6
          },
          label: {
            fontSize: 12,
            fontWeight: 'bold',
            color: '#fff',
            backgroundColor: color1,
            borderRadius: 4,
            padding: 5,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
            shadowBlur: 6
          }
        },
        tooltip: {
          show: true
        }
      });
    }

    // 添加file2节点
    if (!nodeMap.has(genealogy.file2.file_id)) {
      nodeMap.set(genealogy.file2.file_id, {
        id: genealogy.file2.file_id,
        name: genealogy.file2.file_name,
        value: genealogy.file2,
        category: 0,
        symbolSize: 55,
        label: {
          show: true,
          position: 'bottom',
          formatter: (params: any) => {
            const name = genealogy.file2.file_name;
            return name.length > 25 ? `${name.substring(0, 25)}...` : name;
          },
          fontSize: 11,
          color: '#333',
          fontWeight: 'bold',
          distance: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          borderRadius: 3,
          borderColor: '#e0e0e0',
          borderWidth: 0.5,
          padding: [4, 7],
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          shadowBlur: 3
        },
        itemStyle: {
          color: color2,
          borderColor: '#ffffff',
          borderWidth: 3.5,
          shadowBlur: 16,
          shadowColor: color2 + '40',
          shadowOffsetY: 4,
          opacity: 0.95
        },
        emphasis: {
          itemStyle: {
            color: color2,
            borderColor: '#fff',
            borderWidth: 4,
            shadowBlur: 24,
            shadowColor: color2 + '60',
            shadowOffsetY: 6
          },
          label: {
            fontSize: 12,
            fontWeight: 'bold',
            color: '#fff',
            backgroundColor: color2,
            borderRadius: 4,
            padding: 5,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
            shadowBlur: 6
          }
        },
        tooltip: {
          show: true
        }
      });
    }

    // 添加连接线（带箭头，从file1指向file2）
    const taskCount = genealogy.task?.task_units?.length || 0;
    links.push({
      source: genealogy.file1.file_id,
      target: genealogy.file2.file_id,
      value: genealogy.task,
      label: {
        show: true,
        position: 'middle',
        fontSize: 10,
        color: '#555',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#d0d0d0',
        borderWidth: 1,
        borderRadius: 3,
        padding: [5, 8],
        fontWeight: 'bold',
        shadowColor: 'rgba(0, 0, 0, 0.08)',
        shadowBlur: 4
      },
      lineStyle: {
        width: 2.8,
        color: 'rgba(180, 180, 180, 0.7)',
        curveness: 0.15,
        opacity: 0.75,
        type: 'solid'
      },
      symbolSize: [10, 18],
      symbol: ['circle', 'arrow'],
      smooth: true
    });
  });

  console.log('Transformed nodes:', Array.from(nodeMap.values()));
  console.log('Transformed links:', links);
  console.log('File type color map:', fileTypeColorMap);

  return {
    nodes: Array.from(nodeMap.values()),
    links,
    categories: [{ name: 'file' }],
    fileTypeColorMap
  };
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

  // 计算节点位置（横向布局：左往右）
  const nodePositions = new Map<string, [number, number]>();
  const levelWidth = 200;
  const nodeHeight = 150;

  Object.entries(levels).forEach(([level, nodes]: [string, any[]]) => {
    const levelIndex = Number.parseInt(level, 10);
    const x = levelIndex * levelWidth + 50;
    const totalHeight = nodes.length * nodeHeight;
    const startY = 50 - totalHeight / 2;

    nodes.forEach((node: any, index: number) => {
      const y = startY + index * nodeHeight;
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
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(30, 30, 40, 0.98)',
      borderColor: '#5470c6',
      borderWidth: 1.5,
      textStyle: {
        color: '#fff',
        fontSize: 13,
        fontFamily: "'Segoe UI', 'Microsoft YaHei', sans-serif"
      },
      padding: [12, 16],
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const nodeData = params.data.value;
          const timestamp = new Date(nodeData.created_time).toLocaleString('zh-CN');
          return `
            <div style="line-height: 1.8;">
              <div style="font-size: 14px; font-weight: bold; color: #ffd700; margin-bottom: 8px;">📄 文件信息</div>
              <div style="color: #e0e0e0; font-size: 12px;">
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 文件名:</span> <span style="color: #fff; font-weight: 500;">${nodeData.file_name}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 文件类型:</span> <span style="color: #90ee90; font-weight: 500;">${nodeData.file_type}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 文件ID:</span> <span style="color: #fff;">${nodeData.file_id}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 用户:</span> <span style="color: #fff;">${nodeData.user || 'N/A'}</span></div>
              </div>
            </div>
          `;
        } else if (params.dataType === 'edge') {
          const taskData = params.data.value;
          if (!taskData || !taskData.task_units) {
            return '<div style="padding: 8px;">加载中...</div>';
          }
          const taskCount = taskData.task_units.length;
          const taskUnits = taskData.task_units
            .map((u: any) => `<li style="margin: 3px 0; color: #90ee90;">✓ ${u.task_unit_name}</li>`)
            .join('');
          const timestamp = new Date(taskData.time).toLocaleString('zh-CN');
          return `
            <div style="line-height: 1.8;">
              <div style="font-size: 14px; font-weight: bold; color: #ffd700; margin-bottom: 8px;">⚙️ 任务信息</div>
              <div style="color: #e0e0e0; font-size: 12px;">
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 任务数:</span> <span style="color: #90ee90; font-weight: bold;">${taskCount}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 执行用户:</span> <span style="color: #fff;">${taskData.user || 'N/A'}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 执行时间:</span> <span style="color: #bbb; font-size: 11px;">${timestamp}</span></div>
                <div style="margin-top: 8px;"><span style="color: #87ceeb;">▸ 任务单元:</span></div>
                <ul style="margin: 4px 0 0 16px; padding: 0; list-style: none;">
                  ${taskUnits}
                </ul>
              </div>
            </div>
          `;
        }
        return '';
      }
    },
    legend: [
      {
        data: ['file'],
        left: '5%',
        top: '5%',
        textStyle: {
          color: '#666',
          fontSize: 12,
          fontWeight: 500
        },
        itemGap: 20
      }
    ],
    animationDuration: 500,
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
        focusNodeAdjacency: true,
        draggable: true,
        label: {
          show: true,
          position: 'bottom',
          fontSize: 11,
          color: '#333',
          fontWeight: 'bold',
          distance: 8,
          formatter: (params: any) => {
            const name = params.data.name || params.data.id;
            return name.length > 25 ? `${name.substring(0, 25)}...` : name;
          },
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: 2,
          padding: [3, 6],
          borderColor: '#ddd',
          borderWidth: 0.5
        },
        edgeLabel: {
          show: true,
          position: 'middle',
          fontSize: 10,
          color: '#555',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: [3, 5],
          borderRadius: 2,
          formatter: (params: any) => {
            const taskData = params.data.value;
            if (taskData && taskData.task_units) {
              return `📋 ${taskData.task_units.length} 个任务`;
            }
            return '';
          }
        },
        lineStyle: {
          width: 2.5,
          color: '#bbb',
          curveness: 0.2,
          opacity: 0.6,
          type: 'solid'
        },
        itemStyle: {
          color: '#5470c6',
          borderColor: '#fff',
          borderWidth: 2.5,
          shadowBlur: 12,
          shadowColor: 'rgba(84, 112, 198, 0.3)',
          shadowOffsetY: 3
        },
        emphasis: {
          focus: 'adjacency',
          itemStyle: {
            color: '#ffa726',
            borderColor: '#fff',
            borderWidth: 3.5,
            shadowBlur: 20,
            shadowColor: 'rgba(255, 167, 38, 0.5)',
            shadowOffsetY: 4
          },
          label: {
            fontSize: 12,
            fontWeight: 'bold',
            color: '#000',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 3,
            padding: 4,
            shadowColor: 'rgba(0, 0, 0, 0.15)',
            shadowBlur: 5
          },
          lineStyle: {
            width: 3.5,
            color: '#ffa726',
            opacity: 0.9,
            shadowColor: 'rgba(255, 167, 38, 0.3)',
            shadowBlur: 10
          }
        }
      }
    ]
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
      ElMessage.info(`📄 ${nodeData.file_name} (${nodeData.file_type})`);
    } else if (params.dataType === 'edge') {
      const taskData = params.data.value;
      if (taskData && taskData.task_units) {
        const taskNames = taskData.task_units.map((u: any) => u.task_unit_name).join(', ');
        ElMessage.info(`⚙️ 任务数: ${taskData.task_units.length} | 任务: ${taskNames}`);
      }
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

onMounted(() => {
  fetchSchemas();
  fetchFileStats();
  fetchFileList();
});
</script>

<template>
  <div class="transfer-container equal-height-flex">
    <!-- 主功能区 -->
    <ElCard shadow="hover" class="transfer-card main-card">
      <div class="title-bar">
        <ElIcon class="title-icon" color="#409EFF"><UploadFilled /></ElIcon>
        <span class="main-title main-title-text">数据入湖</span>
      </div>
      <!-- 新增统计信息 -->
      <div class="stats-line">
        <span>入湖数据总数：</span>
        <b class="stats-num">{{ totalFileCount }}</b>
        <span class="stats-gap">总数据量：</span>
        <b class="stats-num">{{ (totalFileSize / 1024 / 1024).toFixed(2) }} MB</b>
        <span class="stats-gap">最后上传时间：</span>
        <b class="stats-num">{{ lastUploadTime }}</b>
      </div>
      <ElDivider content-position="center" style="font-size: 16px">数据类型选择</ElDivider>
      <div class="schema-selection-section">
        <ElForm label-width="90px" style="font-size: 15px">
          <ElFormItem label="数据类型">
            <div style="display: flex; gap: 10px; align-items: center">
              <ElSelect v-model="selectedSchemaId" placeholder="请选择数据类型" class="schema-select" filterable>
                <ElOption v-for="item in filteredSchemas" :key="item.id" :label="`${item.name}`" :value="item.id">
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
      <ElDivider content-position="center" style="font-size: 16px">填写信息并上传文件</ElDivider>
      <div class="file-upload-section">
        <ElForm v-if="selectedSchema" label-width="140px" style="margin-bottom: 18px">
          <!-- 文本输入字段 -->
          <template v-for="field in textFields" :key="field.name">
            <ElFormItem :label="getShortLabel(field.label)" :required="field.required">
              <!-- 下拉选择器 -->
              <template v-if="field.type === 'select'">
                <ElSelect
                  v-model="dynamicForm[field.name]"
                  :placeholder="field.description"
                  :class="{ 'required-field': field.required }"
                >
                  <ElOption
                    v-for="option in field.options"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </ElSelect>
              </template>
              <!-- 布尔值开关 -->
              <template v-else-if="field.type === 'boolean'">
                <ElSwitch v-model="dynamicForm[field.name]" :class="{ 'required-field': field.required }" />
              </template>
              <!-- 动态对象类型（如 Reference_data 的 filePaths）- 使用统一的多文件上传模板 -->
              <template v-else-if="field.type === 'dynamic-object'">
                <ElFormItem :required="field.required">
                  <div class="upload-container">
                    <div class="upload-row">
                      <ElUpload
                        :multiple="true"
                        :auto-upload="false"
                        :show-file-list="false"
                        :accept="getFieldFileAccept(field)"
                        @change="files => {
                          const rawFiles = Array.isArray(files) ? files.map(f => f.raw) : files.raw ? [files.raw] : [];
                          handleFileChange(field.name, rawFiles);
                        }"
                      >
                        <ElButton type="primary">选择文件</ElButton>
                      </ElUpload>
                      
                      <div class="upload-tip">
                        <ElIcon><Upload /></ElIcon>
                        <span>{{ field.description }}</span>
                      </div>
                    </div>
                    
                    <!-- 已上传文件列表 -->
                    <div v-if="getUploadedFileCount(field) > 0" class="uploaded-files-list">
                      <div
                        v-for="(fileInfo, idx) in getUploadedFilesForField(field)"
                        :key="idx"
                        class="uploaded-file-item"
                      >
                        <span class="file-name">{{ getFileName(fileInfo.path) }}</span>
                        <ElButton
                          type="danger"
                          size="small"
                          link
                          @click="removeFileFromField(field, idx)"
                        >
                          移除
                        </ElButton>
                      </div>
                    </div>
                  </div>
                </ElFormItem>
              </template>
              <!-- 数字输入 -->
              <template v-else-if="field.type === 'number'">
                <ElInput
                  v-model="dynamicForm[field.name]"
                  :placeholder="field.description"
                  type="number"
                  :class="{ 'required-field': field.required }"
                />
              </template>
              <!-- 数组类型（可扩展） -->
              <template v-else-if="field.type === 'array'">
                <ElInput
                  v-model="dynamicForm[field.name]"
                  :placeholder="field.description"
                  type="text"
                  :class="{ 'required-field': field.required }"
                />
              </template>
              <!-- 普通文本输入 -->
              <template v-else>
                <ElInput
                  v-model="dynamicForm[field.name]"
                  :placeholder="field.description"
                  type="text"
                  :class="{ 'required-field': field.required }"
                />
              </template>
            </ElFormItem>
          </template>

          <!-- 文件上传字段（多文件） -->
          <template v-for="field in fileFields" :key="field.name">
            <ElFormItem :label="getShortLabel(field.displayLabel || field.label)" :required="field.required">
              <div class="upload-container">
                <div class="upload-row">
                  <ElUpload
                    :multiple="true"
                    :auto-upload="false"
                    :show-file-list="false"
                    :accept="getFieldFileAccept(field)"
                    @change="files => {
                      const rawFiles = Array.isArray(files) ? files.map(f => f.raw) : files.raw ? [files.raw] : [];
                      handleFileChange(field.name, rawFiles);
                    }"
                  >
                    <ElButton type="primary">选择文件</ElButton>
                  </ElUpload>
                  
                  <div class="upload-tip">
                    <ElIcon><Upload /></ElIcon>
                    <span>{{ field.description }}</span>
                  </div>
                </div>
                
                <!-- 已上传文件列表 -->
                <div v-if="getUploadedFileCount(field) > 0" class="uploaded-files-list">
                  <div
                    v-for="(fileInfo, idx) in getUploadedFilesForField(field)"
                    :key="idx"
                    class="uploaded-file-item"
                  >
                    <span class="file-name">{{ getFileName(fileInfo.path) }}</span>
                    <ElButton
                      type="danger"
                      size="small"
                      link
                      @click="removeFileFromField(field, idx)"
                    >
                      移除
                    </ElButton>
                  </div>
                </div>
              </div>
            </ElFormItem>
          </template>

          <ElFormItem>
            <ElButton type="primary" :loading="uploadLoading" @click="handleSubmit">提交并上传</ElButton>
          </ElFormItem>
        </ElForm>
      </div>
    </ElCard>

    <div class="history-list-area">
      <ElCard shadow="hover" class="history-card">
        <div style="font-weight: bold; font-size: large; color: #409eff; margin-bottom: 10px">文件列表</div>
        <!-- 搜索和筛选区域 -->
        <div class="filter-area">
          <div class="filter-row">
            <ElInput
              v-model="fileListFileName"
              placeholder="文件名"
              clearable
              style="flex: 1; min-width: 180px; max-width: 300px;"
            >
              <template #prefix>
                <ElIcon><Search /></ElIcon>
              </template>
            </ElInput>
            
            <ElInput
              :value="fileListFileId === 0 ? '' : fileListFileId"
              v-model.number="fileListFileId"
              placeholder="文件ID"
              type="number"
              clearable
              :min="1"
              style="flex: 1; min-width: 120px; max-width: 180px; margin: 0 10px;"
            />
            
            <ElSelect
              v-model="fileListFileType"
              placeholder="文件类型"
              clearable
              style="flex: 1; min-width: 150px; max-width: 200px;"
            >
              <ElOption label="所有类型" value="" />
              <ElOption label="JSON" value="json" />
              <ElOption label="BAM" value="bam" />
              <ElOption label="FASTQ" value="fastq" />
              <ElOption label="VCF" value="vcf" />
              <ElOption label="Count" value="count" />
              <ElOption label="TPM" value="tpm" />
              <ElOption label="FPKM" value="fpkm" />
              <ElOption label="其他" value="other" />
            </ElSelect>
            
            <ElButton
              type="primary"
              @click="handleSearch"
              style="margin: 0 5px;"
            >
              查询
            </ElButton>
            
            <ElButton
              type="default"
              @click="handleResetFilters"
            >
              重置
            </ElButton>
          </div>
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
                <ElButton type="success" size="small" @click="showLineage(scope.row)">查看世系</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
        <div class="history-pagination">
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
    <div class="upload-task-panel" v-if="uploadTaskList.length > 0">
      <div class="task-panel-header" @click="uploadTaskPanelCollapsed = !uploadTaskPanelCollapsed">
        <div class="task-panel-title">
          <ElIcon class="task-icon"><Upload /></ElIcon>
          <span>正在上传文件数 ({{ uploadTaskList.filter(t => t.status === 'uploading').length }})</span>
        </div>
        <ElIcon class="collapse-icon" :style="{ transform: uploadTaskPanelCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }">
          <CaretTop />
        </ElIcon>
      </div>
      
      <div v-show="!uploadTaskPanelCollapsed" class="task-panel-content">
        <div v-for="task in uploadTaskList" :key="task.id" class="task-item">
          <div class="task-info">
            <span class="task-name">{{ task.fileName }}</span>
            <span class="task-status" :class="task.status">
              {{ task.status === 'uploading' ? (task.canceling ? '取消中...' : '上传中') : task.status === 'success' ? '成功' : '失败' }}
            </span>
          </div>
          <ElProgress 
            :percentage="task.progress" 
            :status="task.status === 'error' ? 'exception' : task.status === 'success' ? 'success' : ''"
            :show-text="false"
            class="task-progress"
          />
          <div v-if="task.error" class="task-error">{{ task.error }}</div>
          <div class="task-actions">
            <ElButton 
              v-if="task.status === 'uploading'" 
              size="small" 
              type="danger"
              :disabled="task.canceling"
              text
              @click="cancelUploadTask(task.id)"
            >
              {{ task.canceling ? '取消中...' : '取消' }}
            </ElButton>
            <ElButton 
              v-if="task.status !== 'uploading'"
              size="small" 
              type="primary" 
              text
              @click="removeUploadTask(task.id)"
            >
              移除
            </ElButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 文件详情弹窗 -->
    <ElDialog
      v-model="fileDetailDialogVisible"
      title="文件详情"
      width="750px"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :show-close="true"
      align-center
      class="file-detail-dialog"
    >
      <div v-if="fileDetailLoading" class="file-detail-loading">
        <ElIcon><i class="el-icon-loading"></i></ElIcon>
        加载中...
      </div>
      <div v-else-if="fileDetailData">
        <ElDescriptions :column="2" border class="file-detail-desc">
          <ElDescriptionsItem label="文件ID">{{ fileDetailData.file_id }}</ElDescriptionsItem>
          <ElDescriptionsItem label="文件名">{{ fileDetailData.file_name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="类型">{{ fileDetailData.file_type }}</ElDescriptionsItem>
          <ElDescriptionsItem label="大小">{{ fileDetailData.file_size }} 字节</ElDescriptionsItem>
          <ElDescriptionsItem label="上传时间">{{ fileDetailData.created_time }}</ElDescriptionsItem>
          <ElDescriptionsItem label="上传用户">
            <span v-if="fileDetailData.upload_user">
              {{ fileDetailData.upload_user.username }} (ID: {{ fileDetailData.upload_user.user_id }})
            </span>
          </ElDescriptionsItem>
        </ElDescriptions>
        <ElDivider content-position="left">描述信息</ElDivider>
        <div class="desc-json-area">
          <ElCollapse>
            <div class="desc-json-scroll">
              <pre class="desc-json-pre">{{ JSON.stringify(fileDetailData.description_json, null, 2) }}</pre>
            </div>
          </ElCollapse>
        </div>
        <ElDivider content-position="left">子文件列表</ElDivider>
        <ElTable
          v-if="fileDetailData.uploaded_subfiles && fileDetailData.uploaded_subfiles.length"
          :data="fileDetailData.uploaded_subfiles"
          size="small"
          border
          class="file-detail-subfile-table"
        >
          <ElTableColumn prop="origin_filename" label="原始文件名" show-overflow-tooltip />
          <ElTableColumn prop="field_name" label="字段名" show-overflow-tooltip />
          <ElTableColumn prop="file_type" label="类型" show-overflow-tooltip />
          <ElTableColumn prop="file_size" label="大小(字节)" show-overflow-tooltip />
          <ElTableColumn prop="file_hash" label="哈希值" show-overflow-tooltip />
          <ElTableColumn prop="upload_time" label="上传时间" show-overflow-tooltip />
        </ElTable>
        <div v-else style="color: #aaa; text-align: center">无子文件</div>
      </div>
      <div v-else style="color: #aaa; text-align: center">无详情数据</div>
      <template #footer>
        <ElButton type="primary" @click="fileDetailDialogVisible = false">关闭</ElButton>
      </template>
    </ElDialog>

    <!-- 数据世系展示弹窗 -->
    <ElDialog
      v-model="lineageDialogVisible"
      title="📊 文件数据世系图"
      width="90%"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :show-close="true"
      align-center
      @close="handleLineageDialogClose"
    >
      <div v-if="lineageLoading" class="lineage-overlay">
        <ElIcon class="is-loading"><i class="el-icon-loading"></i></ElIcon>
        <span style="margin-left: 8px">加载中...</span>
      </div>
      <div v-else class="lineage-container">
        <div ref="lineageChartRef" class="lineage-graph"></div>
        <div v-if="!currentFileGenealogy || !currentFileGenealogy.data.length" class="lineage-overlay">
          <span>暂无世系数据</span>
        </div>
      </div>
      <template #footer>
        <ElButton type="primary" @click="handleLineageDialogClose">关闭</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.equal-height-flex {
  padding: 1% 1% 1% 1%;
  display: flex;
  gap: 1%;
  align-items: stretch;
  /* 新增：让两栏自适应宽度 */
  flex-wrap: wrap;
}

.title-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(12px, 2.2vh, 24px);
}
.title-icon {
  font-size: clamp(24px, 2.2vw, 36px);
  margin-right: 0.875rem;
}
.main-title-text {
  font-size: clamp(1.5rem, 2vw + 0.5rem, 2.25rem);
  letter-spacing: 0.06em;
}
.stats-line {
  text-align: center;
  margin-bottom: clamp(8px, 1.6vh, 16px);
  color: #666;
}
.stats-line .stats-num {
  color: #409eff;
}
.stats-line .stats-gap {
  margin-left: clamp(12px, 2.2vw, 24px);
}

.main-card {
  flex: 1 1 380px;
  min-width: 320px;
  max-width: 100%;
  /* 新增：让主卡片高度自适应父容器 */
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  box-sizing: border-box;
  flex: 0 1 45%;
}

.history-list-area {
  min-width: 320px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-left: 0;
  box-sizing: border-box;
  flex: 0 1 54%;
}

.history-card {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow: visible;
  height: 100%;
}

.history-table-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: auto;
}

.history-pagination {
  flex-shrink: 0;
  padding-top: 12px;
  padding-bottom: 8px;
  border-top: 1px solid #ebeef5;
  background: #fafcff;
}

/* 主卡片美化 */
.transfer-card {
  border-radius: 20px;
  box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.1);
  padding: clamp(16px, 3vw, 38px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px);
  background: var(--el-bg-color, #fafcff);
  height: 100%;
  box-sizing: border-box;
  transition: background 0.3s;
}

.el-upload {
  width: 100%;
}
.el-upload__tip {
  color: #909399;
}

/* 动态对象样式 */
.dynamic-object-container {
  width: 100%;
}

.dynamic-object-item {
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background-color: #fafafa;
}

.dynamic-object-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.dynamic-object-row .el-button {
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  color: #409eff;
  font-size: 12px;
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文件上传区域美化 */
.upload-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.2vw, 12px);
}

.upload-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  color: #909399;
  padding: 0.375rem 0.625rem;
  background: #f5f7fa;
  border-radius: 4px;
  border-left: 3px solid #409eff;
  box-sizing: border-box;
  white-space: nowrap;
}

.upload-tip .el-icon {
  font-size: 14px;
  color: #409eff;
}

/* 已上传文件列表样式 */
.uploaded-files-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
  max-height: 150px;
  overflow-y: auto;
}

.uploaded-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  background-color: #fff;
  border-radius: 3px;
  border: 1px solid #e8e8e8;
  font-size: 12px;
}

.uploaded-file-item .file-name {
  flex: 1;
  color: #409eff;
  margin-left: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 表单标签优化 */
.el-form-item__label {
  font-weight: 500;
  color: #303133;
  min-width: 8rem;
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文件上传按钮美化 */
.upload-container .el-upload {
  display: flex;
  align-items: center;
  gap: 8px;
}

.upload-container .el-button {
  border-radius: 6px;
  font-weight: 500;
  height: 2.25rem;
  line-height: 1;
}

/* 已选择文件名样式 */
.upload-container .el-upload span {
  font-size: 13px;
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

/* 表单整体美化 */
.el-form-item {
  margin-bottom: 1.25rem;
}

.el-form-item__content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 输入框美化 */
.el-input {
  border-radius: 6px;
  width: 70%;
  /* 防止闪烁 */
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: auto;
}

.el-input__inner {
  border-radius: 6px;
  transition: all 0.3s;
}

.el-input__inner:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .history-list-area .el-card {
    background: var(--el-bg-color-overlay, #232324);
  }

  .transfer-card {
    background: var(--el-bg-color-overlay, #232324);
  }

  .upload-tip {
    background: var(--el-bg-color-overlay);
    color: var(--el-text-color-regular);
    border-left-color: var(--el-color-primary);
  }

  .upload-tip .el-icon {
    color: var(--el-color-primary);
  }

  .el-form-item__label {
    color: var(--el-text-color-primary);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .upload-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .upload-tip {
    width: 100%;
    justify-content: center;
  }

  .schema-select,
  .search-input {
    width: 100% !important;
  }
}

/* 输入与选择器宽度（随视口自适应） */
.schema-select {
  width: min(32rem, 100%);
}
.search-input {
  width: min(26rem, 70%);
}

/* 数据类型选择区域居中 */
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

/* 文件上传区域居中 */
.file-upload-section {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

/* 世系图容器样式 */
.lineage-container {
  width: 100%;
  height: 70vh;
  display: flex;
  position: relative;
  background: #fff;
}

.lineage-graph {
  flex: 1;
  height: 100%;
  min-height: 400px;
  position: relative;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: linear-gradient(135deg, #fafcff 0%, #f5f8fd 100%);
  overflow: hidden;
}

.lineage-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  z-index: 20;
  font-size: 14px;
  pointer-events: none;
}

.lineage-overlay .is-loading {
  font-size: 24px;
  color: #409eff;
  animation: spin 1s linear infinite;
}

.filter-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
}

.filter-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
}

.filter-row > :deep(.el-input) {
  min-width: 0;
  flex-shrink: 0;
}

.filter-row > :deep(.el-select) {
  min-width: 0;
  flex-shrink: 0;
}

.filter-row > .el-button {
  flex-shrink: 0;
  white-space: nowrap;
}

@media (max-width: 1400px) {
  .filter-row {
    flex-wrap: wrap;
  }
  
  .filter-row > :deep(.el-input),
  .filter-row > :deep(.el-select) {
    flex: 0 1 calc(50% - 6px) !important;
    max-width: 100% !important;
  }
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-row > :deep(.el-input),
  .filter-row > :deep(.el-select) {
    flex: 1 !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 5px 0 !important;
  }
  
  .filter-row > .el-button {
    width: 100%;
    margin: 5px 0 !important;
  }
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .lineage-container {
    height: 50vh;
  }

  .lineage-graph {
    min-height: 300px;
  }
}

/* 上传任务面板样式 */
.upload-task-panel {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 400px;
  max-height: 500px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 999;
  display: flex;
  flex-direction: column-reverse;
}

.task-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
  cursor: pointer;
  user-select: none;
  background: #f5f7fa;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
}

.task-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #303133;
}

.task-icon {
  font-size: 16px;
  color: #409eff;
}

.collapse-icon {
  font-size: 14px;
  transition: transform 0.3s;
}

.task-panel-content {
  flex: 1;
  overflow-y: auto;
  max-height: 450px;
  display: flex;
  flex-direction: column-reverse;
}

.task-item {
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
  border-bottom: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item:first-child {
  border-top: none;
}

.task-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.task-name {
  flex: 1;
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 3px;
  white-space: nowrap;
}

.task-status.uploading {
  background: #e6f7ff;
  color: #0050b3;
}

.task-status.success {
  background: #f6ffed;
  color: #274e0f;
}

.task-status.error {
  background: #fff1f0;
  color: #820014;
}

.task-progress {
  width: 100%;
}

.task-error {
  font-size: 12px;
  color: #f56c6c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .upload-task-panel {
    width: 320px;
    bottom: 10px;
    left: 10px;
  }

  .task-panel-content {
    max-height: 350px;
  }
}

@media (prefers-color-scheme: dark) {
  .upload-task-panel {
    background: var(--el-bg-color-overlay, #232324);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
  }

  .task-panel-header {
    border-top-color: var(--el-border-color);
    background: var(--el-bg-color);
  }

  .task-panel-title {
    color: var(--el-text-color-primary);
  }

  .task-item {
    border-top-color: var(--el-border-color);
  }

  .task-name {
    color: var(--el-text-color-regular);
  }
}
</style>
