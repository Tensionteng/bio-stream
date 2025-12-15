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

/** 布局计算核心函数 保持了之前的优化：增加间距以避免文字遮挡 */
const getLayoutedElements = (inputNodes: any[], inputEdges: any[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    // 垂直间距：防止分支上下重叠
    nodesep: 120,
    // 水平间距：给长文本标签留空间
    ranksep: 180
  });

  inputNodes.forEach(node => {
    // 根据节点类型预估尺寸
    const w = node.type === 'if-node' ? 180 : 240;
    const h = 100;
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
        // 修正坐标中心点
        position: {
          x: nodeWithPosition.x - (node.type === 'if-node' ? 90 : 120),
          y: nodeWithPosition.y - 50
        },
        sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
        targetPosition: direction === 'LR' ? Position.Left : Position.Top
      };
    }),
    edges: inputEdges
  };
};

/** 数据转换函数 【修复重点】增加了对 null 值的防御性判断 */
const transformDataToGraph = (apiNodes: any[]) => {
  const tempNodes: any[] = [];
  const tempEdges: any[] = [];

  apiNodes.forEach(node => {
    // 1. 处理节点
    let flowType = 'function-node';
    if (node.type === 'if') flowType = 'if-node';
    else if (node.type === 'data') flowType = 'data-node';

    tempNodes.push({
      id: node.id.toString(),
      type: flowType,
      data: {
        label: node.type,
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

    // 2. 处理普通连线 (修复：判断 node.to 是否存在)
    // 只有当 to 不为 null/undefined/空字符串时才创建连线
    if (node.to !== null && node.to !== undefined && node.to !== '') {
      tempEdges.push({
        id: `e${node.id}-${node.to}`,
        source: node.id.toString(),
        target: node.to.toString(),
        ...commonEdgeStyle,
        style: { stroke: '#b1b3b8', strokeWidth: 2 }
      });
    }

    // 3. 处理 IF 分支连线
    if (node.case && Array.isArray(node.case)) {
      node.case.forEach((branch: any) => {
        // 【关键修复】如果是 "Discard" 或结束分支 (to 为 null)，直接跳过，不创建连线
        if (branch.to === null || branch.to === undefined || branch.to === '') {
          return;
        }

        tempEdges.push({
          id: `e${node.id}-${branch.to}`,
          source: node.id.toString(),
          target: branch.to.toString(), // 此时 branch.to 必定有值，不会报错
          ...commonEdgeStyle,
          label: branch.desc,

          style: { stroke: '#faecd8', strokeWidth: 2 },
          labelStyle: { fill: '#d48806', fontWeight: 700, fontSize: 11 },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 1, rx: 6, ry: 6, stroke: '#faecd8', strokeWidth: 1 }
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

      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
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
      class="custom-flow"
    >
      <Background pattern-color="#e0e0e0" :gap="24" />
      <Controls />

      <template #node-function-node="{ data }">
        <div class="custom-node function-style">
          <div v-if="data.desc" class="node-tooltip">
            {{ data.desc }}
            <div class="tooltip-arrow"></div>
          </div>

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
          <div v-if="data.desc" class="node-tooltip">
            {{ data.desc }}
            <div class="tooltip-arrow"></div>
          </div>

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
          <div v-if="data.desc" class="node-tooltip">
            {{ data.desc }}
            <div class="tooltip-arrow"></div>
          </div>

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

/* --- 节点基础样式 --- */
.custom-node {
  position: relative;
  background: #fff;
  text-align: center;
  font-size: 12px;
  color: #333;
  overflow: visible;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  cursor: pointer;
}

.custom-node:hover {
  z-index: 100 !important;
  transform: translateY(-2px);
}

/* --- Tooltip 样式 --- */
.node-tooltip {
  position: absolute;
  bottom: 115%;
  left: 50%;
  transform: translateX(-50%);

  width: max-content;
  max-width: 240px;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.85);
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
  white-space: pre-wrap;
  z-index: 999;

  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s,
    visibility 0.2s;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.tooltip-arrow {
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -6px;
  border-width: 6px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.85) transparent transparent transparent;
}

.custom-node:hover .node-tooltip {
  opacity: 1;
  visibility: visible;
}

/* --- Function Node 样式 --- */
.function-style {
  width: 220px;
  border: 1px solid #d9ecff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.function-style:hover {
  box-shadow: 0 8px 20px rgba(64, 158, 255, 0.2);
  border-color: #409eff;
}

.func-header {
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  background: linear-gradient(90deg, #ecf5ff 0%, #ffffff 100%);
  border-bottom: 1px solid #d9ecff;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #409eff;
  font-weight: bold;
}

/* --- Data Node 样式 --- */
.data-style {
  width: 220px;
  border-radius: 20px;
  border: 1px solid #e1f3d8;
  background: #f0f9eb;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.data-style:hover {
  box-shadow: 0 8px 20px rgba(103, 194, 58, 0.2);
  border-color: #67c23a;
}

.data-header {
  border-top-left-radius: 19px;
  border-top-right-radius: 19px;
  background: #e1f3d8;
  color: #67c23a;
  padding: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  font-weight: bold;
}

.node-body {
  padding: 12px 16px;
  font-weight: 500;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* --- IF Node 样式 --- */
.if-style {
  width: 180px;
  height: 80px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.diamond-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #fff;
  border: 2px solid #e6a23c;
  border-radius: 4px;
  transform: skewX(-15deg);
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.15);
  z-index: 0;
  transition: all 0.2s;
}

.if-style:hover .diamond-bg {
  box-shadow: 0 8px 20px rgba(230, 162, 60, 0.3);
  border-color: #ff9900;
}

.if-content {
  z-index: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.if-tag {
  font-size: 10px;
  color: #e6a23c;
  font-weight: 800;
  margin-bottom: 4px;
}
.if-text {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
