<script setup lang="ts">
defineProps<{ isDark: boolean }>()

const emit = defineEmits<{ 'toggle-theme': [] }>()
</script>

<template>
  <header class="site-header">
    <a class="brand" href="#top" aria-label="apply-to-css playground 首页">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="m8 3.5-4.5 8.5L8 20.5" />
          <path d="m16 3.5 4.5 8.5L16 20.5" />
          <path d="M13.6 6.8 10.4 17.2" />
        </svg>
      </span>
      <span class="brand-text">
        <strong>apply-to-css</strong>
        <span>playground</span>
      </span>
    </a>

    <nav class="site-nav" aria-label="页面导航">
      <a href="#features">特性</a>
      <a href="#components">组件</a>
      <a href="#compare">转换对比</a>
      <a href="#usage">用法</a>
    </nav>

    <div class="header-actions">
      <span class="version">v0.1.0</span>
      <button
        class="theme-toggle"
        type="button"
        :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
        :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
        @click="emit('toggle-theme')"
      >
        <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.3 4.3l1.4 1.4M18.3 18.3l1.4 1.4M2.5 12h2M19.5 12h2M4.3 19.7l1.4-1.4M18.3 5.7l1.4-1.4" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
@reference "../style.css";

.site-header {
  @apply sticky top-4 z-40 flex items-center gap-4 rounded-2xl border border-line-1 bg-surface-1/85 px-3 py-2.5 shadow-sm shadow-black/5 backdrop-blur-xl sm:gap-6 sm:px-5;
}

.brand {
  @apply flex items-center gap-2.5 rounded-xl text-ink-1 no-underline transition-colors hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring;
}

.brand-mark {
  @apply grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-1 to-brand-2 text-white shadow-sm shadow-brand-1/25;
}

.brand-mark :deep(svg) {
  @apply size-[18px];
}

.brand-text {
  @apply flex flex-col leading-none;
}

.brand-text strong {
  @apply text-[14px] font-semibold tracking-tight;
}

.brand-text span {
  @apply mt-1 font-mono text-[9.5px] tracking-[0.22em] text-ink-3 uppercase;
}

.site-nav {
  @apply ml-auto hidden items-center gap-0.5 sm:flex;
}

.site-nav a {
  @apply rounded-lg px-3 py-2 text-[12.5px] font-medium text-ink-2 no-underline transition-colors hover:bg-surface-2 hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-ring;
}

.header-actions {
  @apply ml-auto flex items-center gap-2 sm:ml-0;
}

.version {
  @apply hidden rounded-full border border-line-1 bg-surface-2/70 px-2.5 py-1 font-mono text-[10px] text-ink-3 md:inline-flex;
}

.theme-toggle {
  @apply grid size-9 place-items-center rounded-xl border border-line-1 bg-surface-1 text-ink-2 transition duration-200 hover:border-line-2 hover:bg-surface-2 hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px;
}

.theme-toggle :deep(svg) {
  @apply size-[17px];
}

@media (width < 30rem) {
  .brand-text span {
    display: none;
  }
}
</style>
