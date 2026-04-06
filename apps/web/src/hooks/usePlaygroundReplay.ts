"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { processBar } from "@/lib/playground/replayEngine";

/**
 * Drives the bar-by-bar replay loop. Runs only when appMode === 'playground'
 * and playgroundReplay.isPlaying === true.
 */
export function usePlaygroundReplay() {
  const appMode = useStore((s) => s.appMode);
  const isPlaying = useStore((s) => s.playgroundReplay.isPlaying);
  const speed = useStore((s) => s.playgroundReplay.speed);
  const currentBarIndex = useStore((s) => s.playgroundReplay.currentBarIndex);
  const totalBars = useStore((s) => s.playgroundReplay.totalBars);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (appMode !== "playground" || !isPlaying) {
      if (tickRef.current != null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    // Interval based on speed (base = 800ms per bar at 1x)
    const baseInterval = 800;
    const interval = speed >= 100 ? 0 : Math.max(10, baseInterval / speed);

    const tick = () => {
      const state = useStore.getState();
      const idx = state.playgroundReplay.currentBarIndex;
      const total = state.playgroundReplay.totalBars;
      if (idx >= total - 1) {
        state.setReplayPlaying(false);
        return;
      }
      // Get the full dataset from active dataset
      const activeId = state.activeDataset;
      if (!activeId) return;
      const data = state.datasetChartData[activeId];
      if (!data || data.length === 0) return;

      const nextIdx = idx + 1;
      const bar = data[nextIdx];
      if (!bar) return;

      // Run matching engine
      const update = processBar(
        {
          positions: state.positions,
          orders: state.perpOrders,
          balance: state.demoWallet.balance,
        },
        bar,
        nextIdx
      );

      // Apply state updates
      state.setPositions(update.positions);
      state.setPerpOrders(update.orders);
      if (update.balance !== state.demoWallet.balance) {
        state.adjustWalletBalance(update.balance - state.demoWallet.balance);
      }
      for (const t of update.closedTrades) {
        state.addClosedTrade(t);
      }

      // Track equity history (balance + unrealized PnL)
      const equity =
        update.balance + update.positions.reduce((a, p) => a + p.unrealizedPnl, 0);
      state.pushWalletEquity(nextIdx, equity);

      // Advance bar cursor
      state.setReplayBarIndex(nextIdx);
    };

    if (interval === 0) {
      // Max speed: run via rAF
      let raf = 0;
      let running = true;
      const loop = () => {
        if (!running) return;
        tick();
        const st = useStore.getState();
        if (!st.playgroundReplay.isPlaying) return;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => {
        running = false;
        cancelAnimationFrame(raf);
      };
    }

    tickRef.current = window.setInterval(tick, interval);
    return () => {
      if (tickRef.current != null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [appMode, isPlaying, speed]);

  // Keep totalBars synced with dataset; initialize cursor to ~30% on first load
  useEffect(() => {
    const unsub = useStore.subscribe((state) => {
      const activeId = state.activeDataset;
      const data = activeId ? state.datasetChartData[activeId] : null;
      const len = data?.length ?? 0;
      if (len !== state.playgroundReplay.totalBars) {
        state.setReplayTotalBars(len);
        // If playground mode is active and cursor is still 0, seed it with context
        if (
          state.appMode === "playground" &&
          state.playgroundReplay.currentBarIndex === 0 &&
          len > 0
        ) {
          state.setReplayBarIndex(Math.min(Math.floor(len * 0.3), len - 1));
        }
      }
    });
    return unsub;
  }, []);

  // Initialize totalBars on first data load
  useEffect(() => {
    const state = useStore.getState();
    const activeId = state.activeDataset;
    const data = activeId ? state.datasetChartData[activeId] : null;
    const len = data?.length ?? 0;
    if (len > 0 && state.playgroundReplay.totalBars === 0) {
      state.setReplayTotalBars(len);
    }
  }, [currentBarIndex, totalBars]);
}
