<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElCol, ElIcon, ElMessage, ElRow } from 'element-plus';
import { DataAnalysis, Files, Help, Monitor, Right, Share, TrendCharts } from '@element-plus/icons-vue';
import { fetchProcessList } from '@/service/api/task';

const router = useRouter();
const loading = ref(false);
// 【修改点 2】类型改回 ProcessListItem
const sceneList = ref<Api.Task.ProcessListItem[]>([]);

// 顺序：绿、紫、粉、蓝、青
const gradients = [
  'linear-gradient(135deg, #42d392 0%, #647eff 100%)', // 绿蓝
  'linear-gradient(135deg, #ABDCFF 0%, #0396FF 100%)', // 蓝
  'linear-gradient(135deg, #FEB692 0%, #EA5455 100%)', // 红橙
  'linear-gradient(135deg, #CE9FFC 0%, #7367F0 100%)', // 紫
  'linear-gradient(135deg, #81FBB8 0%, #28C76F 100%)', // 纯绿
  'linear-gradient(135deg, #FFF6B7 0%, #F6416C 100%)' // 暖色
];

// 随机图标映射
const icons = [DataAnalysis, TrendCharts, Monitor, Share, Help];

function getStyle(index: number) {
  return {
    background: gradients[index % gradients.length],
    icon: icons[index % icons.length]
  };
}

/** 获取列表 */
async function loadScenes() {
  loading.value = true;
  try {
    // 【修改点 3】调用原有的 fetchProcessList
    const res = await fetchProcessList();
    // 假设 res.data 返回的就是列表数组
    sceneList.value = res.data ?? [];
  } catch (error) {
    ElMessage.error('加载场景数据失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

/** 跳转向导页 */
function handleRunScene(scene: Api.Task.ProcessListItem) {
  router.push({
    path: `/scene/create/${scene.process_id}`,
    query: { name: scene.name }
  });
}

onMounted(() => {
  loadScenes();
});
</script>

<template>
  <div class="scene-list-container">
    <div class="page-header">
      <div class="header-left">
        <div class="header-title">分析场景库</div>
        <div class="header-subtitle">精选预设流程，无需配置复杂任务单元，一键启动分析。</div>
      </div>
    </div>

    <div v-loading="loading" class="scene-content">
      <ElRow :gutter="24">
        <ElCol v-for="(scene, index) in sceneList" :key="scene.process_id" :xs="24" :sm="12" :md="8" :lg="6" :xl="6">
          <div class="fusion-card" @click="handleRunScene(scene)">
            <div class="card-header-flex">
              <div class="icon-square" :style="{ background: getStyle(index).background }">
                <ElIcon size="28" color="#fff">
                  <component :is="getStyle(index).icon" />
                </ElIcon>
              </div>

              <div class="title-area">
                <div class="scene-name" :title="scene.name">{{ scene.name }}</div>
                <div class="scene-id">ID: {{ scene.process_id }}</div>
              </div>
            </div>

            <div class="process-tags">
              <div class="tags-label">包含流程：</div>
              <div class="tags-group">
                <template v-if="scene.description?.execution_units?.length">
                  <span
                    v-for="unit in scene.description.execution_units.slice(0, 2)"
                    :key="unit.name"
                    class="step-badge"
                  >
                    {{ unit.name }}
                  </span>
                  <span v-if="scene.description.execution_units.length > 2" class="step-badge-more">
                    +{{ scene.description.execution_units.length - 2 }}
                  </span>
                </template>
                <span v-else class="empty-text">暂无详情</span>
              </div>
            </div>

            <div class="card-footer">
              <div class="step-info">
                <ElIcon><Files /></ElIcon>
                <span>{{ scene.description?.total_units || 0 }} 步骤</span>
              </div>
              <div class="action-link">
                去运行
                <ElIcon><Right /></ElIcon>
              </div>
            </div>
          </div>
        </ElCol>
      </ElRow>
    </div>
  </div>
</template>

<style scoped>
/* 样式保持不变 */
.scene-list-container {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: calc(100vh - 64px);
}

.page-header {
  background: #fff;
  padding: 20px 24px;
  border-radius: 4px;
  margin-bottom: 20px;
  border-left: 4px solid #409eff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.header-subtitle {
  font-size: 13px;
  color: #909399;
}

.fusion-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #e4e7ed;
  transition: all 0.3s ease;
  cursor: pointer;
  height: 200px;
  display: flex;
  flex-direction: column;
  position: relative;
}

.fusion-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.06);
  border-color: #c0c4cc;
}

.card-header-flex {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.icon-square {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.title-area {
  flex: 1;
  overflow: hidden;
}

.scene-name {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scene-id {
  font-size: 12px;
  color: #909399;
  background: #f5f7fa;
  padding: 1px 6px;
  border-radius: 4px;
  display: inline-block;
}

.process-tags {
  flex: 1;
}

.tags-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.tags-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  height: 28px;
  overflow: hidden;
}

.step-badge {
  font-size: 12px;
  color: #409eff;
  background-color: #ecf5ff;
  border: 1px solid #d9ecff;
  padding: 2px 8px;
  border-radius: 4px;
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-badge-more {
  font-size: 12px;
  color: #909399;
  background-color: #f4f4f5;
  border: 1px solid #e9e9eb;
  padding: 2px 6px;
  border-radius: 4px;
}

.card-footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-info {
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-link {
  font-size: 13px;
  color: #409eff;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.fusion-card:hover .action-link {
  opacity: 1;
  font-weight: 600;
}

.empty-text {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
