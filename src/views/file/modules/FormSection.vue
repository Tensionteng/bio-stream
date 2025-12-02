<script lang="ts" setup>
import { ref, reactive, watch, computed } from 'vue';
import { ElMessage, ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElSwitch, ElUpload, ElButton, ElIcon } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';

// Props
const props = defineProps<{
  schema: any | null;
}>();

// Emits
const emit = defineEmits<{
  'upload-start': [];
  'upload-complete': [];
  'files-updated': [];
}>();

// 本地状态
const dynamicForm = reactive<any>({});
const textFields = ref<any[]>([]);
const fileFields = ref<any[]>([]);

// 获取已上传文件数
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

// 判断是否为文件相关字段
function isFileLikeField(prop: any, propType: string, propName: string): boolean {
  if (propType !== 'string') return false;
  if (propName.toLowerCase().includes('file')) {
    if (typeof prop.pattern === 'string' && prop.pattern.trim().length > 0) return true;
    return false;
  }
  if (typeof prop.description === 'string' && /文件|路径|file|path/i.test(prop.description)) return true;
  return false;
}

// 处理对象类型
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

// 处理 anyOf 类型
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

// 处理文件字段
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
  if (
    !dynamicForm[fieldKey] ||
    typeof dynamicForm[fieldKey] !== 'object' ||
    (!('path' in dynamicForm[fieldKey]) && !('file' in dynamicForm[fieldKey]))
  ) {
    dynamicForm[fieldKey] = {};
  }
}

// 处理枚举字段
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

// 处理数组字段
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

// 处理布尔字段
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

// 处理数字字段
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

// 处理文本字段
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

// 单个属性解析
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

// 递归解析schema属性
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

// 获取短标签名称
function getShortLabel(label: string): string {
  if (label.length <= 8) return label;

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
    file: '*/*',
    path: '*/*'
  };

  return typeMap[fileType] || '*/*';
}

// 获取字段的文件类型限制
function getFieldFileAccept(field: any): string {
  if (field.fileType) {
    return getFileAcceptTypes(field.fileType);
  }
  return getFileAcceptTypes('*');
}

