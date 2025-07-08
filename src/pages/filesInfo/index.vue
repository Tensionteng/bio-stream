<script lang="ts" setup>
import type { FormInstance } from "element-plus"
import type { FileDetail, FileListItem, StatisticsData } from "@/pages/filesInfo/apis/type"
import { usePagination } from "@@/composables/usePagination" // 假设路径正确
import { RefreshRight, Search, View } from "@element-plus/icons-vue"
import { ElMessage } from "element-plus"
import { onMounted, reactive, ref, watch } from "vue"
import { getFileDetailApi, getFileListApi, getFileStatisticsApi } from "./apis"

defineOptions({
  name: "FileManager"
})
const loading = ref<boolean>(false)
const { paginationData, handleCurrentChange, handleSizeChange } = usePagination()

// 工具函数
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("zh-CN")
}
const statisticsData = ref<StatisticsData | null>(null)
const fileList = ref<FileListItem[]>([])
const searchFormRef = ref<FormInstance | null>(null)
const searchData = reactive({
  file_type: ""
})

// 1. 获取统计信息
function getStatisticsData() {
  loading.value = true
  getFileStatisticsApi()
    .then((data) => {
      statisticsData.value = data
    })
    .catch((err) => {
      ElMessage.error("获取统计信息失败")
      console.error(err)
    })
    .finally(() => {
      loading.value = false
    })
}

// 2. 获取文件列表
function getFileListData() {
  loading.value = true
  getFileListApi({
    page: paginationData.currentPage,
    pageSize: paginationData.pageSize,
    file_type: searchData.file_type
  })
    .then((data) => {
      console.log(data)
      paginationData.total = data.count
      fileList.value = data.results
    })
    .catch(() => {
      fileList.value = []
    })
    .finally(() => {
      loading.value = false
    })
}

function handleSearch() {
  paginationData.currentPage === 1 ? getFileListData() : (paginationData.currentPage = 1)
}

function resetSearch() {
  searchFormRef.value?.resetFields()
  handleSearch()
}
// #endregion

const detailDialogVisible = ref<boolean>(false)
const currentFileDetail = ref<FileDetail | null>(null)
const detailLoading = ref<boolean>(false)

function handleViewDetail(row: FileListItem) {
  detailLoading.value = true
  detailDialogVisible.value = true
  getFileDetailApi(row.file_id)
    .then((data) => {
      currentFileDetail.value = data
      console.log(data)
    })
    .catch(() => {
      ElMessage.error("获取文件详情失败")
      detailDialogVisible.value = false // 获取失败则关闭弹窗
    })
    .finally(() => {
      detailLoading.value = false
    })
}

function onDetailDialogClosed() {
  currentFileDetail.value = null // 清理数据，防止下次打开时看到旧数据
}
// #endregion

// 监听分页参数的变化
watch([() => paginationData.currentPage, () => paginationData.pageSize], getFileListData, { immediate: false })

// 组件挂载时，初始化数据
onMounted(() => {
  getStatisticsData()
  getFileListData()
})
</script>

