<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  ElCard,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElSkeleton,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs
} from 'element-plus';
import VuePdfEmbed from 'vue-pdf-embed';

defineOptions({ name: 'VisualizationPage' });

// --- State ---
const loading = ref(true);
const taskStatus = ref<'processing' | 'completed' | 'error'>('processing');

// Task and Flow selection
const taskIds = ref<string[]>([]);
const selectedTaskId = ref<string | undefined>(undefined);

interface Flow {
  key: string;
  label: string;
}

const processingFlows = ref<Flow[]>([
  { key: 'dna_preprocessing', label: 'DNA前处理' },
  { key: 'rna_preprocessing', label: 'RNA前处理' },
  { key: 'dna_merge', label: 'DNA合并' },
  { key: 'rna_quant', label: 'RNA定量分析' }
]);
const selectedFlowKey = ref(processingFlows.value[0].key);

// --- Data for rendering ---
interface FlowOutput {
  type: 'pdf' | 'table';
  label: string;
  url?: string;
  tableType?: 'vcf' | 'raw_count' | 'other';
  tableData?: any[];
}

const outputs = ref<FlowOutput[]>([]);
const activeOutputLabel = ref('');

const tableColumns = ref<{ prop: string; label: string; width: number }[]>([]);

// PDF specific state
// const pdfPageCount = ref(0);
// const pdfCurrentPage = ref(1);
// const pdfRef = ref<any>(null);

// --- Column Definitions ---
const staticVcfColumns = [
  { prop: '#CHROM', label: '#CHROM', width: 100 },
  { prop: 'POS', label: 'POS', width: 120 },
  { prop: 'ID', label: 'ID', width: 120 },
  { prop: 'REF', label: 'REF', width: 80 },
  { prop: 'ALT', label: 'ALT', width: 80 },
  { prop: 'QUAL', label: 'QUAL', width: 80 },
  { prop: 'FILTER', label: 'FILTER', width: 80 },
  { prop: 'INFO', label: 'INFO', width: 80 },
  { prop: 'FORMAT', label: 'FORMAT', width: 80 }
];

const staticRawCountColumns = [
  'gene_id',
  'NR_0201_1',
  'NR_0201_2',
  'R_0301_1',
  'R_0301_2',
  'R_1001_1',
  'R_1001_2',
  'R_1101_1',
  'R_1101_2',
  'NR_1201_1',
  'NR_1201_2',
  'NR_1301_1',
  'NR_1301_2',
  'NR_1401_1',
  'NR_1401_2',
  'R_1501_1',
  'R_1501_2',
  'R_1601_1',
  'R_1601_2',
  'NR_1701_1',
  'NR_1701_2',
  'R_1801_1',
  'R_1801_2',
  'NR_2001_1',
  'NR_2001_2',
  'NC_2401_1',
  'NC_2401_2',
  'NC_3401_1',
  'NC_3401_2',
  'NC_3601_1',
  'NC_3601_2',
  'NC_5101_1',
  'NC_5101_2',
  'NC_F1F_1',
  'NC_F1F_2',
  'NC_U1M_1',
  'NC_U1M_2',
  'NC_U2F_1'
].map(col => ({ prop: col, label: col, width: 150 }));

// --- Methods ---

async function fetchTaskIds() {
  loading.value = true;
  // await new Promise(resolve => setTimeout(resolve, 500));
  await new Promise<void>(resolve => {
    setTimeout(resolve, 500);
  });
  const mockTaskIds = ['task-001', 'task-002', 'task-003'];
  taskIds.value = mockTaskIds;
  if (mockTaskIds.length > 0) {
    selectedTaskId.value = mockTaskIds[0];
    await fetchData();
  } else {
    loading.value = false;
  }
}

async function fetchData() {
  if (!selectedTaskId.value) return;

  loading.value = true;
  taskStatus.value = 'processing';
  outputs.value = [];

  // await new Promise(resolve => setTimeout(resolve, 1000));
  await new Promise<void>(resolve => {
    setTimeout(resolve, 1000);
  });

  const mockResponse = getMockData(selectedTaskId.value, selectedFlowKey.value);
  taskStatus.value = mockResponse.status;

  if (mockResponse.status === 'completed') {
    outputs.value = mockResponse.data.outputs || [];
    if (outputs.value.length > 0) {
      activeOutputLabel.value = outputs.value[0].label;
      // Find the first table output to prepare its columns by default
      const firstTable = outputs.value.find(o => o.type === 'table');
      prepareTableColumns(firstTable);
    }
  }

  loading.value = false;
}

