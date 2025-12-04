import { c } from 'vite/dist/node/moduleRunnerTransport.d-CXw_Ws6P';
import { request } from '../request';

export function fetchFileSchemaInfo() {
  return request<Api.Files.FileSchemaInfo>({
    url: '/files/schema',
    method: 'get'
  });
}

export function fetchFileStatistics() {
  return request<Api.Files.FileStatistics>({
    url: '/files/statistics',
    method: 'get'
  });
}

export function fetchFileListInfo(page: number, pageSize: number,
   file_id?: number, file_name?: string, file_type?: string) {
  const params: any = {
    page,
    page_size: pageSize
  };
  
  // 只有在有值的时候才添加到 params
  if (file_id) params.file_id = file_id;
  if (file_name) params.file_name = file_name;
  if (file_type) params.file_type = file_type;
  
  return request<Api.Files.FileList>({
    url: '/files/list',
    method: 'get',
    params
  });
}

export function FileUploadInit(file_type_id: number, content_json: object, uploads: Api.Files.FileUpload[]) {
  return request<Api.Files.FileUploadInitResponse>({
    url: `/files/upload/initiate`,
    method: 'post',
    data: {
      file_type_id,
      content_json,
      uploads
    }
  });
}

export function FileBatchUploadInit(file_type_id: number, content_json: object, uploads: Api.Files.FileBatchUploadItem[]) {
  return request<Api.Files.FileBatchUploadInit>({
    url: `/files/upload/batch_initiate`,
    method: 'post',
    data: {
      file_type_id,
      content_json,
      uploads
    }
  });
}

export function FileUploadComplete(params: {
  file_type_id: number;
  file_name: string;
  description_json: object;
  uploaded_files: Api.Files.UploadedFile[];
}) {
  return request<Api.Files.FileUploadCompleteResponse>({
    url: `/files/upload/complete`,
    method: 'post',
    data: params
  });
}

export function fetchFileDetail(file_id: number) {
  return request<Api.Files.FileDetail>({
    url: `/files/detail/${file_id}`,
    method: 'get',
    data: {
      file_id
    }
  });
}

export function fetchFileGenealogy(file_id: number) {
  return request<Api.Files.FileGenealogy>({
    url: `/genealogy/${file_id}`,
    method: 'get',
    data: {
      file_id
    }
  });
}
