<template>
  <div class="result-card" data-theme-part="result-card">
    <!-- 卡片头部 -->
    <div class="card-header" data-theme-part="card-header">
      <div class="platform-badge" :style="{ background: color }">
        <img class="platform-icon" :src="icon" :alt="title" />
      </div>
      <div class="header-info">
        <h3 class="platform-title">{{ title }}</h3>
        <span class="resource-count">{{ items.length }} 个资源</span>
      </div>
      <button
        v-if="canToggleCollapse && !expanded && items.length > initialVisible"
        class="expand-btn"
        @click="$emit('toggle')">
        展开
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      </button>
    </div>

    <!-- 资源列表 -->
    <ul class="resource-list">
      <li v-for="r in visibleItems" :key="r.url" class="resource-item" :class="{ 'resource-item--bad': r.checkState === 'bad' }">
        <div class="resource-content">
          <a
            class="resource-link"
            :href="r.url"
            target="_blank"
            rel="noopener noreferrer nofollow"
            :title="r.note || r.url">
            <span class="link-text">{{ r.note || r.url }}</span>
            <svg class="external-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>

          <div class="resource-meta">
            <div class="meta-tags">
              <span class="meta-tag date">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                {{ formatDate(r.datetime) || "时间未知" }}
              </span>

              <span v-if="r.password" class="meta-tag password">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <circle cx="12" cy="16" r="1"></circle>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                提取码: {{ r.password }}
              </span>

              <!-- 链接状态标签 -->
              <span v-if="r.checkState" class="meta-tag" :class="checkStateClass(r.checkState)">
                <svg v-if="r.checkState === 'ok'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <svg v-else-if="r.checkState === 'bad'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {{ checkStateText(r.checkState) }}
              </span>
            </div>

            <div class="action-btns">
              <!-- 检查链接按钮 -->
              <button
                class="action-btn check-btn"
                :class="{ 'check-btn--checking': r.checkLoading }"
                @click.prevent="handleCheck(r)"
                :disabled="r.checkLoading"
                :title="'检查链接有效性'">
                <svg v-if="!r.checkLoading && r.checkState !== 'ok'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <svg v-if="r.checkState === 'ok'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <svg v-if="r.checkLoading" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
              </button>

              <!-- 复制密码按钮 -->
              <button
                v-if="r.password"
                class="action-btn copy-pwd-btn"
                :class="{ 'action-btn--copied': copiedPwd === r.url }"
                @click.prevent="handleCopyPassword(r)"
                :title="copiedPwd === r.url ? '已复制' : '复制密码'">
                <svg v-if="copiedPwd !== r.url" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {{ copiedPwd === r.url ? '已复制' : '密码' }}
              </button>

              <!-- 复制链接按钮 -->
              <button
                class="action-btn copy-link-btn"
                :class="{ 'action-btn--copied': copiedUrl === r.url }"
                @click.prevent="handleCopy(r.url)"
                :title="copiedUrl === r.url ? '已复制' : '复制链接'">
                <svg v-if="copiedUrl !== r.url" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {{ copiedUrl === r.url ? '已复制' : '链接' }}
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <!-- 底部展开按钮 -->
    <div v-if="!expanded && items.length > initialVisible" class="card-footer" data-theme-part="card-footer">
      <button class="load-more-btn" @click="$emit('toggle')">
        显示更多 ({{ items.length - initialVisible }})
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12l7 7 7-7"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  color: string;
  icon: string;
  items: any[];
  expanded: boolean;
  initialVisible: number;
  canToggleCollapse?: boolean;
}>();
const emit = defineEmits(["toggle", "copy"]);

const copiedUrl = ref("");
const copiedPwd = ref("");
let copyUrlTimer: ReturnType<typeof setTimeout> | null = null;
let copyPwdTimer: ReturnType<typeof setTimeout> | null = null;

const config = useRuntimeConfig();
const apiBase = (config.public?.apiBase as string) || "/api";

