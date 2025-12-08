<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowRight, CircleCheckFilled, Delete, Edit, Search, View } from '@element-plus/icons-vue';
import {
  checkDeleteTaskChain,
  deleteTaskChain,
  fetchTaskChainDetail,
  fetchTaskChainList // [导入] 引入检测接口
} from '@/service/api/task_chain';
import type { TaskChainDetail, TaskChainListItem, TaskChainListParams } from '@/service/api/task_chain';
import { usePermissionGuard } from '@/hooks/business/permission-guard';

// 页面：工具链列表与详情/删除管控
const router = useRouter();

// 列表状态
const taskChainList = ref<TaskChainListItem[]>([]);
const isLoadingList = ref(false);

// 筛选状态
const filterParams = reactive({
  task_type: '',
  task_id: '',
  task_name: ''
});

// 分页状态
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
});

// 详情模态框状态
const showDetailModal = ref(false);
const selectedTaskChain = ref<TaskChainDetail | null>(null);
const isLoadingDetail = ref(false);
const detailError = ref<string | null>(null);

// [新增] 删除冲突弹窗状态
const deleteConflictVisible = ref(false);
const deleteConflictData = ref<any[]>([]);

const detailDialogTitle = computed(() => {
  if (isLoadingDetail.value) return '正在加载详情...';
  if (selectedTaskChain.value) return `工具链详情: ${selectedTaskChain.value.name}`;
  return '工具链详情';
});

// 获取任务链列表：组合筛选、分页参数，并刷新表格
async function fetchTaskChains() {
  isLoadingList.value = true;
  try {
    const params: TaskChainListParams = {
      page: pagination.page,
      page_size: pagination.pageSize,
      task_type: filterParams.task_type || undefined,
      task_id: filterParams.task_id || undefined,
      task_name: filterParams.task_name || undefined
    };

    const response = await fetchTaskChainList(params);

    if (response.error) {
      taskChainList.value = [];
      pagination.total = 0;
      return;
    }

    taskChainList.value = response.data?.task_chains ?? [];
    pagination.total = response.data?.count ?? 0;
  } catch (e) {
    console.error('Failed to fetch task chains:', e);
    taskChainList.value = [];
    pagination.total = 0;
  } finally {
    isLoadingList.value = false;
  }
}

// 获取任务链详情：点击“详情”后打开弹窗并显示完整配置
async function fetchTaskDetail(id: string | number) {
  isLoadingDetail.value = true;
  detailError.value = null;
  selectedTaskChain.value = null;
  try {
    const response = await fetchTaskChainDetail(id);

    if (response.error) {
      detailError.value = response.error.message || '加载详情失败';
      return;
    }
    selectedTaskChain.value = response.data;
  } catch (e: any) {
    detailError.value = e.message || '加载详情时发生未知错误';
    console.error('Failed to fetch task detail:', e);
  } finally {
    isLoadingDetail.value = false;
  }
}

function handleEdit(id: string | number) {
  router.push({ name: 'taskchain_create', query: { id } });
}

