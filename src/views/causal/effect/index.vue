<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Edit, Setting, TrendCharts } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { getCausalAlgorithms, getCausalObjects, getCausalVariables, runCausalEffect } from '@/service/api/causal';

// 状态管理
const activeStep = ref(0);
const submitting = ref(false);
const configDialogVisible = ref(false);
let chartInstance: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

const objectList = ref<any[]>([]);
const algMap = ref<Record<string, any[]>>({});
const variableList = ref<string[]>([]);

const effectResult = reactive({
  intercept: null as number | null,
  slope: null as number | null
});

const loading = reactive({
  objects: false,
  algs: false,
  vars: false
});

const formData = reactive({
  object_doid: '',
  alg_name: '',
  alg_config: {} as Record<string, any>,
  divmap: {
    X: [] as string[],
    Y: [] as string[],
    T: [] as string[],
    W: [] as string[]
  }
});

// 计算属性
const currentParamsDefinition = computed(() => {
  if (!formData.alg_name || !algMap.value[formData.alg_name]) return [];
  return algMap.value[formData.alg_name];
});

const getParamLabel = (key: string) => {
  const def = currentParamsDefinition.value.find((p: any) => p.name_en === key);
  return def ? def.name_ch : key;
};

// 搜索逻辑
let searchTimer: any = null;
const fetchObjects = async (queryName: string = '') => {
  loading.objects = true;
  try {
    const res = await getCausalObjects({ object_name: queryName });
    if (res.data) objectList.value = res.data;
    else if (Array.isArray(res)) objectList.value = res;
  } catch {
    // Error handled silently
  } finally {
    loading.objects = false;
  }
};

const handleObjectSearch = (query: string) => {
  if (searchTimer) clearTimeout(searchTimer);
  loading.objects = true;
  searchTimer = setTimeout(() => {
    fetchObjects(query);
  }, 300);
};

// API 调用
const fetchAlgorithms = async () => {
  loading.algs = true;
  try {
    const res = await getCausalAlgorithms();
    if (res.data) algMap.value = res.data;
  } catch {
    ElMessage.error('获取算法列表失败');
  } finally {
    loading.algs = false;
  }
};

const fetchVariables = async () => {
  loading.vars = true;
  try {
    const res = await getCausalVariables();
    if (res.data) variableList.value = res.data;
  } catch {
    ElMessage.error('获取变量列表失败');
  } finally {
    loading.vars = false;
  }
};

const handleAlgChange = (val: string) => {
  const params = algMap.value[val];
  if (!params) return;
  const newConfig: Record<string, any> = {};
  params.forEach((p: any) => {
    let defaultVal: any = p.default_value;
    if (p.type === 'float') defaultVal = Number.parseFloat(defaultVal);
    else if (p.type === 'int') defaultVal = Number.parseInt(defaultVal, 10);
    else if (p.type === 'bool') defaultVal = String(defaultVal).toLowerCase() === 'true';
    newConfig[p.name_en] = defaultVal;
  });
  formData.alg_config = newConfig;
};

const handleConfigClick = (algName: string) => {
  if (formData.alg_name !== algName) {
    formData.alg_name = algName;
    handleAlgChange(algName);
  }
  setTimeout(() => {
    configDialogVisible.value = true;
  }, 100);
};

const openConfigDialog = () => {
  configDialogVisible.value = true;
};

const handleOptionValueType = (val: string | number, type: string) => {
  const strVal = String(val);
  if (type === 'int') return Number.parseInt(strVal, 10);
  if (type === 'float') return Number.parseFloat(strVal);
  return val;
};

const nextStep = async () => {
  if (activeStep.value === 0) {
    if (!formData.object_doid) {
      ElMessage.warning('请先选择一个数字对象');
      return;
    }
    await fetchAlgorithms();
    activeStep.value = 1;
  } else if (activeStep.value === 1) {
    if (!formData.alg_name) {
      ElMessage.warning('请选择算法');
      return;
    }
    await fetchVariables();
    activeStep.value = 2;
  }
};

const prevStep = () => {
  if (activeStep.value > 0) {
    activeStep.value -= 1;
    if (activeStep.value < 3 && chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
    }
  }
};

const resetProcess = () => {
  activeStep.value = 0;
  formData.object_doid = '';
  formData.alg_name = '';
  formData.alg_config = {};
  formData.divmap = { X: [], Y: [], T: [], W: [] };
  effectResult.intercept = null;
  effectResult.slope = null;
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
};