// 验证文件格式
function validateFileFormat(fileField: any, fileName: string): boolean {
  if (!fileField.pattern || !fileField.pattern.trim()) return true;

  console.log('Validating file:', fileName, 'against pattern:', fileField.pattern);
  
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  
  let expectedExtension = '';
  if (fileField.pattern.startsWith('*')) {
    const match = fileField.pattern.match(/\*\.([a-zA-Z0-9]+)$/);
    if (match) {
      expectedExtension = match[1].toLowerCase();
    }
  } else {
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
      let regexPattern = fileField.pattern;
      if (regexPattern.startsWith('*')) {
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
  let currentData = fileField.parentField
    ? dynamicForm[fileField.parentField]?.[fileField.originalName]
    : dynamicForm[fileField.name];

  if (!currentData || typeof currentData !== 'object' || 'file' in currentData) {
    currentData = {};
  }

  const existingKeys = Object.keys(currentData)
    .map(k => parseInt(k, 10))
    .filter(k => !Number.isNaN(k));
  let nextKey = existingKeys.length > 0 ? Math.max(...existingKeys) + 1 : 1;

  files.forEach(file => {
    currentData[nextKey] = {
      path: file.name,
      file_type: getFileTypeFromExtension(file.name),
      file,
      hidden: false
    };
    nextKey++;
  });

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

// 处理文件变更
function handleFileChange(field: string, files: File[], key?: string | number) {
  if (!dynamicForm[field] || typeof dynamicForm[field] !== 'object') {
    dynamicForm[field] = {};
  }
  
  if (key !== undefined) {
    if (files && files.length > 0) {
      handleDynamicObjectFileChange(field, files[0], key);
    }
    return;
  }
  
  let fieldConfig = fileFields.value.find(f => f.name === field);
  
  if (!fieldConfig) {
    fieldConfig = textFields.value.find(f => f.name === field && f.type === 'dynamic-object');
  }
  
  if (!fieldConfig) {
    ElMessage.error('字段配置错误');
    return;
  }

  for (const file of files) {
    if (!validateFileFormat(fieldConfig, file.name)) return;
  }

  updateFileFieldMultiple(fieldConfig, files);
  emit('files-updated');
}

// 处理动态对象文件变更
function handleDynamicObjectFileChange(field: string, file: File, key: string | number) {
  if (!dynamicForm[field] || !dynamicForm[field][key]) return;
  
  dynamicForm[field][key] = {
    path: file.name,
    file_type: getFileTypeFromExtension(file.name),
    file,
    hidden: false
  };
  emit('files-updated');
}

// 从字段中移除文件
function removeFileFromField(field: any, fileIndex: number) {
  const fieldData = field.parentField
    ? dynamicForm[field.parentField]?.[field.originalName]
    : dynamicForm[field.name];
  
  if (!fieldData || typeof fieldData !== 'object') return;
  
  if ('file' in fieldData && !Array.isArray(fieldData)) {
    clearFileField(field.originalName || field.name, field.parentField);
    return;
  }
  
  const files = Object.entries(fieldData);
  let count = 0;
  for (const [key, file] of files) {
    if (file && typeof file === 'object' && 'file' in file && !(file as any).hidden) {
      if (count === fileIndex) {
        delete fieldData[key];
        emit('files-updated');
        return;
      }
      count++;
    }
  }
}

// 清理文件字段的旧信息
function clearFileField(fieldName: string, parentField?: string) {
  if (parentField) {
    if (dynamicForm[parentField] && dynamicForm[parentField][fieldName]) {
      dynamicForm[parentField][fieldName] = {
        path: '',
        file_type: ''
      };
    }
  } else if (dynamicForm[fieldName]) {
    dynamicForm[fieldName] = {
      path: '',
      file_type: ''
    };
  }
  emit('files-updated');
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
    if (
      field.required &&
      (dynamicForm[field.name] === '' ||
        dynamicForm[field.name] === undefined ||
        (dynamicForm[field.name] === null && field.type !== 'boolean' && field.type !== 'select'))
    ) {
      ElMessage.warning(`请填写${field.label}`);
      return false;
    }
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

// 验证文件字段
function validateFileFields(): boolean {
  for (const field of fileFields.value) {
    const value = field.parentField
      ? ((dynamicForm[field.parentField] || {}) as any)[field.originalName] || {}
      : dynamicForm[field.name] || ({} as any);
    
    let hasFile = false;
    if (typeof value === 'object') {
      if ('file' in value && !value.hidden) {
        hasFile = Boolean(value.file);
      } else if (!('file' in value)) {
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

// 监听 schema 变化
watch(() => props.schema, (newSchema) => {
  Object.keys(dynamicForm).forEach(k => {
    if (typeof dynamicForm[k] === 'object' && dynamicForm[k] !== null) {
      if (Array.isArray(dynamicForm[k])) {
        dynamicForm[k] = [];
      } else {
        dynamicForm[k] = {};
      }
    } else {
      dynamicForm[k] = '';
    }
  });
  textFields.value = [];
  fileFields.value = [];

  if (!newSchema) return;

  if (newSchema.schema_json && newSchema.schema_json.properties) {
    parseSchemaProperties({
      properties: newSchema.schema_json.properties,
      required: newSchema.schema_json.required || []
    });
  }
}, { deep: true });

// 暴露给父组件
defineExpose({
  dynamicForm,
  textFields,
  fileFields,
  validateTextFields,
  validateFileFields,
  resetForm,
  getUploadedFileCount,
  getUploadedFilesForField,
  handleFileChange,
  removeFileFromField
});
</script>

<template>
  <div class="form-section-container">
    <ElDivider content-position="center" style="font-size: 16px">填写信息并上传文件</ElDivider>
    <div class="file-upload-section">
      <ElForm v-if="props.schema" label-width="140px" style="margin-bottom: 18px">
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
            <!-- 动态对象类型 -->
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
            <!-- 数组类型 -->
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
      </ElForm>
    </div>
  </div>
</template>

<style scoped>
.form-section-container {
  width: 100%;
}

.file-upload-section {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.el-upload {
  width: 100%;
}

.el-upload__tip {
  color: #909399;
}

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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.el-form-item__label {
  font-weight: 500;
  color: #303133;
  min-width: 8rem;
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.el-form-item {
  margin-bottom: 1.25rem;
}

.el-form-item__content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.el-input {
  border-radius: 6px;
  width: 70%;
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
}

@media (prefers-color-scheme: dark) {
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
</style>
