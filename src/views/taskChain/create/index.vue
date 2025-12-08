<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElNotification } from 'element-plus';
import Draggable from 'vuedraggable';
import {
  ArrowDown,
  Box,
  CircleCheck,
  CircleCheckFilled,
  Close,
  Connection,
  DArrowLeft,
  Delete,
  Files,
  InfoFilled,
  Plus,
  Search,
  Setting,
  View
} from '@element-plus/icons-vue';
import { fetchTaskUnitDetail, fetchTaskUnitList } from '@/service/api/task_unit';
import {
  checkTaskChain,
  createTaskChain,
  fetchFileSchemaList,
  fetchTaskChainDetail,
  updateTaskChain
} from '@/service/api/task_chain';
// Types
import type { TaskUnitDetail, TaskUnitListItem } from '@/service/api/task_unit';
import type { FileSchemaItem, TaskChainSubmitParams } from '@/service/api/task_chain';

// 本页面负责“拖拽任务单元-配置参数-合法性校验-提交保存”的完整流程。

// --- Interfaces ---
interface ChainStepItem extends Omit<TaskUnitListItem, 'id'> {
  id: number;
  name: string;
  tempKey: number;
}
interface LocalInputConfig {
  id: number | undefined;
  multiple: boolean;
}
interface LocalOutputConfig {
  id: number | undefined;
  per_sample: boolean;
}

const route = useRoute();
const router = useRouter();

// 路由中是否携带链路 ID，用于区分创建/编辑模式
const chainId = computed(() => route.query.id as string);
const isEditing = computed(() => Boolean(chainId.value));

// --- State ---
const availableTaskUnits = ref<TaskUnitListItem[]>([]);
const fileSchemas = ref<FileSchemaItem[]>([]);

const chainName = ref('');
const chainDesc = ref('');
const chainType = ref('');
// [新增] 可视化类型选择
const chainVisuals = ref<string[]>([]);

// 拖拽面板中配置的整体链路输入/输出/步骤
const chainInputs = ref<LocalInputConfig[]>([]);
const chainOutputs = ref<LocalOutputConfig[]>([]);
const chainSteps = ref<ChainStepItem[]>([]);

// 搜索关键词状态
const unitSearchKeyword = ref('');

const isLoadingUnits = ref(false);
const isLoadingChainData = ref(false);
const isSubmitting = ref(false);
const isChecking = ref(false);
const isValidated = ref(false);

// 弹窗：展示单个任务单元的详情
const showDetailModal = ref(false);
const selectedTaskDetail = ref<TaskUnitDetail | null>(null);
const isLoadingDetail = ref(false);
const detailDialogTitle = computed(() =>
  selectedTaskDetail.value ? `单元详情: ${selectedTaskDetail.value.name}` : '详情'
);

// 合法性校验弹窗 & 结果列表
const showValidationModal = ref(false);
const validationResults = ref<any[]>([]);

// --- Helpers ---
const getStatusType = (status: string) => {
  if (!status) return 'info';
  const s = status.toUpperCase();
  if (s === 'SUCCESS' || s === 'READY' || s === 'OK') return 'success';
  if (s === 'WARNING' || s === 'WARN') return 'warning';
  if (s === 'ERROR' || s === 'FAILED' || s === 'FAIL') return 'danger';
  return 'info';
};

const getStatusMessageClass = (status: string) => `status-color-${getStatusType(status)}`;

// --- Methods ---

// 独立的加载任务单元函数，支持搜索参数
async function loadTaskUnits() {
  isLoadingUnits.value = true;
  try {
    const params: any = { page: 1, page_size: 999 };
    if (unitSearchKeyword.value) {
      params.name = unitSearchKeyword.value;
    }

    const unitRes = await fetchTaskUnitList(params);

    if (unitRes.data?.task_units) {
      availableTaskUnits.value = unitRes.data.task_units;
    } else {
      availableTaskUnits.value = [];
    }
  } catch {
    ElMessage.error('获取任务单元列表失败');
  } finally {
    isLoadingUnits.value = false;
  }
}

// 搜索框点击/回车统一走加载逻辑，保持分页参数固定
const handleSearchUnits = () => {
  loadTaskUnits();
};

// 初始化页面所需的基础数据：任务单元 + 文件 schema + 编辑态回填
async function initData() {
  loadTaskUnits();

  try {
    const schemaRes = await fetchFileSchemaList();
    if (schemaRes.data?.schemas) {
      fileSchemas.value = schemaRes.data.schemas;
    }
  } catch {
    ElMessage.error('初始化数据失败');
  }

  if (isEditing.value) {
    loadChainData(chainId.value);
  }
}