// 删除逻辑：先调检测接口，再决定是直接删除还是提示冲突
async function handleDelete(row: TaskChainListItem) {
  try {
    // 1. 调用检测接口
    const checkRes = await checkDeleteTaskChain(row.id);

    if (checkRes.error) {
      // 接口本身报错，不继续
      return;
    }

    const { delete_flg, analysis } = checkRes.data;

    // 2. 根据 delete_flg 判断
    if (delete_flg) {
      // A. 允许删除 -> 弹出常规确认框
      let confirmMsg = `确定要删除工具链「${row.name}」吗？`;
      // 如果 analysis 里有 warning 信息，也可以提示，但允许删
      if (analysis && analysis.length > 0) {
        confirmMsg += `<div style="margin-top:8px;color:#E6A23C;font-size:12px;">
          注意：检测到 ${analysis.length} 个关联项，但系统判定允许删除。
        </div>`;
      }

      await ElMessageBox.confirm(confirmMsg, '删除确认', {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: true
      });

      // 执行真正删除
      await performDelete(row.id);
    } else {
      // B. 禁止删除 -> 打开自定义弹窗显示列表
      deleteConflictData.value = analysis || [];
      deleteConflictVisible.value = true;
    }
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
}

/** 执行真正的删除 API，并刷新列表/关闭详情 */
async function performDelete(id: string | number) {
  const res = await deleteTaskChain(id);
  if (!res.error) {
    ElMessage.success('删除成功');
    if (selectedTaskChain.value && selectedTaskChain.value.id === id) {
      showDetailModal.value = false;
    }
    fetchTaskChains();
  }
}

// 顶部查询：修改筛选后回到第一页
function handleSearch() {
  pagination.page = 1;
  fetchTaskChains();
}

// 清空筛选条件并重新拉取
function handleReset() {
  filterParams.task_type = '';
  filterParams.task_id = '';
  filterParams.task_name = '';
  pagination.page = 1;
  fetchTaskChains();
}

// 分页大小变化时重置到第一页
function handleSizeChange(val: number) {
  pagination.pageSize = val;
  pagination.page = 1;
  fetchTaskChains();
}

// 切换页码后保持筛选条件不变，直接刷新
function handlePageChange(val: number) {
  pagination.page = val;
  fetchTaskChains();
}

// 打开详情弹窗
function handleViewDetails(id: string | number) {
  showDetailModal.value = true;
  fetchTaskDetail(id);
}

// 弹窗关闭时也要清空状态，避免旧数据闪烁
function onDialogClosed() {
  selectedTaskChain.value = null;
  detailError.value = null;
  isLoadingDetail.value = false;
}

onMounted(async () => {
  // 进入页面先检查权限，避免无权限用户频繁请求接口
  const { checkPermissionAndNotify } = usePermissionGuard();
  const hasPermission = await checkPermissionAndNotify('task_chain');
  if (!hasPermission) {
    return;
  }

  fetchTaskChains();
});
</script>

<template>
  <div class="task-chain-manager-el">
    <!-- 主卡片：承载筛选表单 + 列表 + 分页 -->
    <ElCard shadow="never">
      <template #header>
        <div class="card-header">
          <span>工具链列表</span>
        </div>
      </template>

      <!-- 顶部筛选区：按类型/ID/名称模糊过滤 -->
      <ElForm :model="filterParams" inline class="filter-bar" @submit.prevent="handleSearch">
        <ElFormItem label="任务类型">
          <ElInput v-model="filterParams.task_type" placeholder="按任务类型搜索" clearable @clear="handleSearch" />
        </ElFormItem>
        <ElFormItem label="任务ID">
          <ElInput v-model="filterParams.task_id" placeholder="按任务ID搜索" clearable @clear="handleSearch" />
        </ElFormItem>
        <ElFormItem label="任务名称">
          <ElInput v-model="filterParams.task_name" placeholder="按任务名称搜索" clearable @clear="handleSearch" />
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" native-type="submit" :loading="isLoadingList">
            <ElIcon><Search /></ElIcon>
            查询
          </ElButton>
          <ElButton @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>

      <!-- 工具链数据表 -->
      <ElTable v-loading="isLoadingList" :data="taskChainList" :style="{ width: '100%' }" empty-text="未找到任何工具链">
        <ElTableColumn prop="id" label="ID" width="100" />
        <ElTableColumn prop="name" label="名称 (Name)" min-width="180" />
        <ElTableColumn prop="nums" label="单元数量" width="100" align="center" />
        <ElTableColumn prop="type" label="类型" width="120" show-overflow-tooltip />
        <ElTableColumn prop="created_time" label="创建时间" min-width="180" />
        <ElTableColumn prop="updated_time" label="更新时间" min-width="180" />

        <ElTableColumn label="操作" fixed="right" width="260" align="center">
          <template #default="scope">
            <div class="action-buttons">
              <ElButton type="warning" link class="action-btn is-edit" @click="handleEdit(scope.row.id)">
                <ElIcon><Edit /></ElIcon>
                <span>编辑</span>
              </ElButton>

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

    <!-- 详情弹窗：展示任务链整体结构 -->
    <ElDialog v-model="showDetailModal" :title="detailDialogTitle" width="70%" @closed="onDialogClosed">
      <ElSkeleton v-if="isLoadingDetail" :rows="10" animated />

      <ElAlert v-if="detailError" :title="detailError" type="error" show-icon :closable="false" />

      <div v-if="selectedTaskChain" class="detail-content">
        <div class="detail-header">
          <div class="detail-header-main">
            <div class="detail-main-title">
              {{ selectedTaskChain.name }}
            </div>
            <div class="detail-header-tags">
              <ElTag size="small" type="info">ID: {{ selectedTaskChain.id }}</ElTag>
              <ElTag size="small" type="success" effect="light">
                共 {{ selectedTaskChain.units ? selectedTaskChain.units.length : 0 }} 个步骤
              </ElTag>
            </div>
          </div>
          <div class="detail-header-extra">
            <span>创建时间：{{ selectedTaskChain.created_time }}</span>
            <span>更新时间：{{ selectedTaskChain.updated_time }}</span>
          </div>
        </div>

        <ElDivider class="detail-divider" />

        <div class="section-card section-card-full">
          <div class="section-title">
            <span class="section-dot section-dot-purple"></span>
            任务流程 (Task Flow)
          </div>
          <div class="flow-steps-container">
            <template v-if="selectedTaskChain.units && selectedTaskChain.units.length > 0">
              <div v-for="(unit, index) in selectedTaskChain.units" :key="unit.unit_id" class="flow-step-wrapper">
                <div class="flow-step-card">
                  <div class="card-top">
                    <div class="icon-box">
                      <ElIcon><CircleCheckFilled /></ElIcon>
                    </div>
                    <span class="step-order">STEP {{ unit.id }}</span>
                  </div>
                  <div class="card-bottom">
                    <span class="step-name" :title="unit.name">{{ unit.name }}</span>
                  </div>
                </div>
                <div v-if="index < selectedTaskChain.units.length - 1" class="flow-line">
                  <ElIcon class="line-arrow"><ArrowRight /></ElIcon>
                </div>
              </div>
            </template>
            <ElEmpty v-else :image-size="40" description="暂无流程步骤" />
          </div>
        </div>

        <ElRow :gutter="16" class="detail-grid">
          <ElCol :xs="24" :md="12">
            <div class="section-card">
              <div class="section-title">
                <span class="section-dot section-dot-blue"></span>
                输入 (Input)
              </div>
              <ElTable
                v-if="selectedTaskChain.input && selectedTaskChain.input.length > 0"
                :data="selectedTaskChain.input"
                border
                stripe
                size="small"
              >
                <ElTableColumn prop="file_name" label="File Name" min-width="120" show-overflow-tooltip />
                <ElTableColumn prop="meta_id" label="Meta ID" width="80" align="center" />
                <ElTableColumn prop="multiple" label="Multiple" width="90" align="center">
                  <template #default="scope">
                    <ElTag :type="scope.row.multiple ? 'success' : 'info'" size="small">
                      {{ scope.row.multiple ? 'Yes' : 'No' }}
                    </ElTag>
                  </template>
                </ElTableColumn>
              </ElTable>
              <ElEmpty v-else :image-size="50" description="无输入" />
            </div>
          </ElCol>

          <ElCol :xs="24" :md="12">
            <div class="section-card">
              <div class="section-title">
                <span class="section-dot section-dot-green"></span>
                输出 (Output)
              </div>
              <ElTable
                v-if="selectedTaskChain.output && selectedTaskChain.output.length > 0"
                :data="selectedTaskChain.output"
                border
                stripe
                size="small"
              >
                <ElTableColumn prop="file_name" label="File Name" min-width="120" show-overflow-tooltip />
                <ElTableColumn prop="meta_id" label="Meta ID" width="80" align="center" />
                <ElTableColumn prop="per_sample" label="Per Sample" width="100" align="center">
                  <template #default="scope">
                    <ElTag :type="scope.row.per_sample ? 'success' : 'info'" size="small">
                      {{ scope.row.per_sample ? 'Yes' : 'No' }}
                    </ElTag>
                  </template>
                </ElTableColumn>
              </ElTable>
              <ElEmpty v-else :image-size="50" description="无输出" />
            </div>
          </ElCol>
        </ElRow>

        <div class="section-card section-card-full">
          <div class="section-title">
            <span class="section-dot section-dot-orange"></span>
            参数 (Parameters)
          </div>
          <div v-if="selectedTaskChain.parameters && selectedTaskChain.parameters.length > 0" class="param-list">
            <div v-for="(param, index) in selectedTaskChain.parameters" :key="index" class="param-item">
              <div class="param-header">
                <span class="param-name">{{ param.name }}</span>
                <ElTag size="small" type="info" effect="plain">
                  {{ param.type }}
                </ElTag>
              </div>
              <div class="param-body">
                <div class="field-label">限制</div>
                <div class="field-value">{{ param.limit || 'N/A' }}</div>
                <div class="field-label">范围</div>
                <div class="field-value">
                  <span v-if="param.limit === 'minmax'">{{ param.min }} - {{ param.max }}</span>
                  <span v-else class="text-muted">-</span>
                </div>
                <div class="field-label">可选值</div>
                <div class="field-value field-value-span">
                  {{ param.enum && param.enum.length > 0 ? param.enum.join(', ') : 'N/A' }}
                </div>
              </div>
            </div>
          </div>
          <ElEmpty v-else :image-size="50" description="无参数" />
        </div>
      </div>

      <template #footer>
        <ElButton @click="showDetailModal = false">关闭</ElButton>
      </template>
    </ElDialog>

    <!-- 删除冲突弹窗：告诉用户还有哪些关联阻止删除 -->
    <ElDialog v-model="deleteConflictVisible" title="无法删除" width="500px" center destroy-on-close>
      <div class="cascade-warning-content">
        <ElAlert
          title="该工具链正在被使用或存在冲突，无法直接删除。"
          type="error"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        />

        <div class="section-title-small">关联/冲突详情：</div>
        <ElTable :data="deleteConflictData" border stripe size="small" max-height="300" :style="{ width: '100%' }">
          <ElTableColumn prop="id" label="关联ID" width="120" />
          <ElTableColumn prop="status" label="状态" show-overflow-tooltip>
            <template #default="{ row }">
              <ElTag type="danger" size="small">{{ row.status }}</ElTag>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <ElButton type="primary" @click="deleteConflictVisible = false">知道了</ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* 顶部筛选条：美化输入框和按钮 */
.filter-bar {
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 24px;
  row-gap: 8px;
}

/* label 更轻一点 */
:deep(.filter-bar .el-form-item__label) {
  font-size: 12px;
  color: #909399;
  padding-right: 4px;
}

/* 输入框圆一点、边框更柔和 */
:deep(.filter-bar .el-input__wrapper) {
  border-radius: 999px;
  padding: 0 12px;
  box-shadow: none;
  border-color: #dcdfe6;
}

:deep(.filter-bar .el-input__wrapper:hover) {
  border-color: #c0d4ff;
}

:deep(.filter-bar .el-input__wrapper.is-focus) {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.15);
}

