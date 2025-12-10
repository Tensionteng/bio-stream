import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  processBatchFileUploads,
  cancelUploadTask as cancelUploadTaskGlobal
} from './FileUploadHandler';
import { FileBatchUploadInit } from '@/service/api/file';
import { getSampleIdValue } from './FileUploadHandler';

// ==================== 文件上传 Composition API ====================

/**
 * 文件上传管理 Hook
 * 管理批量文件上传的整个生命周期，包括初始化、分组、上传和状态跟踪
 */
export function useFileUpload() {
  // 上传状态管理
  const uploadLoading = ref(false); // 全局上传加载状态
  const uploadTaskList = ref<any[]>([]); // 上传任务列表，用于显示进度

  /**
   * 添加新的上传任务到列表
   * @param fileName 显示用的文件名
   * @returns 生成的任务ID
   */
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

  /**
   * 实时更新上传任务的进度
   * 确保进度单调递增
   * @param taskId 任务ID
   * @param progress 进度百分比 (0-100)
   */
  function updateUploadTaskProgress(taskId: string, progress: number) {
    const task = uploadTaskList.value.find(t => t.id === taskId);
    if (task) {
      // 确保进度单调递增
      if (progress > task.progress) {
        task.progress = progress;
        console.log(`[${task.fileName}] 上传进度: ${progress}%`);
      }
    }
  }

  /**
   * 更新上传任务的状态
   * @param taskId 任务ID
   * @param status 新状态 (uploading | success | error)
   * @param error 错误信息
   */
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

  /**
   * 取消单个上传任务
   * 设置取消标志，调用全局取消机制
   * @param taskId 任务ID
   */
  function cancelUploadTask(taskId: string) {
    const task = uploadTaskList.value.find(t => t.id === taskId);
    if (task) {
      task.canceling = true; // 标记为取消中
      // 调用全局取消机制，中止网络请求
      cancelUploadTaskGlobal(taskId);
      
      console.log(`正在取消任务 ${taskId}: ${task.fileName}`);
      
      // 异步处理状态更新，确保UI有时间显示取消中状态
      setTimeout(() => {
        if (task.status === 'uploading') {
          task.status = 'error'; // 标记为失败
          task.error = '已取消';
        }
        task.canceling = false;
      }, 100);
    }
  }

  /**
   * 从任务列表中移除上传任务
   * 用于清除已完成或已取消的任务
   * @param taskId 任务ID
   */
  function removeUploadTask(taskId: string) {
    const index = uploadTaskList.value.findIndex(t => t.id === taskId);
    if (index > -1) {
      uploadTaskList.value.splice(index, 1); // 从数组中删除
    }
  }

  /**
   * 处理批量文件上传的主流程
   * 包括验证、分组、初始化和实际上传等步骤
   */
  async function handleBatchSubmit(
    dynamicForm: any,
    selectedSchema: any,
    textFields: any[],
    fileFields: any[],
    fileFieldGroupSizes: Record<string, number>, // 每个文件字段的分组数量
    getUploadedFilesForField: (field: any) => any[],
    validateFileFields: () => boolean,
    validateTextFields: () => boolean,
    resetForm: () => void,
    onSuccess?: () => void
  ) {
    if (!selectedSchema) return;

    // 验证所有字段的输入（文本字段和文件字段）
    if (!validateFileFields() || !validateTextFields()) return;

    uploadLoading.value = true;
    try {
      // ==================== 分组配置验证 ====================
      // 验证分组数量并检查文件数量是否能整除
      const fileTypeGroups: Record<string, any> = {};
      
      for (const field of fileFields) {
        // 检查分组数量是否有效（必须大于0）
        if ((fileFieldGroupSizes[field.name] || 0) < 1) {
          ElMessage.error(`${field.label}的分组数量必须大于0`);
          uploadLoading.value = false;
          return;
        }
        
        const files = getUploadedFilesForField(field);
        const groupSize = fileFieldGroupSizes[field.name] || 1;
        
        // 验证文件数量是否能被分组数量整除
        // 例如：5个文件，分组数2，则5 % 2 = 1（无法整除，报错）
        if (files.length > 0 && files.length % groupSize !== 0) {
          ElMessage.error(`${field.label}的文件数量(${files.length})不能被分组数量(${groupSize})整除`);
          uploadLoading.value = false;
          return;
        }
        
        // 只有有文件的字段才加入分组配置
        if (files.length > 0) {
          fileTypeGroups[field.name] = {
            field,
            files,
            groupSize,
            rounds: files.length / groupSize, // 该文件类型的总分组轮次
            index: 0 // 当前文件索引
          };
        }
      }

      // ==================== 表单数据构建 ====================
      // 构造 content_json（只保留非文件字段）
      const contentJson: any = {};
      textFields.forEach(f => {
        // 跳过动态对象类型字段（这些在后续单独处理）
        if (f.type === 'dynamic-object') return;
        const val = dynamicForm[f.name];
        // 只添加有值的字段
        if (val !== undefined && val !== '' && val !== null) {
          contentJson[f.name] = val;
        }
      });

      // 如果表单中没有文件字段，直接上传（只上传非文件字段）
      if (Object.keys(fileTypeGroups).length === 0) {
        console.log('表单中没有文件字段，直接上传非文件字段');
        
        // 为表单提交生成一个上传任务
        const taskId = addUploadTask('表单数据提交');
        
        await FileBatchUploadInit(selectedSchema.id, contentJson, []);
        
        // 更新任务状态为成功
        updateUploadTaskStatus(taskId, 'success');
        
        ElMessage.success('表单提交成功');
        resetForm();
        if (onSuccess) {
          onSuccess();
        }
        uploadLoading.value = false;
        return;
      }

      // 检查所有文件类型的轮次是否一致
      const rounds = Object.values(fileTypeGroups).map((g: any) => g.rounds);
      if (new Set(rounds).size > 1) {
        // 轮次不一致，找出问题
        const roundsMap: Record<number, string[]> = {};
        for (const fieldName in fileTypeGroups) {
          const group = fileTypeGroups[fieldName];
          const r = group.rounds;
          if (!roundsMap[r]) roundsMap[r] = [];
          roundsMap[r].push(`${group.field.label}(文件数:${group.files.length}, 分组:${group.groupSize})`);
        }
        
        let errorMsg = '各文件类型的总分组轮次不一致，无法进行轮流分组:\n';
        for (const r in roundsMap) {
          errorMsg += `  ${r}轮: ${roundsMap[r].join(', ')}\n`;
        }
        errorMsg += '\n请调整分组数量或文件数量使得所有文件类型的轮次相同';
        ElMessage.error(errorMsg);
        uploadLoading.value = false;
        return;
      }

      // 轮流从各个文件类型中分组抽取文件，每一轮生成一个uploadItem，其fields包含所有文件类型
      const uploads: any[] = [];
      const totalRounds = rounds[0]; // 所有文件类型的轮次都一样
      
      for (let round = 0; round < totalRounds; round++) {
        const fields: any[] = [];
        
        // 在这一轮中，从所有文件类型中抽取对应数量的文件
        for (const fieldName in fileTypeGroups) {
          const group = fileTypeGroups[fieldName];
          const groupSize = group.groupSize;
          
          // 从该文件类型中抽取这一轮对应的文件
          for (let i = 0; i < groupSize; i++) {
            const fileInfo = group.files[group.index++];
            fields.push({
              field_name: group.field.originalName || group.field.name,
              filename: fileInfo.path.split('/').pop() || fileInfo.path.split('\\').pop() || fileInfo.path,
              content_type: fileInfo.file_type
            });
          }
        }
        
        const uploadItem = {
          sample_id: `sample_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          fields
        };
        uploads.push(uploadItem);
      }

      console.log('批量上传请求数据:', {
        file_type_id: selectedSchema.id,
        content_json: contentJson,
        uploads
      });

      // 为每个uploadItem生成一个上传任务
      const taskIds: string[] = [];
      for (let i = 0; i < uploads.length; i++) {
        const uploadItem = uploads[i];
        const fileNames = uploadItem.fields.map((f: any) => f.filename).join(', ');
        const taskId = addUploadTask(`批次${i + 1}: ${fileNames}`);
        taskIds.push(taskId);
      }

      // Step 1: 调用批量上传初始化接口
      console.log('调用 FileBatchUploadInit...');
      let batchInitResponse: any;
      try {
        batchInitResponse = await FileBatchUploadInit(selectedSchema.id, contentJson, uploads);
        console.log('FileBatchUploadInit 响应:', batchInitResponse);
        
        // Init 成功，更新所有任务状态为 uploading（进度条开始显示）
        taskIds.forEach(tid => updateUploadTaskStatus(tid, 'uploading'));
      } catch (initError: any) {
        console.error('初始化失败:', initError);
        // 初始化失败，标记所有任务为错误
        taskIds.forEach(tid => updateUploadTaskStatus(tid, 'error', `初始化失败: ${initError.message || '未知错误'}`));
        ElMessage.error(`初始化上传失败: ${initError.message || '未知错误'}`);
        uploadLoading.value = false;
        return;
      }

      // Step 2: 处理实际的文件上传
      console.log('开始处理实际的文件上传...');
      const batchUploadResult = await processBatchFileUploads(
        batchInitResponse,
        uploads,
        dynamicForm,
        selectedSchema.id,
        textFields,
        taskIds, // 传入 batch taskIds
        getSampleIdValue(dynamicForm), // 传入用户填写的样本唯一标识符（支持多种字段名）
        // onTaskProgress callback
        (taskId: string, progress: number) => {
          updateUploadTaskProgress(taskId, progress);
        },
        // onTaskCompleted callback
        (taskId: string, status: 'success' | 'error', error?: string) => {
          updateUploadTaskStatus(taskId, status, error);
        }
      );

      if (!batchUploadResult.success) {
        // 上传或 complete 失败，错误信息已由 updateUploadTaskStatus 处理
        ElMessage.error(`文件上传失败: ${batchUploadResult.error}`);
        uploadLoading.value = false;
        return;
      }

      // 所有文件上传成功（所有 complete 接口调用成功）
      ElMessage.success('文件上传成功');
      resetForm();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (e: any) {
      ElMessage.error(`上传失败: ${e.message || '未知错误'}`);
      console.error('上传失败详情:', e);
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
    handleBatchSubmit
  };
}
