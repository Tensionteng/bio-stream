<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Search, Upload, UploadFilled } from '@element-plus/icons-vue';
import {
  FileUploadComplete,
  FileUploadInit,
  fetchFileListInfo,
  fetchFileSchemaInfo,
  fetchFileStatistics
} from '@/service/api/file';
import axios from 'axios';
import { createSHA256, createMD5 } from 'hash-wasm';

async function hashFile(file: File) {
  const md5 = await createMD5();
  const chunkSize = 4 * 1024 * 1024; // 4MB 一块
  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    const buffer = await chunk.arrayBuffer();
    md5.update(new Uint8Array(buffer));
    offset += chunkSize;
  }
  return md5.digest('hex');
}

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
  if (typeof prop.pattern === 'string' && prop.pattern.length > 0) return true;
  if (propName.toLowerCase().includes('file')) return true;
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

// 处理文件变更
function handleFileChange(field: string, file: File, key?: string | number) {
  // 确保 dynamicForm[field] 已初始化为对象
  if (!dynamicForm[field] || typeof dynamicForm[field] !== 'object') {
    dynamicForm[field] = {};
  }
  console.log('dynamicform after selected:', dynamicForm);
  // 动态对象子项
  if (key !== undefined) {
    handleDynamicObjectFileChange(field, file, key);
    return;
  }

  const fileField = fileFields.value.find(f => f.name === field);
  if (!fileField) {
    ElMessage.error('字段配置错误');
    return;
  }

  // 验证文件格式
  if (!validateFileFormat(fileField, file.name)) return;

  // 更新文件字段
  updateFileField(fileField, file);
}

// 动态对象处理函数
function addDynamicObjectItem(fieldName: string) {
  if (!dynamicForm[fieldName]) {
    dynamicForm[fieldName] = {};
  }
  // 优先复用 hidden 的项
  const hiddenKey = Object.entries(dynamicForm[fieldName]).find(
    ([, v]) => v && typeof v === 'object' && 'hidden' in v && (v as { hidden?: boolean }).hidden
  )?.[0];
  if (hiddenKey) {
    dynamicForm[fieldName][hiddenKey] = {
      path: '',
      file_type: '',
      hidden: false
    };
    return;
  }
  // 没有 hidden 的项则新建
  const existingKeys = Object.keys(dynamicForm[fieldName]);
  let nextIndex = 1;
  while (existingKeys.includes(`${nextIndex}`)) {
    nextIndex += 1;
  }
  const key = `${nextIndex}`;
  dynamicForm[fieldName][key] = {
    path: '',
    file_type: '',
    hidden: false
  };
}

function removeDynamicObjectItem(fieldName: string, key: string | number) {
  if (dynamicForm[fieldName] && dynamicForm[fieldName][key]) {
    // 使用隐藏标记而不是删除，避免 lint 检查问题
    dynamicForm[fieldName][key] = {
      path: '',
      file_type: '',
      hidden: true // 添加隐藏标记
    };

    // 如果该字段下没有任何项目了，清理整个字段
    if (Object.keys(dynamicForm[fieldName]).length === 0) {
      // 重置为空对象
      dynamicForm[fieldName] = {};
    }
  }
}

