import { useRouter } from 'vue-router';
import { usePermissionStore } from '@/store/modules/permission';
import { $t } from '@/locales';

/**
 * 将权限类型从 snake_case 转换为 camelCase（用于 i18n 键）
 *
 * @param permissionType - 权限类型（如 'task_chain'）
 * @returns camelCase 格式的权限键（如 'taskChain'）
 */
export function getI18nPermissionKey(permissionType: Api.Permission.PermissionType): string {
  return permissionType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** 权限守卫钩子 - 用于检查用户权限并引导申请 */
export function usePermissionGuard() {
  const router = useRouter();
  const permissionStore = usePermissionStore();

  /**
   * 检查是否有指定权限，如果没有则引导用户申请
   *
   * @param permissionType 权限类型
   * @param options 配置选项
   * @returns Promise<boolean> 是否有权限
   */
  async function checkAndRequestPermission(
    permissionType: Api.Permission.PermissionType,
    options?: {
      title?: string;
      message?: string;
      autoRedirect?: boolean;
    }
  ): Promise<boolean> {
    // 检查是否有权限
    const hasAccess = permissionStore.hasPermission(permissionType);

    if (hasAccess) {
      return true;
    }

    // 如果没有权限，引导用户申请
    try {
      const title = options?.title || $t('common.permissionDenied');
      const permissionKey = getI18nPermissionKey(permissionType);
      const message =
        options?.message ||
        $t('page.permission.noPermissionGuide', {
          name: $t(`page.permission.${permissionKey}` as any)
        });

      await window.$messageBox?.confirm(message, title, {
        confirmButtonText: $t('page.permission.applyPermission'),
        cancelButtonText: $t('common.cancel'),
        type: 'warning'
      });

      // 用户同意申请，跳转到申请页面
      router.push({
        name: 'permission_apply',
        query: { type: permissionType }
      });

      return false;
    } catch {
      // 用户取消
      return false;
    }
  }

  /**
   * 检查权限并提示，但不自动跳转
   *
   * @param permissionType 权限类型
   * @returns Promise<boolean> 是否有权限
   */
  async function checkPermissionAndNotify(permissionType: Api.Permission.PermissionType): Promise<boolean> {
    const hasAccess = permissionStore.hasPermission(permissionType);

    if (!hasAccess) {
      const permissionKey = getI18nPermissionKey(permissionType);
      window.$message?.warning(
        $t('page.permission.noPermission', {
          name: $t(`page.permission.${permissionKey}` as any)
        })
      );
    }

    return hasAccess;
  }

  return {
    checkAndRequestPermission,
    checkPermissionAndNotify
  };
}

/** 简单的权限检查钩子 - 同步检查，不引导申请 */
export function useSimplePermissionCheck() {
  const permissionStore = usePermissionStore();

  /**
   * 同步检查是否有指定权限
   *
   * @param permissionType 权限类型
   * @returns boolean 是否有权限
   */
  function hasPermission(permissionType: Api.Permission.PermissionType): boolean {
    return permissionStore.hasPermission(permissionType);
  }

  /**
   * 检查是否有多个权限中的任意一个
   *
   * @param permissionTypes 权限类型数组
   * @returns boolean 是否有任意一个权限
   */
  function hasAnyPermission(permissionTypes: Api.Permission.PermissionType[]): boolean {
    return permissionTypes.some(type => hasPermission(type));
  }

  /**
   * 检查是否拥有所有指定的权限
   *
   * @param permissionTypes 权限类型数组
   * @returns boolean 是否拥有所有权限
   */
  function hasAllPermissions(permissionTypes: Api.Permission.PermissionType[]): boolean {
    return permissionTypes.every(type => hasPermission(type));
  }

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  };
}