// 核心渲染逻辑：三条线（不同斜率）+ 散点 + 范围指示竖线
// eslint-disable-next-line max-params
function renderChart(intercept: number, slope: number, att0: number[], att1: number[]) {
  const container = document.getElementById('effect-chart-container');
  if (!container) return;

  if (chartInstance) chartInstance.dispose();
  chartInstance = echarts.init(container);

  // 1. 数据极值
  const y0_min = Math.min(...att0);
  const y0_max = Math.max(...att0);
  const y1_min = Math.min(...att1);
  const y1_max = Math.max(...att1);

  // 2. 构造散点数据
  const scatterData0 = att0.map(y => [0, y]);
  const scatterData1 = att1.map(y => [1, y]);
  const allScatterData = [...scatterData0, ...scatterData1];

  // X 轴延伸范围 (用于画线)
  const x_start = -0.2;
  const x_end = 1.2;

  // 3. 绿线 (Regression Line)
  const greenLine = [
    [x_start, intercept + slope * x_start],
    [x_end, intercept + slope * x_end]
  ];

  // 4. 蓝线 (Upper Line) - 准备斜率 k 和截距 b 供 tooltip 实时计算
  const k_up = y1_max - y0_max;
  const b_up = y0_max;
  const blueLine = [
    [x_start, b_up + k_up * x_start],
    [x_end, b_up + k_up * x_end]
  ];

  // 5. 黄线 (Lower Line)
  const k_low = y1_min - y0_min;
  const b_low = y0_min;
  const yellowLine = [
    [x_start, b_low + k_low * x_start],
    [x_end, b_low + k_low * x_end]
  ];

  const option = {
    title: {
      text: 'ATT Analysis',
      left: 'center',
      top: 10,
      textStyle: { color: '#999', fontSize: 12 }
    },
    // --- 修改重点 1: Tooltip 配置 ---
    tooltip: {
      trigger: 'axis',
      // snap: false 是关键，让鼠标可以在没有数据点的地方（如 -0.073）也能触发计算
      axisPointer: { type: 'cross', snap: false },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#eee',
      textStyle: { color: '#333' },
      formatter(params: any) {
        // 获取当前鼠标位置的 X 轴数值 (精确浮点数)
        let xVal = 0;
        if (params && params.length) {
          xVal = params[0].axisValue;
        }

        // 代入直线公式 y = kx + b 实时计算纵坐标
        const y_green = intercept + slope * xVal;
        const y_blue = b_up + k_up * xVal;
        const y_yellow = b_low + k_low * xVal;

        // 渲染提示框 HTML
        return `
          <div style="font-weight:bold; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
            X Position: ${Number(xVal).toFixed(3)}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap: 20px; margin-bottom: 4px;">
            <span style="color:#3366CC; font-weight:500">● Upper Bound</span>
            <span style="font-weight:bold; font-family: monospace;">${y_blue.toFixed(4)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap: 20px; margin-bottom: 4px;">
            <span style="color:#009966; font-weight:500">● Regression</span>
            <span style="font-weight:bold; font-family: monospace;">${y_green.toFixed(4)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap: 20px;">
            <span style="color:#FF9933; font-weight:500">● Lower Bound</span>
            <span style="font-weight:bold; font-family: monospace;">${y_yellow.toFixed(4)}</span>
          </div>
        `;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      nameLocation: 'middle',
      min: x_start,
      max: x_end,
      splitLine: { show: true, lineStyle: { color: '#eee' } },
      axisLabel: {
        formatter: (val: number) => {
          if (Math.abs(val) < 0.01) return '0';
          if (Math.abs(val - 1) < 0.01) return '1';
          return '';
        }
      }
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitLine: { show: true, lineStyle: { color: '#eee' } }
    },
    series: [
      // 1. 散点图 - 保持隐藏 Tooltip，避免显示几百个点
      {
        name: 'Data Points',
        type: 'scatter',
        data: allScatterData,
        symbolSize: 6,
        itemStyle: { color: '#666', opacity: 0.6 },
        z: 20,
        tooltip: { show: false }
      },
      // --- 修改重点 2: 移除线图的 tooltip: { show: false } ---
      // 这样鼠标悬停时，ECharts 才会去捕获这些线，并触发上面的 formatter
      {
        name: 'Regression Line',
        type: 'line',
        data: greenLine,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 4, color: '#009966' },
        z: 5
      },
      {
        name: 'Upper Bound',
        type: 'line',
        data: blueLine,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 2, color: '#3366CC' },
        z: 4
      },
      {
        name: 'Lower Bound',
        type: 'line',
        data: yellowLine,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 2, color: '#FF9933' },
        z: 4
      },
      // 5. 竖线
      {
        type: 'line',
        markLine: {
          symbol: ['none', 'none'],
          label: { show: false },
          animation: false,
          data: [
            [
              { coord: [0, y0_min], lineStyle: { color: '#3366CC', width: 4, type: 'solid', opacity: 0.5 } },
              { coord: [0, y0_max] }
            ],
            [
              { coord: [1, y1_min], lineStyle: { color: '#FF6699', width: 4, type: 'solid', opacity: 0.5 } },
              { coord: [1, y1_max] }
            ]
          ]
        }
      }
    ]
  };

  chartInstance.setOption(option);

  if (resizeObserver) resizeObserver.disconnect();
  resizeObserver = new ResizeObserver(() => {
    chartInstance?.resize();
  });
  resizeObserver.observe(container);
}

