## 1. Monotonic Clock Foundation

- [x] 1.1 Add a shared elapsed-clock seam backed by `performance.now()` and verify a focused unit test can supply deterministic fractional-millisecond samples without using wall-clock time.
- [x] 1.2 Replace integer-truncating elapsed-sample normalization with finite, non-negative, fractional-preserving normalization and verify tests cover fractional values, non-finite values, and end-before-start clamping.

## 2. Runtime Elapsed Measurements

- [x] 2.1 Switch run start/settlement, provider request/first output/response completion, and tool start/end defaults in `src/run-activity.ts` to the elapsed clock while retaining explicit timestamp overrides; verify `tests/run-activity.test.ts` covers fractional TTFT, TPS, run duration, and tool duration.
- [x] 2.2 Switch active run/tool sidebar rendering to the same elapsed clock domain and verify sidebar tests show continuous live-to-completed durations and stable concurrent-tool ordering.
- [x] 2.3 Add a regression test that changes `Date.now()` forward and backward while monotonic time advances, and verify response, run, and tool elapsed values remain based only on monotonic time.

## 3. Compatibility and Validation

- [x] 3.1 Update extension integration tests that currently use wall-clock fake timers to control the elapsed-clock seam, and verify existing TTFT/TPS values, estimated `~` marking, reset behavior, and formatted output remain unchanged.
- [x] 3.2 Run the focused run-activity, sidebar, footer, and extension integration test suites and verify all elapsed-time capability scenarios pass.
- [x] 3.3 Run `npm run check` and verify type checking, linting, formatting, all tests, and package validation pass.