// 编辑状态下根据 ID 拉取链路详情，并回填至左/右侧面板
async function loadChainData(id: string) {
  isLoadingChainData.value = true;
  try {
    const response = await fetchTaskChainDetail(id);
    if (response.error) {
      ElMessage.error('加载工具链详情失败');
      return;
    }
    const data = response.data;
    if (!data) return;

    chainName.value = data.name;
    chainDesc.value = data.description || '';
    chainType.value = data.type || '';

    // 回显可视化类型字段，如果接口没返回则默认为空数组
    chainVisuals.value = data.visual_types || [];

    if (data.units) {
      chainSteps.value = data.units.map(
        unit =>
          ({
            id: unit.unit_id,
            name: unit.name,
            tempKey: Date.now() + Math.random(),
            created_time: '',
            link_file: ''
          }) as ChainStepItem
      );
    }

    if (data.input) {
      chainInputs.value = data.input.map(i => ({
        id: Number(i.meta_id),
        multiple: i.multiple
      }));
    }

    if (data.output) {
      chainOutputs.value = data.output.map(o => ({
        id: Number(o.meta_id),
        per_sample: o.per_sample
      }));
    }

    isValidated.value = true;
  } catch {
    // ignore
  } finally {
    isLoadingChainData.value = false;
  }
}

// Draggable 的 clone 钩子：为同一个任务单元生成唯一 tempKey，避免冲突
function cloneUnit(originUnit: TaskUnitListItem): ChainStepItem {
  return {
    ...originUnit,
    id: Number(originUnit.id),
    tempKey: Date.now() + Math.random()
  };
}
function removeStep(index: number) {
  chainSteps.value.splice(index, 1);
}
// 清空当前的编排结果，回到初始态
function clearChain() {
  chainSteps.value = [];
  chainInputs.value = [];
  chainOutputs.value = [];
  chainName.value = '';
  chainDesc.value = '';
  chainType.value = '';
  chainVisuals.value = []; // [新增] 清空可视化
  isValidated.value = false;
}

function addInputRow() {
  chainInputs.value.push({ id: undefined, multiple: false });
}
function removeInputRow(idx: number) {
  chainInputs.value.splice(idx, 1);
}
function addOutputRow() {
  chainOutputs.value.push({ id: undefined, per_sample: false });
}
function removeOutputRow(idx: number) {
  chainOutputs.value.splice(idx, 1);
}

// 将用户在三个面板中配置的内容汇总成接口提交所需的 payload
function constructPayload(): TaskChainSubmitParams | null {
  if (!chainName.value) {
    ElMessage.warning('请输入工具链名称');
    return null;
  }
  if (!chainType.value) {
    ElMessage.warning('请输入工具链类型');
    return null;
  }
  if (chainSteps.value.length === 0) {
    ElMessage.warning('请至少添加一个任务单元');
    return null;
  }
  if (chainInputs.value.some(i => i.id === undefined)) {
    ElMessage.warning('请完善输入定义的类型选择');
    return null;
  }
  if (chainOutputs.value.some(o => o.id === undefined)) {
    ElMessage.warning('请完善输出定义的类型选择');
    return null;
  }

  return {
    name: chainName.value,
    description: chainDesc.value,
    type: chainType.value,
    visual_types: chainVisuals.value,
    task_units: chainSteps.value.map((step, index) => ({
      id: index + 1,
      unit_id: Number(step.id)
    })),
    inputs: chainInputs.value.map(i => ({
      id: i.id!,
      multiple: i.multiple
    })),
    outputs: chainOutputs.value.map(o => ({
      id: o.id!,
      per_sample: o.per_sample
    }))
  };
}

// “检查合法性”按钮：先序列化配置，再调用校验接口并根据结果给出提示
async function handleCheckValidity() {
  const payload = constructPayload();
  if (!payload) return;

  isChecking.value = true;
  isValidated.value = false;

  try {
    const response = await checkTaskChain(payload);
    if (response.error) return;

    const { status, unit_status } = response.data;
    const mainStatus = status ? status.toUpperCase() : 'ERROR';

    validationResults.value = unit_status.filter(item => {
      const s = item.status.toUpperCase();
      return s !== 'READY' && s !== 'SUCCESS' && s !== 'OK';
    });

    if (mainStatus === 'ERROR') {
      isValidated.value = false;
      showValidationModal.value = true;
    } else if (mainStatus === 'WARNING') {
      isValidated.value = true;
      showValidationModal.value = true;
      ElMessage.warning('检测到潜在问题，请确认后提交');
    } else {
      isValidated.value = true;
      ElNotification.success({
        title: '检查通过',
        message: '工具链配置合法，可以保存。'
      });
    }
  } catch {
    ElMessage.error('检查请求失败');
    isValidated.value = false;
  } finally {
    isChecking.value = false;
  }
}

