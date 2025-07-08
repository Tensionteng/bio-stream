export interface User {
  user_id: number
  username: string
}

export interface StatisticsData {
  total_files: number
  total_size: number
  last_upload_time: string
}
export interface RequestFilesList {
  page: number
  pageSize: number
  file_type: string
}
export interface FileListItem {
  file_id: number
  file_name: string
  file_type: string
  file_size: number
  created_time: string
  upload_user: User
}

export interface SubFile {
  origin_filename: string
  field_name: string
  file_type: string
  file_size: number
  upload_time: string
}

// export interface FileDetail extends FileListItem {
//   description_json: object
//   uploaded_subfiles: SubFile[]
// }
// 响应结果中，单个文件对象的类型

// 完整的 API 响应类型
export interface FileListResponse {
  count: number
  next: string | null
  previous: string | null
  results: FileListItem[]
}

// JSON 描述信息
export interface Description {
  geneName: string
  chromosome: string
  position: {
    start: number
    end: number
    strand: boolean
  }
}

// 子文件信息
export interface SubFile {
  origin_filename: string
  field_name: string
  file_type: string
  file_size: number
  upload_time: string
}

// 完整的文件详情响应类型
export interface FileDetail {
  file_id: number
  file_name: string
  file_type: string
  file_size: number
  created_time: string
  upload_user: User
  description_json: Description
  uploaded_subfiles: SubFile[]
}
