<script setup lang="ts">
const stats = [
  { value: '2', label: '条指令' },
  { value: '0', label: '运行时依赖' },
  { value: '10', label: '个示例组件' },
  { value: '100%', label: '普通 CSS 输出' },
]
</script>

<template>
  <section class="hero">
    <div class="hero-copy">
      <p class="hero-badge">
        <span class="badge-dot" aria-hidden="true"></span>
        Vite · Vue 3 · TypeScript · Tailwind v4
      </p>

      <h1>
        把 <em>@apply</em> 变成<br />
        <span class="hero-accent">普通 CSS</span>。
      </h1>

      <p class="hero-lede">
        在 Vue 单文件组件的 <code>&lt;style scoped&gt;</code> 里放心使用 Tailwind 的
        <code>@apply</code> 与 <code>@reference</code>。这个 playground
        既是实时组件展示，也是 <strong>apply-to-css</strong> 的功能试验场。
      </p>

      <div class="hero-actions">
        <a class="btn-primary group" href="#components">
          查看组件
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
        <a class="btn-secondary" href="#compare">查看转换对比</a>
      </div>

      <dl class="hero-stats">
        <div v-for="stat in stats" :key="stat.label" class="stat">
          <dd>{{ stat.value }}</dd>
          <dt>{{ stat.label }}</dt>
        </div>
      </dl>
    </div>

    <div class="hero-visual">
      <div class="code-card">
        <div class="code-head">
          <span class="code-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <span class="code-file">Metric.vue</span>
          <span class="code-scope">scoped</span>
        </div>

        <pre class="code-body"><code><span class="tok-tag">&lt;style scoped&gt;</span>
<span class="tok-at">@reference</span> <span class="tok-str">"../style.css"</span>;

<span class="tok-sel">.metric</span> {
  <span class="tok-at">@apply</span> <span class="tok-util">flex items-center gap-2</span>
         <span class="tok-util">rounded-xl bg-surface-1</span>
         <span class="tok-util">px-3 text-[12.5px]</span>
         <span class="tok-var">hover:bg-surface-2</span>;
}
<span class="tok-tag">&lt;/style&gt;</span></code></pre>

        <div class="code-foot">
          <span class="pulse" aria-hidden="true"></span>
          <span><strong>apply-to-css</strong> → 普通声明、伪类与 @media</span>
        </div>
      </div>

      <div class="float-card float-card-a" aria-hidden="true">
        <span class="float-label">@reference</span>
        <span class="float-value">1 → 0</span>
      </div>
      <div class="float-card float-card-b" aria-hidden="true">
        <span class="float-label">tailwind runtime</span>
        <span class="float-value">none</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
@reference "../style.css";

.hero {
  @apply grid items-center gap-10 pt-6 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12 lg:pt-10;
}

.hero-copy {
  @apply flex min-w-0 flex-col items-start gap-5;
}

.hero-badge {
  @apply inline-flex items-center gap-2 rounded-full border border-line-1 bg-surface-1/80 px-3 py-1.5 text-[11px] font-medium text-ink-2 shadow-xs backdrop-blur;
}

.badge-dot {
  @apply size-1.5 rounded-full bg-accent-1 shadow-[0_0_0_3px_var(--accent-soft)];
}

.hero h1 {
  @apply text-balance text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.035em] text-ink-1 sm:text-5xl lg:text-[3.35rem];
}

.hero h1 em {
  @apply bg-linear-to-r from-brand-1 to-brand-2 bg-clip-text font-normal not-italic text-transparent;
}

.hero-accent {
  @apply bg-linear-to-r from-ink-1 via-brand-1 to-accent-1 bg-clip-text text-transparent;
}

.hero-lede {
  @apply max-w-xl text-pretty text-[14.5px] leading-7 text-ink-2 sm:text-[15px];
}

.hero-lede code {
  @apply rounded-md border border-line-1 bg-surface-1 px-1.5 py-0.5 font-mono text-[0.88em] whitespace-nowrap text-ink-1;
}

.hero-lede strong {
  @apply font-semibold text-ink-1;
}

.hero-actions {
  @apply flex flex-wrap items-center gap-2.5 pt-1;
}

