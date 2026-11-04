<script setup lang="ts">
import type { FeatureIcon } from '../types'

defineProps<{
  icon: FeatureIcon
  index: number
  title: string
  description: string
  tag: string
}>()
</script>

<template>
  <article class="feature-card group">
    <span class="feature-index" aria-hidden="true">0{{ index + 1 }}</span>

    <span class="feature-icon" aria-hidden="true">
      <svg v-if="icon === 'scope'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="m8 3.5-4.5 8.5L8 20.5" />
        <path d="m16 3.5 4.5 8.5L16 20.5" />
        <path d="M13.6 6.8 10.4 17.2" />
      </svg>
      <svg v-else-if="icon === 'variants'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h7M15 7h5M4 17h3M11 17h9" />
        <circle cx="13" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    </span>

    <div class="feature-copy">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>

    <span class="feature-tag">
      <span class="tag-dot" aria-hidden="true"></span>
      {{ tag }}
    </span>
  </article>
</template>

<style scoped>
@reference "../style.css";

.feature-card {
  @apply relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-line-1 bg-surface-1 p-5 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-line-2 hover:shadow-xl hover:shadow-black/5;
}

.feature-card::after {
  @apply pointer-events-none absolute -top-14 -right-12 size-36 rounded-full bg-brand-soft opacity-0 blur-2xl transition-opacity duration-300;
  content: '';
}

.feature-card:hover::after {
  @apply opacity-100;
}

.feature-index {
  @apply absolute top-4 right-4 font-mono text-[10px] tracking-[0.16em] text-ink-3/60;
}

.feature-icon {
  @apply grid size-10 place-items-center rounded-xl border border-line-1 bg-surface-2 text-brand-ink transition duration-300 group-hover:-rotate-6 group-hover:border-brand-1/25 group-hover:bg-brand-soft;
}

.feature-icon svg {
  @apply size-5;
}

.feature-copy {
  @apply flex flex-col gap-1.5;
}

.feature-copy h3 {
  @apply text-[15px] font-semibold tracking-tight text-ink-1;
}

.feature-copy p {
  @apply text-pretty text-[13px] leading-6 text-ink-2;
}

.feature-tag {
  @apply mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-line-1 bg-surface-2/70 px-2.5 py-1 font-mono text-[10px] text-ink-3;
}

.tag-dot {
  @apply size-1 rounded-full bg-brand-1;
}
</style>
