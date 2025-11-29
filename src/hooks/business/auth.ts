import { useAuthStore } from '@/store/modules/auth';

export function useAuth() {
  const authStore = useAuthStore();

  function hasAuth(permissionTypes: string | string[]) {
    if (!authStore.isLogin) {
      return false;
    }

    const permissions = authStore.userInfo.permissions;

    // admin has all permissions
    if (permissions.includes('admin')) {
      return true;
    }

    if (typeof permissionTypes === 'string') {
      return permissions.includes(permissionTypes);
    }

    return permissionTypes.some(type => permissions.includes(type));
  }

  return {
    hasAuth
  };
}
