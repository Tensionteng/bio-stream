<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { fetchFileTypes } from '@/service/api/home';
import { useAppStore } from '@/store/modules/app';
import { useEcharts } from '@/hooks/common/echarts';
import { $t } from '@/locales';

defineOptions({ name: 'PieChart' });

const appStore = useAppStore();
const loading = ref(true);

// 数据定义
const fileTypeData = ref<Api.Home.FileType[]>([]);
const totalCount = ref(0);
const totalSize = ref(0);

// --- 核心配置：统一垂直中心位置 ---
// 原来是 52%，改为 45% 让图表整体上移，靠近上方标题
const CENTER_Y = '52%';

// 工具函数：格式化文件大小
function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

// 工具函数：格式化数字
function formatCount(num: number) {
  return num.toLocaleString();
}

const { domRef, updateOptions } = useEcharts(() => ({
  // 初始配置
  title: [
    // 0. 左上标题
    {
      text: '文件数量分布',
      left: '25%',
      top: 30,
      textAlign: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    // 1. 右上标题
    {
      text: '文件体积分布',
      left: '75%',
      top: 30,
      textAlign: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    // 2. 左侧中心文字：总数量
    {
      text: formatCount(totalCount.value),
      subtext: '总数量',
      left: '25%',
      top: CENTER_Y, // 【修改】与圆心一致
      textAlign: 'center',
      textVerticalAlign: 'middle', // 【修改】垂直居中
      textStyle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
      subtextStyle: { fontSize: 12, color: '#999' },
      itemGap: 4
    },
    // 3. 右侧中心文字：总体积
    {
      text: formatFileSize(totalSize.value),
      subtext: '总体积',
      left: '75%',
      top: CENTER_Y, // 【修改】与圆心一致
      textAlign: 'center',
      textVerticalAlign: 'middle', // 【修改】垂直居中
      textStyle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
      subtextStyle: { fontSize: 12, color: '#999' },
      itemGap: 4
    }
  ],
  tooltip: {
    trigger: 'item',
    formatter: (params: any) => {
      const isSizeChart = params.seriesIndex === 1;
      const valueStr = isSizeChart ? formatFileSize(params.value) : formatCount(params.value);
      return `${params.marker} ${params.name}<br/>${valueStr} (${params.percent}%)`;
    }
  },
  series: [
    {
      name: 'Count',
      type: 'pie',
      minAngle: 5,
      radius: ['30%', '50%'],
      center: ['25%', CENTER_Y], // 【修改】上移圆心
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [] as any[]
    },
    {
      name: 'Size',
      type: 'pie',
      minAngle: 5,
      radius: ['30%', '50%'],
      center: ['75%', CENTER_Y], // 【修改】上移圆心
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [] as any[]
    }
  ]
}));

// --- 核心逻辑：自适应计算 ---
const { width: containerWidth, height: containerHeight } = useElementSize(domRef);

// 根据容器宽度计算合适的字号
function getResponsiveFontSize(width: number, height: number) {
  const baseSize = Math.min(width, height) / 14;
  return Math.min(Math.max(baseSize, 14), 28);
}

// 根据容器宽度计算合适的饼图半径（防止重叠）
function getResponsiveChartParams(width: number, height: number) {
  let outerRadius = Math.min(width * 0.26, height * 0.4);
  outerRadius = Math.min(Math.max(outerRadius, 70), 155);
  const innerRadius = outerRadius * 0.6;

  return {
    radius: [innerRadius, outerRadius]
  };
}

// 监听容器变化，更新字号、图表尺寸以及保持数据同步
watch([containerWidth, containerHeight], ([newWidth, newHeight]) => {
  if (newWidth > 0 && newHeight > 0) {
    const newFontSize = getResponsiveFontSize(newWidth, newHeight);
    const subTextSize = Math.max(newFontSize * 0.5, 10);
    const { radius } = getResponsiveChartParams(newWidth, newHeight);

    updateOptions(opts => {
      // 1. 更新标题和字号
      if (Array.isArray(opts.title)) {
        opts.title[2].text = formatCount(totalCount.value);
        opts.title[2].textStyle = { ...opts.title[2].textStyle, fontSize: newFontSize };
        opts.title[2].top = CENTER_Y; // 【关键】保持位置一致
        opts.title[2].subtextStyle = {
          ...opts.title[2].subtextStyle,
          fontSize: subTextSize,
          color: opts.title[2].subtextStyle?.color ?? '#999'
        };

        opts.title[3].text = formatFileSize(totalSize.value);
        opts.title[3].textStyle = { ...opts.title[3].textStyle, fontSize: newFontSize };
        opts.title[3].top = CENTER_Y; // 【关键】保持位置一致
        opts.title[3].subtextStyle = {
          ...opts.title[3].subtextStyle,
          fontSize: subTextSize,
          color: opts.title[3].subtextStyle?.color ?? '#999'
        };
      }

      // 2. 更新两个饼图的半径
      opts.series[0].radius = radius.map(r => `${r}px`);
      opts.series[1].radius = radius.map(r => `${r}px`);

      // 【关键】确保 resize 时圆心位置也是修正后的位置
      opts.series[0].center = ['25%', CENTER_Y];
      opts.series[1].center = ['75%', CENTER_Y];

      // 3. 数据同步
      opts.series[0].data = fileTypeData.value.map(item => ({
        name: item.file_type_name,
        value: item.count
      }));
      opts.series[1].data = fileTypeData.value.map(item => ({
        name: item.file_type_name,
        value: item.size
      }));

      return opts;
    });
  }
});

async function fetchData() {
  try {
    loading.value = true;
    const { data } = await fetchFileTypes();

    if (data) {
      fileTypeData.value = data.file_types || [];
      totalCount.value = data.total_count || 0;
      totalSize.value = data.total_size || 0;

      updateOptions(opts => {
        opts.series[0].data = fileTypeData.value.map(item => ({ name: item.file_type_name, value: item.count }));
        opts.series[1].data = fileTypeData.value.map(item => ({ name: item.file_type_name, value: item.size }));

        if (Array.isArray(opts.title)) {
          opts.title[2].text = formatCount(totalCount.value);
          opts.title[3].text = formatFileSize(totalSize.value);
        }
        return opts;
      });
    }
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
}

function updateLocale() {
  updateOptions(opts => {
    if (Array.isArray(opts.title)) {
      opts.title[0].text = $t('page.home.fileTypesOverview');
    }
    return opts;
  });
}

watch(() => appStore.locale, updateLocale);

async function init() {
  await fetchData();
  // 初始化时手动触发一次计算
  nextTick(() => {
    if (domRef.value) {
      const w = domRef.value.clientWidth;
      const h = domRef.value.clientHeight;
      if (w > 0 && h > 0) {
        const size = getResponsiveFontSize(w, h);
        const { radius } = getResponsiveChartParams(w, h);

        updateOptions(opts => {
          if (Array.isArray(opts.title)) {
            opts.title[2].textStyle = { ...opts.title[2].textStyle, fontSize: size };
            opts.title[3].textStyle = { ...opts.title[3].textStyle, fontSize: size };
            // 【关键】初始化时也要使用统一的 Y 轴
            opts.title[2].top = CENTER_Y;
            opts.title[3].top = CENTER_Y;
          }
          opts.series[0].radius = radius.map(r => `${r}px`);
          opts.series[1].radius = radius.map(r => `${r}px`);
          // 【关键】初始化时也要使用统一的 Y 轴
          opts.series[0].center = ['25%', CENTER_Y];
          opts.series[1].center = ['75%', CENTER_Y];
          return opts;
        });
      }
    }
  });
}

init();
</script>

<template>
  <ElCard class="pie-chart-card card-wrapper">
    <div ref="domRef" class="pie-chart-content overflow-hidden"></div>
  </ElCard>
</template>

<style scoped>
.pie-chart-card {
  height: 100%;
}

.pie-chart-card :deep(.el-card__body) {
  height: 100%;
  padding: 12px 16px 10px;
}

.pie-chart-content {
  width: 100%;
  height: 100%;
  min-height: 260px;
}
</style>
