<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';
import { ArrowDown, Download, Plus, Search, Upload, UploadFilled, View } from '@element-plus/icons-vue';

// 使用实际的schemas_list数据
const schemas_list = [
  {
    id: 1,
    name: 'DNA_bam_sample',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sample_id: {
          type: 'string',
          description: '样本唯一标识符'
        },
        file_locations: {
          type: 'object',
          properties: {
            json_file: {
              type: 'string',
              pattern: '\\.json$',
              description: 'JSON格式数据文件路径'
            },
            bam_file: {
              type: 'string',
              pattern: '\\.bam$',
              description: 'bam格式序列文件路径'
            }
          },
          required: ['json_file', 'bam_file'],
          additionalProperties: false
        },
        source_type: {
          type: 'string',
          enum: ['DNA'],
          description: '样本来源的生物分子类型'
        }
      },
      required: ['sample_id', 'file_locations', 'source_type'],
      additionalProperties: false
    }
  },
  {
    id: 2,
    name: 'DNA_fq_sample',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sample_id: {
          type: 'string',
          description: '样本唯一标识符'
        },
        file_locations: {
          type: 'object',
          properties: {
            json_file: {
              type: 'string',
              pattern: '\\.json$',
              description: 'JSON格式数据文件路径'
            },
            fq_file1: {
              type: 'string',
              pattern: '\\.fastq\\.gz$',
              description: 'FASTQ格式序列文件路径，双端测序的第一端'
            },
            fq_file2: {
              type: 'string',
              pattern: '\\.fastq\\.gz$',
              description: 'FASTQ格式序列文件路径，双端测序的另一端'
            }
          },
          required: ['json_file', 'fq_file1', 'fq_file2'],
          additionalProperties: false
        },
        source_type: {
          type: 'string',
          enum: ['DNA'],
          description: '样本来源的生物分子类型'
        }
      },
      required: ['sample_id', 'file_locations', 'source_type'],
      additionalProperties: false
    }
  },
  {
    id: 3,
    name: 'DNA_vcf_sample',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sample_id: {
          type: 'string',
          description: '样本唯一标识符'
        },
        file_locations: {
          type: 'object',
          properties: {
            json_file: {
              type: 'string',
              pattern: '\\.json$',
              description: 'JSON格式数据文件路径'
            },
            vcf_file: {
              type: 'string',
              pattern: '\\.vcf$',
              description: 'vcf格式变异文件路径'
            }
          },
          required: ['json_file', 'vcf_file'],
          additionalProperties: false
        },
        source_type: {
          type: 'string',
          enum: ['DNA'],
          description: '样本来源的生物分子类型'
        }
      },
      required: ['sample_id', 'file_locations', 'source_type'],
      additionalProperties: false
    }
  },
  {
    id: 4,
    name: 'Gene_data',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        geneName: {
          type: 'string',
          description: '基因名称'
        },
        chromosome: {
          anyOf: [
            {
              type: 'integer',
              minimum: 1,
              maximum: 22
            },
            {
              type: 'string',
              enum: ['X', 'Y']
            }
          ],
          description: '染色体编号，可以是1-22的整数，或X、Y字符串'
        },
        position: {
          type: 'object',
          properties: {
            start: {
              type: 'integer',
              description: '起始位置'
            },
            end: {
              type: 'integer',
              description: '结束位置'
            },
            strand: {
              type: 'boolean',
              description: '链方向，true表示正链，false表示负链'
            }
          },
          required: ['start', 'end', 'strand'],
          additionalProperties: false
        },
        filePath: {
          type: 'string',
          description: '关联的文件路径'
        }
      },
      required: ['geneName', 'chromosome', 'position', 'filePath'],
      additionalProperties: true
    }
  },
  {
    id: 5,
    name: 'Prot_count_sample',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sample_id: {
          type: 'string',
          description: '样本唯一标识符'
        },
        file_locations: {
          type: 'object',
          properties: {
            json_file: {
              type: 'string',
              pattern: '\\.json$',
              description: 'JSON格式数据文件路径'
            },
            count_file: {
              type: 'string',
              pattern: '\\.count$',
              description: 'count表达文件路径，也许还有更多的file，没删掉这行就说明没确认'
            }
          },
          required: ['json_file', 'count_file'],
          additionalProperties: false
        },
        source_type: {
          type: 'string',
          enum: ['DNA'],
          description: '样本来源的生物分子类型'
        }
      },
      required: ['sample_id', 'file_locations', 'source_type'],
      additionalProperties: false
    }
  },
  {
    id: 6,
    name: 'Prot_raw_sample',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sample_id: {
          type: 'string',
          description: '样本唯一标识符'
        },
        file_locations: {
          type: 'object',
          properties: {
            json_file: {
              type: 'string',
              pattern: '\\.json$',
              description: 'JSON格式数据文件路径'
            },
            raw_file: {
              type: 'string',
              pattern: '\\.csu$',
              description: '我不知道蛋白下机数据的格式是什么，上面那个pattern只是占位符'
            }
          },
          required: ['json_file', 'raw_file'],
          additionalProperties: false
        },
        source_type: {
          type: 'string',
          enum: ['RNA'],
          description: '样本来源的生物分子类型'
        }
      },
      required: ['sample_id', 'file_locations', 'source_type'],
      additionalProperties: false
    }
  },
  {
    id: 7,
    name: 'Reference_data',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        version: {
          type: 'string'
        },
        filePaths: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              path: {
                type: 'string'
              },
              file_type: {
                type: 'string'
              }
            },
            required: ['path', 'file_type'],
            additionalProperties: false
          }
        }
      },
      required: ['version', 'filePaths'],
      additionalProperties: false
    }
  },
  {
    id: 8,
    name: 'RNA_bam_sample',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sample_id: {
          type: 'string',
          description: '样本唯一标识符'
        },
        file_locations: {
          type: 'object',
          properties: {
            json_file: {
              type: 'string',
              pattern: '\\.json$',
              description: 'JSON格式数据文件路径'
            },
            bam_file: {
              type: 'string',
              pattern: '\\.bam$',
              description: 'bam格式序列文件路径'
            }
          },
          required: ['json_file', 'bam_file'],
          additionalProperties: false
        },
        source_type: {
          type: 'string',
          enum: ['RNA'],
          description: '样本来源的生物分子类型'
        }
      },
      required: ['sample_id', 'file_locations', 'source_type'],
      additionalProperties: false
    }
  },
  {
    id: 9,
    name: 'RNA_count_sample',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sample_id: {
          type: 'string',
          description: '样本唯一标识符'
        },
        file_locations: {
          type: 'object',
          properties: {
            json_file: {
              type: 'string',
              pattern: '\\.json$',
              description: 'JSON格式数据文件路径'
            },
            raw_count_file: {
              type: 'string',
              pattern: '\\.count$',
              description: 'count表达文件路径'
            },
            tpm_file: {
              type: 'string',
              pattern: '\\.tpm$',
              description: 'tpm表达文件路径'
            },
            fpkm_file: {
              type: 'string',
              pattern: '\\.fpkm$',
              description: 'fpkm表达文件路径'
            }
          },
          required: ['json_file', 'raw_count_file', 'tpm_file', 'fpkm_file'],
          additionalProperties: false
        },
        source_type: {
          type: 'string',
          enum: ['DNA'],
          description: '样本来源的生物分子类型'
        }
      },
      required: ['sample_id', 'file_locations', 'source_type'],
      additionalProperties: false
    }
  },
  {
    id: 10,
    name: 'RNA_fq_sample',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sample_id: {
          type: 'string',
          description: '样本唯一标识符'
        },
        file_locations: {
          type: 'object',
          properties: {
            json_file: {
              type: 'string',
              pattern: '\\.json$',
              description: 'JSON格式数据文件路径'
            },
            fq_file1: {
              type: 'string',
              pattern: '\\.fq$',
              description: 'FASTQ格式序列文件路径，双端测序的第一端'
            },
            fq_file2: {
              type: 'string',
              pattern: '\\.fq$',
              description: 'FASTQ格式序列文件路径，双端测序的另一端'
            }
          },
          required: ['json_file', 'fq_file1', 'fq_file2'],
          additionalProperties: false
        },
        source_type: {
          type: 'string',
          enum: ['RNA'],
          description: '样本来源的生物分子类型'
        }
      },
      required: ['sample_id', 'file_locations', 'source_type'],
      additionalProperties: false
    }
  },
  {
    id: 11,
    name: 'TEST_fa_schema',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        fa_file: {
          type: 'string',
          pattern: '\\.fa$',
          description: 'ref的fa文件路径'
        }
      },
      required: ['fa_file'],
      additionalProperties: false
    }
  },
  {
    id: 12,
    name: 'TEST_vcf_schema',
    schema_json: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        vcf_file: {
          type: 'string',
          pattern: '\\.vcf$',
          description: 'ref的vcf文件路径'
        }
      },
      required: ['vcf_file'],
      additionalProperties: false
    }
  }
];

