<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowRight, Clock, Connection, List, Operation, Refresh, Search } from '@element-plus/icons-vue';
import { type TaskChainListItem, type TaskChainListParams, fetchTaskChainList } from '@/service/api/task_chain';

const router = useRouter();

// --- 状态定义 ---
const loading = ref(false);
const chainList = ref<TaskChainListItem[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 12,
  total: 0
});

// 搜索参数
const searchParams = reactive({
  name: ''
});

// --- API 请求 ---
async function getTaskChains() {
  loading.value = true;
  try {
    const params: TaskChainListParams = {
      page: pagination.page,
      page_size: pagination.pageSize,
      task_name: searchParams.name || undefined
    };

    const response = await fetchTaskChainList(params);
    if (response.data) {
      chainList.value = response.data.task_chains || [];
      pagination.total = response.data.count || 0;
      pagination.page = response.data.page || 1;
    }
  } catch (error) {
    console.error('获取任务链失败:', error);
    ElMessage.error('获取任务链列表失败');
  } finally {
    loading.value = false;
  }
}

// --- 事件处理 ---
function handleSearch() {
  pagination.page = 1;
  getTaskChains();
}

function handleReset() {
  searchParams.name = '';
  handleSearch();
}

/** 点击卡片跳转创建页 */
function handleChainSelect(chain: TaskChainListItem) {
  router.push({
    path: `/task/create/${chain.id}`,
    query: {
      name: chain.name
    }
  });
}

// 格式化时间
function formatTime(timeStr: string) {
  if (!timeStr) return '-';
  return timeStr.replace('T', ' ').substring(0, 16); // 只取到分钟
}

// 映射类型对应的颜色
function getTypeTagType(type: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    linear: 'success',
    branch: 'warning',
    complex: 'danger',
    dag: 'info'
  };
  return map[type?.toLowerCase()] || 'primary'; // 兼容大小写
}

onMounted(() => {
  getTaskChains();
});
</script>

<template>
  <div class="page-container">
    <div class="content-wrapper">
      <div class="page-header">
        <div class="header-left">
          <div class="title-icon-box">
            <ElIcon><List /></ElIcon>
          </div>
          <div class="header-text">
            <h2 class="header-title">任务链列表</h2>
            <span class="header-subtitle">选择一个任务链模板开始新的分析任务</span>
          </div>
        </div>

        <div class="header-right">
          <div class="search-box">
            <ElInput
              v-model="searchParams.name"
              placeholder="搜索任务链名称..."
              class="custom-input"
              clearable
              @clear="handleSearch"
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <ElIcon class="search-icon"><Search /></ElIcon>
              </template>
            </ElInput>
            <ElButton type="primary" class="search-btn" @click="handleSearch">查询</ElButton>
            <ElButton class="reset-btn" :icon="Refresh" circle title="重置" @click="handleReset" />
          </div>
        </div>
      </div>

      <div v-loading="loading" class="chain-grid-container">
        <ElRow :gutter="24">
          <ElCol v-for="chain in chainList" :key="chain.id" :xs="24" :sm="12" :md="8" :lg="6" :xl="6">
            <div class="chain-card" @click="handleChainSelect(chain)">
              <div class="card-top">
                <div class="icon-wrapper">
                  <ElIcon :size="22"><Connection /></ElIcon>
                </div>
                <div class="card-meta">
                  <div class="chain-id-tag">ID: {{ chain.id }}</div>
                  <div class="chain-type-tag">
                    <ElTag :type="getTypeTagType(chain.type)" size="small" effect="light" round>
                      {{ chain.type || 'General' }}
                    </ElTag>
                  </div>
                </div>
              </div>

              <div class="card-content">
                <h3 class="chain-name" :title="chain.name">{{ chain.name }}</h3>
                <div class="unit-info">
                  <ElIcon class="unit-icon"><Operation /></ElIcon>
                  <span>
                    包含
                    <strong>{{ chain.nums }}</strong>
                    个分析步骤
                  </span>
                </div>
              </div>

              <div class="card-divider"></div>

              <div class="card-bottom">
                <div class="time-info">
                  <ElIcon><Clock /></ElIcon>
                  <span>{{ formatTime(chain.updated_time) }}</span>
                </div>
                <div class="action-area">
                  <span class="action-text">立即创建</span>
                  <div class="action-icon-circle">
                    <ElIcon><ArrowRight /></ElIcon>
                  </div>
                </div>
              </div>

              <div class="hover-glow"></div>
            </div>
          </ElCol>
        </ElRow>

        <div v-if="!loading && chainList.length === 0" class="empty-state">
          <ElEmpty description="暂无任务链数据" :image-size="120" />
        </div>

        <div v-if="chainList.length > 0" class="pagination-wrapper">
          <ElPagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            layout="total, prev, pager, next"
            background
            @current-change="getTaskChains"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局容器 */
