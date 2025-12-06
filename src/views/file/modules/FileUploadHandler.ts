import axios from 'axios';
import { createSHA256 } from 'hash-wasm';
import { FileUploadComplete } from '@/service/api/file';

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
    timeout: 0, // 禁用超时，大文件上传需要充足时间
    validateStatus: function(status) {
      // 认可所有状态码，让我们手动处理
      return true;
    }
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



// 处理批量文件上传 - 在 FileBatchUploadInit 之后调用
export async function processBatchFileUploads(
  batchInitResponse: any,
  uploads: any[],
  dynamicForm: any,
  selectedSchemaId?: string | number,
  textFields?: any[],
  batchTaskIds?: string[], // 新增：batch 任务 ID 列表
  userProvidedSampleId?: string, // 新增：用户填写的 sample_id，用于 complete 接口
  onTaskProgress?: (taskId: string, progress: number) => void,
  onTaskCompleted?: (taskId: string, status: 'success' | 'error', error?: string) => void
): Promise<any> {
  try {
    // 从响应中提取上传URLs
    // 响应格式: { status: "success", upload_files: [ { sample_id, upload_urls: [ { field_name, upload_url, s3_key }, ... ] }, ... ] }
    const responseData = batchInitResponse?.data || batchInitResponse;
    console.log('批量上传初始化响应数据:', responseData);

    const uploadFilesArray = responseData?.upload_files || [];
    console.log('批量上传文件数组:', uploadFilesArray);

    if (!Array.isArray(uploadFilesArray) || uploadFilesArray.length === 0) {
      const errorMsg = '批量上传初始化失败：未获取到上传URL';
      console.error('响应数据:', responseData);
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // 构建 (sample_id, field_name) -> uploadUrl 的映射
    // 需要把分组的结构展平
    const uploadUrlMap = new Map<string, any>();
    for (const uploadFileGroup of uploadFilesArray) {
      const sample_id = uploadFileGroup.sample_id;
      const uploadUrlsList = uploadFileGroup.upload_urls || [];
      for (const urlInfo of uploadUrlsList) {
        // 确保 urlInfo 包含 sample_id（响应中可能没有，需要从 uploadFileGroup 获取）
        const completeUrlInfo = {
          ...urlInfo,
          sample_id: sample_id
        };
        const key = `${sample_id}|${urlInfo.field_name}`;
        uploadUrlMap.set(key, completeUrlInfo);
      }
    }
    console.log('上传URL映射表:', uploadUrlMap);
    
    const fileEntries = collectFileEntries(dynamicForm);

    console.log('收集的文件条目:', fileEntries);

    // 为每个 field_name 维护一个使用计数，确保多个批次不会使用同一个文件
    const fileUsageIndex = new Map<string, number>();

    // 创建 sample_id -> batch taskId 的映射（如果提供了 batchTaskIds）
    const batchTaskIdMap = new Map<string, string>();
    if (batchTaskIds && batchTaskIds.length === uploads.length) {
      for (let i = 0; i < uploads.length; i++) {
        batchTaskIdMap.set(uploads[i].sample_id, batchTaskIds[i]);
      }
    }

    // 为每个 batch 创建处理Promise，使得所有批次异步并行执行
    const batchProcessPromises: Promise<any>[] = [];

    for (let batchIndex = 0; batchIndex < uploads.length; batchIndex++) {
      const batchPromise = (async () => {
        try {
          const batch = uploads[batchIndex];
          const sample_id = batch.sample_id;
          const batchTaskId = batchTaskIdMap.get(sample_id);
          const uploadedFilesForBatch: any[] = [];
          const batchUploadPromises: Promise<void>[] = [];
          const uploadErrorMap = new Map<string, string>(); // 记录上传失败的任务

          console.log(`\n开始处理批次 ${batchIndex + 1} (sample_id: ${sample_id})`);

          // 遍历这个 batch 中的所有 field
          for (let fieldIndex = 0; fieldIndex < (batch.fields || []).length; fieldIndex++) {
            const field = batch.fields[fieldIndex];
            console.log('处理字段:', field);
            const field_name = field.field_name;
            const content_type = field.content_type; // 从请求中获取指定的 content_type

            // 根据 sample_id 和 field_name 查找对应的上传URL
            const mapKey = `${sample_id}|${field_name}`;
            const uploadUrlInfo = uploadUrlMap.get(mapKey);
            console.log(`处理样本 ${sample_id} 字段 ${field_name} 的上传URL:`, uploadUrlInfo);

            if (!uploadUrlInfo) {
              const errorMsg = `未找到 sample_id=${sample_id}, field_name=${field_name} 的上传URL`;
              console.error(errorMsg);
              uploadErrorMap.set(`${field_name}_url_missing`, errorMsg);
              continue;
            }

            // 从 dynamicForm 中找到对应的文件对象
            // 使用索引确保多个批次不会使用同一个文件
            const currentIndex = fileUsageIndex.get(field_name) || 0;
            let fileEntryCount = 0;
            let fileEntry: any = null;
            
            for (const entry of fileEntries) {
              if (entry.field_name === field_name) {
                if (fileEntryCount === currentIndex) {
                  fileEntry = entry;
                  break;
                }
                fileEntryCount++;
              }
            }
            
            // 更新该字段的使用索引，指向下一个文件
            fileUsageIndex.set(field_name, currentIndex + 1);

            if (!fileEntry) {
              const errorMsg = `未找到字段 ${field_name} 的第 ${currentIndex + 1} 个文件数据`;
              console.error(errorMsg);
              uploadErrorMap.set(`${field_name}_file_missing_${currentIndex}`, errorMsg);
              continue;
            }

            // 使用 batch taskId（如果有的话）
            const taskId = batchTaskId || `batch_upload_${sample_id}_${field_name}_${fieldIndex}`;

            // 创建上传Promise
            const uploadPromise = (async () => {
              try {
                const uploadClient = createUploadAxiosInstance();
                const cancelTokenSource = axios.CancelToken.source();
                const lastProgress = { current: 0 };

                // 注册任务用于全局管理
                registerUploadTask(taskId, cancelTokenSource, uploadClient);

                console.log(`开始上传 [样本${sample_id}] ${field_name}: ${uploadUrlInfo.upload_url}`);
                console.log(`文件信息: 名称=${fileEntry.file.name}, 大小=${fileEntry.file.size}, 类型=${fileEntry.file.type}`);
                // 执行上传 - 使用指定的 content_type（如果有的话），否则使用浏览器识别的类型
                const uploadContentType = content_type || fileEntry.file.type || 'application/octet-stream';
                const response = await uploadClient.put(uploadUrlInfo.upload_url, fileEntry.file, {
                  headers: {
                    'Content-Type': uploadContentType,
                  },
                  onUploadProgress: (progressEvent: any) => {
                    trackUploadProgress(progressEvent, taskId, onTaskProgress, lastProgress);
                  },
                  cancelToken: cancelTokenSource.token
                });

                console.log(`PUT 请求响应状态码: ${response.status}, 状态文本: ${response.statusText}`);

                // 检查响应状态码，200-299 为成功
                if (!response.status || response.status < 200 || response.status >= 300) {
                  const errorMsg = `PUT 上传失败: HTTP ${response.status} ${response.statusText || ''}`;
                  console.error(errorMsg);
                  if (response.data) {
                    console.error('服务器响应:', response.data);
                  }
                  throw new Error(errorMsg);
                }

                console.log('PUT 响应数据:', response.data);

                // 确保进度显示为100%
                if (onTaskProgress) {
                  onTaskProgress(taskId, 100);
                }

                console.log(`上传完成 [样本${sample_id}] ${field_name} -> ${uploadUrlInfo.s3_key}`);

                // 记录此 batch 的已上传文件信息
                try {
                  const sha256 = await hashFile(fileEntry.file);
                  uploadedFilesForBatch.push({
                    field_name: field.field_name,
                    origin_filename: fileEntry.file.name,
                    s3_key: uploadUrlInfo.s3_key,
                    file_type: fileEntry.file.type || 'application/octet-stream',
                    file_size: fileEntry.file.size,
                    file_hash: sha256
                  });
                } catch {
                  uploadedFilesForBatch.push({
                    field_name: field.field_name,
                    origin_filename: fileEntry.file.name,
                    s3_key: uploadUrlInfo.s3_key,
                    file_type: fileEntry.file.type || 'application/octet-stream',
                    file_size: fileEntry.file.size,
                    file_hash: 'error'
                  });
                }
              } catch (err: any) {
                if (axios.isCancel(err)) {
                  console.log(`任务 ${taskId} 已被用户取消`);
                  uploadErrorMap.set(taskId, '已取消');
                  if (onTaskCompleted) {
                    onTaskCompleted(taskId, 'error', '已取消');
                  }
                } else {
                  // 详细的错误信息
                  let errorMsg = err?.message || '上传失败';
                  if (err?.response) {
                    errorMsg = `上传失败 (HTTP ${err.response.status}): ${err.response.statusText || err.message}`;
                    console.error(`任务 ${taskId} HTTP 错误响应:`, err.response.data);
                  } else if (err?.request) {
                    errorMsg = `上传失败: 无响应 (${err.message})`;
                    console.error(`任务 ${taskId} 请求无响应:`, err);
                  }
                  
                  console.error(`任务 ${taskId} 上传失败:`, errorMsg);
                  uploadErrorMap.set(taskId, errorMsg);
                  if (onTaskCompleted) {
                    onTaskCompleted(taskId, 'error', errorMsg);
                  }
                }
              } finally {
                cleanupUploadTask(taskId);
              }
            })();

            batchUploadPromises.push(uploadPromise);
          }

          console.log(`批次 ${batchIndex + 1} 准备执行 ${batchUploadPromises.length} 个上传任务`);

          // 如果这个 batch 中没有任何文件需要上传，标记为错误
          if (batchUploadPromises.length === 0) {
            const errorMsg = `批次 ${batchIndex + 1} 中没有找到任何可上传的文件`;
            console.error(errorMsg);
            if (batchTaskId && onTaskCompleted) {
              onTaskCompleted(batchTaskId, 'error', errorMsg);
            }
            return { success: false, error: errorMsg };
          }

          // 等待这个 batch 的所有文件上传完成
          await Promise.all(batchUploadPromises);

          // 检查此 batch 中是否有上传失败的任务
          if (uploadErrorMap.size > 0) {
            const failedTasks = Array.from(uploadErrorMap.entries());
            console.error(`批次 ${batchIndex + 1} 中有 ${failedTasks.length} 个任务出现问题:`, failedTasks);
            return { success: false, error: `批次 ${batchIndex + 1} 文件上传失败` };
          }

          // 检查是否有任何文件被成功上传
          if (uploadedFilesForBatch.length === 0) {
            const errorMsg = `批次 ${batchIndex + 1} 中没有任何文件被成功上传`;
            console.error(errorMsg);
            if (batchTaskId && onTaskCompleted) {
              onTaskCompleted(batchTaskId, 'error', errorMsg);
            }
            return { success: false, error: errorMsg };
          }

          // 所有文件都上传成功，现在调用 complete 接口
          // 只有 complete 成功后，才认为该批次真正成功
          if (!selectedSchemaId) {
            const errorMsg = `批次 ${batchIndex + 1} 缺少必要的 schemaId，无法完成上传`;
            console.error(errorMsg);
            if (batchTaskId && onTaskCompleted) {
              onTaskCompleted(batchTaskId, 'error', errorMsg);
            }
            return { success: false, error: errorMsg };
          }

          try {
            // 构建描述 JSON
            const descriptionJson = buildDescriptionJson(uploadedFilesForBatch, textFields || [], dynamicForm);
            
            // 确定要使用的 file_name：优先使用用户填写的，如果没有则使用 sample_id
            const completeFileName = userProvidedSampleId && userProvidedSampleId.trim() 
              ? userProvidedSampleId.trim()
              : sample_id;
            
            console.log(`\n批次 ${batchIndex + 1} 所有文件上传完成，调用 complete 接口 (sample_id=${sample_id}, file_name=${completeFileName})`, {
              file_type_id: selectedSchemaId,
              file_name: completeFileName,
              description_json: descriptionJson,
              uploaded_files: uploadedFilesForBatch
            });

            // 调用 complete 接口
            await FileUploadComplete({
              file_type_id: Number(selectedSchemaId),
              file_name: completeFileName,
              description_json: descriptionJson,
              uploaded_files: uploadedFilesForBatch
            });

            console.log(`批次 ${batchIndex + 1} (sample_id=${sample_id}) 的 complete 接口调用成功，标记任务为成功`);
            
            // Complete 接口调用成功后，才更新任务状态为成功
            if (batchTaskId && onTaskCompleted) {
              onTaskCompleted(batchTaskId, 'success');
            }
          } catch (err: any) {
            console.error(`批次 ${batchIndex + 1} (sample_id=${sample_id}) 的 complete 接口调用失败:`, err?.message);
            // Complete 失败，更新任务状态为错误
            if (batchTaskId && onTaskCompleted) {
              onTaskCompleted(batchTaskId, 'error', `完成上传失败: ${err?.message}`);
            }
            return { success: false, error: `Complete 接口调用失败: ${err?.message}` };
          }

          console.log(`\n批次 ${batchIndex + 1} 完全处理完成\n`);
          return { success: true };
        } catch (err: any) {
          console.error(`批次处理异常:`, err);
          return { success: false, error: err?.message || '批次处理失败' };
        }
      })();

      batchProcessPromises.push(batchPromise);
    }

    // 并行执行所有批次，使用 Promise.allSettled 确保不会因为某个批次失败而中断其他批次
    const batchResults = await Promise.allSettled(batchProcessPromises);
    
    // 检查所有批次的结果
    const failedBatches = batchResults.filter((result, index) => 
      result.status === 'rejected' || (result.status === 'fulfilled' && !result.value?.success)
    );

    if (failedBatches.length > 0) {
      const errorMsg = `有 ${failedBatches.length} 个批次处理失败`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err: any) {
    console.error('批量上传过程中出错:', err);
    return { success: false, error: err?.message || '批量上传失败' };
  }
}