const schemas = ref<any[]>([]); // 注意：这里初始化为空数组
const selectedSchemaId = ref<string>('');
const selectedSchema = ref<any>(null);
const dynamicForm = reactive<any>({});
const textFields = ref<any[]>([]);
const fileFields = ref<any[]>([]);
const fileInputs = reactive<Record<string, File | null>>({});
const uploadLoading = ref(false);
const totalFileCount = ref(0);
const totalFileSize = ref(0);

// 自定义schema相关
const customSchemaDialog = ref(false);
const customSchemaName = ref('');

// 引导式创建Schema相关
const currentStep = ref(1);
const customSchemaDescription = ref('');
const customSchemaFields = ref<any[]>([]);

// 常用字段模板
const commonFields = [
  {
    name: 'sample_id',
    type: 'string',
    description: '样本唯一标识符',
    required: true,
    pattern: '',
    minimum: '',
    maximum: '',
    properties: []
  },
  {
    name: 'file_locations',
    type: 'object',
    description: '文件位置信息',
    required: true,
    pattern: '',
    minimum: '',
    maximum: '',
    properties: [
      {
        name: 'json_file',
        type: 'file',
        description: 'JSON格式数据文件路径',
        pattern: '\\.json$'
      },
      {
        name: 'bam_file',
        type: 'file',
        description: 'BAM格式序列文件路径',
        pattern: '\\.bam$'
      },
      {
        name: 'fq_file1',
        type: 'file',
        description: 'FASTQ格式序列文件路径（第一端）',
        pattern: '\\.(fastq|fq)(\\.gz)?$'
      },
      {
        name: 'fq_file2',
        type: 'file',
        description: 'FASTQ格式序列文件路径（第二端）',
        pattern: '\\.(fastq|fq)(\\.gz)?$'
      },
      {
        name: 'vcf_file',
        type: 'file',
        description: 'VCF格式变异文件路径',
        pattern: '\\.vcf$'
      }
    ]
  },
  {
    name: 'source_type',
    type: 'string',
    description: '样本来源的生物分子类型',
    required: true,
    pattern: '',
    minimum: '',
    maximum: '',
    properties: []
  },
  {
    name: 'geneName',
    type: 'string',
    description: '基因名称',
    required: true,
    pattern: '',
    minimum: '',
    maximum: '',
    properties: []
  },
  {
    name: 'chromosome',
    type: 'integer',
    description: '染色体编号',
    required: true,
    pattern: '',
    minimum: '1',
    maximum: '22',
    properties: []
  },
  {
    name: 'position',
    type: 'object',
    description: '基因位置信息',
    required: true,
    pattern: '',
    minimum: '',
    maximum: '',
    properties: [
      {
        name: 'start',
        type: 'integer',
        description: '起始位置'
      },
      {
        name: 'end',
        type: 'integer',
        description: '结束位置'
      },
      {
        name: 'strand',
        type: 'boolean',
        description: '链方向，true表示正链，false表示负链'
      }
    ]
  }
];

