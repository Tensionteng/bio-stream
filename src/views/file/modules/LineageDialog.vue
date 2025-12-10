<script lang="ts" setup>
/**
 * LineageDialog.vue - 文件数据世系图展示组件
 * 功能：展示文件之间的数据流向关系，使用ECharts绘制有向无环图
 * 包含：世系数据获取、节点/连接渲染、拓扑排序布局、富交互提示框
 */

import { ref, nextTick } from 'vue';
import { ElMessage, ElDialog, ElIcon, ElButton } from 'element-plus';
import * as echarts from 'echarts';
import { fetchFileGenealogy } from '@/service/api/file';

// ============ Props Props ============
const props = defineProps<{
  modelValue: boolean;  // 对话框显示状态
  row?: any;            // 当前选中的文件行数据
}>();

// ============ Emits 事件发射 ============
const emit = defineEmits<{
  'update:modelValue': [value: boolean];  // 更新对话框可见性
}>();

// ============ 本地状态 ============
const lineageLoading = ref(false);          // 世系图加载状态
const lineageChartRef = ref<HTMLElement>(); // ECharts图表容器引用
const lineageChart = ref<echarts.ECharts>();// ECharts实例
const currentFileGenealogy = ref<any>(null);// 当前文件的完整世系数据

// ============ 生命周期函数 ============

/**
 * 处理世系图对话框关闭
 * 功能：关闭对话框、销毁图表实例、释放内存
 */
function handleLineageDialogClose() {
  emit('update:modelValue', false);
  lineageChart.value?.dispose(); // 销毁ECharts实例
  lineageChart.value = undefined;
}

/**
 * 显示文件的数据世系图
 * 功能：异步获取世系数据，验证数据有效性，初始化并渲染世系图
 * @param {any} row - 选中的文件行数据，包含file_id用于查询世系
 */
async function showLineage(row: any) {
  lineageLoading.value = true;
  currentFileGenealogy.value = null;

  try {
    // 调用API获取文件的完整世系数据
    const res = await fetchFileGenealogy(row.file_id);
    console.log('genealogy response:', res);

    // 兼容不同的响应结构
    const genealogyData = res.response?.data || res.data;
    console.log('genealogyData:', genealogyData);

    // 检查数据有效性：需要是非空数组
    if (genealogyData && Array.isArray(genealogyData.data) && genealogyData.data.length > 0) {
      currentFileGenealogy.value = genealogyData;
      // 等待DOM更新，然后渲染图表（延迟100ms确保容器已挂载）
      await nextTick();
      setTimeout(() => {
        renderLineageGraph(genealogyData.data as any[]);
      }, 100);
    } else {
      // 无世系数据时提示用户
      ElMessage.warning((genealogyData as any).message || '该文件暂无世系数据');
      emit('update:modelValue', false);
    }
  } catch (e: any) {
    // 网络错误或API异常处理
    ElMessage.error(`获取世系数据失败: ${e.message || '未知错误'}`);
    emit('update:modelValue', false);
  } finally {
    lineageLoading.value = false;  // 关闭加载状态
  }
}

/**
 * 转换世系数据为ECharts图表格式
 * 功能：
 * 1. 提取所有文件节点并为不同文件类型分配颜色
 * 2. 构建文件间的连接关系
 * 3. 为每个节点配置样式、标签、悬停效果
 * @param {any[]} data - 后端返回的原始世系数据数组，格式为 [{file1, file2, task}, ...]
 * @return {Object} 返回包含nodes、links、categories的图表数据对象
 */
