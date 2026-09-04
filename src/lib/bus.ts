/**
 * Event & metadata bus.
 *
 * TRD.md §3.3 specifies Kafka in production. The demo runs a single Node process,
 * so this is an in-process implementation of the same publish/subscribe contract
 * with the same topic names. Swapping in a KafkaBus means implementing `EventBus`
 * — no producer or consumer changes.
 */

import type { BusEvents, BusTopic } from "./types";

export interface EventBus {
  publish<T extends BusTopic>(topic: T, payload: BusEvents[T]): void;
  subscribe<T extends BusTopic>(topic: T, fn: (payload: BusEvents[T]) => void): () => void;
  /** Every topic, for the SSE fan-out and the live event inspector. */
  subscribeAll(fn: <T extends BusTopic>(topic: T, payload: BusEvents[T]) => void): () => void;
  stats(): Record<string, number>;
}

type AnyHandler = (topic: BusTopic, payload: unknown) => void;

class InProcessBus implements EventBus {
  private handlers = new Map<BusTopic, Set<(payload: never) => void>>();
  private wildcard = new Set<AnyHandler>();
  private counts: Record<string, number> = {};

  publish<T extends BusTopic>(topic: T, payload: BusEvents[T]): void {
    this.counts[topic] = (this.counts[topic] ?? 0) + 1;
    const set = this.handlers.get(topic);
    if (set) {
      for (const fn of set) {
        try {
          (fn as (p: BusEvents[T]) => void)(payload);
        } catch (err) {
          console.error(`[bus] handler failed on ${topic}:`, err);
        }
      }
    }
    for (const fn of this.wildcard) {
      try {
        fn(topic, payload);
      } catch (err) {
        console.error(`[bus] wildcard handler failed on ${topic}:`, err);
      }
    }
  }

  subscribe<T extends BusTopic>(topic: T, fn: (payload: BusEvents[T]) => void): () => void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(fn as (payload: never) => void);
    return () => {
      set!.delete(fn as (payload: never) => void);
    };
  }

  subscribeAll(fn: <T extends BusTopic>(topic: T, payload: BusEvents[T]) => void): () => void {
    const wrapped = fn as unknown as AnyHandler;
    this.wildcard.add(wrapped);
    return () => {
      this.wildcard.delete(wrapped);
    };
  }

  stats(): Record<string, number> {
    return { ...this.counts };
  }
}

// Next.js dev reloads modules; a fresh bus per reload would orphan every
// subscriber, so the instance is pinned to globalThis.
const g = globalThis as typeof globalThis & { __sentinelBus?: EventBus };
export const bus: EventBus = g.__sentinelBus ?? (g.__sentinelBus = new InProcessBus());