// 常用子字段模板
const commonSubFields = [
  {
    name: 'json_file',
    type: 'file',
    description: 'JSON格式数据文件路径',
    pattern: '\\.json$'
  },
  {
    name: 'bam_file',
    type: 'file',
    description: 'BAM格式序列文件路径',
    pattern: '\\.bam$'
  },
  {
    name: 'fq_file1',
    type: 'file',
    description: 'FASTQ格式序列文件路径（第一端）',
    pattern: '\\.(fastq|fq)(\\.gz)?$'
  },
  {
    name: 'fq_file2',
    type: 'file',
    description: 'FASTQ格式序列文件路径（第二端）',
    pattern: '\\.(fastq|fq)(\\.gz)?$'
  },
  {
    name: 'vcf_file',
    type: 'file',
    description: 'VCF格式变异文件路径',
    pattern: '\\.vcf$'
  },
  {
    name: 'count_file',
    type: 'file',
    description: 'Count表达文件路径',
    pattern: '\\.count$'
  },
  {
    name: 'tpm_file',
    type: 'file',
    description: 'TPM表达文件路径',
    pattern: '\\.tpm$'
  },
  {
    name: 'fpkm_file',
    type: 'file',
    description: 'FPKM表达文件路径',
    pattern: '\\.fpkm$'
  },
  {
    name: 'raw_file',
    type: 'file',
    description: '原始数据文件路径',
    pattern: '\\.raw$'
  },
  {
    name: 'start',
    type: 'integer',
    description: '起始位置'
  },
  {
    name: 'end',
    type: 'integer',
    description: '结束位置'
  },
  {
    name: 'strand',
    type: 'boolean',
    description: '链方向，true表示正链，false表示负链'
  }
];

// 搜索相关
const searchKeyword = ref('');
const filteredSchemas = ref<any[]>([]);

// 历史上传记录（示例数据，可替换为实际接口数据）
const fileList = ref<any[]>([]);
const fileListLoading = ref(false);
const fileListPage = ref(1);
const fileListPageSize = ref(20); // 每页展示20个数据
const fileListTotal = ref(0);

// 历史上传记录（假数据，仅用于接口无数据时展示）
const mockFileList = Array.from({ length: 1000 }).map((_, i) => {
  let fileType = '';
  if (i % 3 === 0) {
    fileType = 'bam';
  } else if (i % 3 === 1) {
    fileType = 'json';
  } else {
    fileType = 'fasta';
  }
  return {
    id: 100 + i,
    file_name: `sample${i + 1}.${fileType}`,
    name: `样本${i + 1}`,
    timestamp: `2024-06-${((i % 30) + 1).toString().padStart(2, '0')}`,
    s3_key: `user_123/uploads/sample${i + 1}.${fileType}`
  };
});