/* 查询 & 重置按钮区域靠右 */
.filter-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 查询按钮：主色圆角 + 轻微阴影 */
/* 查询按钮：圆角胶囊 + 渐变 + 阴影 */
.btn-search {
  border-radius: 999px;
  padding: 0 22px;
  height: 34px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-image: linear-gradient(135deg, #5c7cfa, #4e6bff);
  box-shadow: 0 4px 10px rgba(92, 124, 250, 0.35);
  transition: all 0.18s ease-out;
}

.btn-search .el-icon {
  margin-right: 4px;
  font-size: 14px;
}

.btn-search:hover {
  box-shadow: 0 6px 16px rgba(92, 124, 250, 0.45);
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.btn-search:active {
  box-shadow: 0 2px 6px rgba(92, 124, 250, 0.35);
  transform: translateY(0);
}

/* 重置按钮：细描边 + 浅填充，和查询按钮风格统一 */
.btn-reset {
  border-radius: 999px;
  padding: 0 20px;
  height: 34px;
  font-size: 13px;
  border: 1px solid #d4d9e6;
  color: #606266;
  background-color: #ffffff;
  transition: all 0.18s ease-out;
}

.btn-reset:hover {
  background-color: #f4f6fb;
  border-color: #c0c6d8;
  color: #303133;
}

/* 窄屏下按钮掉到下一行 */
@media (max-width: 900px) {
  .filter-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
    margin-top: 4px;
  }
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.task-chain-manager-el {
  padding: 24px 28px 32px;
  background: #f5f7fb;
  min-height: calc(100vh - 64px);
  box-sizing: border-box;
}

.task-chain-manager-el .el-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.04);
}

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

