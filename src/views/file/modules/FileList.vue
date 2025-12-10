<script lang="ts" setup>
import { ref, watch } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { 
  ElCard, ElEmpty, ElTable, ElTableColumn, ElButton, 
  ElInput, ElIcon, ElPagination, ElDivider 
} from 'element-plus';
import { fetchFileListInfo } from '@/service/api/file';

// ==================== 工具函数 ====================

/**
 * 格式化文件大小为易读的格式
 * 将字节转换为 B, KB, MB, GB, TB, PB
 * @param bytes 文件大小（字节）
 * @returns 格式化后的文件大小字符串
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (!bytes || bytes < 0) return '-';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024; // 1KB = 1024B
  let size = bytes;
  let unitIndex = 0;
  
  // 逐级转换至合适的单位
  while (size >= k && unitIndex < units.length - 1) {
    size /= k;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// ==================== Props 与 Emits ====================
// Props: 可选的初始文件列表
const props = defineProps<{
  modelValue?: any[];
}>();

// Emits: 向父组件发送事件
const emit = defineEmits<{
  'detail': [fileId: number];  // 查看详情事件
  'lineage': [row: any];       // 查看世系事件
}>();

// ==================== 本地状态 ====================
const fileList = ref<any[]>(props.modelValue || []); // 文件列表数据
const fileListLoading = ref(false); // 列表加载状态
const fileListPage = ref(1);
const fileListPageSize = ref(20);
const fileListTotal = ref(0);
const fileListFileId = ref(0);
const fileListFileName = ref('');
const fileListFileType = ref('');

// 获取分页文件列表
async function fetchFileList(
  page?: number,
  pageSize?: number,
  id?: number,
  name?: string,
  type?: string
) {
  const currentPage = page ?? fileListPage.value;
  const currentPageSize = pageSize ?? fileListPageSize.value;
  const currentId = id ?? fileListFileId.value;
  const currentName = name ?? fileListFileName.value;
  const currentType = type ?? fileListFileType.value;

  fileListLoading.value = true;
  try {
    const res = await fetchFileListInfo(currentPage, currentPageSize, currentId, currentName, currentType);

    fileList.value = res.data?.results || [];
    fileListTotal.value = res.data?.count || 0;
    fileListPage.value = currentPage;
    fileListPageSize.value = currentPageSize;
  } catch {
    console.warn('获取文件列表失败');
    fileList.value = [];
    fileListTotal.value = 0;
  } finally {
    fileListLoading.value = false;
  }
}

// 处理搜索
function handleSearch() {
  fileListPage.value = 1;
  fileListFileName.value = fileListFileName.value;
  fileListFileId.value = fileListFileId.value ? Number(fileListFileId.value) : 0;
  fileListFileType.value = fileListFileType.value;
  fetchFileList();
}

// 获取当前显示的数据条数（实际显示在当前页的条数）
function getCurrentDisplayCount(): number {
  return fileList.value.length;
}

// 重置筛选条件
function handleResetFilters() {
  fileListFileId.value = 0;
  fileListFileName.value = '';
  fileListFileType.value = '';
  fileListPage.value = 1;
  fetchFileList();
}

// 处理页码变化
function handleCurrentChange(newPage: number) {
  fileListPage.value = newPage;
  fetchFileList();
}

// 处理分页大小变化
function handlePageSizeChange(newSize: number) {
  fileListPageSize.value = newSize;
  fileListPage.value = 1;
  fetchFileList();
}

// 查看详情
function showDetail(fileId: number) {
  emit('detail', fileId);
}

// 查看世系
function showLineage(row: any) {
  emit('lineage', row);
}

// 初始化
function init() {
  fetchFileList();
}

// 暴露给父组件
defineExpose({
  fetchFileList,
  init,
  fileList,
  fileListTotal,
  fileListPage,
  fileListPageSize
});
</script>

<template>
  <div class="file-list-container">
    <div style="font-weight: bold; font-size: large; color: #409eff; margin-bottom: 10px">文件列表</div>
    
    <!-- 搜索和筛选区域 -->
    <div class="filter-area">
      <div class="filter-row">
        <ElInput
          v-model="fileListFileName"
          placeholder="文件名"
          clearable
          style="flex: 1; min-width: 180px; max-width: 300px;"
        >
          <template #prefix>
            <ElIcon><Search /></ElIcon>
          </template>
        </ElInput>

        <ElInput
          v-model="fileListFileType"
          placeholder="文件类型"
          clearable
          style="flex: 1; min-width: 180px; max-width: 300px;"
        >
          <template #prefix>
            <ElIcon><Search /></ElIcon>
          </template>
        </ElInput>

        <ElInput
          :value="fileListFileId === 0 ? '' : fileListFileId"
          v-model.number="fileListFileId"
          placeholder="文件ID"
          type="number"
          clearable
          :min="1"
          style="flex: 1; min-width: 120px; max-width: 180px; margin: 0 10px;"
        />
        
        <ElButton
          type="primary"
          @click="handleSearch"
          style="margin: 0 5px;"
        >
          查询
        </ElButton>
        
        <ElButton
          type="default"
          @click="handleResetFilters"
        >
          重置
        </ElButton>
      </div>
    </div>
    
    <ElEmpty v-if="!fileList.length && !fileListLoading" description="暂无上传记录" :image-size="60" />
    
    <div class="history-table-scroll">
      <ElTable :data="fileList" :style="{ width: '100%' }" size="small" border stripe>
        <ElTableColumn prop="file_id" label="ID" show-overflow-tooltip />
        <ElTableColumn prop="file_name" label="文件名" show-overflow-tooltip />
        <ElTableColumn label="文件大小" show-overflow-tooltip>
          <template #default="scope">
            {{ formatFileSize(scope.row.file_size) }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="created_time" label="上传时间" show-overflow-tooltip />
        <ElTableColumn prop="upload_user.user_id" label="上传用户" show-overflow-tooltip />
        <ElTableColumn label="操作" width="200" align="center">
          <template #default="scope">
            <ElButton
              type="primary"
              size="small"
              style="margin-right: 6px"
              @click="showDetail(scope.row.file_id)"
            >
              详情
            </ElButton>
            <ElButton type="success" size="small" @click="showLineage(scope.row)">查看世系</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>
    
    <div class="history-pagination">
      <div v-if="fileListTotal > 0" class="pagination-content">
        <span class="data-count">共 {{ fileListTotal }} 条</span>
        <ElPagination
          background
          layout="sizes, prev, pager, next, jumper"
          :total="fileListTotal"
          :page-size="fileListPageSize"
          :current-page="fileListPage"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="handleCurrentChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-list-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0;
}

.history-table-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: auto;
}

.history-pagination {
  flex-shrink: 0;
  padding-top: 12px;
  padding-bottom: 8px;
  padding-left: 16px;
  padding-right: 16px;
  border-top: 1px solid #ebeef5;
  background: #fafcff;
  overflow: hidden;
}

.pagination-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
  min-width: 0;
}

.data-count {
  font-size: 14px;
  color: #606266;
  flex-shrink: 0;
  white-space: nowrap;
}

.pagination-content :deep(.el-pagination) {
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .pagination-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .pagination-content :deep(.el-pagination) {
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
  }
}

.filter-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
  padding: 0;
  flex-shrink: 0;
}

.filter-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
}

.filter-row > :deep(.el-input) {
  min-width: 0;
  flex-shrink: 0;
}

.filter-row > :deep(.el-select) {
  min-width: 0;
  flex-shrink: 0;
}

.filter-row > .el-button {
  flex-shrink: 0;
  white-space: nowrap;
}

@media (max-width: 1400px) {
  .filter-row {
    flex-wrap: wrap;
  }
  
  .filter-row > :deep(.el-input),
  .filter-row > :deep(.el-select) {
    flex: 0 1 calc(50% - 6px) !important;
    max-width: 100% !important;
  }
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-row > :deep(.el-input),
  .filter-row > :deep(.el-select) {
    flex: 1 !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 5px 0 !important;
  }
  
  .filter-row > .el-button {
    width: 100%;
    margin: 5px 0 !important;
  }
}
</style>
