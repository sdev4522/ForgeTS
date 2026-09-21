// tests/unit/Events.test.ts
// ─────────────────────────────────────────────────────────────────────
// Comprehensive test suite for the ForgeTS generic Events subsystem.
// Uses generic, neutral test events and listeners.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  EventDispatcher,
  events,
  Application,
  Container,
  Injectable,
  type EventListenerClass,
} from '../../packages/forge/src/index.js';

// ─── Generic Domain Events (Plain TS Classes) ───

class SampleEvent {
  constructor(
    public readonly id: number,
    public readonly payload: string,
  ) {}
}

class SecondarySampleEvent {
  constructor(
    public readonly referenceId: string,
    public readonly value: number,
  ) {}
}

// ─── Generic Service for DI Testing ───

@Injectable({ lifetime: 'singleton' })
class SampleAuditService {
  public logs: string[] = [];

  log(message: string) {
    this.logs.push(message);
  }
}

// ─── Generic Listeners ───

class AsyncTestListener implements EventListenerClass<SampleEvent> {
  static handledCount = 0;
  static lastHandledPayload = '';

  async handle(event: SampleEvent): Promise<void> {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));
    AsyncTestListener.handledCount++;
    AsyncTestListener.lastHandledPayload = event.payload;
  }
}

class OrderedSequenceListener implements EventListenerClass<SampleEvent> {
  static callOrder: number[] = [];

  handle(event: SampleEvent): void {
    OrderedSequenceListener.callOrder.push(event.id);
  }
}

class DependencyInjectedListener implements EventListenerClass<SampleEvent> {
  constructor(private audit: SampleAuditService) {}

  handle(event: SampleEvent): void {
    this.audit.log(`Event handled: ${event.payload} (ID: ${event.id})`);
  }
}

class FailingListener implements EventListenerClass<SampleEvent> {
  handle(_event: SampleEvent): void {
    throw new Error('Failure in FailingListener');
  }
}

class AsyncFailingListener implements EventListenerClass<SampleEvent> {
  async handle(_event: SampleEvent): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
    throw new Error('Async failure in AsyncFailingListener');
  }
}

