import axios from 'axios';
import { createSHA256 } from 'hash-wasm';
import { FileUploadInit, FileUploadComplete } from '@/service/api/file';
import { ElMessage } from 'element-plus';

// 全局上传任务映射表，用于管理和取消上传任务
const uploadTaskMap = new Map<string, { cancelToken: any; uploadClient: any }>();

// 获取或创建任务的 cancel token
export function getUploadTaskCancelToken(taskId: string) {
  return uploadTaskMap.get(taskId)?.cancelToken;
}

// 注册上传任务
export function registerUploadTask(taskId: string, cancelToken: any, uploadClient: any) {
  uploadTaskMap.set(taskId, { cancelToken, uploadClient });
}

// 取消上传任务
export function cancelUploadTask(taskId: string) {
  const task = uploadTaskMap.get(taskId);
  if (task?.cancelToken) {
    task.cancelToken.cancel(`任务 ${taskId} 已被取消`);
    uploadTaskMap.delete(taskId);
  }
}

// 清理已完成的任务
export function cleanupUploadTask(taskId: string) {
  uploadTaskMap.delete(taskId);
}

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

// 提取表单中非文件字段的内容
export function extractNonFileFormData(dynamicForm: any): Record<string, any> {
  const formData: Record<string, any> = {};
  const fileEntries = collectFileEntries(dynamicForm);
  const fileFieldNames = new Set(fileEntries.map(e => e.field_name));
  
  // 需要跳过的上传产生的字段
  const uploadGeneratedFields = new Set(['path', 's3_key', 'file_hash', 'file_size', 'file_type', 'origin_filename']);

  // 检查一个值是否为有效的用户输入
  function isValidUserInput(value: any): boolean {
    // null 或 undefined 不是有效值
    if (value === null || value === undefined) {
      return false;
    }
    
    // 空字符串、空数组不是有效值
    if (value === '' || (Array.isArray(value) && value.length === 0)) {
      return false;
    }
    
    // 对象类型的值需要进一步检查
    if (typeof value === 'object' && !Array.isArray(value)) {
      // 如果对象只包含上传生成的字段，则不是有效值
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return false;
      }
      const hasNonUploadFields = keys.some(k => !uploadGeneratedFields.has(k));
      return hasNonUploadFields;
    }
    
    return true;
  }

  // 递归处理表单数据，排除文件字段和上传产生的字段
  function processObject(obj: any, result: Record<string, any>) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return;
    }

    Object.entries(obj).forEach(([key, value]) => {
      // 跳过文件字段
      if (fileFieldNames.has(key)) {
        return;
      }

      // 跳过上传产生的字段
      if (uploadGeneratedFields.has(key)) {
        return;
      }

      // 跳过包含 file 属性的对象
      if (value && typeof value === 'object' && 'file' in value) {
        return;
      }

      // 如果值是基本类型
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        // 只添加有效的用户输入值
        if (isValidUserInput(value)) {
          result[key] = value;
        }
        return;
      }

      // 如果是对象，递归处理
      const nestedResult: Record<string, any> = {};
      processObject(value, nestedResult);
      // 只有当嵌套对象中有有效字段时，才添加它
      if (Object.keys(nestedResult).length > 0) {
        result[key] = nestedResult;
      }
    });
  }

  processObject(dynamicForm, formData);
  return formData;
}

// 创建专用的上传 axios 实例，用于更精准的进度跟踪
function createUploadAxiosInstance() {
  return axios.create({
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 0 // 禁用超时，大文件上传需要充足时间
  });
}