function handleCopy(url: string) {
  emit("copy", url);
  copiedUrl.value = url;
  if (copyUrlTimer) clearTimeout(copyUrlTimer);
  copyUrlTimer = setTimeout(() => { copiedUrl.value = ""; }, 1500);
}

async function handleCopyPassword(r: any) {
  if (!r.password) return;
  try {
    await navigator.clipboard.writeText(r.password);
  } catch {}
  copiedPwd.value = r.url;
  if (copyPwdTimer) clearTimeout(copyPwdTimer);
  copyPwdTimer = setTimeout(() => { copiedPwd.value = ""; }, 1500);
}

/** 检查链接有效性 */
async function handleCheck(r: any) {
  if (r.checkLoading || r.checkState) return;
  r.checkLoading = true;
  try {
    const resp = await $fetch<any>(`${apiBase}/check/links`, {
      method: "POST",
      body: {
        items: [{
          disk_type: r.type || "",
          url: r.url,
          password: r.password || "",
        }],
      },
    });
    const result = resp?.data?.results?.[0] || resp?.results?.[0];
    if (result) {
      r.checkState = result.state;
      r.checkSummary = result.summary || "";
    } else {
      r.checkState = "uncertain";
    }
  } catch {
    r.checkState = "uncertain";
  } finally {
    r.checkLoading = false;
  }
}

function checkStateClass(state: string): string {
  switch (state) {
    case "ok": return "check-ok";
    case "bad": return "check-bad";
    case "locked": return "check-locked";
    default: return "check-uncertain";
  }
}

function checkStateText(state: string): string {
  switch (state) {
    case "ok": return "有效";
    case "bad": return "失效";
    case "locked": return "需要密码";
    default: return "未知";
  }
}

const visibleItems = computed(() =>
  props.expanded ? props.items : props.items.slice(0, props.initialVisible)
);

function formatDate(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const now = Date.now();
  const diff = now - dt.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return dt.toLocaleDateString("zh-CN");
}
</script>

<style scoped>
/* 结果卡片主体 - 玻璃拟态设计 */
.result-card {
  background: var(--bg-surface);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  box-shadow: 0 8px 22px rgba(17, 24, 39, 0.06);
  overflow: hidden;
  transition: box-shadow var(--transition-normal), transform var(--transition-normal),
    border-color var(--transition-normal);
}

.result-card:hover {
  box-shadow: 0 14px 28px rgba(17, 24, 39, 0.1);
  transform: translateY(-3px);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-surface-elevated);
  border-bottom: 1px solid var(--border-light);
  position: relative;
}

.card-header::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 1px;
  background: linear-gradient(90deg, var(--primary), transparent 70%);
  opacity: 0.25;
}

/* 平台徽章 */
.platform-badge {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 5px 10px rgba(17, 24, 39, 0.2);
  flex-shrink: 0;
}

.platform-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

/* 头部信息 */
.header-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.platform-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.resource-count {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
}

/* 展开按钮 */
.expand-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
    color var(--transition-fast), transform var(--transition-fast);
  white-space: nowrap;
}

.expand-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.expand-btn svg {
  stroke: currentColor;
}

/* 资源列表 */
.resource-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 600px;
  overflow-y: auto;
}

/* 自定义滚动条 */
.resource-list::-webkit-scrollbar {
  width: 6px;
}

.resource-list::-webkit-scrollbar-track {
  background: transparent;
}

.resource-list::-webkit-scrollbar-thumb {
  background: var(--border-light);
  border-radius: 3px;
}

.resource-list::-webkit-scrollbar-thumb:hover {
  background: var(--border-medium);
}

/* 单个资源项 */
.resource-item {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-light);
  transition: background var(--transition-fast);
}

.resource-item:last-child {
  border-bottom: none;
}

.resource-item:hover {
  background: var(--bg-hover);
}

