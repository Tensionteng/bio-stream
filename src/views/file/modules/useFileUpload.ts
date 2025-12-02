import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  processFileUploads,
  buildDescriptionJson,
  getFileNameFromSchema,
  completeFileUpload,
  cancelUploadTask as cancelUploadTaskGlobal
} from './FileUploadHandler';

export function useFileUpload() {
  const uploadLoading = ref(false);
  const uploadTaskList = ref<any[]>([]);

  // 添加上传任务到列表
  function addUploadTask(fileName: string): string {
    const taskId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    uploadTaskList.value.push({
      id: taskId,
      fileName,
      progress: 0,
      status: 'uploading'
    });
    return taskId;
  }

  // 更新上传任务进度（实时捕捉传输进度）
  function updateUploadTaskProgress(taskId: string, progress: number) {
    const task = uploadTaskList.value.find(t => t.id === taskId);
    if (task) {
      // 确保进度单调递增，并记录进度变化
      if (progress > task.progress) {
        task.progress = progress;
        // 可选：添加进度更新日志用于调试
        console.log(`[${task.fileName}] 上传进度: ${progress}%`);
      }
    }
  }

  // 更新上传任务状态
  function updateUploadTaskStatus(
    taskId: string,
    status: 'uploading' | 'success' | 'error',
    error?: string
  ) {
    const task = uploadTaskList.value.find(t => t.id === taskId);
    if (task) {
      const previousStatus = task.status;
      task.status = status;
      
      // 上传成功或失败时，将进度设置为100%
      if (status !== 'uploading') {
        task.progress = 100;
      }
      
      if (error) {
        task.error = error;
      }
      
      // 记录状态变化
      console.log(`[${task.fileName}] 状态变更: ${previousStatus} -> ${status}${error ? ` (${error})` : ''}`);
    }
  }

  // 取消单个上传任务
  function cancelUploadTask(taskId: string) {
    const task = uploadTaskList.value.find(t => t.id === taskId);
    if (task) {
      task.canceling = true;
      // 调用全局取消机制
      cancelUploadTaskGlobal(taskId);
      
      console.log(`正在取消任务 ${taskId}: ${task.fileName}`);
      
      // 异步处理状态更新
      setTimeout(() => {
        if (task.status === 'uploading') {
          task.status = 'error';
          task.error = '已取消';
        }
        task.canceling = false;
      }, 100);
    }
  }

  // 删除上传任务
  function removeUploadTask(taskId: string) {
    const index = uploadTaskList.value.findIndex(t => t.id === taskId);
    if (index > -1) {
      uploadTaskList.value.splice(index, 1);
    }
  }

  // 处理提交和上传
  async function handleSubmit(
    dynamicForm: any,
    selectedSchema: any,
    textFields: any[],
    fileFields: any[],
    validateFileFields: () => boolean,
    validateTextFields: () => boolean,
    resetForm: () => void,
    onSuccess?: () => void
  ) {
    if (!selectedSchema) return;

    // 验证字段
    if (!validateFileFields() || !validateTextFields()) return;

    uploadLoading.value = true;
    try {
      // 处理文件上传
      const uploadedFiles = await processFileUploads(
        dynamicForm,
        selectedSchema.id,
        (taskId, fileName) => {
          // taskId 由 processFileUploads 生成，直接使用
          uploadTaskList.value.push({
            id: taskId,
            fileName,
            progress: 0,
            status: 'uploading'
          });
        },
        (taskId, progress) => updateUploadTaskProgress(taskId, progress),
        (taskId, status, error) => updateUploadTaskStatus(taskId, status, error)
      );

      if (uploadedFiles.length === 0) {
        ElMessage.error('文件上传失败');
        uploadLoading.value = false;
        return;
      }

      // 构建描述JSON
      const descriptionJson = buildDescriptionJson(uploadedFiles, textFields, dynamicForm);

      // 完成上传
      console.log('上传文件信息:', uploadedFiles);
      await completeFileUpload(
        selectedSchema.id,
        getFileNameFromSchema(dynamicForm),
        descriptionJson,
        uploadedFiles
      );

      // 文件上传成功
      ElMessage.success('文件上传成功');
      resetForm();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (e: any) {
      ElMessage.error(`上传失败: ${e.message || '未知错误'}`);
    } finally {
      uploadLoading.value = false;
    }
  }

  return {
    uploadLoading,
    uploadTaskList,
    addUploadTask,
    updateUploadTaskProgress,
    updateUploadTaskStatus,
    cancelUploadTask,
    removeUploadTask,
    handleSubmit
  };
}
