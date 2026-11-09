(function () {
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function mergePlan(n) {
    const q = new Array(n).fill(1);
    let work = 0;
    let worstChoices = 0;
    while (q.length > 1) {
      const a = q.shift();
      const b = q.shift();
      work += a + b;
      worstChoices += a + b - 1;
      q.push(a + b);
    }
    return { work, worstChoices };
  }

  function countItems(groups) {
    return groups.reduce((sum, g) => sum + g.length, 0);
  }

  function create(ids) {
    const state = {
      queue: shuffle(ids).map(id => [[id]]),
      left: null,
      right: null,
      merged: null,
      i: 0,
      j: 0,
      placed: 0,
      total: mergePlan(ids.length).work,
      choices: 0,
      done: false,
      history: []
    };
    startNextMerge(state);
    return state;
  }

  function startNextMerge(state) {
    if (state.queue.length < 2) {
      state.done = true;
      state.left = state.right = state.merged = null;
      return;
    }
    state.left = state.queue.shift();
    state.right = state.queue.shift();
    state.merged = [];
    state.i = 0;
    state.j = 0;
  }

  function settle(state) {
    while (!state.done && (state.i >= state.left.length || state.j >= state.right.length)) {
      const rest = state.i >= state.left.length
        ? state.right.slice(state.j)
        : state.left.slice(state.i);
      state.placed += countItems(rest);
      state.queue.push(state.merged.concat(rest));
      startNextMerge(state);
    }
  }

  function snapshot(state) {
    const { history, ...rest } = state;
    return JSON.stringify(rest);
  }

  function current(state) {
    if (state.done) return null;
    return { left: state.left[state.i][0], right: state.right[state.j][0] };
  }

  function choose(state, pick) {
    if (state.done) return;
    state.history.push(snapshot(state));
    const l = state.left[state.i];
    const r = state.right[state.j];
    if (pick === "left") {
      state.merged.push(l);
      state.placed += l.length;
      state.i++;
    } else if (pick === "right") {
      state.merged.push(r);
      state.placed += r.length;
      state.j++;
    } else {
      state.merged.push(l.concat(r));
      state.placed += l.length + r.length;
      state.i++;
      state.j++;
    }
    state.choices++;
    settle(state);
  }

  function undo(state) {
    if (!state.history.length) return false;
    const prev = JSON.parse(state.history.pop());
    Object.assign(state, prev);
    return true;
  }

  function progress(state) {
    if (state.done || state.total === 0) return 1;
    return state.placed / state.total;
  }

  function ranking(state) {
    if (!state.done) return [];
    const groups = state.queue[0] || [];
    const out = [];
    let rank = 1;
    for (const g of groups) {
      out.push({ rank, ids: g.slice() });
      rank += g.length;
    }
    return out;
  }

  function allIds(state) {
    const ids = [];
    const collect = list => list && list.forEach(g => g.forEach(id => ids.push(id)));
    state.queue.forEach(collect);
    if (!state.done) {
      collect(state.left);
      collect(state.right);
    }
    return ids;
  }

  window.MergeSorter = {
    create, choose, undo, current, progress, ranking, allIds,
    worstChoices: n => mergePlan(n).worstChoices
  };
})();
