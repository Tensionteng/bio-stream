<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete, Link, Search, View, WarningFilled } from '@element-plus/icons-vue';
// 引入 API
import {
  checkRelatedTaskChains,
  deleteTaskUnit,
  fetchTaskUnitDetail,
  fetchTaskUnitList
} from '@/service/api/task_unit';
import type { TaskUnitDetail, TaskUnitListItem, TaskUnitListParams } from '@/service/api/task_unit';
import { usePermissionGuard } from '@/hooks/business/permission-guard';

/**
 * ==========================================
 *
 * 1. 状态定义 (State Definition) ==========================================
 */

// --- 列表相关状态 ---
/** 存储表格展示的任务单元列表数据 */
const taskUnits = ref<TaskUnitListItem[]>([]);
/** 控制表格加载状态 (Loading Spinner) */
const isLoadingList = ref(false);

// --- 筛选与分页状态 ---
/** 搜索表单模型，支持扩展更多筛选条件 */
const filterParams = reactive({
  name: '' // 按名称模糊搜索
});

/** 分页配置模型 */
const pagination = reactive({
  page: 1, // 当前页码
  pageSize: 10, // 每页数量
  total: 0 // 总条数
});

// --- 详情弹窗状态 ---
/** 控制详情弹窗的显示/隐藏 */
const showDetailModal = ref(false);
/** 当前选中的任务单元详情数据 */
const selectedTask = ref<TaskUnitDetail | null>(null);
/** 详情加载 loading */
const isLoadingDetail = ref(false);
/** 详情加载失败时的错误信息 */
const detailError = ref<string | null>(null);

// --- 删除保护状态 ---
/** 控制“无法删除”警告弹窗的显示 */
const cascadeDeleteVisible = ref(false);
/** - 存储触发级联保护时的数据 用于在警告弹窗中展示：当前要删除谁？它被哪些链引用了？ */
const cascadeDeleteData = reactive({
  id: '' as string | number,
  name: '',
  chains: [] as string[] // 关联的任务链名称列表
});

/** 计算属性：动态生成详情弹窗的标题 */
const detailDialogTitle = computed(() => {
  if (isLoadingDetail.value) return '正在加载详情...';
  if (selectedTask.value) return `任务单元详情: ${selectedTask.value.name}`;
  return '任务单元详情';
});

/**
 * # ==========================================
 *
 * 2. API 交互逻辑 (API Interaction)
 */

/**
 * 获取任务单元列表
 *
 * 根据当前的分页参数和筛选条件查询数据
 */
async function fetchTaskUnits() {
  isLoadingList.value = true;
  try {
    // 构造查询参数
    const params: TaskUnitListParams = {
      page: pagination.page,
      page_size: pagination.pageSize,
      name: filterParams.name || undefined
    };

    const response = await fetchTaskUnitList(params);

    if (response.error) {
      taskUnits.value = [];
      pagination.total = 0;
      return;
    }

    // 更新列表数据与总数
    taskUnits.value = response.data?.task_units ?? [];
    pagination.total = response.data?.count ?? 0;
  } catch (e) {
    console.error('Failed to fetch task units:', e);
    taskUnits.value = [];
    pagination.total = 0;
  } finally {
    isLoadingList.value = false;
  }
}

/**
 * 获取单个任务单元的详细信息
 *
 * @param id 任务单元 ID
 */
async function fetchTaskDetail(id: string) {
  isLoadingDetail.value = true;
  detailError.value = null;
  selectedTask.value = null; // 清空旧数据，防止闪烁
  try {
    const response = await fetchTaskUnitDetail(id);

    if (response.error) {
      detailError.value = response.error.message || '加载详情失败';
      return;
    }

    selectedTask.value = response.data;
  } catch (e: any) {
    detailError.value = e.message || '加载详情时发生未知错误';
    console.error('Failed to fetch task detail:', e);
  } finally {
    isLoadingDetail.value = false;
  }
}

/**
 * 处理删除按钮点击事件
 *
 * 核心安全逻辑：在删除前必须检查是否有“任务链”依赖此单元
 *
 * @param row 当前行数据
 */