function transformLineageData(data: any[]) {
  // ============ 数据验证 ============
  // 检查是否为有效的数组，空数组表示没有世系数据
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('No lineage data provided');
    return { nodes: [], links: [], categories: [{ name: 'file' }] };
  }

  const nodeMap = new Map<string, any>();          // 使用Map存储唯一的文件节点，key为file_id
  const links: any[] = [];                            // 存储节点间的连接（父子关系）
  const fileTypeColorMap = new Map<string, string>(); // 建立文件类型到颜色的映射
  
  // ============ 专业配色方案 ============
  // 8种高对比度颜色用于区分不同的文件类型
  const colors = [
    { primary: '#4A90E2', light: 'rgba(74, 144, 226, 0.15)' },
    { primary: '#7ED321', light: 'rgba(126, 211, 33, 0.15)' },
    { primary: '#F5A623', light: 'rgba(245, 166, 35, 0.15)' },
    { primary: '#E94B3C', light: 'rgba(233, 75, 60, 0.15)' },
    { primary: '#50E3C2', light: 'rgba(80, 227, 194, 0.15)' },
    { primary: '#BD10E0', light: 'rgba(189, 16, 224, 0.15)' },
    { primary: '#FF6B6B', light: 'rgba(255, 107, 107, 0.15)' },
    { primary: '#4ECDC4', light: 'rgba(78, 205, 196, 0.15)' }
  ];
  let colorIndex = 0;

  // 第一遍：为每个文件类型分配唯一的颜色 | 确保同类型文件显示相同颜色便于区分
  data.forEach((genealogy) => {
    // 处理第一个文件节点的颜色映射
    if (genealogy.file1 && !fileTypeColorMap.has(genealogy.file1.file_type)) {
      fileTypeColorMap.set(genealogy.file1.file_type, colors[colorIndex % colors.length].primary);
      colorIndex++; // 循环使用8种颜色
    }
    // 处理第二个文件节点的颜色映射
    if (genealogy.file2 && !fileTypeColorMap.has(genealogy.file2.file_type)) {
      fileTypeColorMap.set(genealogy.file2.file_type, colors[colorIndex % colors.length].primary);
      colorIndex++;
    }
  });

  // 节点工厂函数：为图表创建ECharts格式的节点对象
  const createNode = (file: any, color: string) => ({
    id: file.file_id,
    name: file.file_name,
    value: file,
    category: 0,
    symbolSize: 55,
    label: {
      show: true,
      position: 'bottom',
      formatter: () => {
        const name = file.file_name;
        return name.length > 25 ? `${name.substring(0, 25)}...` : name;
      },
      fontSize: 11,
      color: '#333',
      fontWeight: 'bold',
      distance: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      borderRadius: 3,
      borderColor: '#e0e0e0',
      borderWidth: 0.5,
      padding: [4, 7],
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      shadowBlur: 3
    },
    itemStyle: {
      color: color,
      borderColor: '#ffffff',
      borderWidth: 4,
      shadowBlur: 20,
      shadowColor: color + '50',
      shadowOffsetY: 5,
      opacity: 1
    },
    emphasis: {
      itemStyle: {
        color: color,
        borderColor: '#ffd700',
        borderWidth: 5,
        shadowBlur: 25,
        shadowColor: color + '60',
        shadowOffsetY: 6
      },
      label: {
        show: true,
        color: color,
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: color,
        borderWidth: 1.5
      }
    }
  });

  // 第二遍：创建节点和连接
  data.forEach((genealogy) => {
    if (!genealogy.file1) {
      return;
    }

    // 只有file1时，直接添加该节点
    if (!genealogy.file2) {
      const color1 = fileTypeColorMap.get(genealogy.file1.file_type) || colors[0].primary;
      if (!nodeMap.has(genealogy.file1.file_id)) {
        nodeMap.set(genealogy.file1.file_id, createNode(genealogy.file1, color1));
      }
      return;
    }

    // file1和file2都存在时，添加两个节点和连接线
    const color1 = fileTypeColorMap.get(genealogy.file1.file_type) || colors[0].primary;
    const color2 = fileTypeColorMap.get(genealogy.file2.file_type) || colors[1].primary;

    // 添加file1节点
    if (!nodeMap.has(genealogy.file1.file_id)) {
      nodeMap.set(genealogy.file1.file_id, createNode(genealogy.file1, color1));
    }

    // 添加file2节点
    if (!nodeMap.has(genealogy.file2.file_id)) {
      nodeMap.set(genealogy.file2.file_id, createNode(genealogy.file2, color2));
    }

    // 添加连接线
    const taskCount = genealogy.task?.task_units?.length || 0;
    links.push({
      source: genealogy.file1.file_id,
      target: genealogy.file2.file_id,
      value: genealogy.task,
      label: {
        show: true,
        position: 'middle',
        fontSize: 12,
        color: '#fff',
        backgroundColor: 'rgba(74, 144, 226, 0.95)',
        borderColor: '#4A90E2',
        borderWidth: 1.5,
        borderRadius: 4,
        padding: [6, 10],
        fontWeight: 'bold',
        shadowColor: 'rgba(74, 144, 226, 0.4)',
        shadowBlur: 8,
        rich: {
          taskCount: {
            color: '#ffd700',
            fontSize: 11,
            fontWeight: 'bold'
          }
        },
        formatter: `任务数：{taskCount|${taskCount}}`
      },
      lineStyle: {
        width: 3,
        color: 'rgba(74, 144, 226, 0.8)',
        curveness: 0.15,
        opacity: 0.85,
        type: 'solid'
      },
      symbolSize: [12, 20],
      symbol: ['circle', 'arrow'],
      smooth: true,
      emphasis: {
        lineStyle: {
          width: 4,
          color: 'rgba(74, 144, 226, 1)',
          opacity: 1
        },
        label: {
          show: true,
          fontSize: 13,
          backgroundColor: 'rgba(74, 144, 226, 1)',
          shadowBlur: 10
        }
      }
    });
  });

  return {
    nodes: Array.from(nodeMap.values()),
    links,
    categories: [{ name: 'file' }],
    fileTypeColorMap
  };
}