<template>
  <div class="app-container">
    <el-card v-if="statisticsData" shadow="never" class="stats-card">
      <el-row :gutter="20">
        <el-col :span="8">
          <div class="statistic-item">
            <div class="statistic-title">
              文件总数
            </div>
            <div class="statistic-value">
              {{ statisticsData.total_files }}
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="statistic-item">
            <div class="statistic-title">
              总体积
            </div>
            <div class="statistic-value">
              {{ formatFileSize(statisticsData.total_size) }}
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="statistic-item">
            <div class="statistic-title">
              最近上传时间
            </div>
            <div class="statistic-value">
              {{ formatDateTime(statisticsData.last_upload_time) }}
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card v-loading="loading" shadow="never" class="search-wrapper">
      <el-form ref="searchFormRef" :inline="true" :model="searchData">
        <el-form-item prop="file_type" label="文件类型">
          <el-input v-model="searchData.file_type" placeholder="请输入文件类型名" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            查询
          </el-button>
          <el-button :icon="RefreshRight" @click="resetSearch">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-loading="loading" shadow="never">
      <div class="toolbar-wrapper">
        <div>
          <span class="toolbar-title">文件列表</span>
        </div>
        <div>
          <el-tooltip content="刷新当前页">
            <el-button type="primary" :icon="RefreshRight" circle @click="getFileListData" />
          </el-tooltip>
        </div>
      </div>
      <div class="table-wrapper">
        <el-table :data="fileList">
          <el-table-column prop="file_id" label="文件ID" width="80" align="center" />
          <el-table-column prop="file_name" label="文件名" min-width="180" show-overflow-tooltip />
          <el-table-column prop="file_type" label="文件类型名" align="center" />
          <el-table-column prop="file_size" label="文件大小" align="center">
            <template #default="scope">
              {{ formatFileSize(scope.row.file_size) }}
            </template>
          </el-table-column>
          <el-table-column prop="created_time" label="文件上传时间" align="center" width="180">
            <template #default="scope">
              {{ formatDateTime(scope.row.created_time) }}
            </template>
          </el-table-column>
          <el-table-column prop="upload_user.username" label="文件上传用户" align="center">
            <template #default="scope">
              <el-tag effect="plain">
                {{ scope.row.upload_user.username }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="120" align="center">
            <template #default="scope">
              <el-button type="primary" text bg size="small" :icon="View" @click="handleViewDetail(scope.row)">
                查看详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pager-wrapper">
        <el-pagination
          background
          :layout="paginationData.layout"
          :page-sizes="paginationData.pageSizes"
          :total="paginationData.total"
          :page-size="paginationData.pageSize"
          :current-page="paginationData.currentPage"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      title="文件详细信息"
      width="60%"
      destroy-on-close
      @closed="onDetailDialogClosed"
    >
      <div v-loading="detailLoading">
        <div v-if="currentFileDetail">
          <el-descriptions title="基本信息" :column="2" border>
            <el-descriptions-item label="文件ID">
              {{ currentFileDetail.file_id }}
            </el-descriptions-item>
            <el-descriptions-item label="文件名">
              {{ currentFileDetail.file_name }}
            </el-descriptions-item>
            <el-descriptions-item label="文件类型">
              {{ currentFileDetail.file_type }}
            </el-descriptions-item>
            <el-descriptions-item label="文件大小">
              {{ formatFileSize(currentFileDetail.file_size) }}
            </el-descriptions-item>
            <el-descriptions-item label="上传用户">
              <el-tag effect="plain" size="small">
                {{ currentFileDetail.upload_user.username }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="上传时间">
              {{ formatDateTime(currentFileDetail.created_time) }}
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <h4>Description JSON</h4>
          <pre class="json-pre">{{ JSON.stringify(currentFileDetail.description_json, null, 2) }}</pre>

          <el-divider />

          <h4>相关子文件信息</h4>
          <el-table :data="currentFileDetail.uploaded_subfiles" border stripe size="small">
            <el-table-column prop="origin_filename" label="原始文件名" show-overflow-tooltip />
            <el-table-column prop="field_name" label="对应字段" align="center" />
            <el-table-column prop="file_type" label="文件类型" align="center" />
            <el-table-column prop="file_size" label="文件大小" align="center">
              <template #default="scope">
                {{ formatFileSize(scope.row.file_size) }}
              </template>
            </el-table-column>
            <el-table-column prop="upload_time" label="上传完成时间" align="center" width="180">
              <template #default="scope">
                {{ formatDateTime(scope.row.upload_time) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-empty v-else description="暂无数据" />
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">
          关闭
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.stats-card {
  margin-bottom: 20px;
  .statistic-item {
    text-align: center;
  }
  .statistic-title {
    color: var(--el-text-color-secondary);
    font-size: 14px;
    margin-bottom: 8px;
  }
  .statistic-value {
    font-size: 24px;
    font-weight: bold;
    color: var(--el-text-color-primary);
  }
}

.search-wrapper {
  margin-bottom: 20px;
  :deep(.el-card__body) {
    padding-bottom: 2px;
  }
}

.toolbar-wrapper {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  .toolbar-title {
    font-size: 18px;
    font-weight: bold;
  }
}

.table-wrapper {
  margin-bottom: 20px;
}

.pager-wrapper {
  display: flex;
  justify-content: flex-end;
}

.json-pre {
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 10px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: "Courier New", Courier, monospace;
}
</style>