.page-container {
  min-height: 100vh;
  background-color: #f5f7fa; /* 浅灰背景 */
  padding: 24px;
}

.content-wrapper {
  max-width: 1600px;
  margin: 0 auto;
}

/* --- Header 样式 --- */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  background: #fff;
  padding: 20px 32px;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title-icon-box {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #409eff;
  font-size: 24px;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  line-height: 1.2;
}

.header-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin-top: 4px;
}

.header-right {
  display: flex;
  align-items: center;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f9fafb;
  padding: 6px;
  border-radius: 50px; /* 胶囊形状 */
  border: 1px solid #e5e7eb;
  transition: all 0.3s ease;
}

.search-box:focus-within {
  background: #fff;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.custom-input {
  width: 240px;
  --el-input-border: none;
  --el-input-bg-color: transparent;
}
.custom-input :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background: transparent;
  padding-left: 8px;
}
.search-icon {
  color: #9ca3af;
}

.search-btn {
  border-radius: 20px;
  padding: 8px 24px;
  height: 36px;
}

.reset-btn {
  margin-left: 4px;
  border: none;
  background: transparent;
  color: #909399;
}
.reset-btn:hover {
  color: #409eff;
  background: #ecf5ff;
}

/* --- 任务链卡片样式 --- */
.chain-grid-container {
  min-height: 400px;
}

.chain-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #eaecf0;
  padding: 24px;
  margin-bottom: 24px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  flex-direction: column;
  height: 80%; /* 撑满父容器(ElCol)，保证同一行卡片等高 */
  min-height: 280px;
}

.chain-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  border-color: transparent;
}

/* 顶部信息 */
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #f0f9ff;
  color: #0ea5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.chain-card:hover .icon-wrapper {
  background: #0ea5e9;
  color: #fff;
  transform: scale(1.05);
}

.card-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.chain-id-tag {
  font-size: 12px;
  color: #9ca3af;
  font-family: monospace;
}

/* 内容区域 */
.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chain-name {
  font-size: 17px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px 0;
  line-height: 1.4;
  /* 多行省略 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}

.chain-card:hover .chain-name {
  color: #409eff;
}

.unit-info {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #6b7280;
  background: #f9fafb;
  padding: 6px 12px;
  border-radius: 8px;
  width: fit-content;
}
.unit-icon {
  margin-right: 6px;
  color: #9ca3af;
}
.unit-info strong {
  color: #374151;
  margin: 0 2px;
}

/* 分割线 */
.card-divider {
  height: 1px;
  background: #f3f4f6;
  margin: 20px 0 16px 0;
}

/* 底部区域 */
.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #9ca3af;
}

.action-area {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #409eff;
  font-weight: 500;
  font-size: 13px;
  opacity: 0.8;
  transition: all 0.3s;
}

.action-icon-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ecf5ff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.chain-card:hover .action-area {
  opacity: 1;
}

.chain-card:hover .action-icon-circle {
  background: #409eff;
  color: #fff;
  transform: translateX(4px);
}

/* 装饰光效 */
.hover-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #409eff, #36cfc9);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.chain-card:hover .hover-glow {
  opacity: 1;
}

/* 空状态 */
.empty-state {
  padding: 60px 0;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.02);
}

/* 分页 */
.pagination-wrapper {
  margin-top: 32px;
  display: flex;
  justify-content: flex-end;
  padding-right: 16px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    padding: 16px;
  }
  .search-box {
    width: 100%;
  }
  .custom-input {
    flex: 1;
  }
}
</style>
