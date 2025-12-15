<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { MarkerType, Position, VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import dagre from 'dagre';
import { fetchTaskFlow } from '@/service/api/task';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/controls/dist/style.css';

const props = defineProps<{
  taskId: number | null;
}>();

const { onInit, fitView } = useVueFlow();
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);
const loading = ref(false);

// 修复部分：将参数名称改为 inputNodes 和 inputEdges，避免遮蔽外部变量
const getLayoutedElements = (inputNodes: any[], inputEdges: any[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  inputNodes.forEach(node => {
    const w = node.type === 'if-node' ? 180 : 220;
    const h = 80;
    dagreGraph.setNode(node.id, { width: w, height: h });
  });

  inputEdges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: inputNodes.map(node => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: { x: nodeWithPosition.x - (node.type === 'if-node' ? 90 : 110), y: nodeWithPosition.y - 40 },
        sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
        targetPosition: direction === 'LR' ? Position.Left : Position.Top
      };
    }),
    edges: inputEdges
  };
};

const transformDataToGraph = (apiNodes: any[]) => {
  const tempNodes: any[] = [];
  const tempEdges: any[] = [];

  apiNodes.forEach(node => {
    let flowType = 'function-node';
    if (node.type === 'if') flowType = 'if-node';
    else if (node.type === 'data') flowType = 'data-node';

    tempNodes.push({
      id: node.id.toString(),
      type: flowType,
      data: {
        label: node.type,
        // 关键修改：传入 name 和 desc
        name: node.name,
        desc: node.desc,
        rawType: node.type
      }
    });

    const commonEdgeStyle = {
      type: 'smoothstep',
      animated: true,
      markerEnd: MarkerType.ArrowClosed
    };

    if (node.to) {
      tempEdges.push({
        id: `e${node.id}-${node.to}`,
        source: node.id.toString(),
        target: node.to.toString(),
        ...commonEdgeStyle,
        style: { stroke: '#909399', strokeWidth: 2 }
      });
    }

    if (node.case && Array.isArray(node.case)) {
      node.case.forEach((branch: any) => {
        tempEdges.push({
          id: `e${node.id}-${branch.to}`,
          source: node.id.toString(),
          target: branch.to.toString(),
          ...commonEdgeStyle,
          label: branch.desc,
          style: { stroke: '#e6a23c', strokeWidth: 2 },
          labelStyle: { fill: '#e6a23c', fontWeight: 700 },
          labelBgStyle: { fill: '#fff9f0', fillOpacity: 0.8 }
        });
      });
    }
  });

  return { tempNodes, tempEdges };
};