// 1. 获取 schema 列表
async function fetchSchemas() {
  try {
    const res = await axios.get('/api/file/schema');
    // 如果接口无数据，则用 schemas_list 展示
    if (Array.isArray(res.data) && res.data.length > 0) {
      schemas.value = res.data;
    } else {
      schemas.value = [...schemas_list];
      ElMessage.info('接口无数据，已展示测试数据');
    }
    updateFilteredSchemas();
  } catch {
    schemas.value = [...schemas_list];
    ElMessage.warning('接口获取失败，已展示测试数据');
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

// 引导式创建Schema相关方法
function nextStep() {
  if (currentStep.value === 1) {
    if (!customSchemaName.value.trim()) {
      ElMessage.warning('请输入Schema名称');
      return;
    }
  }

  if (currentStep.value < 3) {
    currentStep.value += 1;
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value -= 1;
  }
}

function addField() {
  customSchemaFields.value.push({
    name: '',
    type: 'string',
    description: '',
    required: true,
    pattern: '',
    minimum: '',
    maximum: '',
    properties: []
  });
}

function removeField(index: number) {
  customSchemaFields.value.splice(index, 1);
}

function addSubField(field: any) {
  if (!field.properties) {
    field.properties = [];
  }
  // 使用Vue的响应式API来避免闪烁
  const newSubField = {
    name: '',
    type: 'string',
    description: '',
    pattern: ''
  };
  field.properties.push(newSubField);
}

function removeSubField(field: any, subIndex: number) {
  field.properties.splice(subIndex, 1);
}

function addCommonField(fieldTemplate: any) {
  // 深拷贝字段模板，避免引用问题
  const newField = JSON.parse(JSON.stringify(fieldTemplate));
  customSchemaFields.value.push(newField);
  ElMessage.success(`已添加常用字段：${fieldTemplate.name}`);
}

function addCommonSubField(field: any, subFieldTemplate: any) {
  if (!field.properties) {
    field.properties = [];
  }
  // 深拷贝子字段模板，避免引用问题
  const newSubField = JSON.parse(JSON.stringify(subFieldTemplate));
  field.properties.push(newSubField);
  ElMessage.success(`已添加常用子字段：${subFieldTemplate.name}`);
}

function createSchema() {
  // 检查schema名称是否重复
  const trimmedName = customSchemaName.value.trim();
  const existingSchema = schemas.value.find(schema => schema.name.toLowerCase() === trimmedName.toLowerCase());

  if (existingSchema) {
    ElMessage.error(`已存在名为"${trimmedName}"的Schema，请使用其他名称`);
    return;
  }

  // 生成Schema JSON
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: customSchemaName.value,
    description: customSchemaDescription.value,
    properties: {} as Record<string, any>,
    required: [] as string[]
  };

  customSchemaFields.value.forEach(field => {
    // 保留原始字段名称，只检查是否为空
    const fieldName = field.name.trim();
    if (fieldName) {
      const fieldDef: any = {
        type: field.type,
        description: field.description
      };

      if (field.type === 'string' && field.pattern) {
        fieldDef.pattern = field.pattern;
      }
      if (field.type === 'number' || field.type === 'integer') {
        if (field.minimum !== '') fieldDef.minimum = Number(field.minimum);
        if (field.maximum !== '') fieldDef.maximum = Number(field.maximum);
      }
      if (field.type === 'object' && field.properties && field.properties.length > 0) {
        fieldDef.properties = {} as Record<string, any>;
        fieldDef.required = [] as string[];
        field.properties.forEach((subField: any) => {
          // 保留原始子字段名称，只检查是否为空
          const subFieldName = subField.name.trim();
          if (subFieldName) {
            (fieldDef.properties as Record<string, any>)[subFieldName] = {
              type: subField.type === 'file' ? 'string' : subField.type,
              description: subField.description
            };
            if (subField.type === 'file') {
              // 使用用户输入的文件格式模式，如果没有输入则使用默认值
              const pattern = (subField as any).pattern || '\\.(json|txt|csv|tsv)$';
              (fieldDef.properties as Record<string, any>)[subFieldName].pattern = pattern;
            }
          }
        });
      }

      (schema.properties as Record<string, any>)[fieldName] = fieldDef;
      if (field.required) {
        (schema.required as string[]).push(fieldName);
      }
    }
  });

  // 添加到schemas列表
  const newSchema = {
    id: Date.now(),
    name: customSchemaName.value.trim(),
    schema_json: schema,
    is_custom: true
  };

  schemas.value.push(newSchema);
  updateFilteredSchemas();

  // 重置表单
  customSchemaDialog.value = false;
  currentStep.value = 1;
  customSchemaName.value = '';
  customSchemaDescription.value = '';
  customSchemaFields.value = [];

  ElMessage.success('Schema创建成功！');
}

// 计算属性：生成的Schema JSON
const generatedSchemaJson = computed(() => {
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: customSchemaName.value,
    description: customSchemaDescription.value,
    properties: {} as Record<string, any>,
    required: [] as string[]
  };

  customSchemaFields.value.forEach(field => {
    // 保留原始字段名称，只检查是否为空
    const fieldName = field.name.trim();
    if (fieldName) {
      const fieldDef: any = {
        type: field.type,
        description: field.description
      };

      if (field.type === 'string' && field.pattern) {
        fieldDef.pattern = field.pattern;
      }
      if (field.type === 'number' || field.type === 'integer') {
        if (field.minimum !== '') fieldDef.minimum = Number(field.minimum);
        if (field.maximum !== '') fieldDef.maximum = Number(field.maximum);
      }
      if (field.type === 'object' && field.properties && field.properties.length > 0) {
        fieldDef.properties = {} as Record<string, any>;
        fieldDef.required = [] as string[];
        field.properties.forEach((subField: any) => {
          // 保留原始子字段名称，只检查是否为空
          const subFieldName = subField.name.trim();
          if (subFieldName) {
            (fieldDef.properties as Record<string, any>)[subFieldName] = {
              type: subField.type === 'file' ? 'string' : subField.type,
              description: subField.description
            };
            if (subField.type === 'file') {
              // 使用用户输入的文件格式模式，如果没有输入则使用默认值
              const pattern = (subField as any).pattern || '\\.(json|txt|csv|tsv)$';
              (fieldDef.properties as Record<string, any>)[subFieldName].pattern = pattern;
            }
          }
        });
      }

      (schema.properties as Record<string, any>)[fieldName] = fieldDef;
      if (field.required) {
        (schema.required as string[]).push(fieldName);
      }
    }
  });

  return JSON.stringify(schema, null, 2);
});

