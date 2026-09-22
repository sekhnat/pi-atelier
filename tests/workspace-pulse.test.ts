import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createWorkspacePulseRefresh,
	inspectWorkspacePulse,
	type WorkspacePulseInspection,
} from "../src/workspace-pulse.js";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

afterEach(() => {
	vi.useRealTimers();
});

const result = (stdout = "", code = 0, stderr = "") => ({
	stdout,
	stderr,
	code,
	killed: false,
});

describe("createWorkspacePulseRefresh", () => {
	const clean: WorkspacePulseInspection = {
		kind: "available",
		root: "/repo",
		relativeCwd: "",
		branch: "main",
		snapshot: {
			trackedFiles: 0,
			untrackedFiles: 0,
			linesAdded: 0,
			linesRemoved: 0,
			binaryFiles: 0,
			submodules: 0,
			conflicts: 0,
		},
	};

	it("coalesces scheduled requests into one inspection", async () => {
		vi.useFakeTimers();
		const inspect = vi.fn().mockResolvedValue(clean);
		const publish = vi.fn();
		const refresh = createWorkspacePulseRefresh({ inspect, publish, delayMs: 250 });

		refresh.request();
		refresh.request();
		refresh.request();
		await vi.advanceTimersByTimeAsync(249);
		expect(inspect).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		expect(inspect).toHaveBeenCalledOnce();
		expect(publish).toHaveBeenCalledWith(clean);
	});

	it("runs no concurrent inspections and retains one trailing request", async () => {
		vi.useFakeTimers();
		const first = deferred<WorkspacePulseInspection>();
		const second = deferred<WorkspacePulseInspection>();
		const inspect = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const publish = vi.fn();
		const refresh = createWorkspacePulseRefresh({ inspect, publish, delayMs: 250 });

		refresh.request();
		await vi.advanceTimersByTimeAsync(250);
		expect(inspect).toHaveBeenCalledOnce();

		refresh.request();
		await vi.advanceTimersByTimeAsync(250);
		expect(inspect).toHaveBeenCalledOnce();

		first.resolve(clean);
		await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(2));
		second.resolve(clean);
		await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(2));
	});

	it("flushes through a running inspection to guarantee a fresh result", async () => {
		vi.useFakeTimers();
		const first = deferred<WorkspacePulseInspection>();
		const second = deferred<WorkspacePulseInspection>();
		const changed: WorkspacePulseInspection = {
			...clean,
			branch: "feature/pulse",
			snapshot: { ...clean.snapshot, trackedFiles: 1 },
		};
		const inspect = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const publish = vi.fn();
		const refresh = createWorkspacePulseRefresh({ inspect, publish, delayMs: 250 });

		refresh.request();
		await vi.advanceTimersByTimeAsync(250);
		const flushed = refresh.flush();
		first.resolve(clean);
		await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(2));
		second.resolve(changed);
		await flushed;

		expect(publish).toHaveBeenLastCalledWith(changed);
	});

	it("cancels scheduled work and ignores in-flight results after disposal", async () => {
		vi.useFakeTimers();
		const running = deferred<WorkspacePulseInspection>();
		const inspect = vi.fn().mockReturnValue(running.promise);
		const publish = vi.fn();
		const refresh = createWorkspacePulseRefresh({ inspect, publish, delayMs: 250 });

		refresh.request();
		await vi.advanceTimersByTimeAsync(250);
		refresh.request();
		refresh.dispose();
		running.resolve(clean);
		await vi.runAllTimersAsync();

		expect(inspect).toHaveBeenCalledOnce();
		expect(publish).not.toHaveBeenCalled();
	});

	it("aborts the enabled lifetime and rejects stale results when disabled", async () => {
		vi.useFakeTimers();
		const running = deferred<WorkspacePulseInspection>();
		let observedSignal: AbortSignal | undefined;
		const inspect = vi.fn().mockImplementation((signal: AbortSignal) => {
			observedSignal = signal;
			return running.promise;
		});
		const publish = vi.fn();
		const refresh = createWorkspacePulseRefresh({ inspect, publish, delayMs: 250 });

		refresh.request();
		await vi.advanceTimersByTimeAsync(250);
		expect(inspect).toHaveBeenCalledOnce();
		refresh.setEnabled(false);
		expect(observedSignal?.aborted).toBe(true);
		running.resolve(clean);
		await vi.runAllTimersAsync();

		expect(publish).not.toHaveBeenCalled();
	});

	it("cancels a pending debounce when disabled", async () => {
		vi.useFakeTimers();
		const inspect = vi.fn().mockResolvedValue(clean);
		const publish = vi.fn();
		const refresh = createWorkspacePulseRefresh({ inspect, publish, delayMs: 250 });

		refresh.request();
		refresh.setEnabled(false);
		await vi.runAllTimersAsync();
		expect(inspect).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();

		refresh.setEnabled(true);
		refresh.request();
		await vi.advanceTimersByTimeAsync(250);
		expect(inspect).toHaveBeenCalledOnce();
		expect(publish).toHaveBeenCalledWith(clean);
	});

	it("releases flush waiters promptly when disabled", async () => {
		vi.useFakeTimers();
		const running = deferred<WorkspacePulseInspection>();
		const inspect = vi.fn().mockReturnValue(running.promise);
		const publish = vi.fn();
		const refresh = createWorkspacePulseRefresh({ inspect, publish, delayMs: 250 });

		const flushed = refresh.flush();
		expect(inspect).toHaveBeenCalledOnce();
		refresh.setEnabled(false);
		await flushed;
		expect(publish).not.toHaveBeenCalled();

		running.resolve(clean);
		await vi.runAllTimersAsync();
		expect(publish).not.toHaveBeenCalled();
	});

	it("creates a fresh signal for each enabled lifetime", async () => {
		const signals: AbortSignal[] = [];
		const inspect = vi.fn().mockImplementation((signal: AbortSignal) => {
			signals.push(signal);
			return Promise.resolve(clean);
		});
		const publish = vi.fn();
		const refresh = createWorkspacePulseRefresh({ inspect, publish, delayMs: 0 });

		refresh.request();
		await refresh.flush();
		refresh.setEnabled(false);
		refresh.setEnabled(true);
		refresh.request();
		await refresh.flush();

		expect(inspect).toHaveBeenCalledTimes(2);
		expect(signals[0]?.aborted).toBe(true);
		expect(signals[1]?.aborted).toBe(false);
		expect(publish).toHaveBeenCalledTimes(2);
	});
});

