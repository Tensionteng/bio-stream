<script lang="ts" setup>
import { computed } from 'vue';
import { useRouterPush } from '@/hooks/common/router';
import { $t } from '@/locales';

defineOptions({ name: 'ExceptionBase' });

type ExceptionType = '111' | '403' | '404' | '500';

interface Props {
  /**
   * Exception type
   *
   * - 403: no permission
   * - 404: not found
   * - 500: service error
   */
  type: ExceptionType;
}

const props = defineProps<Props>();

const { routerPushByKey } = useRouterPush();

const iconMap: Record<ExceptionType, string> = {
  '111': 'empty-data',
  '403': 'no-permission',
  '404': 'not-found',
  '500': 'service-error'
};

const icon = computed(() => iconMap[props.type]);
</script>

<template>
  <div class="size-full min-h-520px flex-col-center gap-24px overflow-hidden">
    <div class="flex text-400px text-primary">
      <SvgIcon :local-icon="icon" />
    </div>
    <div v-if="props.type == '111'">当前用户没有创建任务，请先创建任务</div>
    <ElButton type="primary" @click="routerPushByKey('root')">{{ $t('common.backToHome') }}</ElButton>
  </div>
</template>

<style scoped></style>
