export function useDarkMode() {
  const isDark = useState("dark-mode", () => false);

  function applyTheme(dark: boolean) {
    if (import.meta.client) {
      document.documentElement.classList.toggle("dark", dark);
    }
  }

  function toggle() {
    isDark.value = !isDark.value;
    try {
      localStorage.setItem("panseek:dark-mode", isDark.value ? "dark" : "light");
    } catch {
      // Safari 隐私模式 / 存储满时 localStorage 会抛错，降级为仅内存状态
    }
    applyTheme(isDark.value);
  }

  function init() {
    if (!import.meta.client) return;
    try {
      // 迁移旧存储键（panhub → panseek）
      let saved = localStorage.getItem("panseek:dark-mode");
      if (saved === null) {
        saved = localStorage.getItem("panhub:dark-mode");
        if (saved !== null) {
          localStorage.setItem("panseek:dark-mode", saved);
          localStorage.removeItem("panhub:dark-mode");
        }
      }
      if (saved === "dark") {
        isDark.value = true;
      } else if (saved === "light") {
        isDark.value = false;
      } else {
        isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
    } catch {
      // localStorage 不可用时使用系统默认偏好
      isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    applyTheme(isDark.value);
  }

  return { isDark: readonly(isDark), toggle, init };
}
