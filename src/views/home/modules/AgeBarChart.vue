<script setup lang="ts">
import { watch } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';

type AgeStat = { age: number; count: number; desc?: string };

const props = defineProps<{ data: AgeStat[] }>();

const COLOR_PRE = '#2dd4bf';
const COLOR_POST = '#3b82f6';

// --- 1. 新增：用于存储“真实数量”的映射，供 Tooltip 显示使用 ---
let currentRealCountMap: Record<string, number> = {};
// 原有的描述映射
let currentDescMap: Record<string, string[]> = {};

function movingAverageWithNull(arr: Array<number | null>, window = 2) {
  const res = Array.from<number | null>({ length: arr.length }).fill(null);
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

function getDensityChartData(data: AgeStat[] | undefined, smoothWindow = 2) {
  if (!data || data.length === 0) {
    return { xAxisData: [], preData: [], postData: [], descMap: {}, realCountMap: {} };
  }

  const bucket = new Map<number, number>();
  const descBucket = new Map<number, string[]>();

  for (const item of data) {
    const k = Math.round(item.age);
    bucket.set(k, (bucket.get(k) || 0) + (item.count || 0));
    if (item.desc) {
      const list = descBucket.get(k) || [];
      list.push(item.desc);
      descBucket.set(k, list);
    }
  }

  const keys = [...bucket.keys()];
  const minK = Math.min(...keys);
  const maxK = Math.max(...keys);

  const xAxisData: string[] = [];
  const allCounts: number[] = [];
  const descMap: Record<string, string[]> = {};

  // --- 2. 新增：构建真实数据的 Map ---
  const realCountMap: Record<string, number> = {};

  for (let k = minK; k <= maxK; k += 1) {
    const kStr = String(k);
    xAxisData.push(kStr);

    // 获取真实数量
    const realCount = bucket.get(k) || 0;
    allCounts.push(realCount);

    // 存入 Map
    realCountMap[kStr] = realCount;

    if (descBucket.has(k)) {
      descMap[kStr] = descBucket.get(k)!;
    }
  }

  const preRaw: Array<number | null> = [];
  const postRaw: Array<number | null> = [];

  for (let i = 0; i < allCounts.length; i += 1) {
    const age = Number(xAxisData[i]);
    const c = allCounts[i];
    preRaw.push(age <= 0 ? c : null);
    postRaw.push(age >= 0 ? c : null);
  }

  // 这里生成的 preData/postData 是平滑后的小数，用于 Series 绘图（画线）
  const preData = movingAverageWithNull(preRaw, smoothWindow);
  const postData = movingAverageWithNull(postRaw, smoothWindow);

  // 返回包含了 realCountMap 的结果
  return { xAxisData, preData, postData, descMap, realCountMap };
}

const { domRef, updateOptions } = useEcharts(
  () => {
    // 解构出 realCountMap
    const { xAxisData, preData, postData, descMap, realCountMap } = getDensityChartData(props.data, 2);

    // 更新外部变量
    currentDescMap = descMap;
    currentRealCountMap = realCountMap; // 更新真实数据引用

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
      grid: { left: '3%', right: '4%', top: '15%', bottom: '15%', containLabel: true },

      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#1e293b' },
        formatter: (params: any) => {
          const axisValueStr = params?.[0]?.axisValue;
          const axisValue = Number(axisValueStr ?? 0);
          const age = Math.round(axisValue);
          const realVal = currentRealCountMap[axisValueStr] || 0;

          const label = age < 0 ? `胎龄: ${Math.abs(age)} 周` : `年龄: ${age} 岁`;
          const color = age < 0 ? COLOR_PRE : COLOR_POST;

          const descList = currentDescMap[axisValueStr] || [];
          let descHtml = '';

          if (descList.length > 0) {
            const displayList = descList.slice(0, 5);
            const moreCount = descList.length - 5;
            const listHtml = displayList.map(d => `<div style="margin-bottom:2px;">• ${d}</div>`).join('');
            const moreHtml =
              moreCount > 0 ? `<div style="color:#94a3b8;font-size:11px">...还有 ${moreCount} 项</div>` : '';
            descHtml = `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:12px;color:#64748b;line-height:1.4;max-width:220px;white-space:normal;"><div style="margin-bottom:4px;font-weight:600;color:#94a3b8">相关描述:</div>${listHtml}${moreHtml}</div>`;
          }

          // --- 3. 显示修改：使用 realVal ---
          return `
            <div style="padding: 4px">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 4px">样本分布详情</div>
              <div style="display: flex; align-items: center; gap: 8px">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color}"></span>
                <b style="font-size: 14px">${label}</b>
                <span style="color: #64748b; margin-left: 8px">数量: ${realVal}</span>
              </div>
              ${descHtml}
            </div>`;
        }
      },
      xAxis: {
        /* ...保持不变... */ type: 'category',
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
        /* ...保持不变... */ type: 'value',
        axisLabel: { formatter: (v: number) => Math.round(v).toString() },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
      },
      series: [
        {
          name: '出生前 (孕周)',
          type: 'line',
          smooth: true,
          // Series 里继续使用 preData (平滑后数据) 以保证曲线圆润
          data: preData,
          // ... 样式保持不变 ...
          showSymbol: false,
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
          // Series 里继续使用 postData (平滑后数据)
          data: postData,
          // ... 样式保持不变 ...
          showSymbol: false,
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

    // 重新计算时，解构出 realCountMap
    const { xAxisData, preData, postData, descMap, realCountMap } = getDensityChartData(val, 2);

    currentDescMap = descMap;
    currentRealCountMap = realCountMap;

    updateOptions(opts => {
      const xAxis = Array.isArray(opts.xAxis) ? opts.xAxis[0] : opts.xAxis;
      xAxis.data = xAxisData;
      (opts.series as any[])[0].data = preData; // 图表还是用平滑后的
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
/* 样式保持不变 */
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
