import { ref } from 'vue';

/**
 * A hook for managing boolean state
 *
 * @param initValue - The initial value, default is false
 */
export function useBoolean(initValue = false) {
  const bool = ref(initValue);

  function setTrue() {
    bool.value = true;
  }

  function setFalse() {
    bool.value = false;
  }

  function toggle() {
    bool.value = !bool.value;
  }

  return {
    bool,
    setTrue,
    setFalse,
    toggle
  };
}
