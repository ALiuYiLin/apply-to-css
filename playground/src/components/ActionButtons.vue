<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const clicks = ref(0)
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function simulate() {
  if (loading.value) return

  loading.value = true
  timer = setTimeout(() => {
    loading.value = false
  }, 1400)
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <section class="panel" aria-labelledby="buttons-title">
    <header class="panel-head">
      <div>
        <p class="panel-kicker">STATE VARIANTS</p>
        <h2 id="buttons-title">按钮与状态</h2>
      </div>
      <span class="panel-badge">@apply</span>
    </header>

    <p class="panel-desc">
      hover、focus-visible、active、disabled 全部写在
      <code>&lt;style scoped&gt;</code> 里，转换后仍是普通选择器。
    </p>

    <div class="button-row">
      <button class="btn btn-primary" type="button" @click="clicks += 1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        点击 +1
      </button>

      <button class="btn btn-secondary" type="button" @click="clicks = 0">重置</button>

      <button class="btn btn-ghost" type="button" :disabled="loading" @click="simulate">
        <span v-if="loading" class="spinner" aria-hidden="true"></span>
        {{ loading ? '处理中…' : '模拟加载' }}
      </button>

      <button class="btn btn-danger" type="button" disabled>禁用状态</button>
    </div>

    <div class="counter">
      <span>点击次数</span>
      <strong>{{ clicks }}</strong>
    </div>

    <div class="state-preview">
      <p class="state-title">转换后的选择器</p>
      <code><span>.btn-primary:hover</span> { background-color: var(--brand-strong); }</code>
      <code><span>.btn:focus-visible</span> { outline: 2px solid var(--ring); }</code>
      <code><span>.btn:disabled</span> { opacity: 50%; cursor: not-allowed; }</code>
    </div>
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
  @apply rounded-full border border-brand-1/20 bg-brand-soft px-2.5 py-1 font-mono text-[10px] font-semibold text-brand-ink;
}

.panel-desc {
  @apply -mt-1 text-pretty text-[12.5px] leading-6 text-ink-2;
}

.panel-desc code {
  @apply rounded-md border border-line-1 bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-1;
}

.button-row {
  @apply flex flex-wrap items-center gap-2.5;
}

.btn {
  @apply inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-medium transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50;
}

.btn svg {
  @apply size-3.5;
}

.btn-primary {
  @apply bg-brand-1 text-white shadow-sm shadow-brand-1/25 hover:bg-brand-strong active:translate-y-px;
}

.btn-secondary {
  @apply border border-line-1 bg-surface-1 text-ink-2 hover:border-line-2 hover:bg-surface-2 hover:text-ink-1 active:translate-y-px;
}

.btn-ghost {
  @apply text-ink-2 hover:bg-surface-2 hover:text-ink-1 active:translate-y-px;
}

.btn-danger {
  @apply bg-danger-soft text-danger-1;
}

.spinner {
  @apply size-3.5 rounded-full border-2 border-current border-t-transparent;
  animation: playground-spin 0.8s linear infinite;
}

.counter {
  @apply flex items-center justify-between rounded-xl border border-dashed border-line-2 bg-surface-2/60 px-3.5 py-2.5 text-[11.5px] text-ink-3;
}

.counter strong {
  @apply font-mono text-sm font-semibold text-ink-1;
}

.state-preview {
  @apply mt-auto flex min-w-0 flex-col gap-1.5 rounded-xl border border-line-1 bg-surface-2/40 p-3;
}

.state-title {
  @apply font-mono text-[9px] tracking-[0.16em] text-ink-3 uppercase;
}

.state-preview code {
  @apply block min-w-0 overflow-x-auto rounded-md border border-line-1 bg-surface-1 px-2 py-1 font-mono text-[10px] leading-5 whitespace-nowrap text-ink-2;
}

.state-preview code span {
  @apply text-brand-1;
}
</style>
