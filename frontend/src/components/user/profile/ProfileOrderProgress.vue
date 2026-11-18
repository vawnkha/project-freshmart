<script setup>
import { computed, useId } from "vue";
import { orderStatusLabel } from "@/utils/storefront.util";

const props = defineProps({ order: { type: Object, required: true } });
const headingId = useId();
const workflow = ["pending", "processing", "shipping", "completed"];
const aliases = { confirmed: "processing", delivered: "completed", cancelled: "canceled" };
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Ho_Chi_Minh",
});

function normalizeStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  return Object.hasOwn(aliases, status) ? aliases[status] : status;
}

function label(status, fallback) {
  if (status === "cancel_pending" && props.order.paymentMethod === "paypal") return "Chờ hoàn tiền";
  return orderStatusLabel({ rawStatus: status, status: fallback });
}

const events = computed(() => (props.order.timeline ?? []).filter(Boolean).map(event => {
  const status = normalizeStatus(event.status);
  const date = new Date(event.changed_at ?? event.created_at ?? NaN);
  const hasDate = Number.isFinite(date.getTime());
  const title = String(event.status_text || event.title || "").trim();
  const humanTitle = /^[a-z]+(?:_[a-z]+)*$/i.test(title) ? "" : title;
  return {
    status,
    label: label(status, humanTitle),
    note: typeof event.note === "string" ? event.note.trim() : "",
    dateTime: hasDate ? date.toISOString() : "",
    timeLabel: hasDate ? dateFormatter.format(date) : "",
  };
}));

const current = computed(() => normalizeStatus(props.order.rawStatus) || events.value.at(-1)?.status || "unknown");
const latest = computed(() => events.value.findLast(event => event.status === current.value));
const steps = computed(() => {
  const reached = new Set(events.value.map(event => event.status));
  const path = current.value === "awaiting_payment" || reached.has("awaiting_payment")
    ? ["awaiting_payment", ...workflow]
    : workflow;
  if (path.includes(current.value)) return path;
  if (current.value === "cancel_pending" || current.value === "canceled") {
    const stopped = path.filter(status => reached.has(status));
    if (current.value === "canceled" && reached.has("cancel_pending")) stopped.push("cancel_pending");
    return [...stopped, current.value];
  }
  return [current.value];
});
const activeIndex = computed(() => steps.value.indexOf(current.value));
</script>

<template>
  <section class="order-progress" :aria-labelledby="headingId">
    <h3 :id="headingId" class="order-progress__heading">Tiến trình đơn hàng</h3>
    <ol class="order-progress__steps" role="list">
      <li
        v-for="(step, index) in steps" :key="step"
        class="order-progress__step" :class="{ 'is-past': index < activeIndex }"
        :data-status="step" :aria-current="step === current ? 'step' : undefined"
      >
        <span class="order-progress__marker" aria-hidden="true">
          <i v-if="index < activeIndex || (step === current && step === 'completed')" class="fa-solid fa-check"></i>
          <i v-else-if="step === current && step === 'canceled'" class="fa-solid fa-xmark"></i>
          <i v-else-if="step === current && step === 'cancel_pending'" class="fa-regular fa-clock"></i>
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="order-progress__label">{{ label(step) }}</span>
      </li>
    </ol>

    <div v-if="latest?.note || latest?.timeLabel" class="order-progress__update">
      <span v-if="latest.note">{{ latest.note }}</span>
      <time v-if="latest.timeLabel" :datetime="latest.dateTime">{{ latest.timeLabel }}</time>
    </div>

    <details v-if="events.length" class="order-progress__history">
      <summary>
        Lịch sử cập nhật
        <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
      </summary>
      <ol class="order-progress__events" role="list">
        <li v-for="(event, index) in events" :key="index">
          <div class="order-progress__event-header">
            <strong>{{ event.label }}</strong>
            <time v-if="event.timeLabel" :datetime="event.dateTime">{{ event.timeLabel }}</time>
          </div>
          <span v-if="event.note">{{ event.note }}</span>
        </li>
      </ol>
    </details>
  </section>
</template>

