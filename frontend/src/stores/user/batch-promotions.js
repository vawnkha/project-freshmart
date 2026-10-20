import { defineStore } from "pinia";
import discountService from "@/services/discount.service";
const runtimes = new WeakMap();
export const useBatchPromotionStore = defineStore("batch-promotions", {
  state: () => ({ offers: [], verified: false, hasRefreshed: false }),
  actions: {
    subscribe() {
      let runtime = runtimes.get(this.$state);
      if (!runtime) { runtime = { subscribers: 0, pending: null, timer: null }; runtimes.set(this.$state, runtime); }
      if (++runtime.subscribers === 1) { runtime.timer = setInterval(() => this.refresh(), 60000); runtime.timer.unref?.(); }
      return () => { if (--runtime.subscribers === 0) { clearInterval(runtime.timer); this.offers = []; this.verified = false; this.hasRefreshed = false; } };
    },
    async refresh() {
      const runtime = runtimes.get(this.$state);
      if (!runtime || runtime.pending) return runtime?.pending;
      runtime.pending = (async () => {
        try { const result = await discountService.getPublic(); if (runtime.subscribers) { this.offers = (result.data || []).filter(row => row.scope === "batch"); this.verified = true; } }
        catch { this.offers = []; this.verified = false; }
        finally { this.hasRefreshed = true; runtime.pending = null; }
      })();
      return runtime.pending;
    },
  },
});
