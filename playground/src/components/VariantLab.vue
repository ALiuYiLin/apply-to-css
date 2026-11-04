<script setup lang="ts">
import { ref } from 'vue'

const query = ref('')
const accentOn = ref(true)

const variants = [
  'hover:',
  'focus-visible:',
  'active:',
  'disabled:',
  'max-lg:',
  'dark:',
  '[&_tr]:',
  'group-hover:',
]
</script>

<template>
  <section class="panel" aria-labelledby="variants-title">
    <header class="panel-head">
      <div>
        <p class="panel-kicker">VARIANTS &amp; RESPONSIVE</p>
        <h2 id="variants-title">变体实验台</h2>
      </div>
      <span class="panel-badge">@reference</span>
    </header>

    <p class="panel-desc">
      输入框的 focus、复选框的强调色、卡片的 hover 与响应式断点，都由组件内的
      <code>@apply</code> 驱动。
    </p>

    <div class="field">
      <label class="field-label" for="variant-query">搜索点什么，然后按 Tab 离开</label>
      <div class="input-wrap">
        <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          id="variant-query"
          v-model="query"
          class="input"
          type="search"
          placeholder="例如：@apply"
          autocomplete="off"
        />
        <kbd class="kbd">/</kbd>
      </div>
      <p class="field-hint">
        <span class="hint-dot" :data-on="query.length > 0" aria-hidden="true"></span>
        {{ query ? `正在过滤 “${query}”` : 'focus-visible 外圈来自 @apply' }}
      </p>
    </div>

    <label class="checkbox-row">
      <input v-model="accentOn" class="checkbox" type="checkbox" />
      <span>强调色高亮</span>
      <span class="accent-dot" :data-on="accentOn" aria-hidden="true"></span>
    </label>

    <div class="variant-grid">
      <div class="variant-card" data-tone="brand">
        <span class="variant-name">hover:</span>
        <p>悬停换色并轻微抬起</p>
      </div>
      <div class="variant-card" data-tone="accent">
        <span class="variant-name">focus-within:</span>
        <p>聚焦时边框变青</p>
      </div>
      <div class="variant-card" data-tone="warn">
        <span class="variant-name">[&amp;_svg]:</span>
        <p>用任意变体选中子元素</p>
      </div>
    </div>

    <ul class="chip-row" aria-label="支持的变体示例">
      <li v-for="variant in variants" :key="variant" class="chip">{{ variant }}</li>
    </ul>

    <p class="responsive-note">
      <span class="only-wide">当前宽屏：三列卡片</span>
      <span class="only-narrow">当前窄屏：单列堆叠（max-lg）</span>
    </p>
  </section>
</template>

<style scoped>
@reference "../style.css";

.panel {
  @apply flex min-w-0 flex-col gap-4 rounded-2xl border border-line-1 bg-surface-1 p-5 shadow-sm shadow-black/5 sm:p-6;
}

.panel-head {
  @apply flex items-start justify-between gap-4;
}

.panel-kicker {
  @apply font-mono text-[9.5px] font-semibold tracking-[0.18em] text-ink-3 uppercase;
}

.panel h2 {
  @apply mt-1 text-[17px] font-semibold tracking-tight text-ink-1;
}

.panel-badge {
  @apply rounded-full border border-accent-1/20 bg-accent-soft px-2.5 py-1 font-mono text-[10px] font-semibold text-accent-1;
}

.panel-desc {
  @apply -mt-1 text-pretty text-[12.5px] leading-6 text-ink-2;
}

.panel-desc code {
  @apply rounded-md border border-line-1 bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-1;
}

.field {
  @apply flex flex-col gap-1.5;
}

.field-label {
  @apply text-[11px] font-medium text-ink-2;
}

.input-wrap {
  @apply relative flex items-center;
}

.input-icon {
  @apply pointer-events-none absolute left-3 size-3.5 text-ink-3;
}

.input {
  @apply h-9 w-full rounded-xl border border-line-1 bg-surface-1 pr-9 pl-9 text-[12.5px] text-ink-1 transition-colors placeholder:text-ink-3 focus:border-brand-1 focus:outline-2 focus:outline-offset-2 focus:outline-ring/40;
}

.kbd {
  @apply pointer-events-none absolute right-2.5 rounded-md border border-line-1 bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-3;
}

.field-hint {
  @apply flex items-center gap-1.5 text-[10.5px] text-ink-3;
}

.hint-dot {
  @apply size-1.5 rounded-full bg-line-2 transition-colors;
}

.hint-dot[data-on='true'] {
  @apply bg-accent-1;
}

.checkbox-row {
  @apply flex items-center gap-2.5 rounded-xl border border-line-1 bg-surface-2/50 px-3 py-2 text-[11.5px] text-ink-2;
}

.checkbox {
  @apply size-4 rounded border-line-2 accent-brand-1;
}

.accent-dot {
  @apply ml-auto size-2 rounded-full bg-line-2 transition-colors;
}

.accent-dot[data-on='true'] {
  @apply bg-accent-1 shadow-[0_0_0_3px_var(--accent-soft)];
}

.variant-grid {
  @apply grid gap-2.5 sm:grid-cols-3;
}

.variant-card {
  @apply flex flex-col gap-1 rounded-xl border border-line-1 bg-surface-1 p-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5;
}

.variant-card[data-tone='brand'] {
  @apply hover:border-brand-1/40 hover:bg-brand-soft;
}

.variant-card[data-tone='accent'] {
  @apply hover:border-accent-1/40 hover:bg-accent-soft;
}

.variant-card[data-tone='warn'] {
  @apply hover:border-warn-1/40 hover:bg-warn-soft;
}

.variant-name {
  @apply font-mono text-[10px] font-semibold text-ink-3;
}

.variant-card p {
  @apply text-[11px] leading-5 text-ink-2;
}

.chip-row {
  @apply flex list-none flex-wrap gap-1.5 p-0;
}

.chip {
  @apply rounded-md border border-line-1 bg-surface-2/70 px-2 py-1 font-mono text-[10px] text-ink-2;
}

.responsive-note {
  @apply mt-auto border-t border-dashed border-line-1 pt-3 text-[10.5px] text-ink-3;
}

.only-wide {
  @apply hidden lg:inline;
}

.only-narrow {
  @apply inline lg:hidden;
}
</style>
