<script setup lang="ts">
import { ref } from 'vue'
import TheHeader from './components/TheHeader.vue'
import HeroSection from './components/HeroSection.vue'
import FeatureGrid from './components/FeatureGrid.vue'
import ActionButtons from './components/ActionButtons.vue'
import VariantLab from './components/VariantLab.vue'
import MemberTable from './components/MemberTable.vue'
import CodeCompare from './components/CodeCompare.vue'
import UsageSection from './components/UsageSection.vue'
import SiteFooter from './components/SiteFooter.vue'

const STORAGE_KEY = 'apply-to-css-theme'

const isDark = ref(document.documentElement.classList.contains('dark'))

function toggleTheme() {
  const next = !isDark.value
  isDark.value = next
  document.documentElement.classList.toggle('dark', next)

  try {
    localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
  } catch {
    /* localStorage can be unavailable in private mode */
  }
}
</script>

<template>
  <div id="top" class="page">
    <a class="skip-link" href="#main">跳到主要内容</a>
    <div class="page-grid" aria-hidden="true"></div>
    <div class="page-glow" aria-hidden="true"></div>

    <div class="shell">
      <TheHeader :is-dark="isDark" @toggle-theme="toggleTheme" />

      <main id="main" class="main">
        <HeroSection />
        <FeatureGrid />

        <section id="components" class="components">
          <div class="components-heading">
            <p class="eyebrow">LIVE COMPONENTS</p>
            <h2>组件里的 @apply，真的在跑</h2>
            <p>
              下面每个面板的样式都写在自己的 <code>&lt;style scoped&gt;</code> 中。切换深色模式，或缩小窗口，看看
              <code>hover:</code>、<code>max-lg:</code> 与 <code>dark:</code> 一起工作。
            </p>
          </div>

          <div class="component-grid">
            <ActionButtons />
            <VariantLab />
          </div>

          <MemberTable />
        </section>

        <CodeCompare />
        <UsageSection />
      </main>

      <SiteFooter />
    </div>
  </div>
</template>

<style scoped>
@reference "./style.css";

.page {
  @apply relative min-h-screen overflow-x-clip bg-surface-0 text-ink-1;
}

.skip-link {
  @apply absolute top-4 left-4 z-50 -translate-y-20 rounded-lg bg-brand-1 px-3 py-2 text-[12px] font-medium text-white no-underline transition-transform focus:translate-y-0;
}

.page-grid {
  @apply pointer-events-none absolute inset-0 h-[720px] opacity-40 dark:opacity-25;
  background-image: radial-gradient(var(--line-2) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: linear-gradient(to bottom, black, transparent 72%);
}

.page-glow {
  @apply pointer-events-none absolute inset-x-0 top-0 h-[680px];
  background:
    radial-gradient(
      42rem 28rem at 16% -8%,
      color-mix(in oklab, var(--brand-1) 20%, transparent),
      transparent 70%
    ),
    radial-gradient(
      38rem 24rem at 88% 0%,
      color-mix(in oklab, var(--accent-1) 14%, transparent),
      transparent 70%
    );
}

.shell {
  @apply relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pt-4 pb-8 sm:px-6 lg:px-8;
}

.main {
  @apply flex flex-1 flex-col gap-16 pt-12 pb-14 sm:gap-20 sm:pt-16;
}

.components {
  @apply flex flex-col gap-6;
}

.components-heading {
  @apply flex max-w-2xl flex-col gap-2.5;
}

.eyebrow {
  @apply font-mono text-[10px] font-semibold tracking-[0.2em] text-brand-ink uppercase;
}

.components-heading h2 {
  @apply text-balance text-[1.65rem] font-semibold tracking-tight text-ink-1 sm:text-3xl;
}

.components-heading p {
  @apply text-pretty text-[13.5px] leading-6 text-ink-2;
}

.components-heading code {
  @apply rounded-md border border-line-1 bg-surface-1 px-1.5 py-0.5 font-mono text-[0.9em] whitespace-nowrap text-ink-1;
}

.component-grid {
  @apply grid min-w-0 gap-3.5 lg:grid-cols-[1.08fr_0.92fr];
}

@media (width < 40rem) {
  .page-grid {
    background-size: 20px 20px;
  }
}
</style>
