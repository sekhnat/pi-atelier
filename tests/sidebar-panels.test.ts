import { describe, expect, it } from "vitest";
import {
	isPanelVisibleInLayout,
	legacyPanelVisibilityFromLayout,
	type SidebarPanelLayout,
} from "../src/sidebar-panels.js";

const layout: SidebarPanelLayout = [
	{ id: "agent", visible: false },
	{ id: "activity", visible: true },
];

describe("legacyPanelVisibilityFromLayout", () => {
	it("treats a layout entry's visible flag as authoritative", () => {
		expect(
			legacyPanelVisibilityFromLayout(layout, { showSidebarAgent: true, showSidebarTodos: true }),
		).toEqual({
			showSidebarAgent: false,
			showSidebarTodos: true,
		});
	});

	it("keeps the fallback for a missing entry", () => {
		expect(
			legacyPanelVisibilityFromLayout([{ id: "agent", visible: true }], {
				showSidebarAgent: false,
				showSidebarTodos: true,
			}),
		).toEqual({ showSidebarAgent: true, showSidebarTodos: true });
		expect(legacyPanelVisibilityFromLayout([], { showSidebarAgent: false, showSidebarTodos: false })).toEqual(
			{
				showSidebarAgent: false,
				showSidebarTodos: false,
			},
		);
	});
});

describe("isPanelVisibleInLayout", () => {
	it("is true only for a visible entry", () => {
		expect(isPanelVisibleInLayout([{ id: "agent", visible: true }], "agent")).toBe(true);
		expect(isPanelVisibleInLayout(layout, "agent")).toBe(false);
	});

	it("treats a missing entry as not visible", () => {
		expect(isPanelVisibleInLayout(layout, "todos")).toBe(false);
		expect(isPanelVisibleInLayout([], "agent")).toBe(false);
		expect(isPanelVisibleInLayout(undefined, "agent")).toBe(false);
	});
});