function downloadSchema() {
  const blob = new Blob([generatedSchemaJson.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${customSchemaName.value}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function previewSchema() {
  // 可以在这里添加预览逻辑，比如打开一个新窗口显示Schema
  ElMessage.info('Schema预览功能开发中...');
}

// 删除schema
async function deleteSchema(schemaId: string | number) {
  try {
    const schema = schemas.value.find(s => s.id === schemaId);
    if (!schema) {
      ElMessage.error('未找到要删除的数据类型');
      return;
    }

    // 检查是否为内置schema（来自schemas_list）
    const isBuiltIn = schemas_list.some(s => s.id === schemaId);
    if (isBuiltIn) {
      ElMessage.warning('内置数据类型不能删除');
      return;
    }

    await ElMessageBox.confirm('确定要删除这个自定义数据类型吗？删除后无法恢复。', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    // 如果是当前选中的schema，清空选择
    if (selectedSchemaId.value === schemaId) {
      selectedSchemaId.value = '';
      selectedSchema.value = null;
    }

    // 从schemas中删除
    const index = schemas.value.findIndex(s => s.id === schemaId);
    if (index > -1) {
      schemas.value.splice(index, 1);
      updateFilteredSchemas();
      ElMessage.success('自定义数据类型删除成功');
    }
  } catch (error) {
    // 用户取消删除
    if (error !== 'cancel') {
      ElMessage.error('删除失败，请重试');
    }
  }
}

// 2. 获取文件统计信息
async function fetchFileStats() {
  try {
    // 假设接口返回 { total_count: 123, total_size: 4567890 }
    const res = await axios.get('/api/file/stat');
    totalFileCount.value = res.data.total_count || 0;
    totalFileSize.value = res.data.total_size || 0;
  } catch {
    totalFileCount.value = 0;
    totalFileSize.value = 0;
  }
}

// 3. 监听 schema 变化，生成表单
watch(selectedSchemaId, () => {
  const schema = schemas.value.find((s: any) => s.id === selectedSchemaId.value);
  selectedSchema.value = schema;
  if (!schema) return;

  // 清空表单
  for (const key in dynamicForm) {
    if (Object.hasOwn(dynamicForm, key)) {
      dynamicForm[key] = '';
    }
  }
  textFields.value = [];
  fileFields.value = [];

  // 根据 JSON Schema 结构生成表单字段
  if (schema.schema_json && schema.schema_json.properties) {
    const properties = schema.schema_json.properties;
    const required = schema.schema_json.required || [];

    // 处理顶层属性
    Object.keys(properties).forEach(propName => {
      const prop = properties[propName];
      const isRequired = required.includes(propName);

      if (prop.type === 'string') {
        // 字符串类型字段
        if (prop.pattern && prop.pattern.includes('\\.')) {
          // 文件路径字段，需要文件上传
          // 从pattern中提取文件扩展名，例如 "\\.json$" -> "json"
          const fileType = prop.pattern.match(/\\([^.]+)\$?/)?.[1] || 'file';
          fileFields.value.push({
            name: propName,
            label: prop.description || propName,
            type: 'file',
            required: isRequired,
            fileType: String(fileType),
            pattern: prop.pattern,
            description: prop.description || `请上传${propName}文件`
          });
          fileInputs[propName] = null;
        } else {
          // 普通文本字段
          dynamicForm[propName] = '';
          textFields.value.push({
            name: propName,
            label: prop.description || propName,
            required: isRequired,
            description: prop.description || `请输入${propName}`
          });
        }
      } else if (prop.type === 'object' && prop.properties) {
        // 对象类型字段（如 file_locations）
        Object.keys(prop.properties).forEach(subPropName => {
          const subProp = prop.properties[subPropName];
          const subRequired = prop.required || [];
          const isSubRequired = subRequired.includes(subPropName);

          if (subProp.type === 'string' && subProp.pattern && subProp.pattern.includes('\\.')) {
            // 文件路径字段
            // 从pattern中提取文件扩展名，例如 "\\.json$" -> "json"
            const fileType = subProp.pattern.match(/\\([^.]+)\$?/)?.[1] || 'file';
            fileFields.value.push({
              name: subPropName,
              label: subProp.description || subPropName,
              type: 'file',
              required: isSubRequired,
              fileType: String(fileType),
              pattern: subProp.pattern,
              description: subProp.description || `请上传${subPropName}文件`
            });
            fileInputs[subPropName] = null;
          } else if (subProp.type === 'string') {
            // 普通文本字段
            dynamicForm[subPropName] = '';
            textFields.value.push({
              name: subPropName,
              label: subProp.description || subPropName,
              required: isSubRequired,
              description: subProp.description || `请输入${subPropName}`
            });
          }
        });
      } else if (prop.type === 'integer') {
        // 整数类型字段
        dynamicForm[propName] = '';
        textFields.value.push({
          name: propName,
          label: prop.description || propName,
          required: isRequired,
          description: prop.description || `请输入${propName}`,
          type: 'number'
        });
      } else if (prop.anyOf) {
        // 联合类型字段（如染色体）
        dynamicForm[propName] = '';
        textFields.value.push({
          name: propName,
          label: prop.description || propName,
          required: isRequired,
          description: prop.description || `请输入${propName}`,
          type: 'text'
        });
      }
    });
  }
});

// 3. 选择文件
function handleFileChange(field: string, file: File) {
  // 获取对应的文件字段配置
  const fileField = fileFields.value.find(f => f.name === field);
  if (!fileField) {
    ElMessage.error('字段配置错误');
    return;
  }

  // 验证文件格式
  if (fileField.pattern) {
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

    // 从 pattern 中提取期望的文件扩展名
    const patternMatch = fileField.pattern.match(/\\([^.]+)\$?/);
    const expectedExtension = patternMatch ? patternMatch[1].toLowerCase() : '';

    // 检查文件扩展名是否匹配
    let isValidFormat = false;

    // 首先检查扩展名是否匹配
    if (expectedExtension && fileExtension === expectedExtension) {
      isValidFormat = true;
    }

    // 如果没有匹配到，尝试检查完整文件名是否匹配 pattern
    if (!isValidFormat) {
      try {
        const patternRegex = new RegExp(fileField.pattern);
        if (patternRegex.test(fileName)) {
          isValidFormat = true;
        }
      } catch {
        // 如果正则表达式无效，跳过正则验证
        console.warn('Invalid regex pattern:', fileField.pattern);
      }
    }

    if (!isValidFormat) {
      // 生成用户友好的错误信息
      let expectedFormat = '';
      if (expectedExtension) {
        expectedFormat = `.${expectedExtension}`;
      } else {
        expectedFormat = fileField.pattern.replace(/\\\./g, '.').replace(/\$/g, '');
      }
      ElMessage.error(`文件格式不正确，请上传 ${expectedFormat} 格式的文件`);
      return;
    }
  }

  fileInputs[field] = file;
}

// 4. 提交表单并上传
async function handleSubmit() {
  if (!selectedSchema.value) return;

  // 校验必填字段
  for (const field of fileFields.value) {
    if (field.required && !fileInputs[field.name]) {
      ElMessage.warning(`请上传${field.label}`);
      return;
    }
  }

  // 校验其他必填字段
  for (const field of textFields.value) {
    if (field.required && !dynamicForm[field.name]) {
      ElMessage.warning(`请填写${field.label}`);
      return;
    }
  }
  uploadLoading.value = true;
  try {
    // 4.1 请求预签名
    const uploads = fileFields.value.map(f => ({
      field_name: f.name,
      filename: fileInputs[f.name]?.name,
      content_type: fileInputs[f.name]?.type || 'application/octet-stream'
    }));
    const res = await axios.post('/api/file/upload/initiate', {
      file_type_id: selectedSchema.value.id,
      uploads
    });
    const uploadUrls = res.data.upload_urls;

    // 5. 上传文件到 S3
    const uploadedFiles: any[] = [];
    const uploadPromises = uploadUrls
      .filter((u: any) => fileInputs[u.field_name])
      .map(async (u: any) => {
        const file = fileInputs[u.field_name];
        if (!file) return null;

        await axios.put(u.upload_url, file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' }
        });

        const fileExtension = file.name.split('.').pop() || '';
        return {
          field_name: u.field_name,
          origin_filename: file.name,
          s3_key: u.s3_key,
          file_type: `.${fileExtension}`,
          file_size: file.size
        };
      });

    const results = await Promise.all(uploadPromises);
    uploadedFiles.push(...results.filter(Boolean));

    // 6. 通知后端上传完成
    await axios.post('/api/file/upload/complete', {
      file_type_id: selectedSchema.value.id,
      file_name: dynamicForm.file_name || '', // 假设有 file_name 字段
      description_json: { ...dynamicForm },
      uploaded_files: uploadedFiles
    });

    ElMessage.success('上传成功');
    // 清空表单
    Object.keys(dynamicForm).forEach(k => {
      dynamicForm[k] = '';
    });
    Object.keys(fileInputs).forEach(k => {
      fileInputs[k] = null;
    });
  } catch (e: any) {
    const errorMessage = e?.message || '';
    ElMessage.error(`上传失败: ${errorMessage}`);
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
    // 假设接口返回 { total: 100, items: [...] }
    const res = await axios.get('/api/file/list', {
      params: {
        page: currentPage,
        page_size: currentPageSize,
        search: searchKeyword.value || undefined
      }
    });
    if (Array.isArray(res.data.items) && res.data.items.length > 0) {
      fileList.value = res.data.items;
      fileListTotal.value = res.data.total || res.data.items.length;
    } else {
      // 接口无数据时用 mockFileList 展示分页，支持搜索过滤
      let filteredList = mockFileList;
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase();
        filteredList = mockFileList.filter(
          item => item.file_name.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword)
        );
      }

      const start = (currentPage - 1) * currentPageSize;
      const end = start + currentPageSize;
      fileList.value = filteredList.slice(start, end);
      fileListTotal.value = filteredList.length;
    }
    fileListPage.value = currentPage;
    fileListPageSize.value = currentPageSize;
  } catch {
    // 错误时也支持搜索过滤
    let filteredList = mockFileList;
    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase();
      filteredList = mockFileList.filter(
        item => item.file_name.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword)
      );
    }

    const start = (currentPage - 1) * currentPageSize;
    const end = start + currentPageSize;
    fileList.value = filteredList.slice(start, end);
    fileListTotal.value = filteredList.length;
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
    '链方向，true表示正链，false表示负链': '链方向'
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
    file: '*/*' // 默认接受所有文件
  };

  return typeMap[fileType] || '.file,application/octet-stream';
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