/* 失效链接样式 */
.resource-item--bad {
  opacity: 0.55;
}

.resource-item--bad .resource-link {
  text-decoration: line-through;
}

.resource-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 资源链接 */
.resource-link {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: var(--primary);
  font-weight: 600;
  font-size: 14px;
  line-height: 1.4;
  transition: color var(--transition-fast), gap var(--transition-fast);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.resource-link:hover {
  color: var(--primary-dark);
  gap: 8px;
}

.link-text {
  flex: 1;
  min-width: 0;
}

.external-icon {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  flex-shrink: 0;
}

.resource-link:hover .external-icon {
  opacity: 1;
  transform: translateX(0);
}

.external-icon {
  stroke: currentColor;
}

/* 资源元数据 */
.resource-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

/* 元数据标签 */
.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 999px;
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.meta-tag svg {
  stroke: currentColor;
  opacity: 0.7;
}

.meta-tag.date {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.15);
  color: var(--primary);
}

.meta-tag.password {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.2);
  color: var(--success);
}

/* 检查状态标签 */
.meta-tag.check-ok {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.25);
  color: var(--success);
}

.meta-tag.check-bad {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.25);
  color: #ef4444;
}

.meta-tag.check-locked {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.25);
  color: #f59e0b;
}

.meta-tag.check-uncertain {
  background: rgba(107, 114, 128, 0.12);
  border-color: rgba(107, 114, 128, 0.25);
  color: var(--text-tertiary);
}

/* 操作按钮组 */
.action-btns {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* 通用操作按钮样式 */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
    color var(--transition-fast), transform var(--transition-fast);
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.action-btn:active {
  transform: translateY(0);
  background: var(--border-light);
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.action-btn svg {
  stroke: currentColor;
}

.action-btn--copied {
  color: var(--success);
  border-color: var(--success);
}

/* 检查按钮特殊样式 */
.check-btn {
  padding: 6px 8px;
}

.check-btn--checking {
  color: var(--primary);
  border-color: var(--primary);
}

/* 旋转动画 */
.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 卡片底部 */
.card-footer {
  padding: 12px 16px;
  background: var(--bg-surface-subtle);
  border-top: 1px solid var(--border-light);
  text-align: center;
}

.load-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--primary), #14b8a6);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  box-shadow: 0 4px 12px rgba(15, 118, 110, 0.3);
}

.load-more-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 118, 110, 0.4);
}

.load-more-btn:active {
  transform: translateY(0);
}

.load-more-btn svg {
  stroke: currentColor;
}

/* 移动端优化 */
@media (max-width: 640px) {
  .card-header {
    padding: 12px;
    gap: 10px;
  }

  .platform-badge {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 14px;
  }

  .platform-title {
    font-size: 15px;
  }

  .resource-item {
    padding: 12px;
  }

  .resource-link {
    font-size: 13px;
  }

  .meta-tag {
    padding: 3px 6px;
    font-size: 10px;
  }

  .action-btn {
    padding: 5px 8px;
    font-size: 11px;
  }

  .check-btn {
    padding: 5px 6px;
  }

  .expand-btn {
    padding: 5px 8px;
    font-size: 11px;
  }

  .load-more-btn {
    padding: 8px 12px;
    font-size: 13px;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .result-card {
    border-width: 2px;
  }

  .platform-badge {
    border: 2px solid white;
  }

  .meta-tag {
    border-width: 2px;
  }

  .action-btn,
  .expand-btn,
  .load-more-btn {
    border-width: 2px;
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .result-card,
  .resource-item,
  .resource-link,
  .expand-btn,
  .action-btn,
  .load-more-btn {
    transition: none;
  }

  .result-card:hover,
  .resource-link:hover,
  .expand-btn:hover,
  .action-btn:hover,
  .load-more-btn:hover {
    transform: none;
  }

  .external-icon {
    transition: none;
  }

  .spin {
    animation: none;
  }
}
</style>