// 计算节点层级
function calculateNodeLevels(graphData: any): Record<number, any[]> {
  const levels: Record<number, any[]> = {};
  const visited = new Set<string>();
  const nodeLevel: Record<string, number> = {};

  const inDegree: Record<string, number> = {};
  graphData.nodes.forEach((node: any) => {
    inDegree[node.id] = 0;
  });

  graphData.links.forEach((link: any) => {
    inDegree[link.target] = (inDegree[link.target] || 0) + 1;
  });

  const queue: any[] = [];
  graphData.nodes.forEach((node: any) => {
    if (inDegree[node.id] === 0) {
      queue.push(node);
      nodeLevel[node.id] = 0;
      if (!levels[0]) levels[0] = [];
      levels[0].push(node);
    }
  });

  while (queue.length > 0) {
    const node = queue.shift();
    visited.add(node.id);

    graphData.links.forEach((link: any) => {
      if (link.source === node.id) {
        const targetNode = graphData.nodes.find((n: any) => n.id === link.target);
        if (targetNode && !visited.has(link.target)) {
          const newLevel = (nodeLevel[node.id] || 0) + 1;
          nodeLevel[link.target] = Math.max(nodeLevel[link.target] || 0, newLevel);

          if (!levels[newLevel]) levels[newLevel] = [];
          if (!levels[newLevel].includes(targetNode)) {
            levels[newLevel].push(targetNode);
          }

          queue.push(targetNode);
        }
      }
    });
  }

  // 处理孤立节点（没有入度关系的节点）
  graphData.nodes.forEach((node: any) => {
    if (!visited.has(node.id)) {
      nodeLevel[node.id] = 0;
      if (!levels[0]) levels[0] = [];
      levels[0].push(node);
    }
  });

  return levels;
}