async function handleDelete(row: TaskUnitListItem) {
  try {
    // 3.1 预检查：查询关联的任务链
    // 这是一个保护机制，防止误删正在被使用的单元导致流程崩溃
    const response = await checkRelatedTaskChains(row.id);

    if (response.error) {
      console.log(response.error);
      return;
    }

    const relatedChains = response.data?.task_chain || [];

    // 3.2 根据依赖情况决定后续操作
    if (relatedChains.length > 0) {
      // 情况 A: 存在关联 -> 禁止删除
      // 填充警告数据并打开自定义的 Warning Dialog
      cascadeDeleteData.id = row.id;
      cascadeDeleteData.name = row.name;
      cascadeDeleteData.chains = relatedChains;
      cascadeDeleteVisible.value = true;
      // 流程结束，用户只能点击“知道了”
    } else {
      // 情况 B: 无关联 -> 允许删除
      // 弹出标准的 Element Plus 确认框
      await ElMessageBox.confirm(`确定要删除任务单元 "${row.name}" 吗？`, '删除确认', {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      });

      // 用户点击“确定”后执行真正的删除 API
      await performDelete(row.id);
    }
  } catch (e) {
    // 用户点击取消会抛出 'cancel'，忽略即可
    if (e !== 'cancel') {
      console.error(e);
    }
  }
}

/**
 * 执行真正的删除请求
 *
 * @param id 任务单元 ID
 */
async function performDelete(id: string | number) {
  try {
    const res = await deleteTaskUnit(id);
    if (!res.error) {
      ElMessage.success('删除成功');
      // 删除成功后刷新列表，保持数据同步
      fetchTaskUnits();
    }
  } catch (e) {
    console.error(e);
  }
}

/**
 * # ==========================================
 *
 * 3. 事件处理 (Event Handlers)
 */

/** 点击“查询”按钮：重置页码并刷新 */
function handleSearch() {
  pagination.page = 1;
  fetchTaskUnits();
}

/** 点击“重置”按钮：清空筛选条件并刷新 */
function handleReset() {
  filterParams.name = '';
  pagination.page = 1;
  fetchTaskUnits();
}

/** 分页组件：每页显示数量变更 */
function handleSizeChange(val: number) {
  pagination.pageSize = val;
  pagination.page = 1; // 改变页容量通常建议重置回第一页
  fetchTaskUnits();
}

/** 分页组件：页码变更 */
function handlePageChange(val: number) {
  pagination.page = val;
  fetchTaskUnits();
}

/** 点击“详情”按钮：打开弹窗并加载数据 */
function handleViewDetails(id: string) {
  showDetailModal.value = true;
  fetchTaskDetail(id);
}

/** 详情弹窗完全关闭后的回调：清理状态 */
function onDialogClosed() {
  selectedTask.value = null;
  detailError.value = null;
  isLoadingDetail.value = false;
}

/**
 * # ==========================================
 *
 * 4. 生命周期 (Lifecycle)
 */
onMounted(async () => {
  // 1. 权限守卫检查
  // 确保用户拥有访问此模块的权限，如果没有权限，内部逻辑会处理跳转或提示
  const { checkPermissionAndNotify } = usePermissionGuard();
  const hasPermission = await checkPermissionAndNotify('task_unit');

  if (!hasPermission) {
    return;
  }

  // 2. 初始化列表数据
  fetchTaskUnits();
});
</script>