// 实时跟踪上传进度，确保进度更新的准确性和连续性
function trackUploadProgress(
  progressEvent: any,
  taskId: string,
  onTaskProgress?: (taskId: string, progress: number) => void,
  lastProgress?: { current: number }
) {
  if (!progressEvent.total || !onTaskProgress) return;
  
  // 计算当前进度百分比
  const currentProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
  
  // 确保进度单调递增，避免进度条抖动
  if (!lastProgress || currentProgress > lastProgress.current) {
    lastProgress = lastProgress || { current: 0 };
    lastProgress.current = currentProgress;
    onTaskProgress(taskId, currentProgress);
  }
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

  // 提取非文件字段的表单数据作为 content_json
  const contentJson = extractNonFileFormData(dynamicForm);

  const uploadedFiles: any[] = [];
  const uploadPromises: Promise<void>[] = [];
  
  // Step 1: 调用 FileUploadInit 接口初始化上传
  let initiateRes: any;
  let currentUploadUrls: any[] = [];
  let initiateError: string | null = null;
  
  try {
    initiateRes = await FileUploadInit(Number(selectedSchemaId), contentJson, uploads);
    currentUploadUrls = (initiateRes.data?.upload_urls || initiateRes.response?.data?.upload_urls || []) as any[];
    
    if (!currentUploadUrls || currentUploadUrls.length === 0) {
      initiateError = '初始化上传失败：未获取到上传 URL';
    }
  } catch (err: any) {
    initiateError = err?.message || '初始化上传失败';
  }
  
  // Step 2: 在 initiate 阶段为每个文件添加任务到列表
  // 这样用户在初始化完成后立即能看到任务，而不是等待上传完成
  const taskMap = new Map<string, string>(); // 用于映射 field_name 到 taskId
  
  fileEntries.forEach(({ field_name, file }) => {
    const taskId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    taskMap.set(field_name, taskId);
    
    if (onTaskAdded) {
      onTaskAdded(taskId, file.name);
    }
    
    // 如果初始化失败，立即标记任务为错误
    if (initiateError) {
      if (onTaskCompleted) {
        onTaskCompleted(taskId, 'error', initiateError);
      }
    }
  });
  
  // Step 3: 如果初始化失败，返回空数组（不继续上传）
  if (initiateError) {
    console.error('FileUploadInit 失败:', initiateError);
    return uploadedFiles;
  }
  
  // Step 4: 开始实际的文件上传
  try {
    currentUploadUrls.forEach((u: any) => {
      const promise = (async () => {
        const entry = fileEntries.find(e => e.field_name === u.field_name);
        if (!entry) {
          throw new Error(`上传时未找到对应的文件字段: ${u.field_name}`);
        }

        // 从任务映射表获取已创建的 taskId
        const taskId = taskMap.get(u.field_name);
        if (!taskId) {
          throw new Error(`找不到任务 ID: ${u.field_name}`);
        }
        
        const cancelTokenSource = axios.CancelToken.source();
        const uploadClient = createUploadAxiosInstance();
        const lastProgress = { current: 0 }; // 用于追踪上一次的进度百分比

        // 注册上传任务，用于全局管理和取消
        registerUploadTask(taskId, cancelTokenSource, uploadClient);

        try {
          // 执行上传请求，实时捕捉传输进度
          await uploadClient.put(u.upload_url, entry.file, {
            headers: {
              'Content-Type': entry.file.type || 'application/octet-stream'
            },
            // 实时捕捉上传进度，确保面板显示最新的传输状态
            onUploadProgress: (progressEvent: any) => {
              trackUploadProgress(progressEvent, taskId, onTaskProgress, lastProgress);
            },
            cancelToken: cancelTokenSource.token
          });

          // 确保上传成功时进度显示为 100%
          if (onTaskProgress) {
            onTaskProgress(taskId, 100);
          }

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
        } finally {
          // 清理已完成的任务
          cleanupUploadTask(taskId);
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

// 处理批量文件上传 - 在 FileBatchUploadInit 之后调用
export async function processBatchFileUploads(
  batchInitResponse: any,
  uploads: any[],
  dynamicForm: any,
  onTaskProgress?: (taskId: string, progress: number) => void,
  onTaskCompleted?: (taskId: string, status: 'success' | 'error', error?: string) => void
): Promise<any> {
  try {
    // 从响应中提取上传URLs
    // 响应格式: { status: "success", upload_urls: [ { sample_id, field_name, upload_url, s3_key }, ... ] }
    const responseData = batchInitResponse?.data || batchInitResponse;
    const uploadUrlsList = responseData?.upload_urls || [];
    
    if (!Array.isArray(uploadUrlsList) || uploadUrlsList.length === 0) {
      const errorMsg = '批量上传初始化失败：未获取到上传URL';
      console.error('响应数据:', responseData);
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log('批量上传URL列表:', uploadUrlsList);

    // 构建 (sample_id, field_name) -> uploadUrl 的映射
    const uploadUrlMap = new Map<string, any>();
    for (const urlInfo of uploadUrlsList) {
      const key = `${urlInfo.sample_id}|${urlInfo.field_name}`;
      uploadUrlMap.set(key, urlInfo);
    }

    const uploadPromises: Promise<void>[] = [];
    const fileEntries = collectFileEntries(dynamicForm);

    console.log('收集的文件条目:', fileEntries);

    // 遍历所有上传batch中的每个field
    for (let batchIndex = 0; batchIndex < uploads.length; batchIndex++) {
      const batch = uploads[batchIndex];
      const sample_id = batch.sample_id;

      for (let fieldIndex = 0; fieldIndex < (batch.fields || []).length; fieldIndex++) {
        const field = batch.fields[fieldIndex];
        const field_name = field.field_name;

        // 根据 sample_id 和 field_name 查找对应的上传URL
        const mapKey = `${sample_id}|${field_name}`;
        const uploadUrlInfo = uploadUrlMap.get(mapKey);

        if (!uploadUrlInfo) {
          console.warn(`未找到 sample_id=${sample_id}, field_name=${field_name} 的上传URL`);
          continue;
        }

        // 从 dynamicForm 中找到对应的文件对象
        const fileEntry = fileEntries.find(e => e.field_name === field_name);

        if (!fileEntry) {
          console.warn(`未找到字段 ${field_name} 的文件数据`);
          continue;
        }

        // 为这个文件生成 taskId
        const taskId = `batch_upload_${sample_id}_${field_name}_${fieldIndex}`;

        // 创建上传Promise
        const uploadPromise = (async () => {
          try {
            const uploadClient = createUploadAxiosInstance();
            const cancelTokenSource = axios.CancelToken.source();
            const lastProgress = { current: 0 };

            // 注册任务用于全局管理
            registerUploadTask(taskId, cancelTokenSource, uploadClient);

            console.log(`开始上传 [样本${sample_id}] ${field_name}: ${uploadUrlInfo.upload_url}`);

            // 执行上传
            await uploadClient.put(uploadUrlInfo.upload_url, fileEntry.file, {
              headers: {
                'Content-Type': fileEntry.file.type || 'application/octet-stream'
              },
              onUploadProgress: (progressEvent: any) => {
                trackUploadProgress(progressEvent, taskId, onTaskProgress, lastProgress);
              },
              cancelToken: cancelTokenSource.token
            });

            // 确保进度显示为100%
            if (onTaskProgress) {
              onTaskProgress(taskId, 100);
            }

            // 上传成功
            if (onTaskCompleted) {
              onTaskCompleted(taskId, 'success');
            }

            console.log(`上传完成 [样本${sample_id}] ${field_name} -> ${uploadUrlInfo.s3_key}`);
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
          } finally {
            cleanupUploadTask(taskId);
          }
        })();

        uploadPromises.push(uploadPromise);
      }
    }

    console.log(`准备执行 ${uploadPromises.length} 个上传任务`);

    // 等待所有上传完成
    await Promise.all(uploadPromises);

    return { success: true };
  } catch (err: any) {
    console.error('批量上传过程中出错:', err);
    return { success: false, error: err?.message || '批量上传失败' };
  }
}