.detail-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px 18px 20px;
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.03);
  box-sizing: border-box;
}

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

.detail-grid {
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

.param-body {
  display: grid;
  grid-template-columns: 80px 1fr 80px 1fr;
  column-gap: 8px;
  row-gap: 4px;
  font-size: 12px;
}

.field-label {
  background: #fafafa;
  color: #909399;
  padding: 4px 8px;
  border-radius: 4px;
}

.field-value {
  padding: 4px 8px;
  color: #303133;
  word-break: break-all;
}

.field-value-span {
  grid-column: 2 / 5;
}

@media (max-width: 768px) {
  .detail-header-main {
    flex-direction: column;
    align-items: flex-start;
  }
}

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
.action-btn.is-edit {
  color: #e6a23c;
}
.action-btn.is-edit:hover {
  background-color: #fdf6ec;
  color: #e6a23c;
}
.action-btn.is-delete {
  color: #f56c6c;
  opacity: 0.8;
}
.action-btn.is-delete:hover {
  background-color: #fef0f0;
  color: #f56c6c;
  opacity: 1;
}

.flow-steps-container {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  padding: 16px 4px 24px 4px;
  gap: 0;
  scrollbar-width: thin;
}

.flow-steps-container::-webkit-scrollbar {
  height: 6px;
}
.flow-steps-container::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 3px;
}
.flow-steps-container::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}
.flow-steps-container::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}

