/**
 * 单个文件上传信息的详情
 */
export interface UploadUrlInfo {
  field_name: string // 对应请求中的字段名，用于匹配文件
  upload_url: string // S3 预签名上传 URL
  s3_key: string // 文件在 S3 中存储的路径/键
}

/**
 * 初始化上传时的响应体结构
 */
export interface InitiateUploadResponse {
  status: string
  upload_urls: UploadUrlInfo[]
}
