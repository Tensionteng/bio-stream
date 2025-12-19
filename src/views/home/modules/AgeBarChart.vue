<script setup lang="ts">
import { watch } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';

type AgeStat = { age: number; count: number; desc?: string };

const props = defineProps<{ data: AgeStat[] }>();

/** 颜色常量定义，确保图表、图例、提示框颜色完全统一 */
const COLOR_PRE = '#2dd4bf'; // 出生前 - 青绿色
const COLOR_POST = '#3b82f6'; // 出生后 - 蓝色

/** 移动平均（支持 null，null 代表该点不属于该系列） */
function movingAverageWithNull(arr: Array<number | null>, window = 2) {
  const res: Array<number | null> = Array.from({ length: arr.length }).fill(null);

  for (let i = 0; i < arr.length; i += 1) {
    const current = arr[i];
    if (typeof current !== 'number') {
      res[i] = null;
    } else {
      let sum = 0;
      let n = 0;
      for (let j = i - window; j <= i + window; j += 1) {
        const v = arr[j];
        if (typeof v === 'number') {
          sum += v;
          n += 1;
        }
      }
      res[i] = n > 0 ? sum / n : current;
    }
  }
  return res;
}

/**
 * 处理数据：
 *
 * 1. 将小数 age 按整数桶聚合（Math.round）
 * 2. 补齐 x 轴缺失桶（缺失 count=0）
 * 3. 拆分出生前/出生后两条曲线（在 0 处“相接”）
 * 4. 可选平滑（移动平均），视觉上更像“密度趋势”
 */
function getDensityChartData(data: AgeStat[] | undefined, smoothWindow = 2) {
  if (!data || data.length === 0) return { xAxisData: [], preData: [], postData: [] };

  // 1) 按整数桶聚合：同一个桶（如 -21）把 count 累加
  const bucket = new Map<number, number>();
  for (const item of data) {
    const k = Math.round(item.age);
    bucket.set(k, (bucket.get(k) || 0) + (item.count || 0));
  }

  // 2) 生成连续 x 轴并补齐缺失桶
  const keys = [...bucket.keys()];
  const minK = Math.min(...keys);
  const maxK = Math.max(...keys);

  const xAxisData: string[] = [];
  const allCounts: number[] = [];

  for (let k = minK; k <= maxK; k += 1) {
    xAxisData.push(String(k));
    allCounts.push(bucket.get(k) || 0);
  }

  // 3) 拆分出生前/出生后
  const preRaw: Array<number | null> = [];
  const postRaw: Array<number | null> = [];

  for (let i = 0; i < allCounts.length; i += 1) {
    const age = Number(xAxisData[i]);
    const c = allCounts[i];

    preRaw.push(age <= 0 ? c : null);
    postRaw.push(age >= 0 ? c : null);
  }

  // 4) 平滑
  const preData = movingAverageWithNull(preRaw, smoothWindow);
  const postData = movingAverageWithNull(postRaw, smoothWindow);

  return { xAxisData, preData, postData };
}

const { domRef, updateOptions } = useEcharts(
  () => {
    const { xAxisData, preData, postData } = getDensityChartData(props.data, 2);

    return {
      title: {
        text: '年龄分布密度图',
        left: 'center',
        top: 10,
        textStyle: { fontSize: 16, fontWeight: 600, color: '#334155' }
      },
      legend: {
        bottom: 10,
        icon: 'roundRect',
        itemGap: 25,
        textStyle: { color: '#64748b' },
        data: [
          { name: '出生前 (孕周)', itemStyle: { color: COLOR_PRE } },
          { name: '出生后 (周岁)', itemStyle: { color: COLOR_POST } }
        ]
      },
      grid: {
        left: '3%',
        right: '4%',
        top: '15%',
        bottom: '15%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#1e293b' },
        formatter: (params: any) => {
          // params 会包含两条 series，选有值的那条
          const axisValue = Number(params?.[0]?.axisValue ?? 0);
          const age = Math.round(axisValue);

          const p0 = params?.[0];
          const p1 = params?.[1];
          const val = (p0?.value ?? p1?.value ?? 0) as number;

          const label = age < 0 ? `胎龄: ${Math.abs(age)} 周` : `年龄: ${age} 岁`;
          const color = age < 0 ? COLOR_PRE : COLOR_POST;

          return `
            <div style="padding: 4px">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 4px">样本分布详情</div>
              <div style="display: flex; align-items: center; gap: 8px">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color}"></span>
                <b style="font-size: 14px">${label}</b>
                <span style="color: #64748b; margin-left: 8px">数量: ${Math.round(val)}</span>
              </div>
            </div>`;
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisData,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          interval: 'auto',
          formatter: (v: string) => {
            const val = Math.round(Number(v));
            if (val === 0) return '出生';
            return val < 0 ? `${Math.abs(val)}周` : `${val}岁`;
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number) => Math.round(v).toString() },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
      },
      series: [
        {
          name: '出生前 (孕周)',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: preData,
          lineStyle: { width: 3, color: COLOR_PRE },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(45, 212, 191, 0.4)' },
                { offset: 1, color: 'rgba(45, 212, 191, 0.05)' }
              ]
            }
          }
        },
        {
          name: '出生后 (周岁)',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: postData,
          lineStyle: { width: 3, color: COLOR_POST },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
              ]
            }
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: true, position: 'end', formatter: '分界', fontSize: 10 },
            lineStyle: { color: '#94a3b8', type: 'dashed' },
            data: [{ xAxis: '0' }]
          }
        }
      ]
    };
  },
  { onRender: instance => instance.hideLoading() }
);

watch(
  () => props.data,
  val => {
    if (!val) return;

    const { xAxisData, preData, postData } = getDensityChartData(val, 2);

    updateOptions(opts => {
      // xAxis 可能是对象，也可能是数组，这里做个兼容处理
      const xAxis = Array.isArray(opts.xAxis) ? opts.xAxis[0] : opts.xAxis;
      xAxis.data = xAxisData;

      (opts.series as any[])[0].data = preData;
      (opts.series as any[])[1].data = postData;

      return opts;
    });
  },
  { deep: true }
);
</script>

<template>
  <div class="density-card">
    <div ref="domRef" class="analysis-chart"></div>
  </div>
</template>

<style scoped>
.density-card {
  width: 100%;
  background: #ffffff;
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
  border: 1px solid #f1f5f9;
}

.analysis-chart {
  width: 100%;
  height: 380px;
}
</style>
