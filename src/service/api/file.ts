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
   file_id: number, file_name: string, file_type: string) {
  return request<Api.Files.FileList>({
    url: '/files/list',
    method: 'get',
    params: {
      page,
      page_size: pageSize,
      file_id: file_id,
      file_name: file_name,
      file_type: file_type
    }
  });
}

export function FileUploadInit(file_type_id: number, uploads: Api.Files.FileUpload[]) {
  return request<Api.Files.FileUploadInitResponse>({
    url: `/files/upload/initiate`,
    method: 'post',
    data: {
      file_type_id,
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