// 保存/更新入口：必须在通过合法性校验后才能提交
async function handleSubmit() {
  if (!isValidated.value) {
    ElMessage.warning('请先点击“检查合法性”，只有在无严重错误(ERROR)时才可保存');
    return;
  }
  const payload = constructPayload();
  if (!payload) return;

  isSubmitting.value = true;
  try {
    let response;
    if (isEditing.value && chainId.value) {
      response = await updateTaskChain(chainId.value, payload);
    } else {
      response = await createTaskChain(payload);
    }

    if (response.error) return;

    const s = response.data?.status?.toUpperCase();
    if (s === 'ERROR' || s === 'FAILED') {
      ElMessage.error('提交失败：存在严重错误，请检查配置');
      isValidated.value = false;
    } else {
      ElNotification.success({
        title: '操作成功',
        message: isEditing.value ? '工具链已更新' : '工具链创建成功'
      });
      if (!isEditing.value) {
        clearChain();
      } else {
        router.push({ name: 'taskchain_list' });
      }
    }
  } catch {
    ElMessage.error('提交失败');
  } finally {
    isSubmitting.value = false;
  }
}

// 打开左侧任务单元的详情抽屉，便于确认输入/输出/参数
async function handleViewUnitDetail(id: string | number) {
  showDetailModal.value = true;
  isLoadingDetail.value = true;
  try {
    const res = await fetchTaskUnitDetail(String(id));
    if (!res.error) selectedTaskDetail.value = res.data;
  } finally {
    isLoadingDetail.value = false;
  }
}
function onDialogClosed() {
  selectedTaskDetail.value = null;
}

onMounted(() => {
  initData();
});

// 根据路由的 id 变化动态切换“编辑/创建”态
watch(
  () => route.query.id,
  newId => {
    if (newId) {
      loadChainData(newId as string);
    } else {
      clearChain();
    }
  }
);

// 只要任意配置有改动，就强制置为未校验，避免旧的校验结果误导用户
watch(
  [chainName, chainDesc, chainType, chainInputs, chainOutputs, chainSteps, chainVisuals], // [新增] 监听 chainVisuals 变化
  () => {
    if (isValidated.value) {
      isValidated.value = false;
    }
  },
  { deep: true }
);
</script>