schemas.value = [...schemas_list];
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
                    <ElButton
                      v-if="!schemas_list.some(s => s.id === item.id)"
                      type="danger"
                      size="small"
                      style="margin-left: 10px; padding: 2px 6px"
                      @click.stop="deleteSchema(item.id)"
                    >
                      删除
                    </ElButton>
                  </div>
                </ElOption>
                <template #empty>
                  <span style="color: #aaa">暂无可选数据类型</span>
                </template>
              </ElSelect>
              <ElButton type="primary" size="small" @click="customSchemaDialog = true">新建Schema</ElButton>
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
              <ElInput
                v-model="dynamicForm[field.name]"
                :placeholder="field.description"
                :type="field.type === 'number' ? 'number' : 'text'"
                :class="{ 'required-field': field.required }"
              />
            </ElFormItem>
          </template>

          <!-- 文件上传字段 -->
          <template v-for="field in fileFields" :key="field.name">
            <ElFormItem :label="getShortLabel(field.label)" :required="field.required">
              <div class="upload-container">
                <div class="upload-row">
                  <ElUpload
                    :auto-upload="false"
                    :show-file-list="false"
                    :accept="getFileAcceptTypes(field.fileType)"
                    @change="uploadFile => uploadFile.raw && handleFileChange(field.name, uploadFile.raw)"
                  >
                    <ElButton type="primary">选择文件</ElButton>
                    <span v-if="fileInputs[field.name]" style="margin-left: 10px; color: #409eff">
                      {{ fileInputs[field.name]?.name }}
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
        <div style="font-weight: bold; color: #409eff; margin-bottom: 5px">历史上传记录</div>
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
            <ElTableColumn prop="file_name" label="文件名" show-overflow-tooltip />
            <ElTableColumn prop="name" label="样本名称" show-overflow-tooltip />
            <ElTableColumn prop="timestamp" label="上传时间" show-overflow-tooltip />
            <ElTableColumn label="操作" width="100" align="center">
              <template #default="scope">
                <ElButton
                  type="primary"
                  size="small"
                  :disabled="!scope.row.s3_key"
                  @click="handleDownloadFile(scope.row)"
                >
                  下载
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

  <!-- 自定义Schema对话框 -->
  <ElDialog v-model="customSchemaDialog" title="创建自定义Schema" width="800px" :close-on-click-modal="false">
    <div class="schema-creation-wizard">
      <!-- 步骤指示器 -->
      <div class="wizard-steps">
        <div class="step" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
          <span class="step-number">1</span>
          <span class="step-title">基本信息</span>
        </div>
        <div class="step" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
          <span class="step-number">2</span>
          <span class="step-title">字段定义</span>
        </div>
        <div class="step" :class="{ active: currentStep === 3, completed: currentStep > 3 }">
          <span class="step-number">3</span>
          <span class="step-title">完成创建</span>
        </div>
      </div>

      <!-- 步骤1：基本信息 -->
      <div v-if="currentStep === 1" class="step-content">
        <h3>第一步：设置Schema基本信息</h3>
        <ElForm label-width="120px">
          <ElFormItem label="Schema名称" required>
            <ElInput v-model="customSchemaName" placeholder="请输入schema名称，如：Custom_Data_Type" />
          </ElFormItem>
          <ElFormItem label="描述">
            <ElInput v-model="customSchemaDescription" type="textarea" :rows="3" placeholder="请描述这个Schema的用途" />
          </ElFormItem>
        </ElForm>
      </div>

      <!-- 步骤2：字段定义 -->
      <div v-if="currentStep === 2" class="step-content">
        <h3>第二步：定义Schema字段</h3>
        <div class="fields-container">
          <!-- 当没有字段时显示提示 -->
          <div v-if="customSchemaFields.length === 0" class="empty-fields-tip">
            <ElIcon size="48" color="#909399"><Plus /></ElIcon>
            <p>还没有添加任何字段</p>
            <p>请点击下方按钮添加字段，或选择常用字段模板</p>
          </div>

          <div v-for="(field, index) in customSchemaFields" :key="index" class="field-item">
            <div class="field-header">
              <span class="field-title">字段 {{ index + 1 }}</span>
              <ElButton type="danger" size="small" @click="removeField(index)">删除</ElButton>
            </div>
            <div class="field-content">
              <ElForm label-width="80px" size="small">
                <ElFormItem label="字段名" required>
                  <ElInput v-model="field.name" placeholder="如：sample_id" />
                </ElFormItem>
                <ElFormItem label="字段类型" required>
                  <ElSelect v-model="field.type" placeholder="选择字段类型">
                    <ElOption label="字符串" value="string" />
                    <ElOption label="数字" value="number" />
                    <ElOption label="整数" value="integer" />
                    <ElOption label="布尔值" value="boolean" />
                    <ElOption label="对象" value="object" />
                    <ElOption label="数组" value="array" />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="描述">
                  <ElInput v-model="field.description" placeholder="字段说明" />
                </ElFormItem>
                <ElFormItem label="是否必填">
                  <ElSwitch v-model="field.required" />
                </ElFormItem>

                <!-- 字符串类型的额外选项 -->
                <template v-if="field.type === 'string'">
                  <ElFormItem label="文件格式">
                    <ElInput v-model="field.pattern" placeholder="如：\\.json$" />
                  </ElFormItem>
                </template>

                <!-- 数字类型的额外选项 -->
                <template v-if="field.type === 'number' || field.type === 'integer'">
                  <ElFormItem label="最小值">
                    <ElInput v-model="field.minimum" type="number" />
                  </ElFormItem>
                  <ElFormItem label="最大值">
                    <ElInput v-model="field.maximum" type="number" />
                  </ElFormItem>
                </template>

                <!-- 对象类型的子字段 -->
                <template v-if="field.type === 'object'">
                  <ElFormItem label="子字段">
                    <div class="sub-fields">
                      <!-- 当没有子字段时显示提示 -->
                      <div v-if="!field.properties || field.properties.length === 0" class="empty-sub-fields-tip">
                        <ElIcon size="24" color="#909399"><Plus /></ElIcon>
                        <span>还没有添加任何子字段</span>
                      </div>

                      <div v-for="(subField, subIndex) in field.properties as any[]" :key="subIndex" class="sub-field">
                        <div class="sub-field-row">
                          <ElInput v-model="(subField as any).name" placeholder="子字段名" style="width: 120px" />
                          <ElSelect v-model="(subField as any).type" placeholder="类型" style="width: 100px">
                            <ElOption label="字符串" value="string" />
                            <ElOption label="数字" value="number" />
                            <ElOption label="文件" value="file" />
                          </ElSelect>
                          <ElInput v-model="(subField as any).description" placeholder="描述" style="width: 150px" />

                          <!-- 文件类型的额外选项 -->
                          <template v-if="(subField as any).type === 'file'">
                            <ElInput v-model="(subField as any).pattern" placeholder="格式" style="width: 80px" />
                          </template>

                          <ElButton type="danger" size="small" @click="removeSubField(field, subIndex)">删除</ElButton>
                        </div>
                      </div>
                      <div class="sub-field-actions">
                        <ElButton type="primary" size="small" @click="addSubField(field)">添加子字段</ElButton>

                        <ElDropdown
                          trigger="click"
                          @command="subFieldTemplate => addCommonSubField(field, subFieldTemplate)"
                        >
                          <ElButton type="success" size="small">
                            <ElIcon><Plus /></ElIcon>
                            常用子字段
                            <ElIcon class="el-icon--right"><ArrowDown /></ElIcon>
                          </ElButton>
                          <template #dropdown>
                            <ElDropdownMenu>
                              <ElDropdownItem
                                v-for="subField in commonSubFields"
                                :key="subField.name"
                                :command="subField"
                              >
                                <div class="dropdown-item">
                                  <span class="field-name">{{ subField.name }}</span>
                                  <span class="field-desc">{{ subField.description }}</span>
                                </div>
                              </ElDropdownItem>
                            </ElDropdownMenu>
                          </template>
                        </ElDropdown>
                      </div>
                    </div>
                  </ElFormItem>
                </template>
              </ElForm>
            </div>
          </div>

          <div class="field-actions">
            <ElButton type="primary" class="add-field-btn" @click="addField">
              <ElIcon><Plus /></ElIcon>
              添加字段
            </ElButton>

            <ElDropdown trigger="click" @command="addCommonField">
              <ElButton type="success" class="common-field-btn">
                <ElIcon><Plus /></ElIcon>
                常用字段
                <ElIcon class="el-icon--right"><ArrowDown /></ElIcon>
              </ElButton>
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem v-for="field in commonFields" :key="field.name" :command="field">
                    <div class="dropdown-item">
                      <span class="field-name">{{ field.name }}</span>
                      <span class="field-desc">{{ field.description }}</span>
                    </div>
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </div>
        </div>
      </div>

      <!-- 步骤3：完成创建 -->
      <div v-if="currentStep === 3" class="step-content">
        <h3>第三步：预览和完成</h3>
        <div class="schema-preview">
          <h4>生成的Schema结构：</h4>
          <pre class="schema-json">{{ generatedSchemaJson }}</pre>
        </div>

        <div class="schema-actions">
          <ElButton type="success" @click="downloadSchema">
            <ElIcon><Download /></ElIcon>
            下载Schema文件
          </ElButton>
          <ElButton type="info" @click="previewSchema">
            <ElIcon><View /></ElIcon>
            预览Schema
          </ElButton>
        </div>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <ElButton @click="customSchemaDialog = false">取消</ElButton>
        <ElButton v-if="currentStep > 1" @click="prevStep">上一步</ElButton>
        <ElButton v-if="currentStep < 3" type="primary" @click="nextStep">下一步</ElButton>
        <ElButton v-if="currentStep === 3" type="primary" @click="createSchema">创建Schema</ElButton>
      </span>
    </template>
  </ElDialog>
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

