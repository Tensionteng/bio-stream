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

export function fetchFileListInfo(page: number, pageSize: number) {
    return request<Api.Files.FileList>({
        url: '/files/list',
        method: 'get',
        params: {
            page,
            page_size: pageSize
        }
    });
}


export function FileUploadInit(file_type_id: number, uploads: Api.Files.FileUpload[]) {
    return request<Api.Files.FileUploadInitResponse>({
        url: `/files/upload/initiate`,
        method: 'post',
        data: {
            file_type_id,
            uploads: uploads
        }
    });
}

export function FileUploadComplete(file_type_id: number, file_name: string, description_json: object, uploaded_files: Api.Files.UploadedFile[]) {
    return request<Api.Files.FileUploadCompleteResponse>({
        url: `/files/upload/complete`,
        method: 'post',
        data: {
            file_type_id,
            file_name,
            description_json,
            uploaded_files
        }
    });
}
