<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core'; // Soybean Admin 默认包含 VueUse
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

// 工具函数：格式化文件大小 (字节 -> 文本)
function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

// 工具函数：格式化数字 (1000 -> 1,000)
function formatCount(num: number) {
  return num.toLocaleString();
}

const { domRef, updateOptions } = useEcharts(() => ({
  // 初始配置，具体的 fontSize 会在 adjustFontSize 中被覆盖
  title: [
    // 左侧标题：数量
    {
      text: '文件数量分布',
      left: '25%',
      top: 20,
      textAlign: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    // 右侧标题：体积
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
      top: '52%', // 稍微微调垂直位置以居中
      textAlign: 'center',
      textStyle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
      subtextStyle: { fontSize: 12, color: '#999' },
      itemGap: 4 // 主副标题间距
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
      radius: ['45%', '70%'],
      center: ['25%', '55%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [] as any[]
    },
    {
      name: 'Size',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['75%', '55%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [] as any[]
    }
  ]
}));

// --- 核心逻辑：自适应字号计算 ---
const { width: containerWidth } = useElementSize(domRef);

// 根据容器宽度计算合适的字号
function getResponsiveFontSize(width: number) {
  // 基础逻辑：宽度越小，字号越小。
  // 假设 600px 宽时用 24px 字号，最小不小于 14px，最大不超过 30px
  const baseSize = width / 25;
  return Math.min(Math.max(baseSize, 14), 28);
}

// 监听容器宽度变化，更新字号
watch(containerWidth, newWidth => {
  if (newWidth > 0) {
    const newFontSize = getResponsiveFontSize(newWidth);
    const subTextSize = Math.max(newFontSize * 0.5, 10); // 副标题约为一半大小

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
          // 使用 formatCount 添加千分位
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
    // 刷新多语言
    if (Array.isArray(opts.title)) {
      opts.title[0].text = $t('page.home.fileTypesOverview');
    }
    return opts;
  });
}

watch(() => appStore.locale, updateLocale);

async function init() {
  await fetchData();
  // 初始化时手动触发一次字号计算，确保渲染正确
  nextTick(() => {
    if (domRef.value) {
      const w = domRef.value.clientWidth;
      if (w > 0) {
        const size = getResponsiveFontSize(w);
        updateOptions(opts => {
          if (Array.isArray(opts.title)) {
            opts.title[2].textStyle = { ...opts.title[2].textStyle, fontSize: size };
            opts.title[3].textStyle = { ...opts.title[3].textStyle, fontSize: size };
          }
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
