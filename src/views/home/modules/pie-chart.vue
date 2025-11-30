<script setup lang="ts">
import { ref, watch } from 'vue';
import { fetchFileTypes } from '@/service/api/home';
import { useAppStore } from '@/store/modules/app';
import { useEcharts } from '@/hooks/common/echarts';
import { $t } from '@/locales';

defineOptions({ name: 'PieChart' });

const appStore = useAppStore();
const loading = ref(true);
const fileTypeData = ref<Api.Home.FileType[]>([]);

const { domRef, updateOptions } = useEcharts(() => ({
  title: {
    text: $t('page.home.fileTypesOverview'),
    subtext: $t('page.home.fileTypesDescription'),
    left: 'center',
    top: 20,
    textStyle: {
      fontSize: 16,
      fontWeight: 'bold'
    },
    subtextStyle: {
      fontSize: 12,
      color: '#666'
    }
  },
  tooltip: {
    trigger: 'item',
    formatter: '{a} <br/>{b} : {c} ({d}%)'
  },
  legend: {
    bottom: '10px',
    left: 'center',
    itemStyle: {
      borderWidth: 0
    },
    textStyle: {
      fontSize: 12
    }
  },
  series: [
    {
      color: ['#5da8ff', '#8e9dff', '#fedc69', '#26deca', '#ff7875', '#52c41a', '#fa8c16', '#722ed1'],
      name: $t('page.home.fileTypes'),
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}: {c}',
        fontSize: 11
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 12,
          fontWeight: 'bold'
        }
      },
      labelLine: {
        show: true,
        length: 15,
        length2: 10
      },
      data: [] as { name: string; value: number }[]
    }
  ]
}));

async function fetchData() {
  try {
    loading.value = true;
    const { data } = await fetchFileTypes();
    fileTypeData.value = data?.file_types || [];

    updateOptions(opts => {
      opts.series[0].data = fileTypeData.value.map(item => ({
        name: item.file_type_name,
        value: item.count
      }));
      return opts;
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('获取文件类型统计失败:', error);
    // 使用空数据
    updateOptions(opts => {
      opts.series[0].data = [];
      return opts;
    });
  } finally {
    loading.value = false;
  }
}

function updateLocale() {
  updateOptions((opts, factory) => {
    const originOpts = factory();
    opts.series[0].name = originOpts.series[0].name;
    opts.series[0].data = fileTypeData.value.map(item => ({
      name: item.file_type_name,
      value: item.count
    }));
    return opts;
  });
}

async function init() {
  await fetchData();
}

watch(
  () => appStore.locale,
  () => {
    updateLocale();
  }
);

// init
init();
</script>

<template>
  <ElCard class="card-wrapper">
    <div ref="domRef" class="h-600px overflow-hidden pb-2"></div>
  </ElCard>
</template>

<style scoped></style>
