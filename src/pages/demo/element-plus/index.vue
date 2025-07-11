<script lang="ts" setup>
import type { FormInstance } from "element-plus"
import { usePagination } from "@@/composables/usePagination" // 假设路径正确
import { RefreshRight, Search, View } from "@element-plus/icons-vue"
import { ElMessage } from "element-plus"
import { onMounted, reactive, ref, watch } from "vue"

defineOptions({
  name: "FileManager"
})

// #region 类型定义 (根据你的API文档)
interface User {
  user_id: number
  username: string
}

interface StatisticsData {
  total_files: number
  total_size: number
  last_upload_time: string
}

interface FileListItem {
  file_id: number
  file_name: string
  file_type: string
  file_size: number
  created_time: string
  upload_user: User
}

interface SubFile {
  origin_filename: string
  field_name: string
  file_type: string
  file_size: number
  upload_time: string
}

interface FileDetail extends FileListItem {
  description_json: object
  uploaded_subfiles: SubFile[]
}
// #endregion

// #region 模拟 API (用你的真实API替换)
// 实际项目中, 你应该将这些API调用封装在单独的文件中
async function getFileStatisticsApi(): Promise<{ data: StatisticsData }> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 300))
  // 模拟成功响应
  return Promise.resolve({
    data: {
      total_files: 128,
      total_size: 4567823000,
      last_upload_time: "2025-06-30T15:32:21Z"
    }
  })
}

async function getFileListApi(params: {
  page: number
  page_size: number
  file_type: string
}): Promise<{ data: { count: number, results: FileListItem[] } }> {
  console.log("请求文件列表，参数:", params)
  await new Promise(resolve => setTimeout(resolve, 500))
  const mockData: FileListItem[] = Array.from({ length: params.page_size }, (_, i) => ({
    file_id: 1000 + (params.page - 1) * params.page_size + i + 1,
    file_name: `Sample_Page${params.page}_Item${i + 1}.bam`,
    file_type: params.file_type || "BAM输入文件",
    file_size: 1345821 + i * 1000,
    created_time: new Date().toISOString(),
    upload_user: { user_id: i % 3, username: ["alice", "bob", "charlie"][i % 3] }
  }))
  return Promise.resolve({
    data: {
      count: 128,
      results: mockData
    }
  })
}

async function getFileDetailApi(fileId: number): Promise<{ data: FileDetail }> {
  console.log("请求文件详情，ID:", fileId)
  await new Promise(resolve => setTimeout(resolve, 400))
  return Promise.resolve({
    data: {
      file_id: fileId,
      file_name: "SampleA.bam",
      file_type: "BAM输入文件",
      file_size: 1345821,
      created_time: "2025-06-30T13:25:42Z",
      upload_user: { user_id: 3, username: "alice" },
      description_json: {
        geneName: "TP53",
        chromosome: "17",
        position: { start: 7565097, end: 7590856, strand: true }
      },
      uploaded_subfiles: [
        {
          origin_filename: "TP53.bam",
          field_name: "bam_file",
          file_type: "bam",
          file_size: 1234567,
          upload_time: "2025-06-30T13:30:10Z"
        },
        {
          origin_filename: "TP53.json",
          field_name: "json_file",
          file_type: "json",
          file_size: 45678,
          upload_time: "2025-06-30T13:30:12Z"
        }
      ]
    }
  })
}
// #endregion

const loading = ref<boolean>(false)
const { paginationData, handleCurrentChange, handleSizeChange } = usePagination()

// #region 工具函数
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
// #endregion

// #region 查 (文件列表 & 统计)
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
    .then(({ data }) => {
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
    page_size: paginationData.pageSize,
    file_type: searchData.file_type
  })
    .then(({ data }) => {
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

// #region 文件详情
const detailDialogVisible = ref<boolean>(false)
const currentFileDetail = ref<FileDetail | null>(null)
const detailLoading = ref<boolean>(false)

function handleViewDetail(row: FileListItem) {
  detailLoading.value = true
  detailDialogVisible.value = true
  getFileDetailApi(row.file_id)
    .then(({ data }) => {
      currentFileDetail.value = data
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
