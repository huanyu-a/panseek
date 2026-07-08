import type { Ref } from "vue";
import {
  ALL_PLUGIN_NAMES,
  CLOUD_TYPES,
  DEFAULT_USER_SETTINGS,
  SETTINGS_VERSION,
  STORAGE_KEYS,
} from "~/config/plugins";
import channelsConfig from "~/config/channels.json";

export interface UserSettings {
  enabledTgChannels: string[];
  enabledPlugins: string[];
  enabledCloudTypes: string[];
  concurrency: number;
  pluginTimeoutMs: number;
}

export interface UseSettingsReturn {
  settings: Ref<UserSettings>;
  loadSettings: () => void;
  saveSettings: () => void;
  resetToDefault: () => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onSelectAllTg: () => void;
  onClearAllTg: () => void;
}

// 模块级守卫：useSettings() 在多个组件中调用，loadSettings() 只需执行一次
let _settingsInitialized = false;

function getDefaultSettings(defaultTgChannels: string[]): UserSettings {
  return {
    enabledTgChannels: [...defaultTgChannels],
    enabledPlugins: [...DEFAULT_USER_SETTINGS.enabledPlugins],
    enabledCloudTypes: [...DEFAULT_USER_SETTINGS.enabledCloudTypes],
    concurrency: DEFAULT_USER_SETTINGS.concurrency,
    pluginTimeoutMs: DEFAULT_USER_SETTINGS.pluginTimeoutMs,
  };
}

export function useSettings(): UseSettingsReturn {
  const config = useRuntimeConfig();

  const defaultTgChannels = computed(() => {
    const configChannels = (config.public as any)?.tgDefaultChannels;
    if (Array.isArray(configChannels) && configChannels.length > 0) {
      return configChannels;
    }
    return channelsConfig.defaultChannels;
  });

  // 使用 Nuxt useState 替代模块级单例，SSR 安全
  const settings = useState<UserSettings>("user-settings", () =>
    getDefaultSettings(defaultTgChannels.value)
  );

  function loadSettings(): void {
    if (typeof window === "undefined") return;

    try {
      // 迁移旧存储键（panhub → panseek）
      const oldSettingsKey = "panhub.settings";
      const oldVersionKey = "panhub.settingsVersion";
      if (!localStorage.getItem(STORAGE_KEYS.settings) && localStorage.getItem(oldSettingsKey)) {
        localStorage.setItem(STORAGE_KEYS.settings, localStorage.getItem(oldSettingsKey)!);
        localStorage.removeItem(oldSettingsKey);
      }
      if (!localStorage.getItem(STORAGE_KEYS.settingsVersion) && localStorage.getItem(oldVersionKey)) {
        localStorage.setItem(STORAGE_KEYS.settingsVersion, localStorage.getItem(oldVersionKey)!);
        localStorage.removeItem(oldVersionKey);
      }

      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      const validated: UserSettings = {
        enabledTgChannels: Array.isArray(parsed.enabledTgChannels)
          ? parsed.enabledTgChannels.filter((x: unknown) => typeof x === "string")
          : [...(defaultTgChannels.value?.length ? defaultTgChannels.value : channelsConfig.defaultChannels)],
        enabledPlugins: Array.isArray(parsed.enabledPlugins)
          ? parsed.enabledPlugins.filter((x: unknown) => typeof x === "string")
          : [...DEFAULT_USER_SETTINGS.enabledPlugins],
        enabledCloudTypes: Array.isArray(parsed.enabledCloudTypes)
          ? parsed.enabledCloudTypes.filter((x: unknown) => typeof x === "string")
          : [...DEFAULT_USER_SETTINGS.enabledCloudTypes],
        concurrency:
          typeof parsed.concurrency === "number" && parsed.concurrency > 0
            ? Math.min(16, Math.max(1, parsed.concurrency))
            : DEFAULT_USER_SETTINGS.concurrency,
        pluginTimeoutMs:
          typeof parsed.pluginTimeoutMs === "number" && parsed.pluginTimeoutMs > 0
            ? parsed.pluginTimeoutMs
            : DEFAULT_USER_SETTINGS.pluginTimeoutMs,
      };

      validated.enabledPlugins = validated.enabledPlugins.filter((name) =>
        ALL_PLUGIN_NAMES.includes(name as any)
      );

      // 自动迁移：当设置版本过期时，自动补充新增插件
      const savedVersion = localStorage.getItem(STORAGE_KEYS.settingsVersion);
      const currentVersion = String(SETTINGS_VERSION);
      if (savedVersion !== currentVersion) {
        const newPlugins = ALL_PLUGIN_NAMES.filter(
          (n) => !validated.enabledPlugins.includes(n as any)
        );
        if (newPlugins.length > 0) {
          validated.enabledPlugins = [...validated.enabledPlugins, ...newPlugins];
        }
        localStorage.setItem(STORAGE_KEYS.settingsVersion, currentVersion);
      }

      if (
        validated.enabledPlugins.length === 0 &&
        validated.enabledTgChannels.length === 0
      ) {
        validated.enabledPlugins = [...DEFAULT_USER_SETTINGS.enabledPlugins];
      }

      settings.value = validated;
    } catch (_error) {
      // Silent failure
    }
  }

  function saveSettings(): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings.value));
      localStorage.setItem(STORAGE_KEYS.settingsVersion, String(SETTINGS_VERSION));
    } catch (_error) {
      // Silent failure
    }
  }

  function resetToDefault(): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(STORAGE_KEYS.settings);
      localStorage.removeItem(STORAGE_KEYS.settingsVersion);
    } catch (_error) {
      // Silent failure
    }

    settings.value = getDefaultSettings(
      defaultTgChannels.value?.length ? defaultTgChannels.value : channelsConfig.defaultChannels
    );

    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  function onSelectAll(): void {
    settings.value.enabledPlugins = [...ALL_PLUGIN_NAMES];
    saveSettings();
  }

  function onClearAll(): void {
    settings.value.enabledPlugins = [];
    saveSettings();
  }

  function onSelectAllTg(): void {
    settings.value.enabledTgChannels = [
      ...(defaultTgChannels.value?.length ? defaultTgChannels.value : channelsConfig.defaultChannels),
    ];
    saveSettings();
  }

  function onClearAllTg(): void {
    settings.value.enabledTgChannels = [];
    saveSettings();
  }

  if (typeof window !== "undefined" && !_settingsInitialized) {
    _settingsInitialized = true;
    loadSettings();
  }

  return {
    settings,
    loadSettings,
    saveSettings,
    resetToDefault,
    onSelectAll,
    onClearAll,
    onSelectAllTg,
    onClearAllTg,
  };
}
