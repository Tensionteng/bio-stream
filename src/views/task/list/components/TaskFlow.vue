<script setup lang="ts">
import { ElIcon, ElTooltip } from 'element-plus';
import { CircleCloseFilled, Clock, Loading, SuccessFilled } from '@element-plus/icons-vue';

defineProps<{
  steps: Array<{
    name: string;
    status: string;
    message?: string;
  }>;
}>();

// 在状态信息中增加了背景色的 class，用于图标
const getStatusInfo = (status: string) => {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return { icon: SuccessFilled, color: 'var(--el-color-success)', type: 'success', bgClass: 'bg-success-light' };
    case 'RUNNING':
      return { icon: Loading, color: 'var(--el-color-primary)', type: 'primary', bgClass: 'bg-primary-light' };
    case 'FAILED':
    case 'CANCELED':
    case 'CANCELLED':
      return { icon: CircleCloseFilled, color: 'var(--el-color-danger)', type: 'danger', bgClass: 'bg-danger-light' };
    case 'PENDING':
    default:
      return { icon: Clock, color: 'var(--el-color-info)', type: 'info', bgClass: 'bg-info-light' };
  }
};
</script>

<template>
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
