<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const outcomes = [
  '声明按原位置写入，层叠顺序不变',
  'hover 展开为独立的 @media 规则',
  '@reference 在不再需要时自动移除',
  '颜色仍指向全局主题变量，深色模式可用',
]

const after = `<style scoped>
.metric {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  border-radius: var(--radius-xl);
  background-color: var(--surface-1);
  padding-inline: calc(var(--spacing) * 3);
  font-size: 12.5px;
}

@media (hover: hover) {
  .metric:hover {
    background-color: var(--surface-2);
  }
}
</style>
`

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

async function copyOutput() {
  try {
    await navigator.clipboard.writeText(after)
    copied.value = true
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    copied.value = false
  }
}

onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer)
})
</script>

<template>
  <section id="compare" class="compare">
    <div class="compare-heading">
      <p class="eyebrow">BEFORE / AFTER</p>
      <h2>一条命令，两种形态</h2>
      <p>
        左边是组件源码，右边是 <strong>apply-to-css</strong> 的产出。主题变量继续保留，所以明暗切换不会失效。
      </p>
    </div>

    <div class="compare-grid">
      <article class="code-panel" data-side="before">
        <header class="code-head">
          <span class="code-label">
            <span class="dot" data-kind="before" aria-hidden="true"></span>
            Vue 源码
          </span>
          <span class="code-meta">@apply × 1</span>
        </header>

        <pre class="code"><code><span class="t-tag">&lt;style scoped&gt;</span>
<span class="t-at">@reference</span> <span class="t-str">"../style.css"</span>;

<span class="t-sel">.metric</span> {
  <span class="t-at">@apply</span> <span class="t-util">flex items-center gap-2</span>
         <span class="t-util">rounded-xl bg-surface-1</span>
         <span class="t-util">px-3 text-[12.5px]</span>
         <span class="t-var">hover:bg-surface-2</span>;
}
<span class="t-tag">&lt;/style&gt;</span></code></pre>

        <footer class="code-foot">输入 · 构建前</footer>
      </article>

      <article class="code-panel" data-side="after">
        <header class="code-head">
          <span class="code-label">
            <span class="dot" data-kind="after" aria-hidden="true"></span>
            转换结果
          </span>
          <button class="copy" type="button" :data-copied="copied" @click="copyOutput">
            <svg v-if="!copied" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="10" height="10" rx="2" />
              <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 4 4L19 6" />
            </svg>
            {{ copied ? '已复制' : '复制 CSS' }}
          </button>
        </header>

        <pre class="code"><code><span class="t-tag">&lt;style scoped&gt;</span>
<span class="t-sel">.metric</span> {
  <span class="t-prop">display</span>: <span class="t-val">flex</span>;
  <span class="t-prop">align-items</span>: <span class="t-val">center</span>;
  <span class="t-prop">gap</span>: <span class="t-val">calc(var(--spacing) * 2)</span>;
  <span class="t-prop">border-radius</span>: <span class="t-val">var(--radius-xl)</span>;
  <span class="t-prop">background-color</span>: <span class="t-val">var(--surface-1)</span>;
  <span class="t-prop">padding-inline</span>: <span class="t-val">calc(var(--spacing) * 3)</span>;
  <span class="t-prop">font-size</span>: <span class="t-val">12.5px</span>;
}

<span class="t-at">@media</span> <span class="t-val">(hover: hover)</span> {
  <span class="t-sel">.metric:hover</span> {
    <span class="t-prop">background-color</span>: <span class="t-val">var(--surface-2)</span>;
  }
}
<span class="t-tag">&lt;/style&gt;</span></code></pre>

        <footer class="code-foot">输出 · 0 条 @apply / @reference</footer>
      </article>
    </div>

    <ul class="outcomes">
      <li v-for="outcome in outcomes" :key="outcome" class="outcome">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m5 12 4 4L19 6" />
        </svg>
        {{ outcome }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
@reference "../style.css";

.compare {
  @apply flex flex-col gap-6;
}

.compare-heading {
  @apply flex max-w-2xl flex-col gap-2.5;
}

.eyebrow {
  @apply font-mono text-[10px] font-semibold tracking-[0.2em] text-brand-ink uppercase;
}

.compare-heading h2 {
  @apply text-balance text-[1.65rem] font-semibold tracking-tight text-ink-1 sm:text-3xl;
}

.compare-heading p {
  @apply text-pretty text-[13.5px] leading-6 text-ink-2;
}

.compare-heading strong {
  @apply font-semibold text-ink-1;
}

.compare-grid {
  @apply grid gap-3.5 lg:grid-cols-2;
}

.code-panel {
  @apply flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line-1 bg-surface-1 shadow-sm shadow-black/5;
}

.code-panel[data-side='after'] {
  @apply border-accent-1/25;
}

.code-head {
  @apply flex items-center justify-between gap-3 border-b border-line-1 bg-surface-2/60 px-4 py-2.5;
}

.code-label {
  @apply inline-flex items-center gap-2 font-mono text-[10.5px] font-medium text-ink-2;
}

.dot {
  @apply size-1.5 rounded-full bg-line-2;
}

.dot[data-kind='before'] {
  @apply bg-brand-1;
}

.dot[data-kind='after'] {
  @apply bg-accent-1;
}

.code-meta {
  @apply font-mono text-[9.5px] text-ink-3;
}

.copy {
  @apply inline-flex items-center gap-1.5 rounded-lg border border-line-1 bg-surface-1 px-2 py-1 font-mono text-[9.5px] text-ink-2 transition hover:border-line-2 hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring;
}

.copy[data-copied='true'] {
  @apply border-accent-1/30 bg-accent-soft text-accent-1;
}

.copy svg {
  @apply size-3;
}

.code {
  @apply m-0 flex-1 overflow-x-auto p-4 font-mono text-[11px] leading-[1.8] text-ink-2;
}

.t-tag {
  @apply text-ink-3;
}

.t-at {
  @apply font-semibold text-brand-ink;
}

.t-str {
  @apply text-accent-1;
}

.t-sel {
  @apply text-brand-1;
}

.t-util {
  @apply text-ink-1;
}

.t-var {
  @apply text-warn-1;
}

.t-prop {
  @apply text-ink-3;
}

.t-val {
  @apply text-ink-1;
}

.code-foot {
  @apply border-t border-line-1 bg-surface-2/30 px-4 py-2 font-mono text-[9.5px] text-ink-3;
}

.outcomes {
  @apply grid list-none gap-2 p-0 sm:grid-cols-2;
}

.outcome {
  @apply flex items-start gap-2 rounded-xl border border-line-1 bg-surface-1/60 px-3 py-2 text-[11px] leading-5 text-ink-2;
}

.outcome svg {
  @apply mt-0.5 size-3.5 shrink-0 text-accent-1;
}
</style>