describe("inspectWorkspacePulse", () => {
	it("reports an explicit clean Pulse for the containing worktree", async () => {
		const exec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo \n"))
			.mockResolvedValueOnce(result("# branch.oid abc\0# branch.head main\0"))
			.mockResolvedValueOnce(result("tree-id\n"))
			.mockResolvedValueOnce(result());

		await expect(inspectWorkspacePulse({ exec, cwd: "/repo /packages/api" })).resolves.toEqual({
			kind: "available",
			root: "/repo ",
			relativeCwd: "packages/api",
			branch: "main",
			snapshot: {
				trackedFiles: 0,
				untrackedFiles: 0,
				linesAdded: 0,
				linesRemoved: 0,
				binaryFiles: 0,
				submodules: 0,
				conflicts: 0,
			},
		});
	});

	it("aggregates tracked, untracked, text, binary, submodule, rename, and conflict changes", async () => {
		const status = [
			"# branch.oid abc",
			"# branch.head feature/pulse",
			"1 .M N... 100644 100644 100644 aaa aaa src/a.ts",
			"1 .M N... 100644 100644 100644 bbb bbb image.png",
			"1 .M S.M. 160000 160000 160000 ccc ccc modules/lib",
			"u UU N... 100644 100644 100644 100644 ddd eee fff conflict.txt",
			"2 R. N... 100644 100644 100644 aaa aaa R100 new.ts",
			"old.ts",
			"? new-file.ts",
		].join("\0");
		const numstat = [
			"10\t2\tsrc/a.ts",
			"-\t-\timage.png",
			"1\t1\tmodules/lib",
			"3\t4\tconflict.txt",
			"5\t0\t",
			"old.ts",
			"new.ts",
		].join("\0");
		const exec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(result(status))
			.mockResolvedValueOnce(result("tree-id\n"))
			.mockResolvedValueOnce(result(numstat));

		const inspection = await inspectWorkspacePulse({ exec, cwd: "/repo" });

		expect(inspection).toMatchObject({
			kind: "available",
			branch: "feature/pulse",
			snapshot: {
				trackedFiles: 5,
				untrackedFiles: 1,
				linesAdded: 18,
				linesRemoved: 6,
				binaryFiles: 1,
				submodules: 1,
				conflicts: 1,
			},
		});
		expect(exec).toHaveBeenNthCalledWith(
			1,
			"git",
			["rev-parse", "--is-inside-work-tree", "--show-toplevel"],
			{ cwd: "/repo", timeout: 2_000 },
		);
		expect(exec).toHaveBeenNthCalledWith(
			2,
			"git",
			["-C", "/repo", "status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all"],
			{ timeout: 2_000 },
		);
		expect(exec).toHaveBeenNthCalledWith(3, "git", ["-C", "/repo", "rev-parse", "--verify", "HEAD^{tree}"], {
			timeout: 2_000,
		});
		expect(exec).toHaveBeenNthCalledWith(
			4,
			"git",
			["-C", "/repo", "diff", "--numstat", "-z", "--find-renames", "tree-id", "--"],
			{ timeout: 2_000 },
		);
	});

	it("distinguishes a non-repository from an unavailable Git inspection", async () => {
		const notRepoExec = vi.fn().mockResolvedValue(result("", 128, "fatal: kein Git-Repository"));
		const unavailableExec = vi.fn().mockRejectedValue(new Error("spawn failed"));

		await expect(
			inspectWorkspacePulse({ exec: notRepoExec, cwd: "/definitely-not-a-repository/pulse" }),
		).resolves.toEqual({
			kind: "not-repo",
		});
		await expect(inspectWorkspacePulse({ exec: unavailableExec, cwd: "/tmp" })).resolves.toEqual({
			kind: "unavailable",
		});

		const worktree = mkdtempSync(join(tmpdir(), "atelier-pulse-"));
		mkdirSync(join(worktree, ".git"));
		try {
			await expect(inspectWorkspacePulse({ exec: notRepoExec, cwd: worktree })).resolves.toEqual({
				kind: "unavailable",
			});
		} finally {
			rmSync(worktree, { recursive: true, force: true });
		}
	});

	it("treats malformed porcelain output as unavailable instead of clean", async () => {
		const exec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(result("unexpected output"))
			.mockResolvedValueOnce(result("tree-id\n"))
			.mockResolvedValueOnce(result());

		await expect(inspectWorkspacePulse({ exec, cwd: "/repo" })).resolves.toEqual({
			kind: "unavailable",
		});
	});

	it("uses the empty tree as the baseline before the first commit", async () => {
		const exec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(
				result(
					[
						"# branch.oid (initial)",
						"# branch.head main",
						"1 A. N... 100644 100644 100644 aaa aaa first.ts",
					].join("\0"),
				),
			)
			.mockResolvedValueOnce(result("", 128, "fatal: Needed a single revision"))
			.mockResolvedValueOnce(result("7\t0\tfirst.ts\0"));

		const inspection = await inspectWorkspacePulse({ exec, cwd: "/repo" });

		expect(inspection).toMatchObject({
			kind: "available",
			branch: "main",
			snapshot: { trackedFiles: 1, linesAdded: 7 },
		});
		expect(exec).toHaveBeenLastCalledWith(
			"git",
			expect.arrayContaining(["4b825dc642cb6eb9a060e54bf8d69288fbee4904"]),
			{ timeout: 2_000 },
		);
	});

	// Fast path: valid status with no tracked records avoids HEAD and diff commands.
	it("returns a clean snapshot after discovery and status without HEAD or diff commands", async () => {
		const exec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(result("# branch.oid abc\0# branch.head main\0"));

		await expect(inspectWorkspacePulse({ exec, cwd: "/repo" })).resolves.toEqual({
			kind: "available",
			root: "/repo",
			relativeCwd: "",
			branch: "main",
			snapshot: {
				trackedFiles: 0,
				untrackedFiles: 0,
				linesAdded: 0,
				linesRemoved: 0,
				binaryFiles: 0,
				submodules: 0,
				conflicts: 0,
			},
		});
		expect(exec).toHaveBeenCalledTimes(2);
		expect(exec).toHaveBeenLastCalledWith(
			"git",
			["-C", "/repo", "status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all"],
			{ timeout: 2_000 },
		);
	});

	it("counts untracked files on the fast path without running diffs", async () => {
		const exec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(result("# branch.oid abc\0# branch.head main\0? a.txt\0? b.txt\0"));

		await expect(inspectWorkspacePulse({ exec, cwd: "/repo" })).resolves.toMatchObject({
			kind: "available",
			branch: "main",
			snapshot: { trackedFiles: 0, untrackedFiles: 2, linesAdded: 0, linesRemoved: 0 },
		});
		expect(exec).toHaveBeenCalledTimes(2);
	});

	it("takes the fast path for an unborn repository without tracked changes", async () => {
		const exec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(result("# branch.oid (initial)\0# branch.head main\0? notes.md\0"));

		await expect(inspectWorkspacePulse({ exec, cwd: "/repo" })).resolves.toMatchObject({
			kind: "available",
			branch: "main",
			snapshot: { trackedFiles: 0, untrackedFiles: 1 },
		});
		expect(exec).toHaveBeenCalledTimes(2);
	});

	it("retains full diff accounting when tracked changes exist", async () => {
		const exec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(
				result(
					["# branch.oid abc", "# branch.head main", "1 .M N... 100644 100644 100644 aaa aaa a.ts"].join(
						"\0",
					),
				),
			)
			.mockResolvedValueOnce(result("tree-id\n"))
			.mockResolvedValueOnce(result("3\t1\ta.ts\0"));

		await expect(inspectWorkspacePulse({ exec, cwd: "/repo" })).resolves.toMatchObject({
			kind: "available",
			branch: "main",
			snapshot: { trackedFiles: 1, linesAdded: 3, linesRemoved: 1 },
		});
		expect(exec).toHaveBeenCalledTimes(4);
	});

	it("does not take the fast path for conflicts or changed submodules", async () => {
		const conflictExec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(
				result(
					[
						"# branch.oid abc",
						"# branch.head main",
						"u UU N... 100644 100644 100644 100644 ddd eee fff c.txt",
					].join("\0"),
				),
			)
			.mockResolvedValueOnce(result("tree-id\n"))
			.mockResolvedValueOnce(result("3\t4\tc.txt\0"));
		await expect(inspectWorkspacePulse({ exec: conflictExec, cwd: "/repo" })).resolves.toMatchObject({
			snapshot: { trackedFiles: 1, conflicts: 1, linesAdded: 3, linesRemoved: 4 },
		});
		expect(conflictExec).toHaveBeenCalledTimes(4);

		const submoduleExec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(
				result(
					[
						"# branch.oid abc",
						"# branch.head main",
						"1 .M S.M. 160000 160000 160000 ccc ccc modules/lib",
					].join("\0"),
				),
			)
			.mockResolvedValueOnce(result("tree-id\n"))
			.mockResolvedValueOnce(result("1\t1\tmodules/lib\0"));
		await expect(inspectWorkspacePulse({ exec: submoduleExec, cwd: "/repo" })).resolves.toMatchObject({
			snapshot: { trackedFiles: 1, submodules: 1, linesAdded: 0, linesRemoved: 0 },
		});
		expect(submoduleExec).toHaveBeenCalledTimes(4);
	});

	it("does not publish a clean result when cancelled before or after status", async () => {
		const controller = new AbortController();
		const exec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(result("# branch.oid abc\0# branch.head main\0"));

		controller.abort();
		await expect(inspectWorkspacePulse({ exec, cwd: "/repo", signal: controller.signal })).resolves.toEqual({
			kind: "unavailable",
		});
		// A cancelled lifetime starts no Git commands and cannot publish a clean result.
		expect(exec).not.toHaveBeenCalled();

		// An executor that resolves after abort cannot publish a clean fast-path result either.
		const lateController = new AbortController();
		const lateExec = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockImplementation(async () => {
				// Abort exactly when status resolves; this executor ignores the signal.
				lateController.abort();
				return result("# branch.oid abc\0# branch.head main\0");
			});
		await expect(
			inspectWorkspacePulse({ exec: lateExec, cwd: "/repo", signal: lateController.signal }),
		).resolves.toEqual({ kind: "unavailable" });
		expect(lateExec).toHaveBeenCalledTimes(2);
	});

	it("reports not-repo and unavailable states without HEAD or diff commands", async () => {
		const notRepo = vi.fn().mockResolvedValue(result("", 128, "fatal: not a git repository"));
		await expect(inspectWorkspacePulse({ exec: notRepo, cwd: "/plain" })).resolves.toEqual({
			kind: "not-repo",
		});
		expect(notRepo).toHaveBeenCalledTimes(1);

		const unavailable = vi
			.fn()
			.mockResolvedValueOnce(result("true\n/repo\n"))
			.mockResolvedValueOnce(result("# branch.oid abc\0# branch.head main\0", 1, "fatal: bad object"));
		await expect(inspectWorkspacePulse({ exec: unavailable, cwd: "/repo" })).resolves.toEqual({
			kind: "unavailable",
		});
		expect(unavailable).toHaveBeenCalledTimes(2);
	});
});