function prepareTableColumns(tableOutput?: FlowOutput) {
  if (!tableOutput || !tableOutput.tableData || tableOutput.tableData.length === 0) {
    tableColumns.value = [];
    return;
  }

  const data = tableOutput.tableData;
  const firstRowKeys = Object.keys(data[0]);
  let staticColumns: { prop: string; label: string; width: number }[] = [];

  if (tableOutput.tableType === 'vcf') {
    staticColumns = staticVcfColumns;
  } else if (tableOutput.tableType === 'raw_count') {
    staticColumns = staticRawCountColumns;
  }

  if (staticColumns.length > 0) {
    const staticColumnProps = new Set(staticColumns.map(c => c.prop));
    const dynamicKeys = firstRowKeys.filter(key => !staticColumnProps.has(key));
    const dynamicColumns = dynamicKeys.map(key => ({ prop: key, label: key, width: 120 }));
    tableColumns.value = [...staticColumns, ...dynamicColumns];
  } else {
    // For 'other' table types or if no static definition exists
    tableColumns.value = firstRowKeys.map(key => ({ prop: key, label: key, width: 150 }));
  }
}

function getMockData(
  taskId: string,
  flowKey: string
): { status: 'completed' | 'processing'; data: { outputs?: FlowOutput[] } } {
  if (taskId === 'task-002') {
    return { status: 'processing', data: {} };
  }

  if (flowKey === 'dna_preprocessing') {
    return {
      status: 'completed',
      data: {
        outputs: [
          {
            type: 'pdf',
            label: '质控报告',
            url: 'https://xiaoxian521.github.io/hyperlink/pdf/Cookie%E5%92%8CSession%E5%8C%BA%E5%88%AB%E7%94%A8%E6%B3%95.pdf'
          },
          {
            type: 'table',
            label: 'VCF数据',
            tableType: 'vcf',
            tableData: [
              {
                '#CHROM': '1',
                POS: '78170655',
                ID: 'rs1621088',
                REF: 'T',
                ALT: 'C',
                QUAL: '.',
                FILTER: '.',
                INFO: '.',
                FORMAT: 'GT',
                sample02: '1/1',
                sample03: '0/1'
              },
              {
                '#CHROM': '3',
                POS: '136250592',
                ID: '.',
                REF: 'C',
                ALT: 'T',
                QUAL: '.',
                FILTER: '.',
                INFO: '.',
                FORMAT: 'GT',
                sample02: '0/0',
                sample03: '0/0'
              }
            ]
          }
        ]
      }
    };
  }

  if (flowKey === 'rna_preprocessing') {
    return {
      status: 'completed',
      data: {
        outputs: [
          {
            type: 'table',
            label: 'VCF数据',
            tableType: 'vcf',
            tableData: [
              {
                '#CHROM': '1',
                POS: '78170655',
                ID: 'rs1621088',
                REF: 'T',
                ALT: 'C',
                QUAL: '.',
                FILTER: '.',
                INFO: '.',
                FORMAT: 'GT',
                sample02: '1/1',
                sample03: '0/1'
              }
            ]
          }
        ]
      }
    };
  }

  if (flowKey === 'dna_merge') {
    return {
      status: 'completed',
      data: {
        outputs: [
          {
            type: 'pdf',
            label: '合并报告',
            url: 'https://xiaoxian521.github.io/hyperlink/pdf/Cookie%E5%92%8CSession%E5%8C%BA%E5%88%AB%E7%94%A8%E6%B3%95.pdf'
          },
          {
            type: 'table',
            label: '合并后VCF数据',
            tableType: 'vcf',
            tableData: [
              {
                '#CHROM': '1',
                POS: '78170655',
                ID: 'rs1621088',
                REF: 'T',
                ALT: 'C',
                QUAL: '.',
                FILTER: '.',
                INFO: '.',
                FORMAT: 'GT',
                sample02: '1/1',
                sample03: '0/1'
              },
              {
                '#CHROM': '3',
                POS: '136250592',
                ID: '.',
                REF: 'C',
                ALT: 'T',
                QUAL: '.',
                FILTER: '.',
                INFO: '.',
                FORMAT: 'GT',
                sample02: '0/0',
                sample03: '0/0'
              }
            ]
          }
        ]
      }
    };
  }

  return {
    status: 'completed',
    data: {
      outputs: [
        {
          type: 'table',
          label: '定量分析结果',
          tableType: 'other',
          tableData: [
            { id: 1, analysis: 'RNA-Quant', value: 123.45, qc: 'Pass' },
            { id: 2, analysis: 'RNA-Quant', value: 678.9, qc: 'Pass' }
          ]
        }
      ]
    }
  };
}