// 渲染世系图
function renderLineageGraph(genealogyData: any[]) {
  console.log('Starting renderLineageGraph with data:', genealogyData);

  if (!lineageChartRef.value) {
    console.error('lineageChartRef is not available');
    return;
  }

  if (lineageChart.value) {
    lineageChart.value.dispose();
  }

  lineageChart.value = echarts.init(lineageChartRef.value, 'light', {
    renderer: 'canvas',
    useDirtyRect: false
  });

  const graphData = transformLineageData(genealogyData);
  console.log('Transformed graph data:', graphData);
  if (graphData.nodes.length === 0) {
    console.warn('No nodes in graph data');
    ElMessage.warning('无法生成世系图：没有有效的数据');
    return;
  }

  const levels = calculateNodeLevels(graphData);
  const nodePositions = new Map<string, [number, number]>();
  const levelWidth = 200;
  const nodeHeight = 150;

  // 获取图表容器的实际尺寸
  const containerWidth = lineageChartRef.value?.clientWidth || 800;
  const containerHeight = lineageChartRef.value?.clientHeight || 600;

  Object.entries(levels).forEach(([level, nodes]: [string, any[]]) => {
    const levelIndex = Number.parseInt(level, 10);
    
    // 对于单个节点或多个层级，分别计算位置
    if (Object.keys(levels).length === 1 && nodes.length === 1) {
      // 单个节点：居中显示
      const x = containerWidth / 2;
      const y = containerHeight / 2;
      nodePositions.set(nodes[0].id, [x, y]);
    } else {
      // 多个节点：按照层级排列
      const x = levelIndex * levelWidth + 50;
      const totalHeight = nodes.length * nodeHeight;
      const startY = containerHeight / 2 - totalHeight / 2;

      nodes.forEach((node: any, index: number) => {
        const y = startY + index * nodeHeight;
        nodePositions.set(node.id, [x, y]);
      });
    }
  });

  graphData.nodes.forEach((node: any) => {
    const pos = nodePositions.get(node.id);
    if (pos) {
      node.x = pos[0];
      node.y = pos[1];
      node.fixed = true;
    }
  });

  const option = {
    backgroundColor: 'rgba(250, 252, 255, 0.5)',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(20, 25, 40, 0.98)',
      borderColor: '#4A90E2',
      borderWidth: 2,
      textStyle: {
        color: '#fff',
        fontSize: 13,
        fontFamily: "'Segoe UI', 'Microsoft YaHei', sans-serif"
      },
      padding: [14, 18],
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const nodeData = params.data.value;
          return `
            <div style="line-height: 1.8;">
              <div style="font-size: 14px; font-weight: bold; color: #ffd700; margin-bottom: 8px;">📄 文件信息</div>
              <div style="color: #e0e0e0; font-size: 12px;">
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 文件名:</span> <span style="color: #fff; font-weight: 500;">${nodeData.file_name}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 文件类型:</span> <span style="color: #90ee90; font-weight: 500;">${nodeData.file_type}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 文件ID:</span> <span style="color: #fff;">${nodeData.file_id}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 用户:</span> <span style="color: #fff;">${nodeData.user || 'N/A'}</span></div>
              </div>
            </div>
          `;
        } else if (params.dataType === 'edge') {
          const taskData = params.data.value;
          if (!taskData) {
            return '<div style="padding: 8px; color: #e0e0e0;">无任务数据</div>';
          }
          if (!taskData.task_units || taskData.task_units.length === 0) {
            return '<div style="padding: 8px; color: #e0e0e0;">暂无任务单元信息</div>';
          }
          const taskCount = taskData.task_units.length;
          const taskUnits = taskData.task_units
            .map((u: any) => `<li style="margin: 3px 0; color: #90ee90;">✓ ${u.task_unit_name}</li>`)
            .join('');
          const timestamp = new Date(taskData.time).toLocaleString('zh-CN');
          return `
            <div style="line-height: 1.8;">
              <div style="font-size: 14px; font-weight: bold; color: #ffd700; margin-bottom: 8px;">⚙️ 任务信息</div>
              <div style="color: #e0e0e0; font-size: 12px;">
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 任务数:</span> <span style="color: #90ee90; font-weight: bold;">${taskCount}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 执行用户:</span> <span style="color: #fff;">${taskData.user || 'N/A'}</span></div>
                <div style="margin: 4px 0;"><span style="color: #87ceeb;">▸ 执行时间:</span> <span style="color: #bbb; font-size: 11px;">${timestamp}</span></div>
                <div style="margin-top: 8px;"><span style="color: #87ceeb;">▸ 任务单元:</span></div>
                <ul style="margin: 4px 0 0 16px; padding: 0; list-style: none;">
                  ${taskUnits}
                </ul>
              </div>
            </div>
          `;
        }
        return '';
      }
    },
    series: [
      {
        name: 'file',
        type: 'graph',
        layout: 'none',
        data: graphData.nodes,
        links: graphData.links,
        categories: graphData.categories,
        roam: true,
        roamDetail: {
          x: 0.3,
          y: 0.3,
          scaleX: 1,
          scaleY: 1
        },
        focusNodeAdjacency: true,
        draggable: true,
        hoverAnimation: true,
        lineStyle: {
          width: 2.5,
          color: 'rgba(180, 180, 180, 0.5)',
          curveness: 0.2,
          opacity: 0.6,
          type: 'solid'
        },
        edgeSymbol: ['circle', 'arrow'],
        edgeSymbolSize: [12, 18],
        label: {
          position: 'bottom',
          show: false
        },
        emphasis: {
          label: {
            show: true
          },
          focus: 'adjacency'
        }
      }
    ]
  };

  lineageChart.value.setOption(option);

  setTimeout(() => {
    if (lineageChart.value) {
      lineageChart.value.dispatchAction({
        type: 'restore',
        seriesIndex: 0
      });
    }
  }, 100);
}

