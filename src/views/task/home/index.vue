<script setup lang="ts">
// -------------------------------------------------------------------------
// 1. 依赖导入
// -------------------------------------------------------------------------
// Vue 核心
import { onMounted, reactive, ref } from 'vue';
// 路由钩子
import { useRouter } from 'vue-router';
// Element Plus 组件库的反馈组件
import { ElMessage } from 'element-plus';
// 图标组件
import { ArrowRight, Clock, Connection, List, Operation, Refresh, Search } from '@element-plus/icons-vue';
// API 接口定义与请求方法 (假定位于 @/service/api 目录下)
import { type TaskChainListItem, type TaskChainListParams, fetchTaskChainList } from '@/service/api/task_chain';

/**
 * # ========================================================================
 *
 * # 逻辑层 (Script)
 *
 * # ========================================================================
 */

// 初始化路由实例，用于页面跳转
const router = useRouter();

// -------------------------------------------------------------------------
// 2. 状态定义 (State)
// -------------------------------------------------------------------------

/** loading 状态：控制列表加载时的骨架屏或 Loading 动画显示 */
const loading = ref(false);

/** 任务链数据列表：存储从后端获取的卡片数据 */
const chainList = ref<TaskChainListItem[]>([]);

/** 分页配置对象：使用 reactive 响应式对象统一管理 */
const pagination = reactive({
  page: 1, // 当前页码
  pageSize: 12, // 每页显示数量 (配合栅格布局，12能被2,3,4,6整除，排版更整齐)
  total: 0 // 数据总条数
});

/** 搜索表单数据 */
const searchParams = reactive({
  name: '' // 搜索关键词：任务链名称
});

// -------------------------------------------------------------------------
// 3. API 请求逻辑
// -------------------------------------------------------------------------

/** 获取任务链列表数据 触发时机：页面挂载(onMounted)、点击分页、点击搜索 */
async function getTaskChains() {
  loading.value = true; // 开启加载状态
  try {
    // 构造请求参数，将前端分页状态映射为 API 所需格式
    const params: TaskChainListParams = {
      page: pagination.page,
      page_size: pagination.pageSize,
      // 如果搜索框为空字符串，传递 undefined 以避免后端过滤空值
      task_name: searchParams.name || undefined
    };

    // 发起异步请求
    const response = await fetchTaskChainList(params);

    // 处理响应数据
    if (response.data) {
      chainList.value = response.data.task_chains || []; // 更新列表
      pagination.total = response.data.count || 0; // 更新总数，用于分页组件计算页数
      pagination.page = response.data.page || 1; // 同步当前页码（防止越界）
    }
  } catch (error) {
    console.error('获取任务链失败:', error);
    ElMessage.error('获取任务链列表失败'); // 这里的错误提示可根据实际需求优化
  } finally {
    loading.value = false; // 无论成功失败，最后都关闭加载状态
  }
}

// -------------------------------------------------------------------------
// 4. 事件处理 (Event Handlers)
// -------------------------------------------------------------------------

/** 处理搜索事件 说明：用户点击查询或按回车时触发，需将页码重置为 1，确保从第一页开始看结果 */
function handleSearch() {
  pagination.page = 1;
  getTaskChains();
}

/** 处理重置事件 说明：清空搜索框内容，并重新获取全量数据 */
function handleReset() {
  searchParams.name = '';
  handleSearch(); // 复用搜索逻辑（此时 name 为空，页码为 1）
}

/**
 * 点击卡片跳转到创建页
 *
 * @param chain 选中的任务链对象 说明：携带 chain.id 和 name 跳转，用于下一个页面初始化
 */
function handleChainSelect(chain: TaskChainListItem) {
  router.push({
    path: `/task/create/${chain.id}`,
    query: {
      name: chain.name // 将名字通过 query 参数传递，方便下个页面展示面包屑或标题
    }
  });
}

// -------------------------------------------------------------------------
// 5. 工具函数 (Helpers)
// -------------------------------------------------------------------------

