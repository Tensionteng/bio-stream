import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  processFileUploads,
  buildDescriptionJson,
  getFileNameFromSchema,
  completeFileUpload
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

  // 更新上传任务进度
  function updateUploadTaskProgress(taskId: string, progress: number) {
    const task = uploadTaskList.value.find(t => t.id === taskId);
    if (task) {
      task.progress = progress;
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
      task.status = status;
      if (error) {
        task.error = error;
      }
    }
  }

  // 取消单个上传任务
  function cancelUploadTask(taskId: string) {
    const task = uploadTaskList.value.find(t => t.id === taskId);
    if (task) {
      task.canceling = true;
      if (task.cancelTokenSource) {
        task.cancelTokenSource.cancel('用户取消上传');
      }
      setTimeout(() => {
        if (task.status === 'uploading') {
          task.status = 'error';
          task.error = '已取消';
        }
        task.canceling = false;
      }, 300);
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
        (taskId, fileName) => addUploadTask(fileName),
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