// 暴露给父组件
defineExpose({
  showLineage,
  handleLineageDialogClose
});
</script>

<template>
  <ElDialog
    :model-value="props.modelValue"
    title="📊 文件数据世系图"
    width="90%"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :show-close="true"
    align-center
    @close="handleLineageDialogClose"
    @update:model-value="(val) => !val && handleLineageDialogClose()"
  >
    <div v-if="lineageLoading" class="lineage-overlay">
      <ElIcon class="is-loading"><i class="el-icon-loading"></i></ElIcon>
      <span style="margin-left: 8px">加载中...</span>
    </div>
    <div v-else class="lineage-container">
      <div ref="lineageChartRef" class="lineage-graph"></div>
      <div v-if="!currentFileGenealogy || !currentFileGenealogy.data.length" class="lineage-overlay">
        <span>暂无世系数据</span>
      </div>
    </div>
    <template #footer>
      <ElButton type="primary" @click="handleLineageDialogClose">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.lineage-container {
  width: 100%;
  height: 70vh;
  display: flex;
  position: relative;
  background: #fff;
}

.lineage-graph {
  flex: 1;
  height: 100%;
  min-height: 400px;
  position: relative;
  border: 2px solid #e0e7ff;
  border-radius: 12px;
  background: linear-gradient(135deg, #fafcff 0%, #f0f5ff 50%, #f5f8fd 100%);
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(74, 144, 226, 0.08), inset 0 0 20px rgba(74, 144, 226, 0.03);
}

.lineage-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  z-index: 20;
  font-size: 14px;
  pointer-events: none;
}

.lineage-overlay .is-loading {
  font-size: 24px;
  color: #409eff;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .lineage-container {
    height: 50vh;
  }

  .lineage-graph {
    min-height: 300px;
  }
}

@media (prefers-color-scheme: dark) {
  .lineage-container {
    background: var(--el-bg-color);
  }

  .lineage-graph {
    background: linear-gradient(135deg, #1a1a1a 0%, #232324 100%);
  }
}
</style>
