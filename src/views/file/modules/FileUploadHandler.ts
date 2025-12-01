import axios from 'axios';
import { createSHA256 } from 'hash-wasm';
import { FileUploadInit, FileUploadComplete } from '@/service/api/file';
import { ElMessage } from 'element-plus';

// 计算文件哈希编码
export async function hashFile(file: File) {
  const sha256 = await createSHA256();
  const chunkSize = 4 * 1024 * 1024; // 4MB 一块
  let offset = 0;
  const chunks: Blob[] = [];
  while (offset < file.size) {
    chunks.push(file.slice(offset, offset + chunkSize));
    offset += chunkSize;
  }
  const buffers = await Promise.all(chunks.map(chunk => chunk.arrayBuffer()));
  for (const buffer of buffers) {
    sha256.update(new Uint8Array(buffer));
  }
  return sha256.digest('hex');
}

// 从文件名获取用于键名/描述的后缀
export function getSuffixFromFileName(fileName: string): string {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.fastq.gz')) return 'fastq.gz';
  if (lower.endsWith('.fq.gz')) return 'fq.gz';
  const parts = lower.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

// 遍历 dynamicForm，收集所有含有 file 的叶子节点
export function collectFileEntries(
  obj: Record<string, any>,
  basePath: string[] = []
): Array<{ path: string[]; field_name: string; file: File }> {
  const results: Array<{ path: string[]; field_name: string; file: File }> = [];
  if (!obj || typeof obj !== 'object') return results;

  Object.entries(obj).forEach(([k, v]) => {
    const currentPath = [...basePath, k];
    if (v && typeof v === 'object') {
      if ('file' in v && v.file && !(v as any).hidden) {
        const fieldName = k;
        results.push({ path: currentPath, field_name: fieldName, file: v.file as File });
      } else if (!Array.isArray(v)) {
        let hasMultipleFiles = false;
        const multiFiles: Array<{ path: string[]; field_name: string; file: File }> = [];
        
        Object.entries(v).forEach(([subKey, subValue]) => {
          if (subValue && typeof subValue === 'object' && 'file' in subValue && subValue.file && !(subValue as any).hidden) {
            hasMultipleFiles = true;
            multiFiles.push({
              path: [...currentPath, subKey],
              field_name: k,
              file: subValue.file as File
            });
          }
        });
        
        if (hasMultipleFiles) {
          results.push(...multiFiles);
        } else {
          results.push(...collectFileEntries(v as Record<string, any>, currentPath));
        }
      }
    }
  });
  return results;
}

// 将点分隔的键设置为嵌套对象中的值
export function setNestedValue(target: Record<string, any>, path: string, value: any) {
  const segments = path.split('.');
  let current = target;
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (isLast) {
      current[seg] = value;
    } else {
      if (typeof current[seg] !== 'object' || current[seg] === null || Array.isArray(current[seg])) {
        current[seg] = {};
      }
      current = current[seg];
    }
  }
}

// 构建描述JSON
export function buildDescriptionJson(uploadedFiles: any[], textFields: any[], dynamicForm: any): any {
  const descriptionJson: any = {};

  // 处理非文件字段
  textFields.forEach(f => {
    if (f.type === 'dynamic-object') return;
    const val = (dynamicForm as any)[f.name];
    if (val !== undefined) setNestedValue(descriptionJson, f.name, val);
  });

  // 处理文件字段
  uploadedFiles.forEach(uf => {
    setNestedValue(descriptionJson, uf.field_name, {
      path: uf.s3_key,
      file_type: `.${getSuffixFromFileName(uf.origin_filename)}`
    });
  });

  return descriptionJson;
}