.flow-step-wrapper {
  display: flex;
  align-items: stretch;
}

.flow-step-card {
  display: flex;
  flex-direction: column;
  width: 240px;
  height: 100%;
  min-height: 110px;
  background-color: #ffffff;
  border: 1px solid #ebeef5;
  border-left: 5px solid #67c23a;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  user-select: none;
  box-sizing: border-box;
}

.flow-step-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(103, 194, 58, 0.15);
  border-color: #c2e7b0;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.icon-box {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f0f9eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #67c23a;
  font-size: 18px;
  flex-shrink: 0;
}

.step-order {
  font-size: 11px;
  font-weight: 800;
  color: #909399;
  background: #f2f3f5;
  padding: 4px 8px;
  border-radius: 12px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.card-bottom {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-start;
}

.step-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  line-height: 1.5;
  width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.flow-line {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  position: relative;
  align-self: center;
  flex-shrink: 0;
}

.flow-line::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 2px;
  background: repeating-linear-gradient(to right, #909399 0, #909399 6px, transparent 6px, transparent 10px);
  z-index: 0;
}

.line-arrow {
  z-index: 1;
  background: #fff;
  padding: 0 4px;
  font-size: 16px;
  color: #606266;
  font-weight: bold;
}

/* 弹窗底部按钮居中 */
.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
}

/* 警告内容区 */
.cascade-warning-content {
  padding: 0 10px;
}
.section-title-small {
  margin-top: 12px;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 13px;
  color: #606266;
}
</style>