function handleAddDynamicObjectFile(fieldName: string, file: File) {
  if (!file) return;
  if (!dynamicForm[fieldName]) dynamicForm[fieldName] = {};
  // 优先复用 hidden 的项
  const hiddenKey = Object.entries(dynamicForm[fieldName]).find(
    ([, v]) => v && typeof v === 'object' && 'hidden' in v && (v as { hidden?: boolean }).hidden
  )?.[0];
  if (hiddenKey) {
    dynamicForm[fieldName][hiddenKey] = {
      path: file.name,
      file_type: getFileTypeFromExtension(file.name),
      file,
      hidden: false
    };
    return;
  }
  // 没有 hidden 的项则新建
  const existingKeys = Object.keys(dynamicForm[fieldName]);
  let nextIndex = 1;
  while (existingKeys.includes(`${nextIndex}`)) {
    nextIndex += 1;
  }
  const key = `${nextIndex}`;
  dynamicForm[fieldName][key] = {
    path: file.name,
    file_type: getFileTypeFromExtension(file.name),
    file,
    hidden: false
  };
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
    if (v && typeof v === 'object' && 'file' in v && v.file && !(v as any).hidden) {
      // 只用当前 key 作为 field_name，避免重复拼接
      const fieldName = k; // 只用叶子节点 key
      results.push({ path: currentPath, field_name: fieldName, file: v.file as File });
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      results.push(...collectFileEntries(v as Record<string, any>, currentPath));
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

  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const patternMatch = fileField.pattern.match(/\\([^.]+)\$?/);
  const expectedExtension = patternMatch ? patternMatch[1].toLowerCase() : '';

  let isValidFormat = false;
  if (expectedExtension && fileExtension === expectedExtension) {
    isValidFormat = true;
  }

  if (!isValidFormat) {
    try {
      const patternRegex = new RegExp(fileField.pattern);
      if (patternRegex.test(fileName)) {
        isValidFormat = true;
      }
    } catch {
      console.warn('Invalid regex pattern:', fileField.pattern);
    }
  }

  if (!isValidFormat) {
    const expectedFormat = expectedExtension
      ? `.${expectedExtension}`
      : fileField.pattern.replace(/\\\./g, '.').replace(/\$/g, '');
    ElMessage.error(`文件格式不正确，请上传 ${expectedFormat} 格式的文件`);
    return false;
  }

  return true;
}

// 更新文件字段
function updateFileField(fileField: any, file: File) {
  // 先清理旧的文件信息
  clearFileField(fileField.originalName || fileField.name, fileField.parentField);

  // 重新创建完整的文件对象
  const fileInfo = {
    path: file.name,
    file_type: getFileTypeFromExtension(file.name),
    file
  };

  // 确保 dynamicForm 结构存在
  if (fileField.parentField) {
    if (!dynamicForm[fileField.parentField] || typeof dynamicForm[fileField.parentField] !== 'object') {
      dynamicForm[fileField.parentField] = {};
    }
    dynamicForm[fileField.parentField][fileField.originalName] = { ...fileInfo };
  } else {
    if (!dynamicForm[fileField.name] || typeof dynamicForm[fileField.name] !== 'object') {
      dynamicForm[fileField.name] = {};
    }
    dynamicForm[fileField.name] = { ...fileInfo };
  }
}

// 验证文件字段
function validateFileFields(): boolean {
  for (const field of fileFields.value) {
    const value = field.parentField
      ? ((dynamicForm[field.parentField] || {}) as any)[field.originalName] || {}
      : dynamicForm[field.name] || ({} as any);
    const hasFile = Boolean(value && value.file);
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
      // 只计算没有隐藏标记的组件
      const visibleKeys = Object.keys(container).filter(key => !(container[key] as any).hidden);
      const hasAny = visibleKeys.length > 0;
      if (field.required && !hasAny) {
        ElMessage.warning(`请添加${field.label}`);
        return false;
      }
    }
    if (field.required && !dynamicForm[field.name]) {
      ElMessage.warning(`请填写${field.label}`);
      return false;
    }
  }
  return true;
}

