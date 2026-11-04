<script setup lang="ts">
const steps = [
  {
    title: '安装依赖',
    description: '在 workspace 根目录执行，playground 与工具包会一起安装。',
    command: 'pnpm install',
  },
  {
    title: '预览改动',
    description: '不加 --write 时只输出 unified diff，不会修改任何源文件。',
    command: 'pnpm apply-to-css --cwd playground --diff',
  },
  {
    title: '写回并验证',
    description: '确认 diff 后写回，再跑一次构建确认转换结果仍然可用。',
    command: 'pnpm apply-to-css --cwd playground --write\npnpm --filter @10coding/apply-to-css-playground build',
  },
]

const tips = [
  { flag: '--check', description: '仍有文件需要转换时退出码为 1，适合 CI。' },
  { flag: '--css <file>', description: '没有 @reference 时的兜底 Tailwind 入口。' },
  { flag: '--keep-reference', description: '即使不再需要也保留 @reference。' },
  { flag: '--json', description: '输出结构化结果，方便接入其他脚本。' },
]
</script>

<template>
  <section id="usage" class="usage">
    <div class="usage-copy">
      <div class="usage-heading">
        <p class="eyebrow">USAGE</p>
        <h2>三步接入</h2>
        <p>
          在 workspace 根目录操作 playground。默认只预览，<code>--write</code> 才会写回，<code>--check</code>
          可直接放进 CI。
        </p>
      </div>

      <ol class="steps">
        <li v-for="(step, index) in steps" :key="step.title" class="step">
          <span class="step-index" aria-hidden="true">0{{ index + 1 }}</span>
          <div class="step-body">
            <h3>{{ step.title }}</h3>
            <p>{{ step.description }}</p>
            <code>{{ step.command }}</code>
          </div>
        </li>
      </ol>
    </div>

    <aside class="terminal" aria-label="命令行示例">
      <div class="terminal-head">
        <span class="terminal-dots" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
        <span class="terminal-title">apply-to-css — zsh</span>
      </div>

      <pre class="terminal-body"><code><span class="t-prompt">$</span> <span class="t-cmd">pnpm apply-to-css --cwd playground --diff</span>
<span class="t-comment"># 预览全部改动，不会写入文件</span>

<span class="t-prompt">$</span> <span class="t-cmd">pnpm apply-to-css --cwd playground --check</span>
<span class="t-comment"># CI：需要转换时退出码为 1</span>

<span class="t-prompt">$</span> <span class="t-cmd">pnpm apply-to-css --cwd playground --write</span>
<span class="t-comment"># 写回后仍然可以正常构建</span></code></pre>

      <div class="terminal-tips">
        <p class="tips-title">常用选项</p>
        <ul>
          <li v-for="tip in tips" :key="tip.flag">
            <code>{{ tip.flag }}</code>
            <span>{{ tip.description }}</span>
          </li>
        </ul>
      </div>
    </aside>
  </section>
</template>

<style scoped>
@reference "../style.css";

.usage {
  @apply grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-start;
}

.usage-copy {
  @apply flex min-w-0 flex-col gap-5;
}

.usage-heading {
  @apply flex max-w-xl flex-col gap-2.5;
}

.eyebrow {
  @apply font-mono text-[10px] font-semibold tracking-[0.2em] text-brand-ink uppercase;
}

.usage-heading h2 {
  @apply text-balance text-[1.65rem] font-semibold tracking-tight text-ink-1 sm:text-3xl;
}

.usage-heading p {
  @apply text-pretty text-[13.5px] leading-6 text-ink-2;
}

.usage-heading code {
  @apply rounded-md border border-line-1 bg-surface-1 px-1.5 py-0.5 font-mono text-[0.9em] text-ink-1;
}

.steps {
  @apply flex list-none flex-col gap-2.5 p-0;
}

.step {
  @apply flex gap-3 rounded-xl border border-line-1 bg-surface-1 p-3.5 shadow-xs transition-colors hover:border-line-2;
}

.step-index {
  @apply mt-0.5 font-mono text-[10px] font-semibold tracking-wider text-brand-ink;
}

.step-body {
  @apply flex min-w-0 flex-col gap-1;
}

.step-body h3 {
  @apply text-[13px] font-semibold text-ink-1;
}

.step-body p {
  @apply text-[11.5px] leading-5 text-ink-2;
}

.step-body code {
  @apply mt-1.5 block overflow-x-auto rounded-lg border border-line-1 bg-surface-2 px-2.5 py-2 font-mono text-[10.5px] leading-5 whitespace-pre text-ink-1;
}

.terminal {
  @apply min-w-0 overflow-hidden rounded-2xl border border-[#222a3b] bg-[#0b0e16] shadow-xl shadow-black/20 lg:sticky lg:top-24;
}

.terminal-head {
  @apply flex items-center gap-3 border-b border-white/5 bg-white/[0.02] px-4 py-2.5;
}

.terminal-dots {
  @apply flex items-center gap-1.5;
}

.terminal-dots span {
  @apply size-2 rounded-full bg-white/10;
}

.terminal-dots span:nth-child(1) {
  @apply bg-[#ff6b6b]/70;
}

.terminal-dots span:nth-child(2) {
  @apply bg-[#f7b955]/70;
}

.terminal-dots span:nth-child(3) {
  @apply bg-[#4ade80]/70;
}

.terminal-title {
  @apply font-mono text-[9.5px] tracking-wide text-white/35;
}

.terminal-body {
  @apply m-0 overflow-x-auto p-4 font-mono text-[10.5px] leading-[2.05] text-white/70;
}

.t-prompt {
  @apply text-[#5eead4];
}

.t-cmd {
  @apply text-white/85;
}

.t-comment {
  @apply text-white/30;
}

.terminal-tips {
  @apply border-t border-white/5 bg-white/[0.02] p-4;
}

.tips-title {
  @apply mb-2 font-mono text-[9px] tracking-[0.18em] text-white/30 uppercase;
}

.terminal-tips ul {
  @apply m-0 flex list-none flex-col gap-1.5 p-0;
}

.terminal-tips li {
  @apply flex items-baseline gap-2 text-[10.5px] text-white/45;
}

.terminal-tips code {
  @apply shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9.5px] text-[#c7d2fe];
}

@media (width < 64rem) {
  .terminal {
    @apply static;
  }
}
</style>
