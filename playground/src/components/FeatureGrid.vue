<script setup lang="ts">
import FeatureCard from './FeatureCard.vue'
import type { FeatureIcon } from '../types'

const features: Array<{
  icon: FeatureIcon
  title: string
  description: string
  tag: string
}> = [
  {
    icon: 'scope',
    title: '作用域安全',
    description:
      '@reference 只负责把 Tailwind 主题交给编译器；转换完成后自动移除，Vue scoped 的选择器与 :deep() 保持原样。',
    tag: '@reference',
  },
  {
    icon: 'variants',
    title: '变体照常工作',
    description:
      'hover、focus-visible、max-lg、[&_tr]、group-hover 会展开成普通规则和 @media，不依赖 CSS 嵌套。',
    tag: 'variants',
  },
  {
    icon: 'runtime',
    title: '零运行时',
    description:
      '产物只有声明、伪类和媒体查询。主题变量仍由全局 CSS 提供，明暗切换不会因为转换而失效。',
    tag: 'build-time',
  },
]
</script>

<template>
  <section id="features" class="features">
    <div class="features-heading">
      <p class="eyebrow">WHY THIS TOOL</p>
      <h2>编译期展开，运行时退场</h2>
      <p>
        组件源码保留可读的 Tailwind 写法，构建前用一条命令得到浏览器和 Vue scoped
        都能直接消费的普通 CSS。
      </p>
    </div>

    <div class="feature-grid">
      <FeatureCard
        v-for="(feature, index) in features"
        :key="feature.title"
        :icon="feature.icon"
        :index="index"
        :title="feature.title"
        :description="feature.description"
        :tag="feature.tag"
      />
    </div>
  </section>
</template>

<style scoped>
@reference "../style.css";

.features {
  @apply flex flex-col gap-7;
}

.features-heading {
  @apply flex max-w-2xl flex-col gap-2.5;
}

.eyebrow {
  @apply font-mono text-[10px] font-semibold tracking-[0.2em] text-brand-ink uppercase;
}

.features-heading h2 {
  @apply text-balance text-[1.65rem] font-semibold tracking-tight text-ink-1 sm:text-3xl;
}

.features-heading p {
  @apply text-pretty text-[13.5px] leading-6 text-ink-2;
}

.feature-grid {
  @apply grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3;
}

@media (width < 40rem) {
  .features-heading h2 {
    @apply text-[1.5rem];
  }
}
</style>