describe('ForgeTS Events Subsystem', () => {
  let dispatcher: EventDispatcher;
  let container: Container;

  beforeEach(() => {
    container = new Container();
    dispatcher = new EventDispatcher(container);
    AsyncTestListener.handledCount = 0;
    AsyncTestListener.lastHandledPayload = '';
    OrderedSequenceListener.callOrder = [];
    events.flush();
  });

  test('1. Event dispatch: dispatches event and executes registered class listener', async () => {
    dispatcher.listen(SampleEvent, AsyncTestListener);

    expect(dispatcher.hasListeners(SampleEvent)).toBe(true);
    await dispatcher.dispatch(new SampleEvent(42, 'test-payload'));

    expect(AsyncTestListener.handledCount).toBe(1);
    expect(AsyncTestListener.lastHandledPayload).toBe('test-payload');
  });

  test('2. One event with multiple listeners: executes all registered listeners', async () => {
    let fnExecuted = false;
    dispatcher.listen(SampleEvent, AsyncTestListener);
    dispatcher.listen(SampleEvent, OrderedSequenceListener);
    dispatcher.listen(SampleEvent, (event: SampleEvent) => {
      fnExecuted = true;
      expect(event.id).toBe(101);
    });

    await dispatcher.dispatch(new SampleEvent(101, 'multi-payload'));

    expect(AsyncTestListener.handledCount).toBe(1);
    expect(OrderedSequenceListener.callOrder).toEqual([101]);
    expect(fnExecuted).toBe(true);
  });

  test('3. Deterministic listener ordering: executes in strict FIFO sequence', async () => {
    const executionSequence: string[] = [];

    dispatcher.listen(SampleEvent, () => {
      executionSequence.push('first');
    });
    dispatcher.listen(SampleEvent, async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      executionSequence.push('second-async');
    });
    dispatcher.listen(SampleEvent, () => {
      executionSequence.push('third');
    });

    await dispatcher.dispatch(new SampleEvent(1, 'order-payload'));

    expect(executionSequence).toEqual(['first', 'second-async', 'third']);
  });

  test('4. Async listener: dispatch correctly awaits async listeners', async () => {
    let completedAt = 0;
    const startedAt = Date.now();

    dispatcher.listen(SampleEvent, async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      completedAt = Date.now();
    });

    await dispatcher.dispatch(new SampleEvent(7, 'async-payload'));

    expect(completedAt).toBeGreaterThanOrEqual(startedAt + 25);
  });

  test('5. Listener dependency injection: resolves class listeners and constructor dependencies through DI container', async () => {
    const audit = new SampleAuditService();
    container.instance(SampleAuditService, audit);

    // Register factory that injects SampleAuditService into DependencyInjectedListener
    container.bind(
      DependencyInjectedListener,
      () => new DependencyInjectedListener(container.resolve(SampleAuditService)),
    );

    dispatcher.listen(SampleEvent, DependencyInjectedListener);

    await dispatcher.dispatch(new SampleEvent(99, 'injected-payload'));

    expect(audit.logs).toHaveLength(1);
    expect(audit.logs[0]).toBe('Event handled: injected-payload (ID: 99)');
  });

  test('6. Listener failure propagation: synchronous listener failure halts execution and rejects dispatch', async () => {
    let afterFailureExecuted = false;

    dispatcher.listen(SampleEvent, () => {
      // Listener before failure runs fine
    });
    dispatcher.listen(SampleEvent, FailingListener);
    dispatcher.listen(SampleEvent, () => {
      afterFailureExecuted = true;
    });

    await expect(
      dispatcher.dispatch(new SampleEvent(1, 'error-payload')),
    ).rejects.toThrow('Failure in FailingListener');

    // Subsequent listeners must NOT execute
    expect(afterFailureExecuted).toBe(false);
  });

  test('7. Listener failure propagation: async listener failure halts execution and rejects dispatch', async () => {
    let afterFailureExecuted = false;

    dispatcher.listen(SampleEvent, AsyncFailingListener);
    dispatcher.listen(SampleEvent, () => {
      afterFailureExecuted = true;
    });

    await expect(
      dispatcher.dispatch(new SampleEvent(2, 'async-error-payload')),
    ).rejects.toThrow('Async failure in AsyncFailingListener');

    expect(afterFailureExecuted).toBe(false);
  });

  test('8. Dispatching an event with no registered listeners: returns cleanly without error', async () => {
    expect(dispatcher.hasListeners(SecondarySampleEvent)).toBe(false);

    // Should complete cleanly without error
    await expect(
      dispatcher.dispatch(new SecondarySampleEvent('REF-1234', 199.99)),
    ).resolves.toBeUndefined();
  });

  test('9. Batch listener registration and forget: listen array and clear specific event listeners', async () => {
    const list: number[] = [];
    dispatcher.listen(SecondarySampleEvent, [
      () => { list.push(1); },
      () => { list.push(2); },
      () => { list.push(3); },
    ]);

    expect(dispatcher.getListeners(SecondarySampleEvent)).toHaveLength(3);

    await dispatcher.dispatch(new SecondarySampleEvent('R-1', 50));
    expect(list).toEqual([1, 2, 3]);

    dispatcher.forget(SecondarySampleEvent);
    expect(dispatcher.hasListeners(SecondarySampleEvent)).toBe(false);
    expect(dispatcher.getListeners(SecondarySampleEvent)).toHaveLength(0);
  });

  test('10. Global events facade & Application bootstrap integration', async () => {
    const app = new Application();

    // 1. Application exposes .events property
    expect(app.events).toBeInstanceOf(EventDispatcher);

    // 2. DI container has 'events' and EventDispatcher bound
    expect(app.container.has('events')).toBe(true);
    expect(app.container.has(EventDispatcher)).toBe(true);
    expect(app.container.resolve(EventDispatcher)).toBe(app.events);
    expect(app.container.resolve<EventDispatcher>('events')).toBe(app.events);

    // 3. Global events facade delegates to active application dispatcher
    let facadeTriggered = false;
    events.listen(SampleEvent, () => {
      facadeTriggered = true;
    });

    await events.dispatch(new SampleEvent(555, 'facade-payload'));
    expect(facadeTriggered).toBe(true);
  });
});