// 处理文件上传
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
  const currentUploadUrls = (initiateRes.data?.upload_urls || []) as any[];

  console.log('Initiate Upload Response:', initiateRes); // 调试日志
  console.log('Current Upload URLs:', currentUploadUrls); // 调试日志
  console.log('dynamicForm:', dynamicForm); // 调试日志
  console.log('fileEntries:', fileEntries); // 调试日志

  // 上传文件到对应的url
  // await Promise.all(
  //   currentUploadUrls.map(async (u: any) => {
  //     // 找到对应的file
  //     const entry = fileEntries.find(e => e.field_name === u.field_name);
  //     if (!entry) {
  //       console.warn(`上传时未找到对应的文件字段: ${u.field_name}`);
  //       return;
  //     }
  //     await fetch(u.upload_url, {
  //       method: 'PUT',
  //       body: entry.file,
  //       headers: {
  //         'Content-Type': entry.file.type || 'application/octet-stream'
  //       }
  //     });
  //   })
  // );
  //上传文件到对应的url
  await Promise.all(
    currentUploadUrls.map(async (u: any) => {
      // 找到对应的file
      const entry = fileEntries.find(e => e.field_name === u.field_name);
      if (!entry) {
        console.warn(`上传时未找到对应的文件字段: ${u.field_name}`);
        return;
      }
        await axios.put(u.upload_url, entry.file, {
          headers: {
            'Content-Type': entry.file.type || 'application/octet-stream'
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              console.log(`正在上传 ${u.field_name}: ${percent}%`);
            } else {
              console.log(`正在上传 ${u.field_name}: 已上传 ${progressEvent.loaded} 字节`);
            }
          },
          maxBodyLength: Infinity,  // 允许大文件
          maxContentLength: Infinity
      });
    })
  );


  // 回填路径信息
  currentUploadUrls.forEach((u: any) => {
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
  });

  // 处理文件上传信息（如hash等）
  const uploadedFiles: any[] = [];
  const uploadPromises = currentUploadUrls.map(async (u: any) => {
    let foundFile: File | null = null;
    const stack: Array<Record<string, any>> = [dynamicForm];

    while (stack.length && !foundFile) {
      const node = stack.pop()!;
      for (const [k, v] of Object.entries(node)) {
        if (k === u.field_name && v && typeof v === 'object' && (v as any).file) {
          foundFile = (v as any).file as File;
          break;
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
          stack.push(v as Record<string, any>);
        }
      }
    }

    if (!foundFile) return null;

    try {
      const sha256 = await hashFile(foundFile);

      return {
        field_name: u.field_name,
        origin_filename: foundFile.name,
        s3_key: u.s3_key,
        file_type: foundFile.type || 'application/octet-stream',
        file_size: foundFile.size,
        file_hash: sha256
      };
    } catch {
      console.log('计算文件哈希失败');
      return {
        field_name: u.field_name,
        origin_filename: foundFile.name,
        s3_key: u.s3_key,
        file_type: foundFile.type || 'application/octet-stream',
        file_size: foundFile.size,
        file_hash: 'error'
      };
    }
  });

  const results = await Promise.all(uploadPromises);
  uploadedFiles.push(...results.filter(Boolean));
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

    ElMessage.success('上传成功');
    resetForm();
  } catch (e: any) {
    ElMessage.error(`上传失败: ${e.message || '未知错误'}`);
  } finally {
    uploadLoading.value = false;
  }
}

