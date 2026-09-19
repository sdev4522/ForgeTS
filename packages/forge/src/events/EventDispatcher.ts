// packages/forge/src/events/EventDispatcher.ts
// ─────────────────────────────────────────────────────────────────────
// Lightweight, deterministic Event subsystem for ForgeTS.
//
// DESIGN & ARCHITECTURE:
// 1. Events are plain application-defined classes (zero required base class).
// 2. Listeners can be classes with a handle() method, plain functions,
//    or instances with a handle() method.
// 3. Class listeners are resolved via ForgeTS's DI Container, ensuring
//    all injected dependencies are resolved automatically.
// 4. Listeners execute in deterministic FIFO order (the order registered).
// 5. Both synchronous and asynchronous listeners are supported.
// 6. Fail-fast error propagation: if any listener throws, execution halts
//    immediately and the exception is propagated. Subsequent listeners
//    are not executed.
// ─────────────────────────────────────────────────────────────────────

import type { Container } from '../container/Container.js';

export type EventConstructor<T = any> = new (...args: any[]) => T;

export interface EventListenerClass<T = any> {
  handle(event: T): void | Promise<void>;
}

export type ListenerClass<T = any> = new (...args: any[]) => EventListenerClass<T>;
export type ListenerFunction<T = any> = (event: T) => void | Promise<void>;
export type Listener<T = any> =
  | ListenerClass<T>
  | ListenerFunction<T>
  | EventListenerClass<T>;

export class EventDispatcher {
  /**
   * Internal mapping of Event class constructor -> list of listeners.
   * Listeners are stored as an ordered array preserving registration order (FIFO).
   */
  private listeners: Map<EventConstructor, Listener[]> = new Map();

  constructor(private container?: Container) {}

  /**
   * Register one or more listeners for a given event class.
   *
   * Ordering Rule:
   * Listeners are executed in strict FIFO order according to registration sequence.
   *
   * @example
   * ```ts
   * dispatcher.listen(UserRegistered, SendWelcomeEmail);
   * dispatcher.listen(UserRegistered, [LogRegistration, NotifyAdmins]);
   * dispatcher.listen(UserRegistered, async (event) => { ... });
   * ```
   */
  listen<T extends object>(
    event: EventConstructor<T>,
    listener: Listener<T> | Listener<T>[],
  ): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const registered = this.listeners.get(event)!;
    if (Array.isArray(listener)) {
      for (const l of listener) {
        registered.push(l);
      }
    } else {
      registered.push(listener);
    }

    return this;
  }

  /**
   * Dispatch an event to all registered listeners.
   *
   * Semantics:
   * - Listeners execute sequentially in deterministic registration order.
   * - Awaits any asynchronous listeners.
   * - If no listeners are registered, returns immediately.
   * - If a listener throws or rejects, execution stops immediately and the error
   *   is propagated to the caller. Later listeners are NOT executed.
   */
  async dispatch<T extends object>(event: T): Promise<void> {
    if (!event || typeof event !== 'object') {
      throw new Error('[ForgeTS Events] Dispatched event must be an object or class instance.');
    }

    const eventConstructor = event.constructor as EventConstructor<T>;
    const registered = this.listeners.get(eventConstructor);

    if (!registered || registered.length === 0) {
      return;
    }

    for (const listener of registered) {
      await this.executeListener(listener, event);
    }
  }

  /**
   * Execute an individual listener.
   * Class listeners are resolved through the DI container.
   */
  private async executeListener<T extends object>(
    listener: Listener<T>,
    event: T,
  ): Promise<void> {
    // 1. Check if listener is a class constructor with a prototype handle() method
    if (
      typeof listener === 'function' &&
      listener.prototype &&
      typeof listener.prototype.handle === 'function'
    ) {
      const instance: EventListenerClass<T> = this.container
        ? this.container.resolve(listener as ListenerClass<T>)
        : new (listener as ListenerClass<T>)();

      await instance.handle(event);
      return;
    }

    // 2. Check if listener is a plain function
    if (typeof listener === 'function') {
      await (listener as ListenerFunction<T>)(event);
      return;
    }

    // 3. Check if listener is an already-instantiated object with a handle() method
    if (
      listener &&
      typeof listener === 'object' &&
      typeof (listener as any).handle === 'function'
    ) {
      await (listener as EventListenerClass<T>).handle(event);
      return;
    }

    throw new Error(
      `[ForgeTS Events] Invalid listener registered for event '${event.constructor.name}'. ` +
        `Expected a class with handle(), a function, or an object with handle().`,
    );
  }

  /**
   * Check if any listeners are registered for an event.
   */
  hasListeners<T extends object>(event: EventConstructor<T>): boolean {
    const list = this.listeners.get(event);
    return Boolean(list && list.length > 0);
  }

  /**
   * Get all listeners registered for an event.
   */
  getListeners<T extends object>(event: EventConstructor<T>): Listener<T>[] {
    return [...(this.listeners.get(event) ?? [])];
  }

  /**
   * Remove all listeners registered for a given event class.
   */
  forget<T extends object>(event: EventConstructor<T>): void {
    this.listeners.delete(event);
  }

  /**
   * Clear all registered events and listeners.
   */
  flush(): void {
    this.listeners.clear();
  }
}

// ─── Global Accessor & Facade ───

let _defaultDispatcher: EventDispatcher | null = null;

/**
 * Set the default framework EventDispatcher instance.
 * Automatically called during Application bootstrap.
 */
export function setEventDispatcher(dispatcher: EventDispatcher): void {
  _defaultDispatcher = dispatcher;
}

/**
 * Get the current framework EventDispatcher instance.
 * If none has been set, initializes a standalone instance.
 */
export function getEventDispatcher(): EventDispatcher {
  if (!_defaultDispatcher) {
    _defaultDispatcher = new EventDispatcher();
  }
  return _defaultDispatcher;
}

/**
 * Global events facade.
 * Provides application developers with a clean, concise syntax:
 *
 * @example
 * ```ts
 * import { events } from '@forge/core';
 *
 * await events.dispatch(new UserRegistered(user.id, user.email));
 * ```
 */
export const events = {
  dispatch<T extends object>(event: T): Promise<void> {
    return getEventDispatcher().dispatch(event);
  },

  listen<T extends object>(
    event: EventConstructor<T>,
    listener: Listener<T> | Listener<T>[],
  ): EventDispatcher {
    return getEventDispatcher().listen(event, listener);
  },

  hasListeners<T extends object>(event: EventConstructor<T>): boolean {
    return getEventDispatcher().hasListeners(event);
  },

  getListeners<T extends object>(event: EventConstructor<T>): Listener<T>[] {
    return getEventDispatcher().getListeners(event);
  },

  forget<T extends object>(event: EventConstructor<T>): void {
    getEventDispatcher().forget(event);
  },

  flush(): void {
    getEventDispatcher().flush();
  },
};