function onPdfRendered() {
  // PDF loading is handled per-component now
}

onMounted(() => {
  fetchTaskIds();
});
</script>

<template>
  <ElCard class="h-full card-wrapper">
    <template #header>
      <div class="flex items-center justify-between">
        <p>Visualization Result</p>
        <div class="flex items-center gap-16px">
          <ElSelect v-model="selectedTaskId" placeholder="Select Task" class="w-200px" @change="fetchData">
            <ElOption v-for="id in taskIds" :key="id" :label="id" :value="id" />
          </ElSelect>
          <ElRadioGroup v-model="selectedFlowKey" @change="fetchData">
            <ElRadioButton v-for="flow in processingFlows" :key="flow.key" :value="flow.key">
              {{ flow.label }}
            </ElRadioButton>
          </ElRadioGroup>
        </div>
      </div>
    </template>

    <div v-if="loading" class="h-full flex-center">
      <ElSkeleton :rows="10" animated />
    </div>

    <div v-else-if="taskStatus === 'processing'" class="h-full flex-col-center justify-center text-gray-500">
      <icon-local-empty-data class="text-160px" />
      <p class="mt-4 text-xl">任务还在进行中，请耐心等待...</p>
    </div>

    <div v-else-if="taskStatus === 'completed' && outputs.length > 0" class="h-full">
      <ElTabs v-if="outputs.length > 1" v-model="activeOutputLabel" class="h-full flex flex-col">
        <ElTabPane
          v-for="output in outputs"
          :key="output.label"
          :label="output.label"
          :name="output.label"
          class="h-full"
        >
          <div v-if="output.type === 'pdf'" class="h-full flex flex-col">
            <div class="flex-1 overflow-auto">
              <VuePdfEmbed :source="output.url" @rendered="onPdfRendered" />
            </div>
          </div>
          <div v-else-if="output.type === 'table'" class="h-full">
            <ElTable :data="output.tableData" border stripe height="100%" class="w-full">
              <ElTableColumn
                v-for="column in tableColumns"
                :key="column.prop"
                :prop="column.prop"
                :label="column.label"
                :width="column.width"
                show-overflow-tooltip
              />
            </ElTable>
          </div>
        </ElTabPane>
      </ElTabs>
      <template v-else>
        <div v-if="outputs[0].type === 'pdf'" class="h-full flex flex-col">
          <div class="flex-1 overflow-auto">
            <VuePdfEmbed :source="outputs[0].url" @rendered="onPdfRendered" />
          </div>
        </div>
        <div v-else-if="outputs[0].type === 'table'" class="h-full">
          <ElTable :data="outputs[0].tableData" border stripe height="100%" class="w-full">
            <ElTableColumn
              v-for="column in tableColumns"
              :key="column.prop"
              :prop="column.prop"
              :label="column.label"
              :width="column.width"
              show-overflow-tooltip
            />
          </ElTable>
        </div>
      </template>
    </div>

    <div v-else class="h-full flex-col-center justify-center text-gray-500">
      <icon-local-empty-data class="text-160px" />
      <p class="mt-4 text-xl">没有可展示的数据</p>
    </div>
  </ElCard>
</template>

<style scoped>
.card-wrapper {
  :deep(.el-card__body) {
    height: calc(100% - 60px);
  }
}

.flex-col-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.el-tabs--top {
  height: 100%;
}

:deep(.el-tabs__content) {
  height: calc(100% - 55px);
}
</style>
