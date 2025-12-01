import type {
  LocationQueryRaw,
  NavigationGuardNext,
  RouteLocationNormalized,
  RouteLocationRaw,
  Router
} from 'vue-router';
import type { RouteKey, RoutePath } from '@elegant-router/types';
import { useAuthStore } from '@/store/modules/auth';
import { useRouteStore } from '@/store/modules/route';
import { getI18nPermissionKey } from '@/hooks/business/permission-guard';
import { localStg } from '@/utils/storage';
import { $t } from '@/locales';
import { getRouteName } from '@/router/elegant/transform';

/**
 * create route guard
 *
 * @param router router instance
 */
/** 检查用户是否登录 */
function checkUserLogin(): boolean {
  return Boolean(localStg.get('token'));
}

/** 检查用户是否有路由角色权限 */
function checkRouteRoleAuth(to: RouteLocationNormalized): boolean {
  const authStore = useAuthStore();
  const routeRoles = to.meta.roles || [];

  if (!routeRoles.length) return true;

  const hasRole = authStore.userInfo.permissions.some(role => routeRoles.includes(role));
  return authStore.isStaticSuper || hasRole;
}

/** 检查路由权限 */
async function checkRoutePermission(to: RouteLocationNormalized): Promise<boolean> {
  const requiredPermission = to.meta?.requiredPermission as Api.Permission.PermissionType | undefined;

  if (!requiredPermission) return true;

  // 动态导入permission store和auth store
  const [permissionModule, authModule] = await Promise.all([
    import('@/store/modules/permission'),
    import('@/store/modules/auth')
  ]);
  const permissionStore = permissionModule.usePermissionStore();
  const currentAuthStore = authModule.useAuthStore();

  // 检查是否是管理员（管理员拥有所有权限）
  const isAdmin = currentAuthStore.userInfo.permissions.includes('admin');

  // 检查是否有权限（管理员直接通过）
  return isAdmin || permissionStore.hasPermission(requiredPermission);
}

/** 处理权限申请引导 */
async function handlePermissionApplyGuide(to: RouteLocationNormalized): Promise<RouteLocationRaw | null> {
  const requiredPermission = to.meta?.requiredPermission as Api.Permission.PermissionType | undefined;

  if (!requiredPermission) return null;

  const hasPermission = await checkRoutePermission(to);

  if (hasPermission) return null;

  try {
    // 将权限类型从 snake_case 转换为 camelCase（用于 i18n 键）
    const permissionKey = getI18nPermissionKey(requiredPermission);

    // 弹出确认框询问是否申请权限
    await window.$messageBox?.confirm(
      $t('page.permission.noPermissionGuide', {
        name: $t(`page.permission.${permissionKey}` as any)
      }),
      $t('common.permissionDenied'),
      {
        confirmButtonText: $t('page.permission.applyPermission'),
        cancelButtonText: $t('common.cancel'),
        type: 'warning'
      }
    );

    // 跳转到权限申请页面
    return {
      name: 'permission_apply',
      query: { type: requiredPermission }
    };
  } catch {
    // 用户取消，停留在原页面
    return null;
  }
}

/** 检查权限页面的角色访问控制 */
async function checkPermissionPageAccess(to: RouteLocationNormalized): Promise<RouteLocationRaw | null> {
  const permissionPages = ['permission_apply', 'permission_manage', 'permission_my'];

  if (!to.name || !permissionPages.includes(to.name as string)) {
    return null;
  }

  // 动态导入auth store和route store
  const [authModule, routeModule] = await Promise.all([
    import('@/store/modules/auth'),
    import('@/store/modules/route')
  ]);
  const currentAuthStore = authModule.useAuthStore();
  const routeStore = routeModule.useRouteStore();
  const isAdmin = currentAuthStore.userInfo.permissions.includes('admin');

  // 如果不是管理员，不允许访问权限审批页面
  if (!isAdmin && to.name === 'permission_manage') {
    window.$message?.error('您没有权限访问该页面');
    return { name: routeStore.routeHome };
  }

  // 如果是管理员，不允许访问申请权限和权限申请记录页面
  if (isAdmin && (to.name === 'permission_apply' || to.name === 'permission_my')) {
    window.$message?.warning($t('page.permission.adminNoNeedApply'));
    return { name: routeStore.routeHome };
  }

  return null;
}

/**
 * create route guard
 *
 * @param router router instance
 */