const onSubmit = async () => {
  const { T, Y } = formData.divmap;
  if (!T.length || !Y.length) {
    ElMessage.warning('干预变量 (T) 和 结果变量 (Y) 不能为空');
    return;
  }

  submitting.value = true;
  try {
    const res = await runCausalEffect({
      alg_name: formData.alg_name,
      alg_config: formData.alg_config,
      doid: formData.object_doid,
      divmap: formData.divmap
    });

    ElMessage.success('分析完成，正在渲染结果...');
    activeStep.value = 3;

    if (res.data && res.data.inferenceResultJson) {
      try {
        const resultData = JSON.parse(res.data.inferenceResultJson);

        const { intercept, slope, ATT0, ATT1 } = resultData;

        if (intercept !== undefined && slope !== undefined) {
          effectResult.intercept = Number.parseFloat(intercept);
          effectResult.slope = Number.parseFloat(slope);
        }

        const att0Data = ATT0 || [];
        const att1Data = ATT1 || [];

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            renderChart(intercept, slope, att0Data, att1Data);
          });
        });
      } catch {
        ElMessage.error('结果数据格式异常');
      }
    }
  } catch {
    ElMessage.error('任务执行失败');
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  fetchObjects('');
});

onBeforeUnmount(() => {
  if (chartInstance) chartInstance.dispose();
  if (resizeObserver) resizeObserver.disconnect();
});
</script>

