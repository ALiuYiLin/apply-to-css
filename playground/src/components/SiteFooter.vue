<template>
  <footer class="footer">
    <div class="footer-brand">
      <span class="footer-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="m8 3.5-4.5 8.5L8 20.5" />
          <path d="m16 3.5 4.5 8.5L16 20.5" />
          <path d="M13.6 6.8 10.4 17.2" />
        </svg>
      </span>
      <div>
        <strong>apply-to-css</strong>
        <p>把 Vue SFC 里的 Tailwind @apply 展开成普通 CSS。</p>
      </div>
    </div>

    <div class="footer-meta">
      <a href="#top">回到顶部 ↑</a>
      <span>Vite · Vue 3 · TypeScript · Tailwind v4</span>
    </div>
  </footer>
</template>

<style scoped>
@reference "../style.css";

.footer {
  @apply mt-auto flex flex-col gap-4 border-t border-line-1 pt-6 pb-2 sm:flex-row sm:items-center sm:justify-between;
}

.footer-brand {
  @apply flex items-center gap-2.5;
}

.footer-mark {
  @apply grid size-8 shrink-0 place-items-center rounded-lg border border-line-1 bg-surface-1 text-brand-ink;
}

.footer-mark svg {
  @apply size-4;
}

.footer-brand strong {
  @apply block text-[12px] font-semibold tracking-tight text-ink-1;
}

.footer-brand p {
  @apply mt-0.5 text-[10.5px] text-ink-3;
}

.footer-meta {
  @apply flex flex-col gap-1 text-[10px] text-ink-3 sm:items-end;
}

.footer-meta a {
  @apply font-medium text-ink-2 no-underline transition-colors hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-ring;
}
</style>