/* 下拉框删除按钮样式 */
.el-select-dropdown .el-option {
  padding: 0.5rem 0.75rem;
}

.el-select-dropdown .el-option .el-button {
  opacity: 0.7;
  transition: opacity 0.2s;
}

.el-select-dropdown .el-option:hover .el-button {
  opacity: 1;
}

.el-select-dropdown .el-option .el-button:hover {
  opacity: 1;
  transform: scale(1.05);
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
  width: min(22rem, 60%);
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

/* Schema创建向导样式 */
.schema-creation-wizard {
  padding: 20px 0;
}

.wizard-steps {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  gap: 20px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.5;
  transition: all 0.3s;
}

.step.active {
  opacity: 1;
}

.step.completed {
  opacity: 0.8;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: #606266;
}

.step.active .step-number {
  background: #409eff;
  color: white;
}

.step.completed .step-number {
  background: #67c23a;
  color: white;
}

.step-title {
  font-size: 14px;
  color: #606266;
}

.step-content {
  min-height: 300px;
}

.step-content h3 {
  text-align: center;
  margin-bottom: 20px;
  color: #303133;
}

.fields-container {
  max-width: 800px;
  margin: 0 auto;
}

.field-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fafafa;
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.field-title {
  font-weight: bold;
  color: #303133;
}

.field-content {
  padding: 16px;
  background: white;
  border-radius: 6px;
  min-width: 0;
}

.sub-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sub-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.sub-field-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding: 4px 0;
  /* 防止闪烁 */
  will-change: auto;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* 防止子字段输入框闪烁 */
.sub-field .el-input,
.sub-field .el-select {
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: auto;
}

/* 防止输入框hover时的闪烁 */
.el-input__inner:hover,
.el-select:hover {
  transform: translateZ(0);
  backface-visibility: hidden;
}

.field-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.add-field-btn,
.common-field-btn {
  flex: 1;
}

.dropdown-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-name {
  font-weight: bold;
  color: #303133;
}

.field-desc {
  font-size: 12px;
  color: #909399;
}

.schema-preview {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.schema-json {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 16px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
}

.schema-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* 空字段提示样式 */
.empty-fields-tip {
  text-align: center;
  padding: 40px 20px;
  background: #fafafa;
  border: 2px dashed #e4e7ed;
  border-radius: 8px;
  margin-bottom: 20px;
}

/* 空子字段提示样式 */
.empty-sub-fields-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  background: #f8f9fa;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  color: #909399;
  font-size: 13px;
  margin-bottom: 12px;
}

.sub-field-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.empty-fields-tip p {
  margin: 8px 0;
  color: #909399;
  font-size: 14px;
}

.empty-fields-tip p:first-of-type {
  font-weight: 500;
  color: #606266;
}

/* 文件上传区域居中 */
.file-upload-section {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}
</style>
