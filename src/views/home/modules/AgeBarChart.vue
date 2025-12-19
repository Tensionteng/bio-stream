<script setup lang="ts">
import { watch } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';

const props = defineProps<{ data: Api.Home.AgeStat[] }>();

const barGradient = {
  type: 'linear' as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: '#2563eb' },
    { offset: 1, color: '#60a5fa' }
  ]
};

function getAgeChartData(data: Api.Home.AgeStat[] | undefined) {
  if (!data || data.length === 0) {
    return { xAxisData: [] as string[], seriesData: [] as number[] };
  }

  const sorted = [...data].sort((a, b) => a.age - b.age);
  return {
    xAxisData: sorted.map(i => i.age.toString()),
    seriesData: sorted.map(i => i.count)
  };
}

const { domRef, updateOptions } = useEcharts(
  () => {
    const { xAxisData, seriesData } = getAgeChartData(props.data);
    return {
      title: {
        text: '年龄分布',
        left: 'center',
        top: 8,
        textStyle: { fontSize: 15, fontWeight: 600, color: '#1f2937' }
      },
      grid: { left: 12, right: 12, top: 46, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: 'rgba(15, 23, 42, 0.2)',
        textStyle: { color: '#ffffff' }
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.6)' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          margin: 10,
          formatter: (v: string) => {
            const val = Number(v);
            if (Number.isNaN(val)) return v;
            const absVal = Math.abs(val);
            const displayVal = Math.round(absVal);
            return val < 0 ? `${displayVal}周` : `${displayVal}岁`;
          }
        }
      },
      yAxis: {
        type: 'value',
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } }
      },
      series: [
        {
          type: 'bar',
          data: seriesData,
          barMaxWidth: 12,
          itemStyle: { color: barGradient, borderRadius: [6, 6, 2, 2] }
        }
      ],
      animationDuration: 800
    };
  },
  {
    onRender: instance => {
      instance.hideLoading();
    }
  }
);

watch(
  () => props.data,
  val => {
    if (!val) return;
    const { xAxisData, seriesData } = getAgeChartData(val);
    updateOptions(opts => {
      if (opts.xAxis && !Array.isArray(opts.xAxis)) {
        opts.xAxis.data = xAxisData;
      }
      if (opts.series && Array.isArray(opts.series)) {
        opts.series[0].data = seriesData;
      }
      return opts;
    });
  }
);
</script>

<template>
  <div class="analysis-tile">
    <div ref="domRef" class="analysis-chart"></div>
  </div>
</template>

<style scoped>
.analysis-tile {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
  padding: 8px 10px 4px;
}

.analysis-chart {
  height: 260px;
  width: 100%;
}
</style>