<template>
  <div class="task-chain-create-el">
    <!-- 顶层卡片：集成工具链编排、检验、提交的全部交互 -->
    <ElCard shadow="never" class="main-card">
      <template #header>
        <div class="card-header">
          <span>{{ isEditing ? '编辑工具链' : '创建工具链 (编排与配置)' }}</span>
          <div class="header-actions">
            <ElTag v-if="isEditing" type="warning" effect="plain" size="small">正在编辑 ID: {{ chainId }}</ElTag>

            <ElButton type="warning" plain :icon="CircleCheck" :loading="isChecking" @click="handleCheckValidity">
              检查合法性
            </ElButton>

            <ElTooltip
              :content="isValidated ? (isEditing ? '更新工具链' : '保存工具链') : '请先通过合法性检查'"
              placement="bottom"
              :disabled="isValidated"
            >
              <span class="btn-wrapper">
                <ElButton
                  class="btn-submit-top"
                  type="primary"
                  :loading="isSubmitting"
                  :disabled="!isValidated"
                  @click="handleSubmit"
                >
                  {{ isEditing ? '更新工具链' : '保存工具链' }}
                </ElButton>
              </span>
            </ElTooltip>
          </div>
        </div>
      </template>

      <!-- 三栏布局：左侧任务库 / 中部流程画布 / 右侧参数配置 -->
      <div class="drag-main">
        <div class="drag-container">
          <!-- 左侧任务单元库：可搜索 + 拖拽 -->
          <div class="source-panel">
            <div class="panel-title">
              <ElIcon><Box /></ElIcon>
              任务单元库
            </div>

            <div class="panel-search">
              <ElInput
                v-model="unitSearchKeyword"
                placeholder="搜索单元名称..."
                class="unit-search-input"
                clearable
                @clear="handleSearchUnits"
                @keyup.enter="handleSearchUnits"
              >
                <template #append>
                  <ElButton :icon="Search" @click="handleSearchUnits" />
                </template>
              </ElInput>
            </div>

            <div v-loading="isLoadingUnits" class="unit-list-wrapper">
              <Draggable
                v-if="availableTaskUnits.length > 0"
                class="unit-list"
                :list="availableTaskUnits"
                :group="{ name: 'chain', pull: 'clone', put: false }"
                :sort="false"
                :clone="cloneUnit"
                item-key="id"
              >
                <template #item="{ element }">
                  <div class="source-item">
                    <ElIcon><Files /></ElIcon>
                    <span class="unit-name" :title="element.name">{{ element.name }}</span>
                    <ElIcon class="action-icon" @click.stop="handleViewUnitDetail(element.id)">
                      <View />
                    </ElIcon>
                  </div>
                </template>
              </Draggable>

              <ElEmpty
                v-else-if="!isLoadingUnits"
                :image-size="60"
                description="未找到相关单元"
                class="unit-list-empty"
              />
            </div>
          </div>

          <!-- 中间画布：动态展示链路步骤 -->
          <div v-loading="isLoadingChainData" class="target-panel">
            <div class="panel-title">
              <ElIcon><Connection /></ElIcon>
              流程编排
              <ElButton
                link
                type="danger"
                size="small"
                class="clear-chain-btn"
                :icon="Delete"
                :disabled="chainSteps.length === 0"
                @click="clearChain"
              >
                清空
              </ElButton>
            </div>

            <div class="canvas-area">
              <Draggable
                v-model="chainSteps"
                class="flow-list"
                group="chain"
                item-key="tempKey"
                animation="200"
                ghost-class="ghost-card"
              >
                <template #item="{ element, index }">
                  <div class="flow-node-wrapper">
                    <div class="flow-card">
                      <div class="flow-status-icon">
                        <ElIcon><CircleCheckFilled /></ElIcon>
                      </div>
                      <div class="flow-content">
                        <div class="flow-step-id">Step {{ index + 1 }}</div>
                        <div class="flow-unit-name">{{ element.name }}</div>
                      </div>
                      <div class="flow-actions">
                        <ElIcon class="action-btn delete-btn" @click="removeStep(index)">
                          <Close />
                        </ElIcon>
                      </div>
                    </div>
                    <div v-if="index < chainSteps.length - 1" class="flow-arrow-vertical">
                      <div class="line"></div>
                      <ElIcon><ArrowDown /></ElIcon>
                    </div>
                  </div>
                </template>

                <template v-if="chainSteps.length === 0" #header>
                  <div class="empty-canvas">
                    <ElIcon size="40"><DArrowLeft /></ElIcon>
                    <p>拖拽任务单元到此处</p>
                  </div>
                </template>
              </Draggable>
            </div>
          </div>

          <!-- 右侧表单：配置基础信息、输入输出、可视化选项 -->
          <div class="config-panel">
            <div class="panel-title">
              <div class="title-left">
                <ElIcon><Setting /></ElIcon>
                参数配置
              </div>
            </div>

            <div class="config-content">
              <ElScrollbar>
                <ElForm label-position="top" size="default" class="modern-form">
                  <div class="config-section">
                    <div class="section-header">基础信息</div>
                    <ElFormItem label="工具链名称" required>
                      <ElInput v-model="chainName" placeholder="给工具链起个名字" class="modern-input" />
                    </ElFormItem>
                    <ElFormItem label="类型 (Type)" required>
                      <ElInput v-model="chainType" placeholder="例如: DAG, Linear" class="modern-input" />
                    </ElFormItem>
                    <ElFormItem label="描述">
                      <ElInput
                        v-model="chainDesc"
                        type="textarea"
                        :rows="3"
                        placeholder="简要描述该工具链的功能..."
                        class="modern-input"
                        resize="none"
                      />
                    </ElFormItem>
                  </div>

                  <div class="config-section">
                    <div class="section-header">
                      <span>可视化类型 (Visualization)</span>
                      <ElTag type="info" size="small" effect="plain" round>{{ chainVisuals.length }}</ElTag>
                    </div>
                    <div class="visual-config-wrapper">
                      <ElCheckboxGroup v-model="chainVisuals" class="visual-checkbox-group">
                        <ElCheckbox label="txt" border>TXT</ElCheckbox>
                        <ElCheckbox label="pdf" border>PDF</ElCheckbox>
                        <ElCheckbox label="vcf" border>VCF</ElCheckbox>
                        <ElCheckbox label="csv" border>CSV</ElCheckbox>
                        <ElCheckbox label="image" border>Image</ElCheckbox>
                        <ElCheckbox label="graph" border>Graph</ElCheckbox>
                      </ElCheckboxGroup>
                      <div class="visual-tip">
                        <ElIcon><InfoFilled /></ElIcon>
                        <span>勾选后，任务运行成功将支持对应可视化</span>
                      </div>
                    </div>
                  </div>

                  <div class="config-section">
                    <div class="section-header">
                      <span>输入定义 (Inputs)</span>
                      <ElTag type="info" size="small" effect="plain" round>{{ chainInputs.length }}</ElTag>
                    </div>

                    <div class="dynamic-list">
                      <TransitionGroup name="list">
                        <div v-for="(item, idx) in chainInputs" :key="idx" class="dynamic-card">
                          <div class="card-row">
                            <span class="row-label">文件类型</span>
                            <ElSelect v-model="item.id" placeholder="请选择" class="modern-select" filterable>
                              <ElOption
                                v-for="schema in fileSchemas"
                                :key="schema.id"
                                :label="schema.name"
                                :value="schema.id"
                              />
                            </ElSelect>
                          </div>
                          <div class="card-row">
                            <ElCheckbox v-model="item.multiple" label="支持多文件上传" size="small" border />
                            <ElButton
                              link
                              type="danger"
                              :icon="Delete"
                              class="delete-row-btn"
                              @click="removeInputRow(idx)"
                            />
                          </div>
                        </div>
                      </TransitionGroup>
                    </div>

                    <div class="dashed-add-btn" @click="addInputRow">
                      <ElIcon><Plus /></ElIcon>
                      添加输入项
                    </div>
                  </div>

                  <div class="config-section">
                    <div class="section-header">
                      <span>输出定义 (Outputs)</span>
                      <ElTag type="info" size="small" effect="plain" round>{{ chainOutputs.length }}</ElTag>
                    </div>

                    <div class="dynamic-list">
                      <TransitionGroup name="list">
                        <div v-for="(item, idx) in chainOutputs" :key="idx" class="dynamic-card">
                          <div class="card-row">
                            <span class="row-label">文件类型</span>
                            <ElSelect v-model="item.id" placeholder="请选择" class="modern-select" filterable>
                              <ElOption
                                v-for="schema in fileSchemas"
                                :key="schema.id"
                                :label="schema.name"
                                :value="schema.id"
                              />
                            </ElSelect>
                          </div>
                          <div class="card-row">
                            <ElCheckbox v-model="item.per_sample" label="每个样本独立生成" size="small" border />
                            <ElButton
                              link
                              type="danger"
                              :icon="Delete"
                              class="delete-row-btn"
                              @click="removeOutputRow(idx)"
                            />
                          </div>
                        </div>
                      </TransitionGroup>
                    </div>

                    <div class="dashed-add-btn" @click="addOutputRow">
                      <ElIcon><Plus /></ElIcon>
                      添加输出项
                    </div>
                  </div>

                  <div class="bottom-spacer"></div>
                </ElForm>
              </ElScrollbar>
            </div>
          </div>
        </div>
      </div>
    </ElCard>

    <!-- 任务单元详情：辅助理解每个步骤的输入输出 -->
    <ElDialog
      v-model="showDetailModal"
      :title="detailDialogTitle"
      width="70%"
      append-to-body
      class="detail-dialog"
      @closed="onDialogClosed"
    >
      <ElSkeleton v-if="isLoadingDetail" :rows="10" animated />
      <div v-if="selectedTaskDetail" class="detail-content">
        <div class="detail-header">
          <div class="detail-header-top">
            <div class="detail-main-title">{{ selectedTaskDetail.name }}</div>
            <ElTag size="default" effect="light" class="id-tag">ID: {{ selectedTaskDetail.id }}</ElTag>
          </div>
          <div class="detail-header-meta">
            <span class="meta-item">创建时间：{{ selectedTaskDetail.created_time }}</span>
            <span class="meta-item">链接文件：{{ selectedTaskDetail.link_file }}</span>
          </div>
        </div>
        <ElDivider class="detail-divider" />

        <div class="section-card section-card-full code-section">
          <div class="section-title">
            <span class="section-dot section-dot-blue"></span>
            Code / 关联代码
          </div>
          <div class="code-block">
            <pre>{{ selectedTaskDetail.code }}</pre>
          </div>
        </div>

        <ElRow :gutter="16" class="detail-grid">
          <ElCol :xs="24" :md="12">
            <div class="section-card">
              <div class="section-title">
                <span class="section-dot section-dot-green"></span>
                输入定义 (Input)
              </div>
              <ElTable
                v-if="selectedTaskDetail.input && selectedTaskDetail.input.length > 0"
                :data="selectedTaskDetail.input"
                border
                stripe
                size="small"
              >
                <ElTableColumn prop="name" label="名称" min-width="100" show-overflow-tooltip />
                <ElTableColumn prop="multiple" label="Multiple" width="80" align="center">
                  <template #default="scope">
                    <ElTag :type="scope.row.multiple ? 'success' : 'info'" size="small">
                      {{ scope.row.multiple ? 'Yes' : 'No' }}
                    </ElTag>
                  </template>
                </ElTableColumn>
              </ElTable>
              <ElEmpty v-else :image-size="50" description="无输入定义" />
            </div>
          </ElCol>
          <ElCol :xs="24" :md="12">
            <div class="section-card">
              <div class="section-title">
                <span class="section-dot section-dot-orange"></span>
                输出定义 (Output)
              </div>
              <ElTable
                v-if="selectedTaskDetail.output && selectedTaskDetail.output.length > 0"
                :data="selectedTaskDetail.output"
                border
                stripe
                size="small"
              >
                <ElTableColumn prop="name" label="名称" min-width="100" show-overflow-tooltip />
                <ElTableColumn prop="per_sample" label="Per Sample" width="90" align="center">
                  <template #default="scope">
                    <ElTag :type="scope.row.per_sample ? 'success' : 'info'" size="small">
                      {{ scope.row.per_sample ? 'Yes' : 'No' }}
                    </ElTag>
                  </template>
                </ElTableColumn>
              </ElTable>
              <ElEmpty v-else :image-size="50" description="无输出定义" />
            </div>
          </ElCol>
        </ElRow>

        <div class="section-card section-card-full">
          <div class="section-title">
            <span class="section-dot section-dot-purple"></span>
            参数配置 (Parameters)
          </div>
          <div v-if="selectedTaskDetail.parameters && selectedTaskDetail.parameters.length > 0" class="param-list">
            <div v-for="(param, index) in selectedTaskDetail.parameters" :key="index" class="param-item">
              <div class="param-header">
                <span class="param-name">{{ param.name }}</span>
                <div class="param-badges">
                  <ElTag v-if="param.default !== undefined" size="small" type="warning" effect="plain">
                    默认: {{ param.default }}
                  </ElTag>
                  <ElTag size="small" type="primary" effect="light">{{ param.type }}</ElTag>
                </div>
              </div>
              <div class="param-body">
                <div class="field-label">限制</div>
                <div class="field-value">{{ param.limit || '无' }}</div>
              </div>
            </div>
          </div>
          <ElEmpty v-else :image-size="50" description="无参数配置" />
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer"><ElButton @click="showDetailModal = false">关闭</ElButton></div>
      </template>
    </ElDialog>

    <!-- 合法性校验结果弹窗 -->
    <ElDialog
      v-model="showValidationModal"
      :title="isValidated ? '检查结果 (存在警告)' : '检查结果 (存在错误)'"
      width="650px"
      center
      append-to-body
    >
      <ElAlert
        v-if="!isValidated"
        title="检测到严重配置错误，必须修正后才可提交："
        type="error"
        :closable="false"
        show-icon
        class="validation-alert"
      />
      <ElAlert
        v-else
        title="检测到配置警告，建议确认，但不影响提交："
        type="warning"
        :closable="false"
        show-icon
        class="validation-alert"
      />

      <ElTable
        :data="validationResults"
        border
        stripe
        class="validation-result-table"
        max-height="400"
        empty-text="暂无详细错误信息"
      >
        <ElTableColumn prop="id" label="步骤" width="100" align="center">
          <template #default="{ row }">
            <span class="validation-step-label">Step {{ row.id }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="级别" width="120" align="center">
          <template #default="{ row }">
            <ElTag :type="getStatusType(row.status)" effect="light" size="default" class="validation-status-tag">
              {{ row.status }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="message" label="问题详情">
          <template #default="{ row }">
            <span class="validation-message" :class="[getStatusMessageClass(row.status)]">{{ row.message }}</span>
          </template>
        </ElTableColumn>
      </ElTable>

      <template #footer>
        <div class="dialog-footer">
          <ElButton type="primary" @click="showValidationModal = false">
            {{ isValidated ? '知道了 (可继续提交)' : '去修改' }}
          </ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* --- Layout --- */
.task-chain-create-el {
  padding: 20px;
  background: #f0f2f5;
  min-height: calc(100vh - 64px);
  box-sizing: border-box;
}
.main-card {
  display: flex;
  flex-direction: column;
  height: 85vh;
}
:deep(.el-card__body) {
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-wrapper {
  display: inline-block;
}
.drag-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.drag-container {
  display: flex;
  width: 100%;
  height: 100%;
}

/* --- 1. Left Panel (Source) --- */
.source-panel {
  width: 240px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  flex-shrink: 0;
}
.panel-title {
  height: 56px;
  padding: 0 20px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  background: #fff;
  gap: 8px;
}

/* [修改] 搜索框容器 - 增加内边距，背景统一 */
.panel-search {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

/* [修改] 搜索框样式 - 一体化设计 */
.unit-search-input {
  width: 100%;
}

/* 覆盖 Element Plus 默认样式 */
.unit-search-input :deep(.el-input__wrapper) {
  box-shadow: none !important; /* 去除默认边框 */
  background-color: #f5f7fa; /* 统一浅灰色背景 */
  border-radius: 8px 0 0 8px; /* 左侧圆角 */
  padding-left: 12px;
  transition: all 0.3s;
}

.unit-search-input :deep(.el-input-group__append) {
  box-shadow: none !important; /* 去除默认边框 */
  background-color: #f5f7fa; /* 统一浅灰色背景 */
  border-radius: 0 8px 8px 0; /* 右侧圆角 */
  border: none;
  padding: 0 16px;
  color: #909399;
  transition: all 0.3s;
}

/* 悬停效果 */
.unit-search-input:hover :deep(.el-input__wrapper),
.unit-search-input:hover :deep(.el-input-group__append) {
  background-color: #eef0f3;
}

/* 聚焦效果 - 整体变白并添加主色内阴影 */
.unit-search-input:focus-within :deep(.el-input__wrapper),
.unit-search-input:focus-within :deep(.el-input-group__append) {
  background-color: #ffffff;
  /* 使用 inset shadow 模拟边框，防止抖动，且看起来更高级 */
  box-shadow: 0 0 0 1px #409eff inset !important;
}

/* 聚焦时按钮图标变色 */
.unit-search-input:focus-within :deep(.el-input-group__append .el-button) {
  color: #409eff;
}

.unit-list-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}
.unit-list-empty {
  padding: 20px 0;
}
.source-item {
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 8px;
  cursor: move;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  transition: all 0.2s;
}
.source-item:hover {
  border-color: #409eff;
  color: #409eff;
  transform: translateX(2px);
}
.unit-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.action-icon {
  color: #909399;
  cursor: pointer;
}
.action-icon:hover {
  color: #409eff;
}

/* --- 2. Middle Panel (Target) --- */
.target-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  position: relative;
  min-width: 300px;
}
.canvas-area {
  flex: 1;
  padding: 20px;
  background-image: radial-gradient(#e0e0e0 1px, transparent 1px);
  background-size: 20px 20px;
  overflow-y: auto;
  display: flex;
  justify-content: center;
}

.flow-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 40px;
}

.flow-card {
  width: 320px;
  height: 90px;
  background: #f0f9eb;
  border: 1px solid #67c23a;
  border-radius: 6px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  cursor: grab;
  position: relative;
  box-sizing: border-box;
  transition: all 0.2s;
}

.flow-card:active {
  cursor: grabbing;
}

.flow-card:hover {
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.2);
  transform: translateY(-2px);
}

.flow-status-icon {
  font-size: 24px;
  color: #67c23a;
  margin-right: 12px;
  flex-shrink: 0;
}

.flow-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.flow-step-id {
  font-size: 10px;
  color: #8dbf72;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}

.flow-unit-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}

.flow-actions {
  margin-left: 8px;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.flow-card:hover .flow-actions {
  opacity: 1;
}
.delete-btn:hover {
  color: #f56c6c;
  cursor: pointer;
}
.flow-arrow-vertical {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 24px;
  justify-content: center;
  color: #c0c4cc;
}
.flow-arrow-vertical .line {
  width: 2px;
  height: 12px;
  background: #dcdfe6;
}
.ghost-card {
  opacity: 0.5;
  background: #ecf5ff;
  border: 1px dashed #409eff;
}
.empty-canvas {
  margin-top: 60px;
  color: #c0c4cc;
  text-align: center;
}

/* --- 3. Right Panel (Config) Beautified --- */
.config-panel {
  width: 360px;
  border-left: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  flex-shrink: 0;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.02);
  z-index: 2;
}
.config-content {
  flex: 1;
  overflow: hidden;
  background-color: #fdfdfd;
}
.title-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.config-section {
  padding: 24px 20px 10px 20px;
  border-bottom: 1px solid #f0f2f5;
}
.config-section:last-child {
  border-bottom: none;
}
.section-header {
  font-size: 14px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 10px;
  border-left: 4px solid #409eff;
  line-height: 1;
}

/* [新增] 可视化配置区域样式 */
.visual-config-wrapper {
  padding: 4px 0 0 4px;
}
.visual-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
/* 让 checkbox 稍微宽一点，好看 */
:deep(.visual-checkbox-group .el-checkbox.is-bordered) {
  margin-right: 0;
  padding: 6px 16px;
  height: auto;
}
.visual-tip {
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Modern Form Style Overrides */
.modern-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #4b5563;
  padding-bottom: 6px;
}
.modern-input :deep(.el-input__wrapper),
.modern-input :deep(.el-textarea__inner),
.modern-select :deep(.el-input__wrapper) {
  background-color: #f3f4f6;
  box-shadow: none !important;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.3s ease;
  padding: 4px 12px;
}
.modern-input :deep(.el-input__wrapper:hover),
.modern-input :deep(.el-textarea__inner:hover),
.modern-select :deep(.el-input__wrapper:hover) {
  background-color: #e5e7eb;
}
.modern-input :deep(.el-input__wrapper.is-focus),
.modern-input :deep(.el-textarea__inner:focus),
.modern-select :deep(.el-input__wrapper.is-focus) {
  background-color: #ffffff;
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15) !important;
}

