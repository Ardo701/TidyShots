/*
 * The sorting session as a pure reducer: an ordered list of photo ids, the
 * decision taken for each one and the position of the photo on screen.
 * Nothing touches the disk while sorting; decisions are only applied from the
 * review screen.
 */

export type Decision = "keep" | "reject";

export type LastAction =
  | { kind: "decide"; id: string; decision: Decision; seq: number }
  | { kind: "back"; id: string; undone: Decision | null; seq: number }
  | { kind: "jump"; seq: number }
  | null;

export type SortState = {
  ids: string[];
  decisions: Record<string, Decision>;
  index: number;
  last: LastAction;
};

export type SortAction =
  | { type: "decide"; decision: Decision }
  | { type: "back" }
  | { type: "jump"; index: number }
  | { type: "set"; id: string; decision: Decision | null };

export function createSortState(
  ids: string[],
  restored: Record<string, Decision> = {},
  currentId: string | null = null,
): SortState {
  const known = new Set(ids);
  const decisions: Record<string, Decision> = {};
  for (const [id, decision] of Object.entries(restored)) {
    if (known.has(id)) decisions[id] = decision;
  }
  let index = currentId ? ids.indexOf(currentId) : -1;
  if (index === -1) index = firstUndecided(ids, decisions);
  return { ids, decisions, index, last: null };
}

export function firstUndecided(ids: string[], decisions: Record<string, Decision>): number {
  const index = ids.findIndex((id) => !(id in decisions));
  return index === -1 ? ids.length : index;
}

function nextSeq(last: LastAction) {
  return (last?.seq ?? 0) + 1;
}

export function sortReducer(state: SortState, action: SortAction): SortState {
  switch (action.type) {
    case "decide": {
      const id = state.ids[state.index];
      if (id === undefined) return state;
      return {
        ...state,
        decisions: { ...state.decisions, [id]: action.decision },
        index: state.index + 1,
        last: { kind: "decide", id, decision: action.decision, seq: nextSeq(state.last) },
      };
    }
    case "back": {
      // Undo: the previous photo comes back without its decision.
      if (state.index === 0) return state;
      const index = state.index - 1;
      const id = state.ids[index];
      const decisions = { ...state.decisions };
      const undone = decisions[id] ?? null;
      delete decisions[id];
      return {
        ...state,
        decisions,
        index,
        last: { kind: "back", id, undone, seq: nextSeq(state.last) },
      };
    }
    case "jump": {
      const index = Math.max(0, Math.min(action.index, state.ids.length - 1));
      if (index === state.index) return state;
      return { ...state, index, last: { kind: "jump", seq: nextSeq(state.last) } };
    }
    case "set": {
      const decisions = { ...state.decisions };
      if (action.decision) decisions[action.id] = action.decision;
      else delete decisions[action.id];
      return { ...state, decisions };
    }
  }
}

export function countDecisions(decisions: Record<string, Decision>) {
  let kept = 0;
  let rejected = 0;
  for (const decision of Object.values(decisions)) {
    if (decision === "keep") kept++;
    else rejected++;
  }
  return { kept, rejected, decided: kept + rejected };
}
