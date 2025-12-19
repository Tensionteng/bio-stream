<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  fetchSampleAge,
  fetchSampleDisease,
  fetchSampleGenomics,
  fetchSampleSex,
  fetchSampleSource,
  fetchSampleTissue
} from '@/service/api/home';
import { useAppStore } from '@/store/modules/app';
import CardData from './modules/card-data.vue';
import PieChart from './modules/pie-chart.vue';
import ProjectNews from './modules/project-news.vue';
import CurrentPermissions from './modules/current-permissions.vue';
import AnalysisPie from './modules/AnalysisPie.vue';
import AgeBarChart from './modules/AgeBarChart.vue';

const pipelineImage = new URL('@/assets/imgs/pipeline.jpg', import.meta.url).href;
useAppStore();

// 定义图表数据状态
const sourceData = ref<{ name: string; value: number }[]>([]);
const tissueData = ref<{ name: string; value: number }[]>([]);
const sexData = ref<{ name: string; value: number }[]>([]);
const diseaseData = ref<{ name: string; value: number }[]>([]);
const genomicsData = ref<{ name: string; value: number }[]>([]);
const ageData = ref<Api.Home.AgeStat[]>([]);
const loading = ref(false);
const analysisTab = ref<'source' | 'sex' | 'genomics'>('source');

/**
 * 修复逻辑说明：
 *
 * 1. 使用可选链 ?. 确保数据安全访问。
 * 2. 访问 data.data，因为接口定义的结构是 { data: { data: [] } }。
 * 3. 为 map 的参数添加类型定义，解决 "implicit any" 错误。
 */
async function initData() {
  loading.value = true;
  try {
    const [s, t, sex, d, g, a] = await Promise.all([
      fetchSampleSource(),
      fetchSampleTissue(),
      fetchSampleSex(),
      fetchSampleDisease(),
      fetchSampleGenomics(),
      fetchSampleAge()
    ]);
    console.log(s);
    // 样本库来源 - 访问 .data.data
    sourceData.value =
      s.data?.map((i: Api.Home.SampleStat) => ({
        name: i.name,
        value: i.count
      })) || [];

    // 组织来源
    tissueData.value =
      t.data?.map((i: Api.Home.SampleStat) => ({
        name: i.name,
        value: i.count
      })) || [];

    // 性别占比
    sexData.value =
      sex.data?.map((i: Api.Home.SampleStat) => ({
        name: i.name,
        value: i.count
      })) || [];

    // 疾病占比
    diseaseData.value =
      d.data?.map((i: Api.Home.SampleStat) => ({
        name: i.name,
        value: i.count
      })) || [];

    // 组学占比 - 这里的数量只是比例，界面会通过 AnalysisPie 隐藏数值
    genomicsData.value =
      g.data?.map((i: Api.Home.SampleStat) => ({
        name: i.name,
        value: i.count
      })) || [];

    // 年龄分布
    ageData.value = a.data || [];
  } catch (error) {
    console.error('获取数据失败:', error);
  } finally {
    loading.value = false;
  }
}

onMounted(initData);
</script>