const loadGraphData = async () => {
  if (!props.taskId) return;
  loading.value = true;
  try {
    const { data } = await fetchTaskFlow(props.taskId);
    const nodeList = data?.nodes || [];
    if (nodeList.length > 0) {
      const { tempNodes, tempEdges } = transformDataToGraph(nodeList);
      const layouted = getLayoutedElements(tempNodes, tempEdges, 'LR');
      nodes.value = layouted.nodes;
      edges.value = layouted.edges;
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    }
  } catch (e) {
    console.error('加载流程图失败', e);
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.taskId,
  val => {
    if (val) loadGraphData();
  },
  { immediate: true }
);

onMounted(() => {
  onInit(() => {
    if (props.taskId) loadGraphData();
  });
});
</script>

<template>
  <div v-loading="loading" class="flow-container">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :default-zoom="1"
      :min-zoom="0.2"
      :max-zoom="4"
      fit-view-on-init
    >
      <Background pattern-color="#e0e0e0" :gap="20" />
      <Controls />

      <template #node-function-node="{ data }">
        <div class="custom-node function-style">
          <div v-if="data.desc" class="node-tooltip">{{ data.desc }}</div>

          <div class="node-header func-header">
            <span class="icon">⚙️</span>
            <span class="title">FUNCTION</span>
          </div>
          <div class="node-body">
            {{ data.name }}
          </div>
        </div>
      </template>

      <template #node-data-node="{ data }">
        <div class="custom-node data-style">
          <div v-if="data.desc" class="node-tooltip">{{ data.desc }}</div>

          <div class="node-header data-header">
            <span class="icon">💾</span>
            <span class="title">DATASET</span>
          </div>
          <div class="node-body">
            {{ data.name }}
          </div>
        </div>
      </template>

      <template #node-if-node="{ data }">
        <div class="custom-node if-style">
          <div v-if="data.desc" class="node-tooltip">{{ data.desc }}</div>

          <div class="if-content">
            <span class="if-tag">IF 判断</span>
            <span class="if-text">{{ data.name }}</span>
          </div>
          <div class="diamond-bg"></div>
        </div>
      </template>
    </VueFlow>
  </div>
</template>

<style scoped>
.flow-container {
  width: 100%;
  height: 600px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
}

/* --- 公共基础样式 --- */
.custom-node {
  font-size: 12px;
  color: #333;
  text-align: center;
  position: relative;
  background: #fff;
  /* 关键修改：移除 overflow: hidden，否则 tooltip 会被挡住 */
  /* overflow: hidden;  <-- 删除这行 */
}

/* --- Tooltip 样式 (新增) --- */
.node-tooltip {
  position: absolute;
  bottom: 110%; /* 显示在节点上方 */
  left: 50%;
  transform: translateX(-50%);

  width: max-content;
  max-width: 200px; /* 限制最大宽度 */
  padding: 8px 12px;
  background-color: rgba(48, 49, 51, 0.9); /* 深色半透明背景 */
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  z-index: 100;

  /* 初始状态隐藏 */
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s,
    visibility 0.2s;
  pointer-events: none; /* 让鼠标事件穿透，避免闪烁 */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

/* 加上小箭头 */
.node-tooltip::after {
  content: '';
  position: absolute;
  top: 100%; /* 箭头在下方 */
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: rgba(48, 49, 51, 0.9) transparent transparent transparent;
}

/* 鼠标悬停时显示 Tooltip */
.custom-node:hover .node-tooltip {
  opacity: 1;
  visibility: visible;
}

/* --- 头部样式调整 --- */
.node-header {
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.node-header .title {
  font-weight: 800;
  font-size: 10px;
  letter-spacing: 1px;
  margin-left: 4px;
}

.node-body {
  padding: 12px;
  font-weight: 600; /* 名字加粗一点 */
  font-size: 14px; /* 名字稍微大一点 */
  line-height: 1.4;
}

/* --- Function 节点样式 --- */
.function-style {
  width: 200px;
  border: 1px solid #409eff;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(64, 158, 255, 0.15);
}
.func-header {
  background: linear-gradient(90deg, #ecf5ff 0%, #d9ecff 100%);
  color: #409eff;
  /* 因为父级去掉了 overflow: hidden，这里需要手动补圆角 */
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
}

/* --- Data 节点样式 --- */
.data-style {
  width: 210px;
  border-radius: 30px;
  border: 2px solid #c8e6c9;
  box-shadow: 0 6px 15px rgba(103, 194, 58, 0.25);
  background: #f1f8f1;
}

.data-header {
  background: linear-gradient(180deg, #e1f3d8 0%, #f1f8f1 100%);
  color: #5daf34;
  border-bottom: none;
  justify-content: center;
  padding-top: 12px;
  padding-bottom: 4px;
  /* 手动补圆角 */
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
}
.data-header .title {
  font-size: 11px;
}

.data-style .node-body {
  color: #525457;
  padding: 5px 20px 18px 20px;
}

/* --- IF 节点样式 --- */
.if-style {
  width: 160px;
  height: 80px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: visible; /* 保持可见 */
}

.diamond-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #fff;
  border: 2px solid #e6a23c;
  border-radius: 8px;
  transform: skewX(-10deg);
  box-shadow: 0 4px 10px rgba(230, 162, 60, 0.2);
  z-index: 0;
}

.if-content {
  z-index: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.if-tag {
  color: #e6a23c;
  font-weight: 900;
  font-size: 10px;
  text-transform: uppercase;
  margin-bottom: 2px;
}
.if-text {
  font-weight: 600;
  color: #606266;
  font-size: 13px; /* 稍微大一点 */
}
</style>
