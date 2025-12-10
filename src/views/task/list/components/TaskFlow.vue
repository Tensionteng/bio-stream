<script setup lang="ts">
// ==========================================
// 1. 依赖引入
// ==========================================
// 引入 Element Plus 的基础组件 (即便项目有自动导入，显式引入有助于 IDE 类型推断)
import { ElIcon, ElTooltip } from 'element-plus';
// 引入所需的图标组件
import {
  CircleCloseFilled, // 用于失败/取消状态
  Clock, // 用于等待/默认状态
  Loading, // 用于运行中状态
  SuccessFilled // 用于成功状态
} from '@element-plus/icons-vue';

/**
 * # ==========================================
 *
 * 2. Props 定义 (接收父组件数据)
 */
defineProps<{
  // 步骤数组，包含每一个任务节点的信息
  steps: Array<{
    name: string; // 节点名称（例如："数据预处理"）
    status: string; // 节点状态（例如："RUNNING", "SUCCESS"）
    message?: string; // (可选) 鼠标悬停时的详细提示信息，通常用于展示报错原因
  }>;
}>();

/**
 * # ==========================================
 *
 * 3. 逻辑处理：状态映射工具函数
 *
 * 根据传入的状态字符串 (status)，返回对应的图标、颜色和样式类名。
 *
 * - @param status - 后端返回的状态字符串
 *
 * @returns 对象包含: icon(组件), color(图标颜色), type(状态类型), bgClass(背景样式类)
 */
const getStatusInfo = (status: string) => {
  // 使用 toUpperCase() 确保大小写不敏感 (防止 'Success' 和 'SUCCESS' 导致不同结果)
  switch (status?.toUpperCase()) {
    // --- 成功状态 ---
    case 'SUCCESS':
      return {
        icon: SuccessFilled,
        color: 'var(--el-color-success)', // 使用 Element 预定义的绿色变量
        type: 'success', // 用于生成 .status-success 类名
        bgClass: 'bg-success-light' // 用于图标的浅绿色背景
      };

    // --- 运行中状态 ---
    case 'RUNNING':
      return {
        icon: Loading,
        color: 'var(--el-color-primary)', // Element 主色调(蓝色)
        type: 'primary',
        bgClass: 'bg-primary-light'
      };

    // --- 失败或取消状态 ---
    // 合并了 FAILED, CANCELED 以及常见的拼写变体 CANCELLED
    case 'FAILED':
    case 'CANCELED':
    case 'CANCELLED':
      return {
        icon: CircleCloseFilled,
        color: 'var(--el-color-danger)', // 红色警告色
        type: 'danger',
        bgClass: 'bg-danger-light'
      };

    // --- 等待中或默认状态 ---
    case 'PENDING':
    default: // 任何未匹配的状态都回落到这里
      return {
        icon: Clock,
        color: 'var(--el-color-info)', // 灰色信息色
        type: 'info',
        bgClass: 'bg-info-light'
      };
  }
};
</script>

<template>
  <!-- 横向节点流，每个卡片对应任务单元 -->
  <div class="task-flow-container-custom">
    <div v-for="(step, index) in steps" :key="step.name" class="node-wrapper">
      <ElTooltip :content="step.message || step.name" placement="top" effect="dark">
        <div class="node-card" :class="`status-${getStatusInfo(step.status).type}`">
          <!-- 为图标增加一个带背景色的容器 -->
          <div class="node-icon-wrapper" :class="getStatusInfo(step.status).bgClass">
            <ElIcon :size="20" :color="getStatusInfo(step.status).color">
              <component
                :is="getStatusInfo(step.status).icon"
                :class="{ 'is-loading': step.status.toUpperCase() === 'RUNNING' }"
              />
            </ElIcon>
          </div>
          <div class="node-content">
            <div class="node-title">{{ step.name }}</div>
          </div>
        </div>
      </ElTooltip>

      <div v-if="index < steps.length - 1" class="connector"></div>
    </div>
  </div>
</template>

<style scoped>
/* 整体容器美化 */
.task-flow-container-custom {
  display: flex;
  align-items: center;
  background-color: #f7f8fa; /* 增加一个浅灰色背景 */
  padding: 24px;
  border-radius: 12px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f1f1f1;
}

/* 滚动条样式 (适用于 Webkit 浏览器) */
.task-flow-container-custom::-webkit-scrollbar {
  height: 8px;
}
.task-flow-container-custom::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}
.task-flow-container-custom::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}
.task-flow-container-custom::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.node-wrapper {
  display: flex;
  align-items: center;
  flex-shrink: 0; /* 防止节点在空间不足时被压缩 */
}

/* 节点卡片样式增强 */
.node-card {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e4e7ed;
  background-color: #ffffff;
  min-width: 200px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); /* 初始阴影 */
  transition:
    transform 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out; /* 平滑过渡效果 */
  cursor: pointer;
  border-left: 4px solid transparent; /* 默认左边框 */
}

/* 鼠标悬浮效果 */
.node-card:hover {
  transform: translateY(-4px); /* 向上移动 */
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1); /* 阴影加深 */
}

/* 根据状态改变左边框颜色 */
.node-card.status-success {
  border-left-color: var(--el-color-success);
}
.node-card.status-primary {
  border-left-color: var(--el-color-primary);
}
.node-card.status-danger {
  border-left-color: var(--el-color-danger);
}
.node-card.status-info {
  border-left-color: var(--el-color-info);
}

/* 图标容器样式 */
.node-icon-wrapper {
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%; /* 圆形背景 */
}

/* 图标背景色 */
.bg-success-light {
  background-color: var(--el-color-success-light-9);
}
.bg-primary-light {
  background-color: var(--el-color-primary-light-9);
}
.bg-danger-light {
  background-color: var(--el-color-danger-light-9);
}
.bg-info-light {
  background-color: var(--el-color-info-light-9);
}

/* 内容区域样式 */
.node-content {
  text-align: left;
  overflow: hidden; /* 防止内容溢出 */
}
.node-title {
  font-weight: 600; /* 字体加粗 */
  color: #303133;
  white-space: nowrap;
  text-overflow: ellipsis; /* 超出部分显示省略号 */
  overflow: hidden;
}
.node-duration {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}

/* 将连接器改造为箭头 */
.connector {
  position: relative;
  width: 60px; /* 箭头线的长度 */
  height: 2px;
  background-color: #c0c4cc;
  margin: 0 16px; /* 箭头与卡片之间的间距 */
}

/* 使用伪元素绘制箭头头部 */
.connector::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -8px; /* 将箭头头部定位在线的末端 */
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 8px solid #c0c4cc; /* 绘制三角形作为箭头 */
}
</style>