/* Dynamic List Cards */
.dynamic-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}
.dynamic-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s ease;
  position: relative;
}
.dynamic-card:hover {
  border-color: #b3d8ff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}
.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.card-row:last-child {
  margin-bottom: 0;
}
.row-label {
  font-size: 12px;
  color: #9ca3af;
  min-width: 50px;
}
.delete-row-btn {
  margin-left: auto;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.delete-row-btn:hover {
  opacity: 1;
}

/* Dashed Add Button */
.dashed-add-btn {
  width: 100%;
  height: 40px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606266;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
  background-color: #fafafa;
}
.dashed-add-btn:hover {
  border-color: #409eff;
  color: #409eff;
  background-color: #f0f9ff;
}
.clear-chain-btn {
  margin-left: auto;
}

/* Checkbox Beautify */
:deep(.el-checkbox.is-bordered) {
  border-radius: 6px;
  background-color: #fff;
  border-color: #e5e7eb;
  padding: 6px 12px;
  height: auto;
}
:deep(.el-checkbox.is-bordered.is-checked) {
  background-color: #f0f9ff;
  border-color: #409eff;
}
.bottom-spacer {
  height: 40px;
}
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Scrollbar */
:deep(.el-scrollbar__view) {
  height: 100%;
}

/* Dialog & Detail Styles */
.detail-dialog {
  border-radius: 12px;
}
.detail-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px 20px;
  background: #f8fafc;
  border-radius: 8px;
}
.detail-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.detail-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.detail-main-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.id-tag {
  background-color: #ebeef5;
  color: #606266;
  border: none;
  font-weight: bold;
}
.detail-header-meta {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #909399;
}
.detail-divider {
  margin: 12px 0 14px;
}
.detail-grid {
  margin-top: 12px;
  margin-bottom: 12px;
}
.section-card {
  background: #ffffff;
  border-radius: 10px;
  padding: 12px 14px 10px;
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.06);
  border: 1px solid #edf0f7;
  height: 100%;
  box-sizing: border-box;
}
.section-card-full {
  margin-top: 12px;
}
.section-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.section-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  margin-right: 6px;
  display: inline-block;
}
.section-dot-blue {
  background: #409eff;
}
.section-dot-green {
  background: #67c23a;
}
.section-dot-orange {
  background: #e6a23c;
}
.section-dot-purple {
  background: #a56bff;
}
.code-section {
  margin-bottom: 10px;
}
.code-block {
  background: #1e1e1e;
  color: #e8e8e8;
  padding: 12px 14px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.6;
}
.param-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.param-item {
  background: #f9fafc;
  border-radius: 8px;
  padding: 8px 10px 10px;
  border: 1px solid #eef1f7;
}
.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.param-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.param-badges {
  display: flex;
  align-items: center;
}
.default-tag {
  margin-right: 6px;
}
.param-desc {
  font-size: 12px;
  color: #606266;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #ebeef5;
  line-height: 1.4;
}
.param-body {
  display: grid;
  grid-template-columns: 70px 1fr;
  column-gap: 12px;
  row-gap: 6px;
  font-size: 12px;
  align-items: baseline;
}
.field-label {
  background: #fafafa;
  color: #909399;
  padding: 2px 6px;
  border-radius: 4px;
  text-align: right;
}
.field-value {
  color: #303133;
  word-break: break-all;
}
.field-value-span {
  grid-column: 2;
}
.enum-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.dialog-footer {
  display: flex;
  justify-content: center;
}
.validation-alert {
  margin-bottom: 16px;
}
.validation-result-table {
  width: 100%;
}
.validation-step-label {
  font-weight: bold;
  color: #606266;
}
.validation-status-tag {
  font-weight: bold;
}
.validation-message {
  display: inline-block;
}
.status-color-success {
  color: #67c23a;
}
.status-color-warning {
  color: #e6a23c;
}
.status-color-danger {
  color: #f56c6c;
}
.status-color-info {
  color: #606266;
}
</style>
