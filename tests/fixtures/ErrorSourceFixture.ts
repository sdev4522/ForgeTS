// tests/fixtures/ErrorSourceFixture.ts
// Deterministic fixture for source snippet and error highlight unit tests.

export class ExampleController {
  index() {
    const status = 'ok';
    return { status };
  }

  show(id: number) {
    if (id < 0) {
      throw new Error('Invalid identifier provided');
    }
    return { id, active: true };
  }
}
