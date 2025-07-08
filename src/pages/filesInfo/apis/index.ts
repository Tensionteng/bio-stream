import type { FileDetail, FileListResponse, RequestFilesList, StatisticsData } from "@/pages/filesInfo/apis/type"
import { request } from "@/http/axios"

export function getFileStatisticsApi() {
  return request<StatisticsData>({
    url: "api/files/statistics",
    method: "get"
  })
}
export function getFileListApi(params: RequestFilesList) {
  return request<FileListResponse>({
    url: "api/files/list",
    method: "get",
    params
  })
}
/**
 * 根据文件ID获取文件详细信息
 * @param fileId - 要查询的文件的ID
 */
export function getFileDetailApi(fileId: number) {
  return request<FileDetail>({
    // 使用模板字符串动态构建 URL
    url: `/api/files/detail/${fileId}`,
    method: "get"
  })
}
