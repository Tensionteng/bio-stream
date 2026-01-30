<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Edit, Setting } from '@element-plus/icons-vue';
// 引入 G6 v5
import { Graph } from '@antv/g6';
import { getCausalAlgorithms, getCausalObjects, runCausalDiscovery } from '@/service/api/causal';

// 状态管理
const activeStep = ref(0);
const submitting = ref(false);
const configDialogVisible = ref(false);
let graph: any = null;
let resizeObserver: ResizeObserver | null = null;

// 数据源
const objectList = ref<any[]>([]);
const algMap = ref<Record<string, any[]>>({});

const loading = reactive({
  objects: false,
  algs: false
});

const formData = reactive({
  object_doid: '',
  alg_name: '',
  alg_config: {} as Record<string, any>
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
    const res = await getCausalObjects({ object_name: queryName }, 'discover');
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

const fetchAlgorithms = async () => {
  loading.algs = true;
  try {
    const res = await getCausalAlgorithms('discover');
    if (res.data) algMap.value = res.data;
  } catch {
    ElMessage.error('获取算法列表失败');
  } finally {
    loading.algs = false;
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

// 流程控制
const nextStep = async () => {
  if (activeStep.value === 0) {
    if (!formData.object_doid) {
      ElMessage.warning('请先选择一个数字对象');
      return;
    }
    await fetchAlgorithms();
    activeStep.value = 1;
  }
};

const prevStep = () => {
  if (activeStep.value > 0) {
    activeStep.value -= 1;
    if (graph) {
      graph.destroy();
      graph = null;
    }
  }
};

const resetProcess = () => {
  activeStep.value = 0;
  formData.object_doid = '';
  formData.alg_name = '';
  formData.alg_config = {};
  if (graph) {
    graph.destroy();
    graph = null;
  }
};

// G6 v5 渲染函数
const renderGraph = (data: any) => {
  const container = document.getElementById('causal-graph-container');

  if (!container) {
    return;
  }

  if (graph) {
    graph.destroy();
    graph = null;
  }

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  graph = new Graph({
    container: 'causal-graph-container',
    width,
    height,
    autoFit: 'view',
    padding: 20,
    data,
    layout: {
      type: 'dagre',
      rankdir: 'LR',
      nodesep: 50,
      ranksep: 70
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    node: {
      type: 'circle',
      style: {
        size: 50,
        lineWidth: 2,
        labelPlacement: 'center',
        labelFontSize: 12
      }
    },
    edge: {
      type: 'polyline',
      style: {
        lineWidth: 1,
        radius: 10
      }
    },
    animation: true
  });

  graph.render().catch(() => {
    // Render error handled silently
  });

  if (resizeObserver) resizeObserver.disconnect();
  resizeObserver = new ResizeObserver(() => {
    if (!graph || graph.destroyed) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      graph.resize(w, h);
      graph.fitView();
    }
  });
  resizeObserver.observe(container);
};

// --- 提交与可视化 ---
const onSubmit = async () => {
  if (!formData.alg_name) {
    ElMessage.warning('请选择算法');
    return;
  }

  submitting.value = true;
  try {
    const res = await runCausalDiscovery({
      alg_name: formData.alg_name,
      alg_config: formData.alg_config,
      doid: formData.object_doid
    });

    ElMessage.success('任务完成，正在渲染图谱...');

    // 切换到结果步骤
    activeStep.value = 2;
    let rawData = res.data || {};
    if (rawData.constructResult) {
      rawData = rawData.constructResult;
    }

    const rawNodes = rawData.nodes || [];
    const rawEdges = rawData.edges || [];
    if (rawNodes.length === 0) {
      ElMessage.warning('未发现有效节点数据');
    }

    const nodes = rawNodes.map((n: any) => {
      const isDark = n.nodeType && n.nodeType.length > 10;
      const isLightBlue = n.nodeType && n.nodeType.includes('9bc7e0');

      let fillColor = '#d0e5f2';
      if (isLightBlue) {
        fillColor = '#9bc7e0';
      } else if (isDark) {
        fillColor = '#164c7e';
      }

      return {
        id: String(n.id),
        data: { ...n },
        style: {
          labelText: n.label || n.id,
          fill: fillColor,
          stroke: isDark ? '#164c7e' : '#5b8ff9',
          labelFill: isDark ? '#fff' : '#000'
        }
      };
    });

    const edges = rawEdges.map((e: any) => ({
      source: String(e.from),
      target: String(e.to),
      style: {
        stroke: '#A3B1BF',
        endArrow: true
      }
    }));

    const graphData = { nodes, edges };

    nextTick(() => {
      setTimeout(() => {
        renderGraph(graphData);
      }, 100);
    });
  } catch {
    ElMessage.error('运行失败');
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  fetchObjects('');
});

onBeforeUnmount(() => {
  if (graph) graph.destroy();
  if (resizeObserver) resizeObserver.disconnect();
});
</script>

<template>
  <div class="causal-discovery-container">
    <ElCard class="box-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span class="title">🔍 因果发现</span>
          <ElTag type="warning" effect="plain" round>Causal Discovery</ElTag>
        </div>
      </template>

      <div class="steps-wrapper">
        <ElSteps :active="activeStep" finish-status="success" align-center>
          <ElStep title="选择数据" description="Select Data Object" />
          <ElStep title="算法配置" description="Configure Algorithm" />
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
          <div class="section-title">选择并配置因果发现算法</div>
          <ElForm label-position="top" size="large">
            <ElFormItem label="选择算法 (Algorithm)" required>
              <ElSelect
                v-model="formData.alg_name"
                placeholder="请选择或搜索因果发现算法"
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

            <div v-if="formData.alg_name" class="parameter-config-box fade-in">
              <div class="box-header">
                <span class="box-title">
                  <strong>当前参数配置 ({{ formData.alg_name }}):</strong>
                </span>
                <ElButton type="primary" link @click="openConfigDialog">
                  <ElIcon class="mr-1"><Edit /></ElIcon>
                  修改配置
                </ElButton>
              </div>

              <div class="box-content">
                <ElEmpty
                  v-if="Object.keys(formData.alg_config).length === 0"
                  :image-size="40"
                  description="该算法无须配置参数"
                />
                <template v-else>
                  <div v-for="(val, key) in formData.alg_config" :key="key" class="param-tag-item">
                    <span class="param-label">{{ getParamLabel(key) }}:</span>
                    <span class="param-value">{{ val }}</span>
                  </div>
                </template>
              </div>
            </div>
          </ElForm>
        </div>

        <div v-show="activeStep === 2" class="result-section fade-in">
          <div class="graph-header">
            <span class="graph-title">因果关系图谱</span>
          </div>
          <div id="causal-graph-container" class="graph-container"></div>
        </div>
      </div>

      <div class="action-footer">
        <ElButton v-if="activeStep > 0" size="large" round @click="prevStep">上一步</ElButton>
        <ElButton v-if="activeStep === 0" type="primary" size="large" round class="wide-btn" @click="nextStep">
          下一步
        </ElButton>
        <ElButton
          v-if="activeStep === 1"
          type="primary"
          size="large"
          :loading="submitting"
          round
          class="wide-btn"
          @click="onSubmit"
        >
          提交运行任务
        </ElButton>
        <ElButton v-if="activeStep === 2" type="default" size="large" round @click="resetProcess">重新分析</ElButton>
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
                <ElRadio :label="true">True</ElRadio>
                <ElRadio :label="false">False</ElRadio>
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
.causal-discovery-container {
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
.steps-wrapper {
  padding: 12px 40px;
  flex-shrink: 0;
  border-bottom: 1px dashed #f0f0f0;
}

.step-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  position: relative;
}

.form-section {
  width: 80%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  overflow-y: auto;
  height: 100%;
}

.result-section {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.graph-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  border-bottom: 1px solid #eee;
  background: #fff;
  z-index: 5;
}

.graph-container {
  flex: 1;
  width: 100%;
  height: auto;
  background: #fafafa;
  position: relative;
  overflow: hidden;
}

.section-title {
  font-size: 15px;
  margin-bottom: 10px;
  margin-top: 10px;
  text-align: center;
  font-weight: 600;
  color: #606266;
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

.graph-title {
  font-weight: bold;
  color: #333;
}
.graph-legend {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #666;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot.blue {
  background: #d0e5f2;
  border: 1px solid #5b8ff9;
}
.dot.dark {
  background: #164c7e;
  border: 1px solid #164c7e;
}

/* --- 算法选择下拉自定义样式 --- */
.alg-option-item {
  width: 100%;
}
.option-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.option-actions {
  display: flex;
  align-items: center;
}

/* --- 核心修改：参数配置框样式 --- */
.parameter-config-box {
  margin-top: 24px;
  background-color: #fcfcfe; /* 截图同款极浅背景 */
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}

.box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #e0e0e0;
}

.box-title {
  font-size: 14px;
  color: #606266;
}

.box-content {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

/* 模仿截图中的参数标签样式 */
.param-tag-item {
  display: inline-flex;
  align-items: center;
  /* 浅蓝紫色背景，类似截图 */
  background-color: #eff0f9;
  border: 1px solid #e1e3ea;
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 13px;
  color: #5a6a85;
  transition: all 0.3s;
}

.param-tag-item:hover {
  background-color: #e6e8f5;
  border-color: #dcdfe6;
}

.param-label {
  margin-right: 6px;
  font-weight: normal;
}

.param-value {
  color: #405ffe; /* 蓝色高亮值 */
  font-weight: 600;
}

/* 动画效果 */
.fade-in {
  animation: fadeIn 0.4s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.full-width {
  width: 100%;
}
</style>