<template>
  <ElSpace direction="vertical" fill class="w-full bg-[#f6f9f8] pb-6" :size="16">
    <CardData class="w-full" />

    <div class="flex flex-col gap-4 px-4">
      <ElRow :gutter="16" class="items-stretch">
        <ElCol :lg="16" :md="24">
          <PieChart class="h-full" />
        </ElCol>
        <ElCol :lg="8" :md="24">
          <ElCard
            class="h-full border-0 rounded-xl shadow-sm"
            shadow="hover"
            :body-style="{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }"
          >
            <img
              :src="pipelineImage"
              alt="产品架构图"
              class="max-h-64 object-contain transition-transform hover:scale-105"
            />
          </ElCard>
        </ElCol>
      </ElRow>

      <ElRow :gutter="16" class="items-stretch">
        <ElCol :lg="16" :md="24">
          <ElCard class="analysis-section-card h-full" shadow="hover">
            <template #header>
              <div class="analysis-header">
                <span class="analysis-title">样本数据分析</span>
                <ElRadioGroup v-model="analysisTab" size="small" class="analysis-switch">
                  <ElRadioButton label="source">样本库/组织</ElRadioButton>
                  <ElRadioButton label="sex">性别/疾病</ElRadioButton>
                  <ElRadioButton label="genomics">组学/年龄</ElRadioButton>
                </ElRadioGroup>
              </div>
            </template>

            <div v-loading="loading" class="analysis-content">
              <ElRow v-if="analysisTab === 'source'" :gutter="16" class="analysis-grid">
                <ElCol :md="12" :sm="24" class="analysis-col">
                  <AnalysisPie title="样本库来源占比" :data="sourceData" />
                </ElCol>
                <ElCol :md="12" :sm="24" class="analysis-col">
                  <AnalysisPie title="组织来源占比" :data="tissueData" />
                </ElCol>
              </ElRow>

              <ElRow v-if="analysisTab === 'sex'" :gutter="16" class="analysis-grid">
                <ElCol :md="12" :sm="24" class="analysis-col">
                  <AnalysisPie title="性别占比" :data="sexData" />
                </ElCol>
                <ElCol :md="12" :sm="24" class="analysis-col">
                  <AnalysisPie title="疾病占比" :data="diseaseData" />
                </ElCol>
              </ElRow>

              <ElRow v-if="analysisTab === 'genomics'" :gutter="16" class="analysis-grid">
                <ElCol :md="12" :sm="24" class="analysis-col">
                  <AnalysisPie title="组学占比" :data="genomicsData" :show-value="false" />
                </ElCol>
                <ElCol :md="12" :sm="24" class="analysis-col">
                  <AgeBarChart :data="ageData" />
                </ElCol>
              </ElRow>
            </div>
          </ElCard>
        </ElCol>

        <ElCol :lg="8" :md="24">
          <div class="h-full flex flex-col gap-4">
            <ProjectNews class="min-h-300px flex-1 shadow-sm" />
            <CurrentPermissions class="shadow-sm" />
          </div>
        </ElCol>
      </ElRow>
    </div>
  </ElSpace>
</template>

<style scoped>
.analysis-section-card {
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, #ffffff 48%, #ffffff 100%);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
}

.analysis-section-card :deep(.el-card__header) {
  padding: 14px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.analysis-section-card :deep(.el-card__body) {
  padding: 16px 18px 18px;
}

.analysis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.analysis-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.analysis-title::before {
  content: '';
  width: 6px;
  height: 16px;
  border-radius: 999px;
  background: linear-gradient(180deg, #2563eb 0%, #10b981 100%);
  box-shadow: 0 6px 12px rgba(37, 99, 235, 0.28);
}

.analysis-switch {
  padding: 0;
  border-radius: 12px;
  background: transparent;
  border: none;
}

.analysis-switch :deep(.el-radio-button) {
  margin-left: 10px;
}

.analysis-switch :deep(.el-radio-button:first-child) {
  margin-left: 0;
}

.analysis-switch :deep(.el-radio-button__inner) {
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.9);
  color: #334155;
  border-radius: 12px;
  height: 30px;
  line-height: 30px;
  padding: 0 14px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.analysis-switch :deep(.el-radio-button__inner:hover) {
  border-color: rgba(37, 99, 235, 0.45);
  color: #1d4ed8;
}

.analysis-switch :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  color: #ffffff;
  border-color: rgba(37, 99, 235, 0.9);
  background: #2563eb;
  box-shadow: 0 10px 18px rgba(37, 99, 235, 0.22);
  font-weight: 600;
}

.analysis-content {
  min-height: 300px;
}

.analysis-grid {
  row-gap: 16px;
  align-items: stretch;
}

.analysis-col {
  display: flex;
}
</style>