.btn-primary {
  @apply inline-flex items-center gap-2 rounded-xl bg-brand-1 px-4 py-2.5 text-[13px] font-semibold text-white no-underline shadow-md shadow-brand-1/25 transition duration-200 hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-lg hover:shadow-brand-1/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-0;
}

.btn-primary svg {
  @apply size-4 transition-transform duration-200 group-hover:translate-x-0.5;
}

.btn-secondary {
  @apply inline-flex items-center rounded-xl border border-line-1 bg-surface-1 px-4 py-2.5 text-[13px] font-medium text-ink-2 no-underline transition duration-200 hover:border-line-2 hover:bg-surface-2 hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring;
}

.hero-stats {
  @apply mt-2 grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4;
}

.stat {
  @apply rounded-xl border border-line-1 bg-surface-1/70 px-3 py-2.5 shadow-xs;
}

.stat dd {
  @apply m-0 font-mono text-lg font-semibold tracking-tight text-ink-1;
}

.stat dt {
  @apply mt-0.5 text-[10.5px] font-medium tracking-wide text-ink-3;
}

/* ---- code preview ------------------------------------------------------ */
.hero-visual {
  @apply relative min-w-0;
}

.hero-visual::before {
  @apply pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10 rounded-[2.5rem] opacity-70 blur-3xl;
  content: '';
  background:
    radial-gradient(50% 50% at 30% 20%, color-mix(in oklab, var(--brand-1) 24%, transparent), transparent),
    radial-gradient(45% 45% at 80% 80%, color-mix(in oklab, var(--accent-1) 18%, transparent), transparent);
}

.code-card {
  @apply relative max-w-full overflow-hidden rounded-2xl border border-line-1 bg-surface-1 shadow-xl shadow-black/10;
}

.code-head {
  @apply flex items-center gap-3 border-b border-line-1 bg-surface-2/60 px-4 py-2.5;
}

.code-dots {
  @apply flex items-center gap-1.5;
}

.code-dots span {
  @apply size-2 rounded-full bg-line-2;
}

.code-dots span:nth-child(1) {
  @apply bg-danger-1/70;
}

.code-dots span:nth-child(2) {
  @apply bg-warn-1/70;
}

.code-dots span:nth-child(3) {
  @apply bg-accent-1/70;
}

.code-file {
  @apply font-mono text-[11px] text-ink-2;
}

.code-scope {
  @apply ml-auto rounded-md border border-line-1 bg-surface-1 px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide text-ink-3 uppercase;
}

.code-body {
  @apply m-0 overflow-x-auto p-4 font-mono text-[11.5px] leading-[1.85] text-ink-2 sm:p-5;
}

.code-body code {
  @apply font-mono;
}

.tok-tag {
  @apply text-ink-3;
}

.tok-at {
  @apply font-semibold text-brand-ink;
}

.tok-str {
  @apply text-accent-1;
}

.tok-sel {
  @apply text-brand-1;
}

.tok-util {
  @apply text-ink-1;
}

.tok-var {
  @apply text-warn-1;
}

.code-foot {
  @apply flex items-center gap-2 border-t border-line-1 bg-surface-2/40 px-4 py-2.5 text-[10.5px] text-ink-3;
}

.code-foot strong {
  @apply font-semibold text-ink-2;
}

.pulse {
  @apply size-1.5 shrink-0 rounded-full bg-accent-1;
  box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent-1) 50%, transparent);
  animation: pulse 2.4s ease-out infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent-1) 45%, transparent);
  }
  70%,
  100% {
    box-shadow: 0 0 0 7px transparent;
  }
}

.float-card {
  @apply absolute hidden flex-col gap-0.5 rounded-xl border border-line-1 bg-surface-1/95 px-3 py-2 shadow-lg shadow-black/10 backdrop-blur sm:flex;
}

.float-card-a {
  @apply -right-3 top-14 rotate-2 xl:-right-6;
}

.float-card-b {
  @apply -right-3 -bottom-7 -rotate-2 xl:-right-6;
}

.float-label {
  @apply font-mono text-[9px] tracking-wider text-ink-3 uppercase;
}

.float-value {
  @apply font-mono text-[12px] font-semibold text-ink-1;
}

@media (width < 64rem) {
  .hero {
    @apply pt-2;
  }

  .float-card {
    @apply hidden;
  }
}
</style>