/**
 * 格式化时间字符串
 *
 * @param timeStr ISO 时间字符串 (如: 2023-10-01T12:00:00)
 * @returns 格式化后的字符串 (如: 2023-10-01 12:00)
 */
function formatTime(timeStr: string) {
  if (!timeStr) return '-';
  // 简单处理：去掉 'T'，截取到分钟级别
  return timeStr.replace('T', ' ').substring(0, 16);
}

/**
 * 根据任务链类型获取 Element Plus Tag 的颜色主题
 *
 * @param type 后端返回的类型字段
 * @returns 对应的 UI 颜色类型
 */
function getTypeTagType(type: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  // 定义映射字典
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    linear: 'success', // 线性流程 -> 绿色
    branch: 'warning', // 分支流程 -> 橙色
    complex: 'danger', // 复杂流程 -> 红色
    dag: 'info' // DAG图 -> 灰色
  };
  // 兼容大小写，未匹配到则默认显示 primary (蓝色)
  return map[type?.toLowerCase()] || 'primary';
}

// -------------------------------------------------------------------------
// 6. 生命周期 (Lifecycle)
// -------------------------------------------------------------------------
onMounted(() => {
  getTaskChains(); // 组件挂载完成后立即请求首屏数据
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
/* * ========================================================================
 * 样式层 (CSS)
 * 采用了 Flexbox 布局为主，注重交互细节和阴影层次感
 * ========================================================================
 */

/* 全局容器：浅灰背景，至少占满一屏高度 */
.page-container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 24px;
}

/* 限制最大宽度，居中显示 */
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
  /* 轻微阴影增加浮起感 */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  flex-wrap: wrap; /* 允许换行，适配小屏幕 */
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 标题左侧的装饰性图标盒子 */
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

/* 胶囊状搜索框容器 */
.search-box {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f9fafb;
  padding: 6px;
  border-radius: 50px;
  border: 1px solid #e5e7eb;
  transition: all 0.3s ease;
}

/* 搜索框聚焦时的样式增强 */
.search-box:focus-within {
  background: #fff;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

/* 自定义 Element Input 样式，去除默认边框以融入胶囊容器 */
.custom-input {
  width: 240px;
  --el-input-border: none;
  --el-input-bg-color: transparent;
}
/* 穿透修改内部 input 样式 */
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
  overflow: hidden; /* 隐藏溢出的装饰光效 */
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  flex-direction: column;
  height: 80%; /* 保证同一行的卡片高度一致 */
  min-height: 280px;
}

/* 卡片悬停效果：上浮 + 阴影 + 边框消失 */
.chain-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  border-color: transparent;
}

/* 顶部信息区域 */
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

/* 卡片内的图标容器 */
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

/* 悬停时图标反色高亮 */
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
  font-family: monospace; /* 等宽字体显示ID */
}

/* 内容区域 */
.card-content {
  flex: 1; /* 撑满剩余空间，把底部区域挤下去 */
  display: flex;
  flex-direction: column;
}

.chain-name {
  font-size: 17px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px 0;
  line-height: 1.4;
  /* CSS 文本溢出省略：最多显示2行 */
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

/* 步骤数胶囊标签 */
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

/* 内部虚线分割线 */
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

/* 悬停时右下角的“立即创建”动效 */
.chain-card:hover .action-area {
  opacity: 1;
}

.chain-card:hover .action-icon-circle {
  background: #409eff;
  color: #fff;
  transform: translateX(4px); /* 向右微移 */
}

/* 装饰光效：顶部的渐变线条 */
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

/* 空状态容器 */
.empty-state {
  padding: 60px 0;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.02);
}

/* 分页容器：右对齐 */
.pagination-wrapper {
  margin-top: 32px;
  display: flex;
  justify-content: flex-end;
  padding-right: 16px;
}

/* 响应式调整：移动端适配 */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column; /* 垂直排列 */
    align-items: stretch;
    padding: 16px;
  }
  .search-box {
    width: 100%; /* 搜索框占满全宽 */
  }
  .custom-input {
    flex: 1;
  }
}
</style>