// 获取分页文件列表
async function fetchFileList(page?: number, pageSize?: number) {
  // 如果没有传递参数，使用当前状态中的值
  const currentPage = page ?? fileListPage.value;
  const currentPageSize = pageSize ?? fileListPageSize.value;

  fileListLoading.value = true;
  try {
    const res = await fetchFileListInfo(currentPage, currentPageSize);

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

// 下载文件方法
function handleDownloadFile(file: any) {
  // 假设 file.s3_key 为后端返回的 S3 路径
  // 实际下载接口可能需要鉴权，可根据实际情况调整
  window.open(`/api/file/download?s3_key=${encodeURIComponent(file.s3_key)}`, '_blank');
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
        <span class="main-title main-title-text">文件上传</span>
      </div>
      <!-- 新增统计信息 -->
      <div class="stats-line">
        <span>已上传文件总数：</span>
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
              <!-- 动态对象类型（如 Reference_data 的 filePaths） -->
              <template v-else-if="field.type === 'dynamic-object'">
                <div class="dynamic-object-container">
                  <div
                    v-for="[k] in Object.entries(dynamicForm[field.name]).filter(([k, v]) => !(v as any).hidden)"
                    :key="k"
                    class="dynamic-object-item"
                  >
                    <div class="dynamic-object-row">
                      <ElUpload
                        :auto-upload="false"
                        :show-file-list="false"
                        :accept="getFileAcceptTypes('*')"
                        @change="uploadFile => uploadFile.raw && handleFileChange(field.name, uploadFile.raw, k)"
                      >
                        <ElButton size="small" type="primary">选择文件</ElButton>
                      </ElUpload>
                      <span v-if="dynamicForm[field.name][k].path" class="file-name">
                        {{ getFileName(dynamicForm[field.name][k].path) }}
                      </span>
                      <ElButton type="danger" size="small" @click="removeDynamicObjectItem(field.name, k)">
                        删除
                      </ElButton>
                    </div>
                  </div>
                  <template v-if="field.type === 'dynamic-object'">
                    <ElUpload
                      :auto-upload="false"
                      :show-file-list="false"
                      :accept="getFileAcceptTypes('*')"
                      @change="uploadFile => uploadFile.raw && handleAddDynamicObjectFile(field.name, uploadFile.raw)"
                    >
                      <ElButton type="primary" size="small">添加文件路径</ElButton>
                    </ElUpload>
                  </template>
                  <template v-else>
                    <ElButton type="primary" size="small" @click="addDynamicObjectItem(field.name)">
                      添加文件路径
                    </ElButton>
                  </template>
                </div>
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

          <!-- 文件上传字段 -->
          <template v-for="field in fileFields" :key="field.name">
            <ElFormItem :label="getShortLabel(field.displayLabel || field.label)" :required="field.required">
              <div class="upload-container">
                <div class="upload-row">
                  <ElUpload
                    :auto-upload="false"
                    :show-file-list="false"
                    :accept="getFileAcceptTypes(field.fileType)"
                    @change="uploadFile => uploadFile.raw && handleFileChange(field.name, uploadFile.raw)"
                  >
                    <ElButton type="primary">选择文件</ElButton>
                    <span
                      v-if="
                        field.parentField
                          ? dynamicForm[field.parentField] &&
                            dynamicForm[field.parentField][field.originalName] &&
                            dynamicForm[field.parentField][field.originalName].path
                          : dynamicForm[field.name] && dynamicForm[field.name].path
                      "
                      style="margin-left: 10px; color: #409eff"
                    >
                      {{
                        getFileName(
                          field.parentField
                            ? dynamicForm[field.parentField][field.originalName].path
                            : dynamicForm[field.name].path
                        )
                      }}
                    </span>
                  </ElUpload>
                  <div class="upload-tip">
                    <ElIcon><Upload /></ElIcon>
                    <span>{{ field.description }}</span>
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
        <div style="font-weight: bold; color: #409eff; margin-bottom: 5px">文件列表</div>
        <!-- 搜索区域 -->
        <div class="search-area" style="margin-bottom: 5px">
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
        <div v-else class="history-table-wrapper">
          <ElTable :data="fileList" style="width: 100%" size="small" border stripe>
            <ElTableColumn prop="file_id" label="ID" show-overflow-tooltip />
            <ElTableColumn prop="file_name" label="文件名" show-overflow-tooltip />
            <ElTableColumn prop="file_size" label="文件大小（字节）" show-overflow-tooltip />
            <ElTableColumn prop="created_time" label="上传时间" show-overflow-tooltip />
            <ElTableColumn prop="upload_user.user_id" label="上传用户" show-overflow-tooltip />
            <ElTableColumn label="操作" width="100" align="center">
              <template #default="scope">
                <ElButton
                  type="primary"
                  size="small"
                  :disabled="!scope.row.s3_key"
                  @click="handleDownloadFile(scope.row)"
                >
                  详情
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
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
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style scoped>
.equal-height-flex {
  padding: 1% 1% 1% 1%;
  display: flex;
  gap: 1%;
  align-items: stretch;
  min-height: 600px;
  height: 100%;
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
  flex: 1 1 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: stretch;
}

.history-list-area {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-left: 0;
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
.history-table-wrapper {
  display: flex;
  flex-direction: column;
  height: 95%;
}
.history-pagination {
  margin-top: clamp(8px, 1.6vh, 16px);
  text-align: center;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
.history-table-wrapper .el-table {
  flex: 1;
  min-height: 0;
  max-height: 90%;
  overflow-y: auto;
}
.el-pagination {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  background: transparent;
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
</style>