<template>
  <div class="task-unit-manager-el">
    <ElCard shadow="never" class="full-height-card">
      <template #header>
        <div class="card-header">
          <span>任务单元列表</span>
        </div>
      </template>
      <ElForm :model="filterParams" inline class="filter-bar" @submit.prevent="handleSearch">
        <ElFormItem label="单元名称">
          <ElInput
            v-model="filterParams.name"
            class="filter-name-input"
            placeholder="按名称搜索"
            clearable
            @clear="handleSearch"
          />
        </ElFormItem>
        <ElFormItem>
          <ElButton class="filter-primary-btn" type="primary" native-type="submit" :loading="isLoadingList">
            <ElIcon><Search /></ElIcon>
            查询
          </ElButton>
          <ElButton class="filter-ghost-btn" @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>

      <ElTable
        v-loading="isLoadingList"
        :data="taskUnits"
        :style="{ width: '100%', flex: 1 }"
        height="100%"
        empty-text="未找到任何任务单元"
      >
        <ElTableColumn prop="name" label="名称 (Name)" min-width="180" />
        <ElTableColumn prop="created_time" label="创建时间 (Created Time)" min-width="200" />
        <ElTableColumn prop="link_file" label="链接文件 (Link File)" min-width="200" show-overflow-tooltip />

        <ElTableColumn label="操作" fixed="right" width="180" align="center">
          <template #default="scope">
            <div class="action-buttons">
              <ElButton type="primary" link class="action-btn is-view" @click="handleViewDetails(scope.row.id)">
                <ElIcon><View /></ElIcon>
                <span>详情</span>
              </ElButton>

              <ElButton type="danger" link class="action-btn is-delete" @click="handleDelete(scope.row)">
                <ElIcon><Delete /></ElIcon>
                <span>删除</span>
              </ElButton>
            </div>
          </template>
        </ElTableColumn>
      </ElTable>

      <div v-if="pagination.total > 0" class="pagination-container">
        <ElPagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.total"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </ElCard>

    <ElDialog v-model="showDetailModal" :title="detailDialogTitle" width="75%" @closed="onDialogClosed">
      <ElSkeleton v-if="isLoadingDetail" :rows="10" animated />

      <ElAlert v-if="detailError" :title="detailError" type="error" show-icon :closable="false" />

      <div v-if="selectedTask" class="detail-content">
        <div class="detail-header">
          <div class="detail-header-main">
            <div class="detail-main-title">
              {{ selectedTask.name }}
            </div>
            <div class="detail-header-tags">
              <ElTag size="small" type="info">ID: {{ selectedTask.id }}</ElTag>
            </div>
          </div>
          <div class="detail-header-extra">
            <span>创建时间：{{ selectedTask.created_time }}</span>
            <span>链接文件：{{ selectedTask.link_file }}</span>
          </div>
        </div>

        <ElDivider class="detail-divider" />

        <div class="section-card section-card-full code-section">
          <div class="section-title">
            <span class="section-dot section-dot-blue"></span>
            Code / 关联代码
          </div>
          <pre class="code-block">{{ selectedTask.code }}</pre>
        </div>

        <ElRow :gutter="16" class="detail-grid">
          <ElCol :xs="24" :md="12">
            <div class="section-card">
              <div class="section-title">
                <span class="section-dot section-dot-green"></span>
                输入定义 (Input)
              </div>
              <ElTable
                v-if="selectedTask.input && selectedTask.input.length > 0"
                :data="selectedTask.input"
                border
                stripe
                size="small"
                :style="{ width: '100%' }"
              >
                <ElTableColumn type="expand">
                  <template #default="props">
                    <div class="pattern-expand-content">
                      <p class="expand-title">Pattern Groups:</p>
                      <ul class="pattern-list">
                        <li v-for="(pg, idx) in props.row.pattern_group" :key="idx">
                          <span class="pattern-name">{{ pg.name }}</span>
                          : {{ pg.pattern }}
                        </li>
                      </ul>
                    </div>
                  </template>
                </ElTableColumn>

                <ElTableColumn prop="name" label="名称" min-width="100" show-overflow-tooltip />
                <ElTableColumn prop="multiple" label="多文件" width="70" align="center">
                  <template #default="scope">
                    <ElTag :type="scope.row.multiple ? 'success' : 'info'" size="small" effect="plain">
                      {{ scope.row.multiple ? '是' : '否' }}
                    </ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn prop="description" label="描述" min-width="100" show-overflow-tooltip />
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
                v-if="selectedTask.output && selectedTask.output.length > 0"
                :data="selectedTask.output"
                border
                stripe
                size="small"
                :style="{ width: '100%' }"
              >
                <ElTableColumn prop="name" label="名称" min-width="100" show-overflow-tooltip />
                <ElTableColumn prop="per_sample" label="逐样本" width="70" align="center">
                  <template #default="scope">
                    <ElTag :type="scope.row.per_sample ? 'success' : 'info'" size="small" effect="plain">
                      {{ scope.row.per_sample ? '是' : '否' }}
                    </ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn prop="template" label="模板" min-width="120" show-overflow-tooltip>
                  <template #default="scope">
                    <code class="template-code">{{ scope.row.template }}</code>
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
            <span v-if="selectedTask.parameters && selectedTask.parameters.length" class="section-subtitle">
              共 {{ selectedTask.parameters.length }} 个参数
            </span>
          </div>

          <div v-if="selectedTask.parameters && selectedTask.parameters.length > 0" class="param-list">
            <div v-for="(param, index) in selectedTask.parameters" :key="index" class="param-item">
              <div class="param-header">
                <span class="param-name">{{ param.name }}</span>
                <div class="param-badges">
                  <ElTag
                    v-if="param.default !== undefined && param.default !== null"
                    size="small"
                    type="warning"
                    effect="plain"
                    class="default-tag"
                  >
                    默认: {{ param.default }}
                  </ElTag>
                  <ElTag size="small" type="primary" effect="light">
                    {{ param.type }}
                  </ElTag>
                </div>
              </div>

              <div v-if="param.description" class="param-desc">
                {{ param.description }}
              </div>

              <div class="param-body">
                <div class="field-label">限制类型</div>
                <div class="field-value">
                  {{ param.limit || '无' }}
                </div>

                <template v-if="param.limit === 'minmax'">
                  <div class="field-label">数值范围</div>
                  <div class="field-value field-value-span">[ {{ param.min }} , {{ param.max }} ]</div>
                </template>

                <template v-else-if="param.limit === 'enum'">
                  <div class="field-label">可选值</div>
                  <div class="field-value field-value-span">
                    <div class="enum-tags">
                      <ElTag v-for="val in param.enum" :key="val" size="small" type="info" class="enum-tag">
                        {{ val }}
                      </ElTag>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="field-label">规则</div>
                  <div class="field-value field-value-span text-muted">无额外限制规则</div>
                </template>
              </div>
            </div>
          </div>
          <ElEmpty v-else :image-size="50" description="无参数配置" />
        </div>
      </div>

      <template #footer>
        <ElButton @click="showDetailModal = false">关闭</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="cascadeDeleteVisible" title="无法删除" width="500px" center destroy-on-close>
      <div class="cascade-warning-content">
        <div class="warning-text">
          <ElIcon class="warning-icon"><WarningFilled /></ElIcon>
          <span>
            任务单元
            <span class="highlight-name">「{{ cascadeDeleteData.name }}」</span>
            已被以下
            <strong>{{ cascadeDeleteData.chains.length }}</strong>
            个任务链引用：
          </span>
        </div>

        <div class="chain-list-container">
          <ElScrollbar max-height="240px">
            <div v-for="(chain, index) in cascadeDeleteData.chains" :key="index" class="chain-item">
              <ElIcon class="link-icon"><Link /></ElIcon>
              <span class="chain-name">{{ chain }}</span>
            </div>
          </ElScrollbar>
        </div>

        <ElAlert
          title="无法直接删除！请先在相关任务链中移除该单元，或删除对应的任务链。"
          type="error"
          :closable="false"
          show-icon
        />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <ElButton type="primary" @click="cascadeDeleteVisible = false">知道了</ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* 修改点 3：页面整体 Flex 布局 */