<template>
  <div class="causal-effect-container">
    <ElCard class="box-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span class="title">✨ 因果效应估计</span>
          <ElTag type="primary" effect="plain" round>Causal Effect Estimation</ElTag>
        </div>
      </template>

      <div class="steps-wrapper">
        <ElSteps :active="activeStep" finish-status="success" align-center>
          <ElStep title="选择数据" description="Select Data Object" />
          <ElStep title="算法配置" description="Configure Algorithm" />
          <ElStep title="变量选择" description="Assign Variables" />
          <ElStep title="结果分析" description="Result Visualization" />
        </ElSteps>
      </div>

      <div class="step-content">
        <div v-if="activeStep === 0" class="form-section fade-in">
          <div class="section-title">请选择用于分析的数据集</div>
          <ElForm label-position="top" size="large">
            <ElFormItem label="数字对象 (Digital Object)" required>
              <ElSelect
                v-model="formData.object_doid"
                placeholder="请输入关键词搜索数据对象..."
                filterable
                remote
                reserve-keyword
                clearable
                :remote-method="handleObjectSearch"
                :loading="loading.objects"
                class="large-select full-width"
              >
                <ElOption v-for="item in objectList" :key="item.doid" :label="item.name" :value="item.doid">
                  <div class="option-item">
                    <span class="option-name">{{ item.name }}</span>
                    <ElTag size="small" type="info">{{ item.doid }}</ElTag>
                  </div>
                </ElOption>
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </div>

        <div v-if="activeStep === 1" class="form-section fade-in">
          <div class="section-title">选择并配置分析算法</div>
          <ElForm label-position="top" size="large">
            <ElFormItem label="选择算法 (Algorithm)" required>
              <ElSelect
                v-model="formData.alg_name"
                placeholder="请选择或搜索因果效应算法"
                :loading="loading.algs"
                popper-class="alg-select-dropdown"
                class="full-width"
                @change="handleAlgChange"
              >
                <ElOption
                  v-for="(params, algName) in algMap"
                  :key="algName"
                  :label="algName"
                  :value="algName"
                  class="alg-option-item"
                >
                  <div class="option-content">
                    <span class="alg-name">{{ algName }}</span>
                    <div class="option-actions">
                      <ElTooltip content="点击配置参数" placement="right" :enterable="false">
                        <ElButton type="primary" link size="small" @click.stop="handleConfigClick(algName)">
                          <ElIcon class="mr-1"><Setting /></ElIcon>
                          配置
                        </ElButton>
                      </ElTooltip>
                    </div>
                  </div>
                </ElOption>
              </ElSelect>
            </ElFormItem>

            <div v-if="formData.alg_name" class="config-preview fade-in">
              <div class="preview-header">
                <span class="preview-title">当前参数配置 ({{ formData.alg_name }})：</span>
                <ElButton type="primary" link size="small" @click="openConfigDialog">
                  <ElIcon><Edit /></ElIcon>
                  修改配置
                </ElButton>
              </div>
              <div class="preview-content">
                <ElEmpty
                  v-if="Object.keys(formData.alg_config).length === 0"
                  :image-size="60"
                  description="暂无配置参数"
                />
                <ElTag
                  v-for="(val, key) in formData.alg_config"
                  :key="key"
                  size="default"
                  class="config-tag"
                  type="info"
                  effect="light"
                >
                  <span class="tag-label">{{ getParamLabel(key) }}:</span>
                  <span class="tag-value">{{ val }}</span>
                </ElTag>
              </div>
            </div>
          </ElForm>
        </div>

        <div v-if="activeStep === 2" class="variable-selection fade-in">
          <ElAlert title="请将数据集中的列映射到因果模型变量" type="primary" show-icon class="mb-4" :closable="false" />
          <ElForm label-position="top" size="large">
            <div class="var-group primary-group">
              <div class="group-label">核心变量 (Core Variables)</div>
              <ElRow :gutter="40">
                <ElCol :span="12">
                  <ElFormItem required>
                    <template #label>
                      <span class="custom-label">干预变量 (Treatment - T)</span>
                    </template>
                    <ElSelect
                      v-model="formData.divmap.T"
                      multiple
                      collapse-tags
                      filterable
                      placeholder="选择 T 变量"
                      class="full-width"
                    >
                      <ElOption v-for="v in variableList" :key="v" :label="v" :value="v" />
                    </ElSelect>
                  </ElFormItem>
                </ElCol>
                <ElCol :span="12">
                  <ElFormItem required>
                    <template #label>
                      <span class="custom-label">结果变量 (Outcome - Y)</span>
                    </template>
                    <ElSelect
                      v-model="formData.divmap.Y"
                      multiple
                      collapse-tags
                      filterable
                      placeholder="选择 Y 变量"
                      class="full-width"
                    >
                      <ElOption v-for="v in variableList" :key="v" :label="v" :value="v" />
                    </ElSelect>
                  </ElFormItem>
                </ElCol>
              </ElRow>
            </div>
            <div class="var-group secondary-group">
              <div class="group-label">控制变量 (Control Variables)</div>
              <ElRow :gutter="40">
                <ElCol :span="12">
                  <ElFormItem label="协变量 (Covariates - X)">
                    <ElSelect
                      v-model="formData.divmap.X"
                      multiple
                      collapse-tags
                      filterable
                      placeholder="选择 X 变量"
                      class="full-width"
                    >
                      <ElOption v-for="v in variableList" :key="v" :label="v" :value="v" />
                    </ElSelect>
                  </ElFormItem>
                </ElCol>
                <ElCol :span="12">
                  <ElFormItem label="混杂因子 (Confounders - W)">
                    <ElSelect
                      v-model="formData.divmap.W"
                      multiple
                      collapse-tags
                      filterable
                      placeholder="选择 W 变量"
                      class="full-width"
                    >
                      <ElOption v-for="v in variableList" :key="v" :label="v" :value="v" />
                    </ElSelect>
                  </ElFormItem>
                </ElCol>
              </ElRow>
            </div>
          </ElForm>
        </div>

        <div v-show="activeStep === 3" class="result-section fade-in">
          <div class="chart-wrapper">
            <div class="graph-header">
              <span class="graph-title">
                <ElIcon class="mr-1"><TrendCharts /></ElIcon>
                因果效应回归线 (ATT Regression)
              </span>
            </div>
            <div id="effect-chart-container" class="graph-container"></div>
          </div>
        </div>
      </div>

      <div class="action-footer">
        <ElButton v-if="activeStep > 0" size="large" round @click="prevStep">上一步</ElButton>
        <ElButton v-if="activeStep < 2" type="primary" size="large" round class="wide-btn" @click="nextStep">
          下一步
        </ElButton>
        <ElButton
          v-if="activeStep === 2"
          type="primary"
          size="large"
          :loading="submitting"
          round
          class="wide-btn"
          @click="onSubmit"
        >
          提交运行任务
        </ElButton>
        <ElButton v-if="activeStep === 3" type="default" size="large" round @click="resetProcess">重新分析</ElButton>
      </div>
    </ElCard>

    <ElDialog
      v-model="configDialogVisible"
      title="算法参数配置"
      width="550px"
      append-to-body
      destroy-on-close
      class="config-dialog"
    >
      <div class="dialog-content-wrapper">
        <ElForm label-width="160px" label-position="right" size="default">
          <template v-for="param in currentParamsDefinition" :key="param.name_en">
            <ElFormItem :label="param.name_ch || param.name_en">
              <ElInputNumber
                v-if="['float', 'int'].includes(param.type) && !param.option"
                v-model="formData.alg_config[param.name_en]"
                :step="param.type === 'float' ? 0.01 : 1"
                controls-position="right"
                class="full-width"
              />
              <ElRadioGroup v-else-if="param.type === 'bool'" v-model="formData.alg_config[param.name_en]">
                <ElRadio :value="true">True</ElRadio>
                <ElRadio :value="false">False</ElRadio>
              </ElRadioGroup>
              <ElSelect
                v-else-if="param.type === 'enum' || param.option"
                v-model="formData.alg_config[param.name_en]"
                class="full-width"
              >
                <ElOption
                  v-for="(label, val) in param.option"
                  :key="val"
                  :label="label"
                  :value="handleOptionValueType(val, param.type)"
                />
              </ElSelect>
              <ElInput v-else v-model="formData.alg_config[param.name_en]" />
            </ElFormItem>
          </template>
        </ElForm>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <ElButton @click="configDialogVisible = false">取消</ElButton>
          <ElButton type="primary" @click="configDialogVisible = false">确定</ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* 样式部分完全保持不变 */
