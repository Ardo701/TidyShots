import { describe, expect, it } from "vitest";
import { countDecisions, createSortState, firstUndecided, sortReducer } from "./session";

const ids = ["a.jpg", "b.jpg", "c.jpg"];

describe("sortReducer", () => {
  it("records a decision and moves to the next photo", () => {
    const state = sortReducer(createSortState(ids), { type: "decide", decision: "reject" });
    expect(state.decisions).toEqual({ "a.jpg": "reject" });
    expect(state.index).toBe(1);
    expect(state.last).toMatchObject({ kind: "decide", id: "a.jpg", decision: "reject" });
  });

  it("undoes the previous decision when going back", () => {
    let state = createSortState(ids);
    state = sortReducer(state, { type: "decide", decision: "keep" });
    state = sortReducer(state, { type: "decide", decision: "reject" });
    state = sortReducer(state, { type: "back" });
    expect(state.index).toBe(1);
    expect(state.decisions).toEqual({ "a.jpg": "keep" });
    expect(state.last).toMatchObject({ kind: "back", id: "b.jpg", undone: "reject" });
  });

  it("does nothing past either end", () => {
    const start = createSortState(ids);
    expect(sortReducer(start, { type: "back" })).toBe(start);
    let end = start;
    for (let i = 0; i < 3; i++) end = sortReducer(end, { type: "decide", decision: "keep" });
    expect(end.index).toBe(3);
    expect(sortReducer(end, { type: "decide", decision: "reject" })).toBe(end);
  });

  it("keeps decisions when jumping around", () => {
    let state = sortReducer(createSortState(ids), { type: "decide", decision: "reject" });
    state = sortReducer(state, { type: "jump", index: 0 });
    expect(state.index).toBe(0);
    expect(state.decisions["a.jpg"]).toBe("reject");
    expect(sortReducer(state, { type: "jump", index: 99 }).index).toBe(2);
  });

  it("changes a single decision from the review screen", () => {
    let state = sortReducer(createSortState(ids), { type: "decide", decision: "reject" });
    state = sortReducer(state, { type: "set", id: "a.jpg", decision: "keep" });
    expect(countDecisions(state.decisions)).toEqual({ kept: 1, rejected: 0, decided: 1 });
    state = sortReducer(state, { type: "set", id: "a.jpg", decision: null });
    expect(state.decisions).toEqual({});
  });
});

describe("createSortState", () => {
  it("restores only decisions for photos still present", () => {
    const state = createSortState(ids, { "a.jpg": "keep", "gone.jpg": "reject" });
    expect(state.decisions).toEqual({ "a.jpg": "keep" });
    expect(state.index).toBe(1);
  });

  it("resumes on the saved photo when it still exists", () => {
    expect(createSortState(ids, { "a.jpg": "keep" }, "c.jpg").index).toBe(2);
    expect(createSortState(ids, { "a.jpg": "keep" }, "gone.jpg").index).toBe(1);
  });

  it("points past the end when everything is decided", () => {
    expect(firstUndecided(ids, { "a.jpg": "keep", "b.jpg": "keep", "c.jpg": "reject" })).toBe(3);
  });
});