<style scoped>
/* Hallmark · pre-emit critique: P4 H5 E5 S5 R5 V4 · existing Sage Blue system */
.order-progress {
  --order-step-size: 32px;
  container-type: inline-size;
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  margin-block-end: var(--space-6);
  padding: clamp(16px, 3vw, 24px);
  overflow-wrap: anywhere;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--ink);
}

.order-progress__heading {
  margin: 0;
  font: 700 20px/1.25 var(--font-display);
}

.order-progress__steps,
.order-progress__events {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.order-progress__step {
  position: relative;
  display: grid;
  grid-template-columns: var(--order-step-size) minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  min-width: 0;
  color: var(--muted);
}

.order-progress__step:not(:last-child) {
  padding-block-end: var(--space-3);
}

.order-progress__step:not(:last-child)::after {
  position: absolute;
  inset-inline-start: calc((var(--order-step-size) - 2px) / 2);
  inset-block: calc(var(--order-step-size) / 2) calc(var(--order-step-size) / -2);
  inline-size: 2px;
  background: var(--line-2);
  content: "";
}

.order-progress__step.is-past::after {
  background: var(--sage-light);
}

.order-progress__marker {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  inline-size: var(--order-step-size);
  block-size: var(--order-step-size);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-pill);
  background: var(--surface);
  font: 700 13px/1 var(--font-body);
}

.order-progress__label {
  align-self: center;
  font: 600 14px/1.35 var(--font-body);
}

.order-progress__step.is-past {
  color: var(--ink);
}

.order-progress__step.is-past .order-progress__marker {
  border-color: var(--sage-deep);
  background: var(--sage-deep);
  color: var(--on-primary);
}

.order-progress__step[aria-current="step"] {
  --step-ink: var(--sage-deep);
  --step-surface: var(--sage-tint);
  color: var(--step-ink);
}

.order-progress__step[data-status="completed"] {
  --step-ink: var(--success);
  --step-surface: var(--success-soft);
}

.order-progress__step[data-status="cancel_pending"] {
  --step-ink: var(--warning);
  --step-surface: var(--warning-soft);
}

.order-progress__step[data-status="canceled"] {
  --step-ink: var(--danger);
  --step-surface: var(--danger-soft);
}

.order-progress__step[aria-current="step"] .order-progress__marker {
  border: 2px solid currentColor;
  background: var(--step-surface);
}

.order-progress__step[aria-current="step"] .order-progress__label {
  font-weight: 700;
}

.order-progress__update,
.order-progress__event-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
}

.order-progress__update {
  padding: var(--space-3);
  border-radius: var(--radius-input);
  background: var(--mist);
  color: var(--body-ink);
  font-size: 14px;
}

.order-progress time {
  color: var(--muted);
  font: 400 12px/1.5 var(--font-mono);
}

.order-progress__history {
  border-block-start: 1px solid var(--border);
}

.order-progress__history summary {
  display: flex;
  min-height: var(--field-size);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  border-radius: var(--radius-input);
  color: var(--sage-deep);
  font: 600 14px/1.4 var(--font-body);
  cursor: pointer;
}

.order-progress__history summary::-webkit-details-marker {
  display: none;
}

.order-progress__history summary:active {
  color: var(--sage-active);
}

.order-progress__history summary:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.order-progress__history[open] summary i {
  transform: rotate(180deg);
}

.order-progress__events {
  gap: var(--space-2);
  font-size: 14px;
}

.order-progress__events li {
  padding-block-start: var(--space-2);
  border-block-start: 1px solid var(--border);
}

.order-progress__events li > span {
  display: block;
  margin-block-start: var(--space-1);
  color: var(--muted);
}

@media (hover: hover) {
  .order-progress__history summary:hover {
    text-decoration: underline;
  }
}

@container (min-width: 540px) {
  .order-progress__steps {
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
  }

  .order-progress__step:not(:only-child) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    text-align: center;
  }

  .order-progress__step:not(:last-child)::after {
    inset-inline: 50% -50%;
    inset-block: calc((var(--order-step-size) - 2px) / 2) auto;
    inline-size: auto;
    block-size: 2px;
  }
}
</style>
