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
    {
      text: '文件数量分布',
      left: '25%',
      top: 20,
      textAlign: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    {
      text: '文件体积分布',
      left: '75%',
      top: 20,
      textAlign: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    // 中心文字：总数量 (索引 2)
    {
      text: formatCount(totalCount.value),
      subtext: '总数量',
      left: '25%',
      top: '52%',
      textAlign: 'center',
      textStyle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
      subtextStyle: { fontSize: 12, color: '#999' },
      itemGap: 4
    },
    // 中心文字：总体积 (索引 3)
    {
      text: formatFileSize(totalSize.value),
      subtext: '总体积',
      left: '75%',
      top: '52%',
      textAlign: 'center',
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
      radius: ['30%', '50%'], // 初始值，后续会被 watch 覆盖
      center: ['25%', '55%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [] as any[]
    },
    {
      name: 'Size',
      type: 'pie',
      minAngle: 5,
      radius: ['30%', '50%'], // 初始值，后续会被 watch 覆盖
      center: ['75%', '55%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [] as any[]
    }
  ]
}));

// --- 核心逻辑：自适应计算 ---
const { width: containerWidth } = useElementSize(domRef);

// 根据容器宽度计算合适的字号
function getResponsiveFontSize(width: number) {
  const baseSize = width / 25;
  return Math.min(Math.max(baseSize, 14), 28);
}

// 根据容器宽度计算合适的饼图半径（防止重叠）
function getResponsiveChartParams(width: number) {
  // 两个饼图的中心分别在 25% 和 75%，间距为 50% 的宽度。
  // 为了不重叠，最大半径不能超过宽度的 25%。
  // 这里我们取宽度的 20% 作为外径，留一些余地。
  let outerRadius = width / 5;
  // 设置一个最大和最小像素值，防止过大或过小
  outerRadius = Math.min(Math.max(outerRadius, 60), 130);

  // 内径取外径的 60%
  const innerRadius = outerRadius * 0.6;

  return {
    radius: [innerRadius, outerRadius]
  };
}

// 监听容器宽度变化，更新字号和图表尺寸
watch(containerWidth, newWidth => {
  if (newWidth > 0) {
    const newFontSize = getResponsiveFontSize(newWidth);
    const subTextSize = Math.max(newFontSize * 0.5, 10);
    const { radius } = getResponsiveChartParams(newWidth);

    updateOptions(opts => {
      if (Array.isArray(opts.title)) {
        // 更新总数量字号
        opts.title[2].textStyle = { ...opts.title[2].textStyle, fontSize: newFontSize };
        opts.title[2].subtextStyle = {
          ...opts.title[2].subtextStyle,
          fontSize: subTextSize,
          color: opts.title[2].subtextStyle?.color ?? '#999'
        };

        // 更新总体积字号
        opts.title[3].textStyle = { ...opts.title[3].textStyle, fontSize: newFontSize };
        opts.title[3].subtextStyle = {
          ...opts.title[3].subtextStyle,
          fontSize: subTextSize,
          color: opts.title[3].subtextStyle?.color ?? '#999'
        };
      }

      // 更新两个饼图的半径
      opts.series[0].radius = radius.map(r => `${r}px`);
      opts.series[1].radius = radius.map(r => `${r}px`);

      return opts;
    });
  }
});
// ------------------------------

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
      if (w > 0) {
        const size = getResponsiveFontSize(w);
        const { radius } = getResponsiveChartParams(w);

        updateOptions(opts => {
          if (Array.isArray(opts.title)) {
            opts.title[2].textStyle = { ...opts.title[2].textStyle, fontSize: size };
            opts.title[3].textStyle = { ...opts.title[3].textStyle, fontSize: size };
          }
          opts.series[0].radius = radius.map(r => `${r}px`);
          opts.series[1].radius = radius.map(r => `${r}px`);
          return opts;
        });
      }
    }
  });
}

init();
</script>

<template>
  <ElCard class="card-wrapper">
    <div ref="domRef" class="h-360px overflow-hidden"></div>
  </ElCard>
</template>

<style scoped></style>