export function createRouteGuard(router: Router) {
  router.beforeEach(async (to, from, next) => {
    // 初始化路由
    const initLocation = await initRoute(to);
    if (initLocation) {
      next(initLocation);
      return;
    }

    const rootRoute: RouteKey = 'root';
    const loginRoute: RouteKey = 'login';
    const noAuthorizationRoute: RouteKey = '403';

    const isLogin = checkUserLogin();
    const needLogin = !to.meta.constant;

    // 登录页面重定向
    if (to.name === loginRoute && isLogin) {
      next({ name: rootRoute });
      return;
    }

    // 无需登录的页面直接放行
    if (!needLogin) {
      handleRouteSwitch(to, from, next);
      return;
    }

    // 需要登录但未登录
    if (!isLogin) {
      next({ name: loginRoute, query: { redirect: to.fullPath } });
      return;
    }

    // 检查角色权限
    if (!checkRouteRoleAuth(to)) {
      next({ name: noAuthorizationRoute });
      return;
    }

    // 处理权限申请引导
    const permissionLocation = await handlePermissionApplyGuide(to);
    if (permissionLocation !== null) {
      next(permissionLocation);
      return;
    }

    // 检查权限页面访问控制
    const permissionPageLocation = await checkPermissionPageAccess(to);
    if (permissionPageLocation !== null) {
      next(permissionPageLocation);
      return;
    }

    // 正常切换路由
    handleRouteSwitch(to, from, next);
  });
}

/**
 * initialize route
 *
 * @param to to route
 */
async function initRoute(to: RouteLocationNormalized): Promise<RouteLocationRaw | null> {
  const routeStore = useRouteStore();

  const notFoundRoute: RouteKey = 'not-found';
  const isNotFoundRoute = to.name === notFoundRoute;

  // if the constant route is not initialized, then initialize the constant route
  if (!routeStore.isInitConstantRoute) {
    await routeStore.initConstantRoute();

    // the route is captured by the "not-found" route because the constant route is not initialized
    // after the constant route is initialized, redirect to the original route
    const path = to.fullPath;
    const location: RouteLocationRaw = {
      path,
      replace: true,
      query: to.query,
      hash: to.hash
    };

    return location;
  }

  const isLogin = Boolean(localStg.get('token'));

  if (!isLogin) {
    // if the user is not logged in and the route is a constant route but not the "not-found" route, then it is allowed to access.
    if (to.meta.constant && !isNotFoundRoute) {
      routeStore.onRouteSwitchWhenNotLoggedIn();

      return null;
    }

    // if the user is not logged in, then switch to the login page
    const loginRoute: RouteKey = 'login';
    const query = getRouteQueryOfLoginRoute(to, routeStore.routeHome);

    const location: RouteLocationRaw = {
      name: loginRoute,
      query
    };

    return location;
  }

  if (!routeStore.isInitAuthRoute) {
    // initialize the auth route
    await routeStore.initAuthRoute();

    // the route is captured by the "not-found" route because the auth route is not initialized
    // after the auth route is initialized, redirect to the original route
    if (isNotFoundRoute) {
      const rootRoute: RouteKey = 'root';
      const path = to.redirectedFrom?.name === rootRoute ? '/' : to.fullPath;

      const location: RouteLocationRaw = {
        path,
        replace: true,
        query: to.query,
        hash: to.hash
      };

      return location;
    }
  }

  routeStore.onRouteSwitchWhenLoggedIn();

  // the auth route is initialized
  // it is not the "not-found" route, then it is allowed to access
  if (!isNotFoundRoute) {
    return null;
  }

  // it is captured by the "not-found" route, then check whether the route exists
  const exist = await routeStore.getIsAuthRouteExist(to.path as RoutePath);
  const noPermissionRoute: RouteKey = '403';

  if (exist) {
    const location: RouteLocationRaw = {
      name: noPermissionRoute
    };

    return location;
  }

  return null;
}

function handleRouteSwitch(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) {
  // route with href
  if (to.meta.href) {
    window.open(to.meta.href, '_blank');

    next({ path: from.fullPath, replace: true, query: from.query, hash: from.hash });

    return;
  }

  next();
}

function getRouteQueryOfLoginRoute(to: RouteLocationNormalized, routeHome: RouteKey) {
  const loginRoute: RouteKey = 'login';
  const redirect = to.fullPath;
  const [redirectPath, redirectQuery] = redirect.split('?');
  const redirectName = getRouteName(redirectPath as RoutePath);

  const isRedirectHome = routeHome === redirectName;

  const query: LocationQueryRaw = to.name !== loginRoute && !isRedirectHome ? { redirect } : {};

  if (isRedirectHome && redirectQuery) {
    query.redirect = `/?${redirectQuery}`;
  }

  return query;
}