// 获取文件名（根据schema中的sample_id）
export function getFileNameFromSchema(dynamicForm: any): string {
  if (dynamicForm.sample_id && dynamicForm.sample_id.trim()) {
    return dynamicForm.sample_id.trim();
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `bioFile_${timestamp}_${randomSuffix}`;
}

// 处理文件上传
export async function processFileUploads(
  dynamicForm: any,
  selectedSchemaId: string | number,
  onTaskAdded?: (taskId: string, fileName: string) => void,
  onTaskProgress?: (taskId: string, progress: number) => void,
  onTaskCompleted?: (taskId: string, status: 'success' | 'error', error?: string) => void
): Promise<any[]> {
  const uploads: any[] = [];
  const fileEntries = collectFileEntries(dynamicForm);
  console.log('before collect dynamicForm:', dynamicForm);
  
  fileEntries.forEach(({ field_name, file }) => {
    uploads.push({
      field_name,
      filename: file.name,
      content_type: file.type || 'application/octet-stream'
    });
  });

  const initiateRes: any = await FileUploadInit(Number(selectedSchemaId), uploads);
  const currentUploadUrls = (initiateRes.data?.upload_urls || initiateRes.response.data?.upload_urls || []) as any[];

  const uploadedFiles: any[] = [];
  const uploadPromises: Promise<void>[] = [];
  
  try {
    currentUploadUrls.forEach((u: any) => {
      const promise = (async () => {
        const entry = fileEntries.find(e => e.field_name === u.field_name);
        if (!entry) {
          throw new Error(`上传时未找到对应的文件字段: ${u.field_name}`);
        }

        // 创建上传任务
        const taskId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        if (onTaskAdded) {
          onTaskAdded(taskId, entry.file.name);
        }
        
        const cancelTokenSource = axios.CancelToken.source();

        try {
          await axios.put(u.upload_url, entry.file, {
            headers: {
              'Content-Type': entry.file.type || 'application/octet-stream'
            },
            onUploadProgress: progressEvent => {
              if (progressEvent.total && onTaskProgress) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onTaskProgress(taskId, percent);
              }
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            cancelToken: cancelTokenSource.token
          });

          // 上传成功
          if (onTaskCompleted) {
            onTaskCompleted(taskId, 'success');
          }

          // 回填路径信息
          const stack: Array<{ obj: Record<string, any>; keyPath: string[] }> = [{ obj: dynamicForm, keyPath: [] }];
          while (stack.length) {
            const { obj, keyPath } = stack.pop()!;
            Object.entries(obj).forEach(([k, v]) => {
              const nextPath = [...keyPath, k];
              if (k === u.field_name && v && typeof v === 'object') {
                (v as any).path = u.s3_key;
              }
              if (v && typeof v === 'object' && !Array.isArray(v)) {
                stack.push({ obj: v as Record<string, any>, keyPath: nextPath });
              }
            });
          }

          // 处理文件信息
          try {
            const sha256 = await hashFile(entry.file);
            uploadedFiles.push({
              field_name: u.field_name,
              origin_filename: entry.file.name,
              s3_key: u.s3_key,
              file_type: entry.file.type || 'application/octet-stream',
              file_size: entry.file.size,
              file_hash: sha256
            });
          } catch {
            uploadedFiles.push({
              field_name: u.field_name,
              origin_filename: entry.file.name,
              s3_key: u.s3_key,
              file_type: entry.file.type || 'application/octet-stream',
              file_size: entry.file.size,
              file_hash: 'error'
            });
          }
        } catch (err: any) {
          if (axios.isCancel(err)) {
            console.log(`任务 ${taskId} 已被用户取消`);
            if (onTaskCompleted) {
              onTaskCompleted(taskId, 'error', '已取消');
            }
          } else {
            console.error(`任务 ${taskId} 上传失败:`, err?.message);
            if (onTaskCompleted) {
              onTaskCompleted(taskId, 'error', err?.message || '上传失败');
            }
          }
        }
      })();
      uploadPromises.push(promise);
    });

    // 等待所有上传完成
    await Promise.all(uploadPromises);
  } catch (err: any) {
    console.error('上传过程中出错:', err);
  }

  return uploadedFiles;
}

// 完成文件上传
export async function completeFileUpload(
  schemaId: string | number,
  fileName: string,
  descriptionJson: any,
  uploadedFiles: any[]
) {
  return await FileUploadComplete({
    file_type_id: Number(schemaId),
    file_name: fileName,
    description_json: descriptionJson,
    uploaded_files: uploadedFiles
  });
}
