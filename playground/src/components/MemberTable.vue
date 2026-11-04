<script setup lang="ts">
import { computed, ref } from 'vue'

type MemberStatus = 'online' | 'away' | 'offline'
type AvatarTone = 'violet' | 'teal' | 'rose' | 'amber'

interface Member {
  name: string
  initials: string
  email: string
  role: string
  status: MemberStatus
  joined: string
  tone: AvatarTone
}

const members: Member[] = [
  {
    name: '林知远',
    initials: 'LY',
    email: 'zhiyuan.lin@10coding.dev',
    role: 'Owner',
    status: 'online',
    joined: '2024-03-12',
    tone: 'violet',
  },
  {
    name: '陈嘉禾',
    initials: 'CJ',
    email: 'jiahe.chen@10coding.dev',
    role: 'Admin',
    status: 'online',
    joined: '2024-06-08',
    tone: 'teal',
  },
  {
    name: '苏念',
    initials: 'SN',
    email: 'nian.su@10coding.dev',
    role: 'Member',
    status: 'away',
    joined: '2025-01-19',
    tone: 'rose',
  },
  {
    name: '周屿',
    initials: 'ZY',
    email: 'yu.zhou@10coding.dev',
    role: 'Member',
    status: 'offline',
    joined: '2025-04-02',
    tone: 'amber',
  },
  {
    name: '许清和',
    initials: 'XQ',
    email: 'qinghe.xu@10coding.dev',
    role: 'Member',
    status: 'online',
    joined: '2025-08-21',
    tone: 'violet',
  },
  {
    name: '何星野',
    initials: 'HX',
    email: 'xingye.he@10coding.dev',
    role: 'Viewer',
    status: 'offline',
    joined: '2026-02-14',
    tone: 'teal',
  },
]

const statusLabel: Record<MemberStatus, string> = {
  online: '在线',
  away: '离开',
  offline: '离线',
}

const query = ref('')

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return members

  return members.filter((member) => {
    return [member.name, member.email, member.role].some((value) =>
      value.toLowerCase().includes(keyword),
    )
  })
})
</script>

<template>
  <section class="panel" aria-labelledby="table-title">
    <header class="panel-head">
      <div>
        <p class="panel-kicker">SCOPED TABLE</p>
        <h2 id="table-title">成员列表</h2>
      </div>
      <span class="panel-badge">[&amp;_tr]</span>
    </header>

    <p class="panel-desc">
      表格行、邮箱列、状态徽章都来自 scoped 样式里的 <code>@apply</code>；窄屏时邮箱列与加入时间列会自动隐藏。
    </p>

    <div class="toolbar">
      <div class="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input v-model="query" type="search" placeholder="搜索姓名、邮箱或角色…" aria-label="搜索成员" />
      </div>
      <span class="count">{{ filtered.length }} / {{ members.length }} 位成员</span>
    </div>

    <div class="table-wrap">
      <table class="member-table">
        <thead>
          <tr>
            <th scope="col">成员</th>
            <th scope="col" class="col-email">邮箱</th>
            <th scope="col">角色</th>
            <th scope="col">状态</th>
            <th scope="col" class="col-date">加入时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in filtered" :key="member.email">
            <td>
              <div class="person">
                <span class="avatar" :data-tone="member.tone" aria-hidden="true">{{ member.initials }}</span>
                <strong>{{ member.name }}</strong>
              </div>
            </td>
            <td class="col-email"><span class="email">{{ member.email }}</span></td>
            <td><span class="role">{{ member.role }}</span></td>
            <td>
              <span class="status" :data-status="member.status">
                <span class="status-dot" aria-hidden="true"></span>
                {{ statusLabel[member.status] }}
              </span>
            </td>
            <td class="col-date"><span class="date">{{ member.joined }}</span></td>
          </tr>
        </tbody>
      </table>
      <p v-if="filtered.length === 0" class="empty">没有匹配的成员，换个关键词试试。</p>
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
  @apply rounded-full border border-warn-1/20 bg-warn-soft px-2.5 py-1 font-mono text-[10px] font-semibold text-warn-1;
}

.panel-desc {
  @apply -mt-1 text-pretty text-[12.5px] leading-6 text-ink-2;
}

.panel-desc code {
  @apply rounded-md border border-line-1 bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-1;
}

.toolbar {
  @apply flex flex-wrap items-center justify-between gap-3;
}

.search {
  @apply relative flex items-center;
}

.search svg {
  @apply pointer-events-none absolute left-3 size-3.5 text-ink-3;
}

.search input {
  @apply h-9 w-60 rounded-xl border border-line-1 bg-surface-1 pr-3 pl-9 text-[12px] text-ink-1 transition-colors placeholder:text-ink-3 focus:border-brand-1 focus:outline-2 focus:outline-offset-2 focus:outline-ring/40;
}

.count {
  @apply font-mono text-[10.5px] text-ink-3;
}

.table-wrap {
  @apply overflow-x-auto rounded-xl border border-line-1;
}

.member-table {
  @apply w-full border-collapse text-left text-[12.5px] [&_tbody_tr:last-child]:border-0;
}

.member-table th {
  @apply border-b border-line-1 bg-surface-2/60 px-3 py-2.5 font-mono text-[9.5px] font-medium tracking-[0.12em] text-ink-3 uppercase;
}

.member-table tbody tr {
  @apply border-b border-line-1/70 transition-colors hover:bg-surface-2/60;
}

.member-table td {
  @apply px-3 py-2.5 align-middle;
}

.person {
  @apply flex items-center gap-2.5;
}

.person strong {
  @apply font-medium whitespace-nowrap text-ink-1;
}

.avatar {
  @apply grid size-8 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold text-white shadow-xs;
}

.avatar[data-tone='violet'] {
  @apply bg-brand-1;
}

.avatar[data-tone='teal'] {
  @apply bg-accent-1;
}

.avatar[data-tone='rose'] {
  @apply bg-danger-1;
}

.avatar[data-tone='amber'] {
  @apply bg-warn-1 text-[#3a2400];
}

.email,
.date {
  @apply font-mono text-[10.5px] text-ink-3;
}

.role {
  @apply inline-flex rounded-md border border-line-1 bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-2;
}

.status {
  @apply inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap;
}

.status[data-status='online'] {
  @apply border-accent-1/25 bg-accent-soft text-accent-1;
}

.status[data-status='away'] {
  @apply border-warn-1/25 bg-warn-soft text-warn-1;
}

.status[data-status='offline'] {
  @apply border-line-1 bg-surface-2 text-ink-3;
}

.status-dot {
  @apply size-1.5 rounded-full bg-current;
}

.col-email {
  @apply max-md:hidden;
}

.col-date {
  @apply max-lg:hidden;
}

.empty {
  @apply px-3 py-8 text-center text-[12px] text-ink-3;
}
</style>
