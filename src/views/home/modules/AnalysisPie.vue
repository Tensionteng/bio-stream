<script setup lang="ts">
import { watch } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';

const props = defineProps<{
  title: string;
  data: { name: string; value: number }[];
  showValue?: boolean;
}>();

/** 优化后的专业色盘 采用邻近色系：深蓝、海蓝、青色、翠绿 这种配色比之前的 15 色更加沉稳，符合第二个案例的审美 */
const palette = [
  '#5c7bd9', // 蓝色
  '#e86868', // 红色
  '#54b280', // 绿色
  '#79c4e3', // 浅蓝
  '#f7c95c', // 黄色
  '#e587d1' // 粉色
];
const { domRef, updateOptions } = useEcharts(
  () => ({
    color: palette,
    // 彻底移除 title 配置中的中心文字
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: [10, 14],
      extraCssText: 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-radius: 8px;',
      formatter: (params: any) => {
        const valStr =
          props.showValue !== false
            ? `<br/><span style="font-weight:600;color:#3b82f6">数量: ${params.value}</span>`
            : '';
        return `<div style="margin-bottom:4px;font-size:12px;color:#64748b">${params.seriesName}</div>
                <div style="display:flex;align-items:center;gap:8px">
                  ${params.marker} <b style="margin-left:4px">${params.name}</b> ${valStr} (${params.percent}%)
                </div>`;
      }
    },
    legend: {
      bottom: '2%',
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: '#64748b', fontSize: 12 }
    },
    series: [
      {
        name: props.title,
        type: 'pie',
        // 优化半径比例：45%-70% 看起来比之前的更厚实、专业
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        // 减小间隙（padAngle），增加整体感
        padAngle: 1.5,
        itemStyle: {
          // 减小圆角，从 12px 改为 4px，更符合第二个图表的硬朗风格
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: {
            shadowBlur: 15,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          }
        },
        label: {
          // 默认不显示外部标签，保持页面简洁；如需显示，可设为 props.showValue
          show: false,
          position: 'outside',
          formatter: '{b}: {c}',
          fontSize: 12,
          color: '#64748b'
        },
        labelLine: {
          show: false,
          smooth: true,
          length: 15,
          length2: 10
        },
        data: props.data
      }
    ],
    animationDuration: 1000,
    animationEasing: 'cubicOut'
  }),
  {
    onRender: instance => {
      instance.hideLoading();
    }
  }
);

// 监听数据变化同步更新
watch(
  () => props.data,
  val =>
    updateOptions(opts => {
      if (opts.series && Array.isArray(opts.series)) {
        opts.series[0].data = val;
      }
      return opts;
    })
);
</script>

<template>
  <div class="analysis-card">
    <div class="card-header">
      <span class="accent-bar"></span>
      <h4 class="title-text">{{ title }}</h4>
    </div>

    <div ref="domRef" class="analysis-chart"></div>
  </div>
</template>

<style scoped>
.analysis-card {
  width: 100%;
  height: 100%;
  border-radius: 12px; /* 稍微缩小了大卡片的圆角，更显精致 */
  background: #ffffff;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.05),
    0 4px 6px rgba(0, 0, 0, 0.02);
  border: 1px solid #f1f5f9;
  padding: 24px;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.analysis-card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.accent-bar {
  width: 4px;
  height: 16px;
  background: #3b82f6; /* 改为纯色，减少花哨感 */
  border-radius: 2px;
  margin-right: 10px;
}

.title-text {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.analysis-chart {
  flex: 1;
  min-height: 380px; /* 适度调整高度 */
  width: 100%;
}
</style>