.causal-effect-container {
  width: 90%;
  max-width: 1600px;
  height: calc(100vh - 20px);
  margin: 10px auto;
  overflow: hidden;
}
.box-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.box-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  min-height: 0;
}
.card-header {
  padding: 12px 24px;
  border-bottom: 1px solid #f5f7fa;
}
.title {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  margin: 0;
}
.steps-wrapper {
  padding: 12px 40px;
  flex-shrink: 0;
  border-bottom: 1px dashed #f0f0f0;
}
.step-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}
.form-section {
  width: 80%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 20px;
}
.section-title {
  font-size: 15px;
  margin-bottom: 10px;
  margin-top: 10px;
  text-align: center;
  font-weight: 600;
  color: #606266;
}
.variable-selection {
  width: 100%;
  max-width: 1400px;
  padding: 0 20px;
}
.var-group {
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 10px;
  border: 1px solid #ebeef5;
}
.mb-4 {
  margin-bottom: 8px;
}
.action-footer {
  flex-shrink: 0;
  padding: 15px 0;
  border-top: 1px solid #f0f2f5;
  background: #fff;
  display: flex;
  justify-content: center;
  gap: 16px;
  z-index: 10;
}

.config-preview {
  margin-top: 20px;
  padding: 15px;
  background-color: #fcfcfc;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.preview-title {
  font-size: 14px;
  color: #606266;
  font-weight: 600;
}
.preview-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.config-tag {
  display: flex;
  align-items: center;
}
.tag-label {
  opacity: 0.8;
  margin-right: 4px;
}
.tag-value {
  font-weight: 600;
}

.result-section {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 20px;
}
.metric-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  flex-shrink: 0;
  gap: 20px;
}
.metric-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 16px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s;
  min-width: 200px;
}
.shadow-hover:hover {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
.metric-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #909399;
  font-size: 14px;
  margin-bottom: 8px;
}
.metric-value-group {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.metric-number {
  font-size: 36px;
  font-weight: 700;
  color: #409eff;
  letter-spacing: 1px;
}
.metric-unit {
  font-size: 14px;
  color: #c0c4cc;
}

.chart-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
  overflow: hidden;
}
.graph-header {
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
}
.graph-title {
  font-weight: 600;
  color: #303133;
  font-size: 15px;
  display: flex;
  align-items: center;
}
.graph-container {
  flex: 1;
  min-height: 0;
  width: 100%;
}
.mr-1 {
  margin-right: 4px;
}
.full-width {
  width: 100%;
}
</style>

<style>
.alg-select-dropdown .el-select-dropdown__item {
  height: 40px;
  line-height: 40px;
  padding: 0 10px 0 20px;
}
.option-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.alg-name {
  font-weight: 500;
}
.option-actions {
  opacity: 0;
  transition: opacity 0.2s ease;
  transform: translateX(10px);
}
.el-select-dropdown__item.hover .option-actions,
.el-select-dropdown__item:hover .option-actions {
  opacity: 1;
  transform: translateX(0);
}
</style>