.task-unit-manager-el {
  padding: 16px; /* 调整 Padding */
  background: #f5f7fb;
  height: calc(100vh - 100px); /* 锁定高度 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 新增：卡片占满剩余空间 */
.full-height-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  border: none;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.04);
}

/* 新增：穿透 ElCard body 开启 Flex */
:deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 关键 */
  padding: 16px 20px;
  height: 100%;
}

/* 筛选栏防止压缩 */
.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.card-header::before {
  content: '';
  width: 4px;
  height: 18px;
  border-radius: 999px;
  margin-right: 8px;
  background: linear-gradient(180deg, #409eff, #66b1ff);
}

/* 搜索输入框美化 */
.filter-name-input {
  max-width: 260px;
}

/* el-input 外壳 */
.filter-name-input :deep(.el-input__wrapper) {
  border-radius: 999px;
  border-color: #c0d3ff;
  box-shadow: 0 0 0 0 rgba(92, 124, 255, 0.15);
  background: #ffffff;
  transition: all 0.18s ease;
}

/* hover */
.filter-name-input :deep(.el-input__wrapper:hover) {
  border-color: #8c9dff;
  box-shadow: 0 0 0 1px rgba(140, 157, 255, 0.25);
}

/* focus */
.filter-name-input :deep(.el-input.is-focus .el-input__wrapper),
.filter-name-input :deep(.el-input__wrapper.is-focus) {
  border-color: #5c7cff;
  box-shadow:
    0 0 0 1px rgba(92, 124, 255, 0.4),
    0 0 10px rgba(92, 124, 255, 0.25);
}

/* 输入文字 / placeholder  */
.filter-name-input :deep(.el-input__inner) {
  font-size: 13px;
}

.filter-name-input :deep(.el-input__inner::placeholder) {
  color: #b8c0ff;
}

/* 查询区域按钮美化 */
.filter-primary-btn {
  min-width: 96px;
  height: 34px;
  border-radius: 999px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  background-image: linear-gradient(135deg, #8c9dff, #5c7cff);
  box-shadow: 0 6px 14px rgba(92, 124, 255, 0.35);
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.filter-primary-btn .el-icon {
  margin-right: 4px;
}

.filter-primary-btn:not(.is-disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(92, 124, 255, 0.45);
  background-image: linear-gradient(135deg, #7b90ff, #4c6dff);
}

.filter-primary-btn:not(.is-disabled):active {
  transform: translateY(0);
  box-shadow: 0 4px 10px rgba(92, 124, 255, 0.4);
}

.filter-primary-btn.is-disabled {
  background-image: linear-gradient(135deg, #cbd5ff, #b9c6ff);
  box-shadow: none;
}

/* 重置按钮：轻描边、简洁 */
.filter-ghost-btn {
  min-width: 78px;
  height: 34px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #d0d5eb;
  background: #ffffff;
  color: #606266;
  transition: all 0.2s ease;
}

.filter-ghost-btn:not(.is-disabled):hover {
  background: #f5f7ff;
  border-color: #b9c6ff;
  color: #3a57d5;
  box-shadow: 0 4px 10px rgba(185, 198, 255, 0.4);
}

.filter-ghost-btn.is-disabled {
  background: #ffffff;
  border-color: #e4e7ed;
  color: #c0c4cc;
  box-shadow: none;
}

/* 分页 */
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px; /* 稍微缩小一点 */
  flex-shrink: 0; /* 防止压缩 */
  background: #fff;
  padding-top: 8px;
}

/* 表格样式 */
:deep(.el-table) {
  --el-table-header-bg-color: #f5f7fa;
  --el-table-row-hover-bg-color: #f0f9ff;
  --el-table-border-color: #ebeef5;
  font-size: 13px;
}

:deep(.el-table__header-wrapper th) {
  font-weight: 600;
  color: #606266;
}

:deep(.el-table__row) {
  transition:
    background-color 0.15s ease,
    transform 0.15s ease;
}

:deep(.el-table__row:hover) {
  transform: translateY(-1px);
}

/* 详情弹窗样式 */
:deep(.el-dialog) {
  border-radius: 14px;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  padding: 16px 20px 10px;
  border-bottom: 1px solid #f0f0f0;
}

:deep(.el-dialog__title) {
  font-size: 16px;
  font-weight: 600;
}

:deep(.el-dialog__body) {
  padding: 16px 20px 20px;
  background: #f5f7fb;
}

:deep(.el-dialog__footer) {
  padding: 10px 20px 16px;
  border-top: 1px solid #f0f0f0;
}

/* 详情内容容器 */
.detail-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px 18px 20px;
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.03);
  box-sizing: border-box;
}

/* 顶部概要区 */
.detail-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-header-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.detail-main-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.detail-header-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-header-extra {
  font-size: 12px;
  color: #909399;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.detail-divider {
  margin: 12px 0 14px;
}

/* section 卡片 */
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

.section-subtitle {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #909399;
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

/* code 区块 */
.code-section {
  margin-bottom: 10px;
}

.code-block {
  background: #1e1e1e;
  color: #e8e8e8;
  padding: 12px 14px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}

/* --- 参数列表相关 --- */
.param-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.param-item {
  background: #f9fafc;
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid #eef1f7;
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
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

.text-muted {
  color: #909399;
  font-style: italic;
}

.enum-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* --- Input Table Expand Style --- */
.pattern-expand-content {
  padding: 8px 16px;
}
.expand-title {
  margin: 0 0 6px 0;
  font-weight: 600;
  font-size: 12px;
  color: #606266;
}
.pattern-list {
  margin: 0;
  padding-left: 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #303133;
}
.pattern-name {
  color: #409eff;
  font-weight: 600;
}
.template-code {
  background: #f4f4f5;
  padding: 2px 4px;
  border-radius: 4px;
  color: #c0392b;
  font-family: monospace;
}

@media (max-width: 768px) {
  .detail-header-main {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* --- 操作按钮样式 --- */
.action-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.action-btn {
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.3s ease;
  font-size: 13px;
  height: auto;
  line-height: 1;
}

.action-btn .el-icon {
  margin-right: 4px;
  font-size: 14px;
}

.action-btn.is-view {
  color: #409eff;
}
.action-btn.is-view:hover {
  background-color: #ecf5ff;
  color: #409eff;
}

.action-btn.is-delete {
  color: #f56c6c;
}
.action-btn.is-delete:hover {
  background-color: #fef0f0;
  color: #f56c6c;
}

/* --- 级联删除弹窗样式 --- */
.cascade-warning-content {
  padding: 0 10px;
}

.warning-text {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.warning-icon {
  color: #e6a23c;
  font-size: 20px;
  margin-right: 8px;
  margin-top: 2px;
}

.highlight-name {
  color: #303133;
  font-weight: 700;
}

/* 列表容器 */
.chain-list-container {
  background-color: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 4px;
  margin-bottom: 16px;
}

.chain-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin: 4px;
  background-color: #fef0f0;
  border-radius: 4px;
  border-left: 4px solid #f56c6c;
  transition: background-color 0.2s;
}

.chain-item:hover {
  background-color: #fde2e2;
}

.link-icon {
  color: #f56c6c;
  margin-right: 8px;
  font-size: 16px;
}

.chain-name {
  font-size: 13px;
  color: #f56c6c;
  font-family: monospace;
  word-break: break-all;
}

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
