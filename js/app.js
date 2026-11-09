(function () {
  const TEAMS = {};
  const POSITIONS = {
  G: "Guard",
  F: "Forward",
  C: "Center"
};
  const STORE_PREFIX = "squadsorter:v1:";
  const app = document.getElementById("app");
  const MANIFEST = window.SQUAD_MANIFEST;
  const SECTIONS = MANIFEST.sections || [];
  const SHOW_FIRST = MANIFEST.showFirst || 5;
  const INDEX = {};
  const LOADING = {};
  const EXPANDED = {};

  SECTIONS.forEach(section => (section.groups || []).forEach(group => (group.teams || []).forEach(id => {
    INDEX[id] = { section, group, dir: section.id + "/" + group.id + "/" + id };
  })));

  let session = null;
  let navToken = 0;

  window.registerTeam = function (team) {
    TEAMS[team.id] = team;
  };

  function loadScript(src) {
    return new Promise(resolve => {
      const s = document.createElement("script");
      s.src = window.SITE_VERSION ? src + "?v=" + window.SITE_VERSION : src;
      s.onload = resolve;
      s.onerror = () => {
        console.warn("Could not load", src);
        resolve();
      };
      document.head.appendChild(s);
    });
  }

  function ensureTeam(id) {
    if (TEAMS[id]) return Promise.resolve(TEAMS[id]);
    const entry = INDEX[id];
    if (!entry) return Promise.resolve(null);
    if (!LOADING[id]) {
      LOADING[id] = loadScript("data/teams/" + entry.dir + ".js").then(() => {
        if (!TEAMS[id]) delete LOADING[id];
        return TEAMS[id] || null;
      });
    }
    return LOADING[id];
  }

  function assetDir(team) {
    const entry = INDEX[team.id];
    return "assets/teams/" + (entry ? entry.dir : team.id) + "/";
  }

  function sectionOf(team) {
    const entry = team && INDEX[team.id];
    return entry ? entry.section.id : "";
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function storeGet(key) {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function storeSet(key, value) {
    try {
      localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
    } catch (e) {}
  }

  function storeDel(key) {
    try {
      localStorage.removeItem(STORE_PREFIX + key);
    } catch (e) {}
  }

  const PHOTO_EXTS = [".webp", ".jpg", ".png"];
  const CREST_EXTS = [".png", ".svg", ".webp"];

  function crestPaths(team, kit) {
    const base = team.crest ? [team.crest] : CREST_EXTS.map(ext => assetDir(team) + "crest" + ext);
    if (!kit || !kit.crest) return base;
    const own = kit.crest.indexOf("/") >= 0 ? kit.crest : assetDir(team) + kit.crest;
    return [own].concat(base);
  }

  function loadFirst(paths) {
    return new Promise(resolve => {
      const attempt = i => {
        if (i >= paths.length) return resolve(null);
        const probe = new Image();
        probe.onload = () => resolve(paths[i]);
        probe.onerror = () => attempt(i + 1);
        probe.src = paths[i];
      };
      attempt(0);
    });
  }

  const CREST_PRELOADED = {};

  function preloadCrests(team) {
    if (CREST_PRELOADED[team.id]) return;
    CREST_PRELOADED[team.id] = true;
    Kits.ids(team).forEach(id => {
      const kit = Kits.get(team, id);
      if (kit.crest) loadFirst(crestPaths(team, kit));
    });
  }

  function swapCrests(team) {
    const paths = crestPaths(team, kitOf(team));
    document.querySelectorAll('.crest[data-team="' + team.id + '"]').forEach(el => {
      if (el.dataset.crest === paths[0]) return;
      el.dataset.crest = paths[0];
      loadFirst(paths).then(src => {
        const img = el.querySelector("img.swap-img");
        if (!src || !img || el.dataset.crest !== paths[0]) return;
        img.dataset.alts = "";
        img.src = src;
        el.classList.add("has-img");
      });
    });
  }

  function photoPaths(team, player) {
    if (player.photo) return [player.photo];
    return PHOTO_EXTS.map(ext => assetDir(team) + "players/" + player.id + ext);
  }

  function imgTag(paths) {
    return '<img class="swap-img" src="' + esc(paths[0]) + '" data-alts="' + esc(paths.slice(1).join("|")) + '" alt="" decoding="async">';
  }

  function kitOf(team, id) {
    return Kits.get(team, id || storeGet("kit:" + team.id));
  }

  function themeVars(team, kit) {
    if (!team) return "";
    const k = kit || kitOf(team);
    return [
      "--club-primary:" + k.primary,
      "--club-on-primary:" + k.onPrimary,
      "--club-accent:" + k.accent,
      "--club-on-accent:" + k.onAccent,
      "--club-pattern:" + Kits.css(k.pattern),
      "--paper:" + k.paper,
      "--card:" + k.card,
      "--card-ink:" + k.ink,
      "--card-muted:" + k.muted,
      "--page-ink:" + k.onPaper,
      "--page-muted:" + k.onPaperMuted,
      "--page-hi:" + k.paperPrimary,
      "--page-on-hi:" + k.paperOnPrimary,
      "--line:" + k.line,
      "--row-tint:" + (k.rowTint || k.primary),
      "--crest-bg:" + (k.crestBg || "transparent"),
      "--crest-scale:" + (k.crestBg ? "0.68" : "1"),
      "--crest-radius:" + (k.crestBg ? "50%" : "0")
    ].join(";");
  }

  function applyTheme(team) {
    const root = document.documentElement;
    if (team) {
      const kit = kitOf(team);
      preloadCrests(team);
      root.setAttribute("style", themeVars(team, kit));
      root.dataset.club = team.id;
      root.dataset.kit = kit.id;
      root.dataset.tone = kit.dark ? "dark" : "light";
    } else {
      root.removeAttribute("style");
      delete root.dataset.club;
      delete root.dataset.kit;
      delete root.dataset.tone;
    }
  }

  function setKit(team, id) {
    const ids = Kits.ids(team);
    const from = ids.indexOf(kitOf(team).id);
    const to = ids.indexOf(id);
    if (!MOTION_OK || !document.startViewTransition || from === to) return applyKit(team, id);
    const root = document.documentElement;
    root.dataset.vt = to > from ? "kit-right" : "kit-left";
    const t = document.startViewTransition(() => applyKit(team, id));
    [t.ready, t.updateCallbackDone].forEach(pr => pr && pr.catch(() => {}));
    const clear = () => {
      if (root.dataset.vt && root.dataset.vt.indexOf("kit") === 0) delete root.dataset.vt;
    };
    t.finished.then(clear, clear);
  }

  function applyKit(team, id) {
    storeSet("kit:" + team.id, id);
    applyTheme(team);
    const vars = themeVars(team);
    document.querySelectorAll('[data-team="' + team.id + '"]').forEach(el => el.setAttribute("style", vars));
    document.querySelectorAll('input[name="site-kit"][data-team="' + team.id + '"]').forEach(i => {
      i.checked = i.value === id;
      const seg = i.closest(".seg");
      if (seg) placeSegPill(seg, false);
    });
    const kit = kitOf(team);
    swapCrests(team);
    document.querySelectorAll(".rank-row[data-rank]").forEach(el => {
      el.style.setProperty("--t", rowTint(kit, Number(el.dataset.rank)).toFixed(3));
    });
  }

  function kitSwitch(team, name, current, attr) {
    const ids = Kits.ids(team);
    if (ids.length < 2) return "";
    return (
      '<div class="seg kit-seg" role="radiogroup" aria-label="Colour mode">' +
      ids.map(id => {
        const k = kitOf(team, id);
        return (
          '<label class="seg-opt"><input type="radio" name="' + name + '" value="' + id + '"' +
          (attr ? ' data-team="' + team.id + '"' : "") +
          (id === current ? " checked" : "") + ">" +
          '<span><i class="swatch" style="background:' + Kits.css(k.pattern) + '"></i>' + esc(k.label) + "</span></label>"
        );
      }).join("") +
      "</div>"
    );
  }

  function kitPicker(team) {
    const sw = kitSwitch(team, "site-kit", kitOf(team).id, true);
    return sw ? '<div class="kit-picker"><span class="kit-label">Colors</span>' + sw + "</div>" : "";
  }

  function crestMarkup(team, cls, kit) {
    const paths = crestPaths(team, kit || kitOf(team));
    return (
      '<span class="crest ' + (cls || "") + '"' + (kit ? "" : ' data-team="' + team.id + '" data-crest="' + esc(paths[0]) + '"') + ' style="' + themeVars(team, kit) + '">' +
        '<span class="crest-fallback">' + esc(team.monogram || team.shortName.slice(0, 3)) + "</span>" +
        imgTag(paths) +
      "</span>"
    );
  }

  function avatarMarkup(team, player, cls) {
    return (
      '<span class="avatar ' + (cls || "") + '" data-team="' + team.id + '" style="' + themeVars(team) + '">' +
        '<span class="avatar-fallback"><span>' + esc(player.number != null ? player.number : "") + "</span></span>" +
        imgTag(photoPaths(team, player)) +
      "</span>"
    );
  }

  function wireImages(scope) {
    scope.querySelectorAll("img.swap-img").forEach(img => {
      const ok = () => img.parentElement && img.parentElement.classList.add("has-img");
      const bad = () => {
        const alts = (img.dataset.alts || "").split("|").filter(Boolean);
        if (alts.length) {
          img.dataset.alts = alts.slice(1).join("|");
          img.src = alts[0];
        } else {
          img.remove();
        }
      };
      img.addEventListener("load", ok);
      img.addEventListener("error", bad);
      if (img.complete) img.naturalWidth ? ok() : bad();
    });
  }

  function lookup(key) {
    const [teamId, playerId] = key.split(":");
    const team = TEAMS[teamId];
    const player = team && team.players.find(p => p.id === playerId);
    return player ? { team, player } : null;
  }

  function render(html, keepScroll) {
    app.innerHTML = html;
    wireImages(app);
    enhanceSegs(app);
    if (!keepScroll) window.scrollTo(0, 0);
  }

  const MOTION_OK = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function viewTransition(update) {
    const t = document.startViewTransition(update);
    [t.ready, t.finished, t.updateCallbackDone].forEach(pr => pr && pr.catch(() => {}));
  }

  function swapScreen(update) {
    if (!MOTION_OK) return update();
    if (document.startViewTransition) {
      viewTransition(update);
      return;
    }
    update();
    app.classList.remove("screen-enter");
    void app.offsetWidth;
    app.classList.add("screen-enter");
  }

  function placeSegPill(seg, animate) {
    let pill = seg.querySelector(":scope > .seg-pill");
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "seg-pill";
      pill.setAttribute("aria-hidden", "true");
      seg.prepend(pill);
      seg.classList.add("has-pill");
      animate = false;
    }
    const checked = seg.querySelector("input:checked");
    const target = checked && checked.nextElementSibling;
    if (!target || !target.offsetWidth) {
      pill.style.opacity = "0";
      return;
    }
    const box = seg.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const scale = seg.offsetWidth ? box.width / seg.offsetWidth : 1;
    const x = (r.left - box.left) / scale - seg.clientLeft;
    const y = (r.top - box.top) / scale - seg.clientTop;
    if (!animate || !MOTION_OK) pill.style.transition = "none";
    pill.style.opacity = "1";
    pill.style.width = r.width / scale + "px";
    pill.style.height = r.height / scale + "px";
    pill.style.transform = "translate(" + x + "px, " + y + "px)";
    if (!animate || !MOTION_OK) {
      void pill.offsetWidth;
      pill.style.transition = "";
    }
  }

  function enhanceSegs(scope) {
    scope.querySelectorAll(".seg").forEach(seg => placeSegPill(seg, false));
  }

  document.addEventListener("change", e => {
    const seg = e.target.closest && e.target.closest(".seg");
    if (seg) placeSegPill(seg, true);
  });

  window.addEventListener("resize", () => enhanceSegs(document));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => enhanceSegs(document));

  function openModal(modal) {
    document.body.appendChild(modal);
    document.body.classList.add("modal-open");
    enhanceSegs(modal);
  }

  function closeModal(modal) {
    if (modal.classList.contains("is-closing")) return;
    const done = () => {
      modal.remove();
      if (!document.querySelector(".modal:not(.is-closing)")) document.body.classList.remove("modal-open");
    };
    if (!MOTION_OK) return done();
    modal.classList.add("is-closing");
    setTimeout(done, 190);
  }

  function teamTile(team, meta) {
    const home = Kits.get(team, "home");
    const tile = Object.assign(
      { bg: home.paper, fg: home.onPaper, muted: home.onPaperMuted, pattern: home.pattern },
      team.tile || {}
    );
    const tileVars = [
      "--tile-bg:" + tile.bg,
      "--tile-fg:" + tile.fg,
      "--tile-muted:" + tile.muted,
      "--tile-pattern:" + Kits.css(tile.pattern)
    ].join(";");
    return (
      '<button type="button" class="team-tile team-tile-club" data-go="' + team.id + '" style="' + tileVars + '">' +
        crestMarkup(team, "crest-md", home) +
        '<span class="team-tile-text">' +
          '<span class="team-tile-name">' + esc(team.name) + "</span>" +
          '<span class="team-tile-meta">' + esc(meta || team.players.length + " players · " + team.season) + "</span>" +
        "</span>" +
      "</button>"
    );
  }

  function blobColours(group) {
    const all = (group.teams || []).filter(id => INDEX[id]);
    const hidden = all.slice(SHOW_FIRST).filter(id => TEAMS[id]);
    const source = hidden.length ? hidden : all.slice(0, SHOW_FIRST).filter(id => TEAMS[id]);
    const colours = [];
    source.forEach(id => {
      const kit = Kits.get(TEAMS[id], "home");
      [kit.paper, kit.accent].forEach(c => {
        if (c && colours.indexOf(c) < 0) colours.push(c);
      });
    });
    return colours.concat(["#a55448", "#262f61", "#c8a24a"]).slice(0, 3);
  }

  function blobMarkup(colours, extraClass) {
    return (
      '<span class="glass-blobs' + (extraClass ? " " + extraClass : "") + '" aria-hidden="true">' +
        colours.map(c => '<i style="background:' + esc(c) + '"></i>').join("") +
      "</span>"
    );
  }

  function visibleIds(group) {
    const ids = (group.teams || []).filter(id => INDEX[id]);
    return EXPANDED[group.id] ? ids : ids.slice(0, SHOW_FIRST);
  }

  const SOON_ICONS = {
    shirt: '<svg viewBox="0 0 48 48"><path d="M17 6 6 11.5l4.5 9.5 5-2.2V42h17V18.8l5 2.2 4.5-9.5L31 6c-1.2 3.2-3.9 5-7 5s-5.8-1.8-7-5z" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 48 48"><path d="M14 6h20v9a10 10 0 0 1-20 0z" fill="currentColor"/><path d="M14 9H8v3.5a6.5 6.5 0 0 0 7 6.5M34 9h6v3.5a6.5 6.5 0 0 1-7 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M21 25h6v8h-6zM15 35h18v7H15z" fill="currentColor"/></svg>'
  };

  function comingSoon(section) {
    const soon = section.soon || {};
    const live = SECTIONS.find(s => (s.groups || []).some(g => (g.teams || []).some(id => INDEX[id])));
    const back = live && live !== section
      ? '<button type="button" class="btn btn-solid soon-cta" data-go="' + live.id + '">Rank ' + esc(live.name.toLowerCase()) + " instead</button>"
      : "";
    const chips = (soon.preview || []).map(name => '<span class="soon-chip">' + esc(name) + "</span>").join("");
    return (
      '<section class="soon">' +
        blobMarkup(soon.colours || ["#a55448", "#262f61", "#c8a24a"], "soon-blobs") +
        '<div class="soon-card">' +
          '<span class="soon-icon" aria-hidden="true">' + (SOON_ICONS[soon.icon] || SOON_ICONS.shirt) + "</span>" +
          '<p class="soon-eyebrow">Coming soon</p>' +
          '<h2 class="soon-title">' + esc(soon.title || section.name + " are on the way") + "</h2>" +
          '<p class="soon-text">' + esc(soon.text || "New rosters are being added. Check back soon.") + "</p>" +
          (chips ? '<div class="soon-chips">' + chips + "</div>" : "") +
          back +
        "</div>" +
        '<div class="soon-ghosts" aria-hidden="true"><span></span><span></span><span></span></div>' +
      "</section>"
    );
  }

  function homeBody(section, groups) {
    const body = groups.map(group => {
      const all = (group.teams || []).filter(id => INDEX[id]);
      const tiles = visibleIds(group).filter(id => TEAMS[id]).map(id => teamTile(TEAMS[id])).join("");
      if (!tiles) return "";
      const hiddenCount = all.length - SHOW_FIRST;
      const more = hiddenCount > 0
        ? '<button type="button" class="team-tile see-more-tile" data-more="' + group.id + '" aria-expanded="' + !!EXPANDED[group.id] + '">' +
            blobMarkup(blobColours(group)) +
            '<span class="see-more-arrow' + (EXPANDED[group.id] ? " is-up" : "") + '" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            "</span>" +
            '<span class="team-tile-text">' +
              '<span class="team-tile-name">' + (EXPANDED[group.id] ? "Show less" : "Show all") + "</span>" +
              '<span class="team-tile-meta">' +
                (EXPANDED[group.id] ? "Back to the first " + SHOW_FIRST : "+" + hiddenCount + " more") +
              "</span>" +
            "</span>" +
          "</button>"
        : "";
      return (
        '<section class="league">' +
          '<h2 class="league-name">' + esc(group.name) + "</h2>" +
          '<div class="team-grid">' + tiles + more + "</div>" +
        "</section>"
      );
    }).join("");
    return body || comingSoon(section);
  }

  let searchQuery = "";
  let allTeamsLoaded = null;

  function loadAllTeams() {
    if (!allTeamsLoaded) allTeamsLoaded = Promise.all(Object.keys(INDEX).map(ensureTeam));
    return allTeamsLoaded;
  }

  function wordStarts(text, token) {
    return (" " + text).indexOf(" " + token) >= 0;
  }

  function searchTeams(query) {
    const q = normText(query);
    const tokens = q.split(" ").filter(Boolean);
    if (!tokens.length) return [];
    return Object.keys(INDEX).map((id, i) => {
      const entry = INDEX[id];
      const team = TEAMS[id];
      if (!team) return null;
      const name = normText(team.name);
      const alt = normText([team.shortName, team.monogram, id.replace(/-/g, " ")].concat(team.aliases || []).join(" "));
      const context = normText([entry.group.name, entry.group.country, entry.section.name, team.season].join(" "));
      const all = name + " " + alt + " " + context;
      if (!tokens.every(t => wordStarts(all, t))) return null;
      let score = 3;
      if (name.indexOf(q) === 0) score = 0;
      else if (tokens.every(t => wordStarts(name, t))) score = 1;
      else if (tokens.every(t => wordStarts(name + " " + alt, t))) score = 2;
      return { id, score, i };
    }).filter(Boolean).sort((a, b) => a.score - b.score || a.i - b.i).map(r => r.id);
  }

  function searchMeta(team) {
    const group = INDEX[team.id].group;
    const season = team.season || "";
    const seasonWords = normText(season).split(" ");
    const covered = normText(group.name).split(" ").every(w => seasonWords.indexOf(w) >= 0);
    return covered ? season : group.name + " · " + season;
  }

  function searchBody(query) {
    const ids = searchTeams(query);
    const shown = query.trim();
    if (!ids.length) {
      return (
        '<section class="search-empty">' +
          '<p class="search-empty-title">No squads match “' + esc(shown) + "”</p>" +
          '<p class="search-empty-text">Try a team, conference or nickname.</p>' +
          (REQUESTS_URL ? '<button type="button" class="btn btn-solid btn-sm" data-request="team" data-prefill="' + esc(shown) + '">Request this squad</button>' : "") +
        "</section>"
      );
    }
    return (
      '<section class="league search-results">' +
        '<h2 class="league-name">Results <small>' + ids.length + (ids.length === 1 ? " squad" : " squads") + "</small></h2>" +
        '<div class="team-grid">' + ids.map(id => teamTile(TEAMS[id], searchMeta(TEAMS[id]))).join("") + "</div>" +
      "</section>"
    );
  }

  function searching() {
    return !!searchQuery.trim();
  }

  function searchBox() {
    return (
      '<div class="search" role="search">' +
        '<svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m15.5 15.5 5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' +
        '<input type="search" class="search-input" placeholder="Search rosters" aria-label="Search squads" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" value="' + esc(searchQuery) + '">' +
        '<button type="button" class="search-clear" aria-label="Clear search"' + (searchQuery ? "" : " hidden") + ">" +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' +
        "</button>" +
      "</div>"
    );
  }

  function bindMore(section) {
    app.querySelectorAll("[data-more]").forEach(btn => btn.addEventListener("click", () => toggleGroup(btn, section)));
  }

  function updateSearch(value) {
    searchQuery = value;
    const bar = app.querySelector(".home-bar");
    const clear = app.querySelector(".search-clear");
    const active = searching();
    if (clear) clear.hidden = !value;
    if (bar) bar.classList.toggle("is-searching", active);
    const token = navToken;
    const paint = () => {
      const mounted = app.querySelector(".home-body");
      if (token !== navToken || !mounted || value !== searchQuery) return;
      const section = SECTIONS.find(s => s.id === mounted.dataset.section) || SECTIONS[0];
      mounted.innerHTML = active ? searchBody(value) : homeBody(section, section.groups || []);
      wireImages(mounted);
      if (!active) bindMore(section);
      const hero = app.querySelector(".hero");
      const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 0;
      if (window.scrollY > heroBottom) window.scrollTo({ top: heroBottom });
    };
    if (active) loadAllTeams().then(paint);
    else paint();
  }

  function clearSearch() {
    searchQuery = "";
    const input = app.querySelector(".search-input");
    const clear = app.querySelector(".search-clear");
    const bar = app.querySelector(".home-bar");
    if (input) input.value = "";
    if (clear) clear.hidden = true;
    if (bar) bar.classList.remove("is-searching");
  }

  function wireSearch() {
    const input = app.querySelector(".search-input");
    if (!input) return;
    input.addEventListener("focus", loadAllTeams, { once: true });
    input.addEventListener("input", () => updateSearch(input.value));
    input.addEventListener("keydown", e => {
      if (e.key === "Escape" && input.value) {
        e.preventDefault();
        input.value = "";
        updateSearch("");
      } else if (e.key === "Enter") {
        e.preventDefault();
        const first = app.querySelector(".search-results [data-go]");
        if (first) {
          input.blur();
          go(first.dataset.go);
        }
      }
    });
    app.querySelector(".search-clear").addEventListener("click", () => {
      input.value = "";
      updateSearch("");
      input.focus();
    });
    const tabs = app.querySelector(".tabs");
    if (tabs) tabs.addEventListener("click", e => {
      if (e.target.closest(".tab") && searchQuery) clearSearch();
    });
  }

  function placeIndicator(animate) {
    const nav = app.querySelector(".tabs");
    const pill = nav && nav.querySelector(".tab-indicator");
    const active = nav && nav.querySelector('.tab[aria-selected="true"]');
    if (!pill || !active) return;
    if (!animate) pill.style.transition = "none";
    pill.style.width = active.offsetWidth + "px";
    pill.style.transform = "translateX(" + active.offsetLeft + "px)";
    if (!animate) {
      void pill.offsetWidth;
      pill.style.transition = "";
    }
  }

  function selectTab(section) {
    app.querySelectorAll(".tabs .tab").forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.go === section.id)));
    placeIndicator(true);
  }

  window.addEventListener("resize", () => placeIndicator(false));

  function renderHome(sectionId, token, keepScroll, afterRender) {
    session = null;
    applyTheme(null);
    const section = SECTIONS.find(s => s.id === sectionId) || SECTIONS[0];
    if (!section) return;
    const groups = section.groups || [];
    const ids = groups.flatMap(visibleIds);
    const ready = searching() ? loadAllTeams() : Promise.all(ids.map(ensureTeam));

    const mounted = app.querySelector(".home-body");
    const fromIndex = mounted ? SECTIONS.findIndex(s => s.id === mounted.dataset.section) : -1;
    const switching = !!mounted && fromIndex !== SECTIONS.indexOf(section);
    const animateSwitch = switching && !REDUCE_MOTION;
    const started = Date.now();
    if (switching) {
      selectTab(section);
      if (animateSwitch) {
        mounted.classList.remove("enter-left", "enter-right");
        mounted.classList.add("is-leaving");
      }
    }

    ready.then(() => {
      if (token !== navToken) return;
      const wait = animateSwitch ? Math.max(0, TAB_LEAVE_MS - (Date.now() - started)) : 0;
      setTimeout(() => {
        if (token !== navToken) return;
        const paint = () => paintHome(section, groups, token, keepScroll, afterRender, mounted, switching, fromIndex);
        if (mounted || !app.firstElementChild) paint();
        else swapScreen(paint);
      }, wait);
    });
  }

  function paintHome(section, groups, token, keepScroll, afterRender, mounted, switching, fromIndex) {
    const body = searching() ? searchBody(searchQuery) : homeBody(section, groups);

    if (mounted && app.contains(mounted)) {
      mounted.innerHTML = body;
      mounted.dataset.section = section.id;
      mounted.classList.remove("is-leaving", "enter-left", "enter-right");
      wireImages(mounted);
      if (switching) {
        const hero = app.querySelector(".hero");
        const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 0;
        if (window.scrollY > heroBottom) window.scrollTo({ top: heroBottom, behavior: REDUCE_MOTION ? "auto" : "smooth" });
        if (!REDUCE_MOTION) {
          void mounted.offsetWidth;
          mounted.classList.add(SECTIONS.indexOf(section) > fromIndex ? "enter-right" : "enter-left");
        }
      }
    } else {
      const tabs = SECTIONS.length > 1
        ? '<nav class="tabs" role="tablist">' +
            '<span class="tab-indicator" aria-hidden="true"></span>' +
            SECTIONS.map(s =>
              '<button type="button" class="tab" role="tab" data-go="' + s.id + '" aria-selected="' + (s === section) + '">' + esc(s.name) + "</button>"
            ).join("") +
          "</nav>"
        : "";
      render(
        '<section class="hero">' +
          '<p class="eyebrow">Rank Hoopers by @tyufbg</p>' +
          "<h1>Pick a roster &amp; start ranking</h1>" +
         /*<p class="hero-sub">Pick your favorite of two players until, eventually, you get your full roster ranking. First team lists, positions and photos are taken from the official NBA and ESPN site.<br><br>Creator: <strong>Nicole</strong>! Find me as @nicsginthings on: <a href="https://x.com/nicsginthings" target="_blank" rel="noopener">X</a>, <a href="https://www.instagram.com/nicsginthings" target="_blank" rel="noopener">IG</a>, <a href="https://www.tiktok.com/@nicsginthings" target="_blank" rel="noopener">TikTok</a>, or <a href="https://www.instagram.com/nicolepanggabeann" target="_blank" rel="noopener">my personal Instagram</a>.' +*/
          
        "</section>" +
        '<div class="home-bar' + (searching() ? " is-searching" : "") + '">' + searchBox() + tabs + "</div>" +
        '<div class="home-body" data-section="' + section.id + '">' + body + "</div>",
        keepScroll
      );
      wireSearch();
      placeIndicator(false);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeIndicator(false));
    }

    groups.forEach(group => {
      const hidden = (group.teams || []).filter(id => INDEX[id]).slice(SHOW_FIRST);
      if (EXPANDED[group.id] || !hidden.length || hidden.every(id => TEAMS[id])) return;
      Promise.all(hidden.map(ensureTeam)).then(() => {
        if (token !== navToken) return;
        const blobs = app.querySelector('[data-more="' + group.id + '"] .glass-blobs');
        if (blobs) blobs.outerHTML = blobMarkup(blobColours(group));
      });
    });

    bindMore(section);
    groups.forEach(group => (group.teams || []).forEach(id => {
      if (TEAMS[id]) submitRanking(TEAMS[id]);
    }));
    if (afterRender) afterRender();
  }

  const REDUCE_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOVE_MS = 340;
  const LEAVE_MS = 170;
  const TAB_LEAVE_MS = 140;

  function toggleGroup(btn, section) {
    if (btn.dataset.busy) return;
    btn.dataset.busy = "1";
    const groupId = btn.dataset.more;
    const collapsing = !!EXPANDED[groupId];
    const league = btn.closest(".league");
    const grid = league.querySelector(".team-grid");
    const gridRect = grid.getBoundingClientRect();
    const moreRect = btn.getBoundingClientRect();
    const before = {
      top: league.getBoundingClientRect().top,
      height: gridRect.height,
      dx: moreRect.left - gridRect.left,
      dy: moreRect.top - gridRect.top
    };
    const rerender = () => {
      EXPANDED[groupId] = !collapsing;
      renderHome(section.id, navToken, true, () => animateGroup(groupId, before, collapsing));
    };
    if (collapsing && !REDUCE_MOTION) {
      Array.from(grid.children)
        .filter(el => !el.classList.contains("see-more-tile"))
        .slice(SHOW_FIRST)
        .forEach(el => el.classList.add("tile-leave"));
      setTimeout(rerender, LEAVE_MS);
    } else {
      rerender();
    }
  }

  function animateGroup(groupId, before, collapsing) {
    const btn = app.querySelector('[data-more="' + groupId + '"]');
    if (!btn) return;
    const league = btn.closest(".league");
    const grid = league.querySelector(".team-grid");
    if (collapsing) window.scrollBy(0, league.getBoundingClientRect().top - before.top);
    if (REDUCE_MOTION) return;

    const gridRect = grid.getBoundingClientRect();
    const moreRect = btn.getBoundingClientRect();
    const shiftX = before.dx - (moreRect.left - gridRect.left);
    const shiftY = before.dy - (moreRect.top - gridRect.top);
    const ease = "cubic-bezier(0.22, 0.8, 0.24, 1)";

    grid.style.height = before.height + "px";
    grid.style.overflow = "hidden";
    btn.style.transform = "translate(" + shiftX + "px, " + shiftY + "px)";
    btn.style.transition = "none";

    if (!collapsing) {
      Array.from(grid.children)
        .filter(el => !el.classList.contains("see-more-tile"))
        .slice(SHOW_FIRST)
        .forEach((el, i) => {
          el.style.animationDelay = (60 + i * 45) + "ms";
          el.classList.add("tile-enter");
        });
    }

    void grid.offsetHeight;
    grid.style.transition = "height " + MOVE_MS + "ms " + ease;
    grid.style.height = gridRect.height + "px";
    btn.style.transition = "transform " + MOVE_MS + "ms " + ease;
    btn.style.transform = "";

    setTimeout(() => {
      grid.style.height = "";
      grid.style.overflow = "";
      grid.style.transition = "";
      btn.style.transition = "";
    }, MOVE_MS + 40);
    grid.querySelectorAll(".tile-enter").forEach(el => el.addEventListener("animationend", () => {
      el.classList.remove("tile-enter");
      el.style.animationDelay = "";
    }, { once: true }));
  }

  function creditsMarkup(team) {
    const credited = team.players.filter(p => p.credit);
    if (!credited.length) return "";
    return (
      '<details class="credits">' +
        "<summary>Photo credits</summary>" +
        "<ul>" +
          credited.map(p =>
            "<li><b>" + esc(p.name) + ":</b> " +
            (p.creditUrl
              ? '<a href="' + esc(p.creditUrl) + '" target="_blank" rel="noopener">' + esc(p.credit) + "</a>"
              : esc(p.credit)) +
            "</li>"
          ).join("") +
        "</ul>" +
      "</details>"
    );
  }

  function renderTeamSetup(team) {
    session = null;
    applyTheme(team);
    const saved = storeGet(team.id);
    const counts = {};
    team.players.forEach(p => { counts[p.position] = (counts[p.position] || 0) + 1; });

    const chips = Object.keys(POSITIONS).filter(k => counts[k]).map(k =>
      '<label class="chip"><input type="checkbox" name="pos" value="' + k + '" checked>' +
      '<span>' + POSITIONS[k] + "s <b>" + counts[k] + "</b></span></label>"
    ).join("");

    let resume = "";
    if (saved && saved.state) {
      const pct = Math.round(MergeSorter.progress(saved.state) * 100);
      resume = saved.state.done
        ? '<button class="btn btn-ghost" data-act="last">See your last ranking</button>'
        : '<button class="btn btn-ghost" data-act="resume">Resume where you left off (' + pct + "%)</button>";
    }

    render(
      '<section class="setup">' +
        '<button type="button" class="back-link" data-go="' + sectionOf(team) + '">← All squads</button>' +
        '<div class="setup-head">' +
          crestMarkup(team, "crest-lg") +
          "<div>" +
            '<p class="eyebrow">' + esc(team.season) + " squad</p>" +
            "<h1>" + esc(team.name) + "</h1>" +
          "</div>" +
          kitPicker(team) +
        "</div>" +
        missingLine(team, true) +
        '<div class="setup-body">' +
          '<p class="setup-label">Choose who to include in your ranking:</p>' +
          '<div class="chips">' + chips + "</div>" +
          '<p class="setup-estimate" id="estimate"></p>' +
          '<div class="setup-actions">' +
            '<button class="btn btn-primary" data-act="start">Start sorting</button>' +
            (STATS_URL ? '<button type="button" class="btn btn-ghost" data-go="' + team.id + '/stats">Community ranking</button>' : "") +
            resume +
          "</div>" +
        "</div>" +
        '<div class="roster">' +
          team.players.map(p =>
            '<div class="roster-item" data-pos="' + p.position + '">' + avatarMarkup(team, p, "avatar-sm") +
            '<span class="roster-name">' + esc(p.name) + "</span>" +
            '<span class="roster-pos">' + p.position + "</span></div>"
          ).join("") +
        "</div>" +
        creditsMarkup(team) +
      "</section>"
    );

    const selected = () => [...app.querySelectorAll('input[name="pos"]:checked')].map(i => i.value);
    const pool = () => team.players.filter(p => selected().includes(p.position));
    const estimate = app.querySelector("#estimate");
    const startBtn = app.querySelector('[data-act="start"]');
    const update = () => {
      const on = selected();
      app.querySelectorAll(".roster-item").forEach(el => el.classList.toggle("is-out", !on.includes(el.dataset.pos)));
      const n = pool().length;
      startBtn.disabled = n < 2;
      estimate.textContent = n < 2
        ? "Pick at least two players to rank."
        : n + " players · at most " + MergeSorter.worstChoices(n) + " matchups";
    };
    app.querySelectorAll('input[name="pos"]').forEach(i => i.addEventListener("change", update));
    update();

    startBtn.addEventListener("click", () => {
      const ids = pool().map(p => team.id + ":" + p.id);
      swapScreen(() => startSession(team, MergeSorter.create(ids)));
    });
    const resumeBtn = app.querySelector('[data-act="resume"]');
    if (resumeBtn) resumeBtn.addEventListener("click", () => swapScreen(() => startSession(team, saved.state)));
    const lastBtn = app.querySelector('[data-act="last"]');
    if (lastBtn) lastBtn.addEventListener("click", () => swapScreen(() => {
      session = { team, state: saved.state };
      renderResults();
    }));
  }

  function startSession(team, state) {
    session = { team, state };
    renderMatchup();
  }

  function cardMarkup(side, key) {
    const { team, player } = lookup(key);
    return (
      '<button class="pick-card" data-pick="' + side + '" data-team="' + team.id + '" style="' + themeVars(team) + '">' +
        '<span class="pick-media">' +
          '<span class="avatar avatar-card">' +
            '<span class="avatar-fallback"><span>' + esc(player.number != null ? player.number : "") + "</span></span>" +
            imgTag(photoPaths(team, player)) +
          "</span>" +
          crestMarkup(team, "crest-card") +
        "</span>" +
        '<span class="pick-info">' +
          '<span class="pick-pos">' + POSITIONS[player.position] + "</span>" +
          '<span class="pick-name">' + esc(player.name) + "</span>" +
          '<span class="pick-meta">#' + esc(player.number) + " · " + esc(player.height || "") + "</span>" +
        '<span class="pick-key">' + (side === "left" ? "←" : "→") + "</span>" +
      "</button>"
    );
  }

  function renderMatchup() {
    const { team, state } = session;
    applyTheme(team);
    storeSet(team.id, { state });
    if (state.done) {
      swapScreen(renderResults);
      return;
    }
    const pair = MergeSorter.current(state);
    const pct = Math.round(MergeSorter.progress(state) * 100);
    render(
      '<section class="battle">' +
        '<div class="battle-top">' +
          '<span class="battle-count">Matchup ' + (state.choices + 1) + "</span>" +
          '<span class="battle-pct">' + pct + "% sorted</span>" +
        "</div>" +
        '<div class="progress"><span style="width:' + pct + '%"></span></div>' +
        '<h2 class="battle-q">Who do you prefer?</h2>' +
        '<div class="arena">' +
          cardMarkup("left", pair.left) +
          '<span class="vs">VS</span>' +
          cardMarkup("right", pair.right) +
        "</div>" +
        '<div class="battle-actions">' +
          '<button class="btn btn-ghost" data-act="undo"' + (state.history.length ? "" : " disabled") + ">Undo</button>" +
          '<button class="btn btn-tie" data-pick="tie">Can\'t choose (tie)</button>' +
          '<button class="btn btn-ghost" data-act="quit">Save &amp; exit</button>' +
        "</div>" +
        '<div class="battle-kit">' + kitSwitch(team, "site-kit", kitOf(team).id, true) + "</div>" +
        '<p class="hint">Keyboard: ← / → to pick, ↓ for a tie, Backspace to undo</p>' +
      "</section>"
    );
    app.querySelectorAll("[data-pick]").forEach(el =>
      el.addEventListener("click", () => pick(el.dataset.pick))
    );
    app.querySelector('[data-act="undo"]').addEventListener("click", doUndo);
    app.querySelector('[data-act="quit"]').addEventListener("click", () => swapScreen(() => renderTeamSetup(team)));
  }

  function pick(which) {
    if (!session || session.state.done) return;
    MergeSorter.choose(session.state, which);
    renderMatchup();
  }

  function doUndo() {
    if (session && MergeSorter.undo(session.state)) renderMatchup();
  }

  function siteUrl() {
    if (MANIFEST.siteUrl) return MANIFEST.siteUrl;
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    return location.protocol.startsWith("http") && !local ? location.origin + location.pathname : "";
  }

  function shareEntries(ranking) {
    const out = [];
    ranking.forEach(row => row.ids.forEach(key => {
      const hit = lookup(key);
      if (!hit) return;
      out.push({
        key,
        rank: row.rank,
        tied: row.ids.length > 1,
        team: hit.team,
        player: hit.player,
        positionLabel: POSITIONS[hit.player.position],
        photoSrc: photoPaths(hit.team, hit.player)
      });
    }));
    return out;
  }

  function caption(team, entries) {
    const top = entries.slice(0, 3).map(e => e.rank + (e.tied ? "=" : "") + ". " + e.player.name).join("\n");
    return "My " + team.shortName + " ranking (" + team.season + ")\n" + top;
  }

  function toast(message) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 4200);
  }

  function segmented(name, options, value) {
    return (
      '<div class="seg" role="radiogroup">' +
      options.map(o =>
        '<label class="seg-opt"><input type="radio" name="' + name + '" value="' + o.value + '"' +
        (o.value === value ? " checked" : "") + "><span>" + o.label + "</span></label>"
      ).join("") +
      "</div>"
    );
  }

  function rankingLink(team, state) {
    const prefix = team.id + ":";
    const groups = (state.queue[0] || []).map(g => g.map(key => key.slice(prefix.length)).join("~"));
    return location.origin + location.pathname + "?club=" + encodeURIComponent(team.id) + "&r=" + groups.join(".");
  }

  function importRanking() {
    const params = new URLSearchParams(location.search);
    const club = params.get("club");
    const raw = params.get("r");
    if (!club || !raw) return Promise.resolve();
    params.delete("club");
    params.delete("r");
    return ensureTeam(club).then(team => {
      if (!team) return;
      const known = new Set(team.players.map(p => p.id));
      const groups = raw.split(".").map(g => g.split("~").filter(id => known.has(id)).map(id => team.id + ":" + id)).filter(g => g.length);
      const count = groups.reduce((n, g) => n + g.length, 0);
      if (count < 2) return;
      storeSet(team.id, {
        state: {
          queue: [groups], left: null, right: null, merged: null, i: 0, j: 0,
          placed: count, total: count, choices: 0, done: true, history: []
        }
      });
      const rest = params.toString();
      try {
        history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + "#/" + team.id + "/results");
      } catch (e) {}
    });
  }

  function openShare(team, entries) {
    const n = entries.length;
    const modes = [{ value: "top3", label: "Top 3" }];
    if (n > 3) modes.push({ value: "top10", label: "Top 10" });
    if (n > 10) modes.push({ value: "full", label: "Full squad" });
    const opts = { format: "story", mode: n > 10 ? "full" : modes[modes.length - 1].value, kit: kitOf(team).id };
    const kitFor = t => (t.id === team.id ? kitOf(t, opts.kit) : kitOf(t));
    const escapeHref = ShareImage.needsBrowserEscape() && session && session.state.done ? rankingLink(team, session.state) : null;
    const url = siteUrl();
    let canvas = null;
    let renderId = 0;

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("style", themeVars(team));
    modal.innerHTML =
      '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="shareTitle">' +
        '<div class="modal-head">' +
          '<h2 id="shareTitle">Share your ranking</h2>' +
          '<button type="button" class="modal-close" data-act="close" aria-label="Close">×</button>' +
        "</div>" +
        '<div class="modal-body">' +
          '<div class="share-preview"><div class="share-loading">Drawing your ranking…</div></div>' +
          '<div class="share-controls">' +
            '<p class="setup-label">Shape</p>' +
            segmented("format", [
              { value: "story", label: "Story 9:16" },
              { value: "post", label: "Post 4:5" },
              { value: "square", label: "Square 1:1" },
              { value: "wide", label: "Wide 16:9" }
            ], opts.format) +
            '<p class="setup-label">Show</p>' +
            segmented("mode", modes, opts.mode) +
            (Kits.ids(team).length > 1 ? '<p class="setup-label">Colors</p>' + kitSwitch(team, "kit", opts.kit, false) : "") +
            '<div class="share-buttons">' +
              '<button type="button" class="btn btn-primary" data-act="download">Download image</button>' +
              '<button type="button" class="btn btn-social btn-ig" data-act="ig">Instagram story</button>' +
              '<button type="button" class="btn btn-social btn-x" data-act="x">Post on X</button>' +
            "</div>" +
            '<p class="share-note" id="shareNote"></p>' +
          "</div>" +
        "</div>" +
      "</div>";
    openModal(modal);

    const preview = modal.querySelector(".share-preview");
    const note = modal.querySelector("#shareNote");
    const fileShare = ShareImage.canShareFiles();
    if (escapeHref) {
      note.innerHTML = 'This app blocks saving images. <a class="share-escape" target="_blank" rel="noopener">Open your ranking in your browser</a> to download or share it.';
      note.querySelector(".share-escape").href = ShareImage.browserIntent(escapeHref);
    } else if (ShareImage.inAppBrowser()) {
      note.textContent = "Opened inside an app? Download still works (press and hold the image), but for one-tap sharing open this page in your browser: tap ⋯ then Open in browser.";
    }

    const fileName = format => team.id + "-ranking-" + opts.mode + "-" + opts.kit + "-" + format + ".png";

    async function draw() {
      const id = ++renderId;
      preview.classList.add("busy");
      const c = await ShareImage.render({
        format: opts.format,
        mode: opts.mode,
        team,
        entries,
        siteUrl: url,
        crestSrc: crestPaths(team, kitFor(team)),
        kitFor
      });
      if (id !== renderId) return;
      canvas = c;
      preview.innerHTML = "";
      preview.appendChild(c);
      preview.classList.remove("busy");
      preview.dataset.format = opts.format;
      if (c.photosDropped) toast("Photos can't go in the image when the page is opened as a file. They will once it's on a server or GitHub Pages.");
    }

    async function storyCanvas() {
      if (opts.format === "story" && canvas) return canvas;
      return ShareImage.render({ format: "story", mode: opts.mode, team, entries, siteUrl: url, crestSrc: crestPaths(team, kitFor(team)), kitFor });
    }

    function close() {
      closeModal(modal);
      document.removeEventListener("keydown", onKey);
    }

    function onKey(e) {
      if (e.key === "Escape") close();
    }

    function deliver(c, file) {
      if (ShareImage.prefersSaveView()) {
        ShareImage.showSaveView(c, null, escapeHref);
        return false;
      }
      ShareImage.download(file);
      return true;
    }

    async function shareFile(file, text, c) {
      try {
        await navigator.share(text ? { files: [file], text } : { files: [file] });
      } catch (e) {
        if (e && e.name !== "AbortError") {
          if (deliver(c || canvas, file)) toast("Sharing didn't open, so the image was downloaded instead.");
        }
      }
    }

    modal.addEventListener("change", e => {
      if (e.target.name === "format" || e.target.name === "mode" || e.target.name === "kit") {
        opts[e.target.name] = e.target.value;
        draw();
      }
    });

    modal.addEventListener("click", async e => {
      if (e.target === modal) return close();
      const act = e.target.closest("[data-act]");
      if (!act || !canvas) {
        if (act && act.dataset.act === "close") close();
        return;
      }
      if (act.dataset.act === "close") return close();

      if (act.dataset.act === "download") {
        deliver(canvas, ShareImage.canvasToFile(canvas, fileName(opts.format)));
      }

      if (act.dataset.act === "x") {
        const text = caption(team, entries) + (url ? "\n\nRank yours:" : "");
        if (fileShare) {
          await shareFile(ShareImage.canvasToFile(canvas, fileName(opts.format)), text + (url ? " " + url : ""));
        } else {
          if (ShareImage.prefersSaveView()) {
            ShareImage.showSaveView(canvas, "Press and hold to save, then attach it to your post on X", escapeHref);
          } else {
            const intent = "https://x.com/intent/tweet?text=" + encodeURIComponent(text) + (url ? "&url=" + encodeURIComponent(url) : "");
            window.open(intent, "_blank", "noopener");
            ShareImage.download(ShareImage.canvasToFile(canvas, fileName(opts.format)));
            toast("Image downloaded. Attach it to your post on X.");
          }
        }
      }

      if (act.dataset.act === "ig") {
        const c = await storyCanvas();
        const file = ShareImage.canvasToFile(c, fileName("story"));
        if (fileShare) {
          await shareFile(file, null, c);
        } else if (ShareImage.prefersSaveView()) {
          ShareImage.showSaveView(c, "Press and hold to save, then add it to your Instagram story", escapeHref);
        } else {
          ShareImage.download(file);
          toast("Story image downloaded. Send it to your phone and add it to your Instagram story.");
        }
      }
    });

    document.addEventListener("keydown", onKey);
    modal.querySelector(".modal-close").focus();
    draw();
  }

  const REQUESTS_URL = MANIFEST.requestsUrl || "";
  let lastRequestAt = 0;

  function missingLine(team, top) {
    if (!REQUESTS_URL) return "";
    return (
    '<p class="missing-line' + (top ? " missing-line-top" : "") + '"> ' +
        '<button type="button" class="link-btn" data-request="player" data-team="' + team.id + '"></button>' +
      "</p>"
    );
  }

  function requestStrip() {
    if (!REQUESTS_URL) return "";
    return (
  '<div class="request-strip">' +
        '<span class="request-strip-text">Missing a roster or a player?</span>' +
        '<button type="button" class="btn btn-solid btn-sm" data-request="team">Make a request</button>' +
      "</div>"
    );
  }

  function normText(text) {
    return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function squadIndex() {
    return SECTIONS.flatMap(section => (section.groups || []).flatMap(group => (group.teams || []).filter(id => INDEX[id]).map(id => {
      const team = TEAMS[id];
      const name = team ? team.name : id.replace(/-/g, " ");
      return {
        id,
        name,
        meta: group.name + " · " + section.name,
        hay: normText([name, team && team.shortName, id, group.name].join(" "))
      };
    })));
  }

  function squadCombo(form, initialId) {
    const input = form.querySelector('input[name="squadSearch"]');
    const hidden = form.querySelector('input[name="squad"]');
    const list = form.querySelector("#squadList");
    const locked = input.readOnly;
    let items = squadIndex();
    let shown = [];
    let active = -1;

    const close = () => {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      active = -1;
    };
    const open = () => {
      if (locked) return;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };
    const pickItem = item => {
      hidden.value = item.id;
      input.value = item.name;
      close();
      form.dispatchEvent(new Event("input"));
    };
    const paint = () => {
      const q = normText(input.value);
      const words = q ? q.split(" ") : [];
      shown = items.filter(it => words.every(w => it.hay.includes(w)));
      list.innerHTML = shown.length
        ? shown.map((it, i) =>
            '<li role="option" id="sq-' + it.id + '" data-i="' + i + '" class="' + (i === active ? "is-active" : "") + '" aria-selected="' + (it.id === hidden.value) + '">' +
              '<span class="combo-name">' + esc(it.name) + "</span>" +
              '<span class="combo-meta">' + esc(it.meta) + "</span>" +
            "</li>"
          ).join("")
        : '<li class="combo-empty">No squad matches that. You can request it as a new squad instead.</li>';
      if (active >= 0) input.setAttribute("aria-activedescendant", "sq-" + shown[active].id);
      else input.removeAttribute("aria-activedescendant");
    };

    if (initialId && INDEX[initialId]) {
      hidden.value = initialId;
      const it = items.find(x => x.id === initialId);
      input.value = it ? it.name : initialId;
    }

    input.addEventListener("focus", () => {
      if (locked) return;
      if (hidden.value) input.select();
      paint();
      open();
    });
    input.addEventListener("input", () => {
      hidden.value = "";
      active = -1;
      paint();
      open();
      const exact = shown.find(it => normText(it.name) === normText(input.value));
      if (exact) hidden.value = exact.id;
    });
    input.addEventListener("blur", () => setTimeout(close, 120));
    input.addEventListener("keydown", e => {
      if (locked) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        open();
        if (!shown.length) paint();
        if (!shown.length) return;
        active = e.key === "ArrowDown" ? (active + 1) % shown.length : (active <= 0 ? shown.length - 1 : active - 1);
        paint();
        const el = list.querySelector(".is-active");
        if (el) el.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && !list.hidden && active >= 0) {
        e.preventDefault();
        pickItem(shown[active]);
      } else if (e.key === "Escape" && !list.hidden) {
        e.stopPropagation();
        close();
      }
    });
    list.addEventListener("mousedown", e => e.preventDefault());
    list.addEventListener("click", e => {
      const li = e.target.closest("li[data-i]");
      if (li) pickItem(shown[Number(li.dataset.i)]);
    });

    return {
      refresh() {
        items = squadIndex();
        const it = items.find(x => x.id === hidden.value);
        if (it && document.activeElement !== input) input.value = it.name;
        if (!list.hidden) paint();
      }
    };
  }

  function pickerSelect(root) {
    if (!root) return;
    const trigger = root.querySelector(".select-trigger");
    const label = root.querySelector("#catValue");
    const hidden = root.querySelector('input[type="hidden"]');
    const list = root.querySelector(".combo-list");
    const options = Array.from(list.querySelectorAll("li[data-i]"));
    let active = -1;

    const mark = () => options.forEach((li, i) => li.classList.toggle("is-active", i === active));
    const open = () => {
      list.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      active = Math.max(0, options.findIndex(li => li.getAttribute("aria-selected") === "true"));
      mark();
    };
    const close = () => {
      list.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    };
    const choose = i => {
      const li = options[i];
      options.forEach(o => o.setAttribute("aria-selected", String(o === li)));
      hidden.value = li.dataset.value;
      label.textContent = li.dataset.value;
      close();
      trigger.focus();
    };

    trigger.addEventListener("click", () => (list.hidden ? open() : close()));
    trigger.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (list.hidden) return open();
        active = e.key === "ArrowDown" ? (active + 1) % options.length : (active <= 0 ? options.length - 1 : active - 1);
        mark();
      } else if ((e.key === "Enter" || e.key === " ") && !list.hidden) {
        e.preventDefault();
        choose(active);
      } else if (e.key === "Escape" && !list.hidden) {
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        close();
      }
    });
    list.addEventListener("mousedown", e => e.preventDefault());
    list.addEventListener("click", e => {
      const li = e.target.closest("li[data-i]");
      if (li) choose(Number(li.dataset.i));
    });
    document.addEventListener("mousedown", e => {
      if (!root.contains(e.target)) close();
    });
  }

  function openRequest(type, teamId) {
    if (!REQUESTS_URL || document.querySelector(".request-modal:not(.is-closing)")) return;
    const fromTeam = TEAMS[teamId] || null;
    const modal = document.createElement("div");
    modal.className = "modal request-modal";
    if (fromTeam) modal.setAttribute("style", themeVars(fromTeam));

    const categories = SECTIONS.map(s => s.name).concat(["Something else"]);

    modal.innerHTML =
      '<div class="modal-card request-card" role="dialog" aria-modal="true" aria-labelledby="reqTitle">' +
        '<div class="modal-head">' +
          '<h2 id="reqTitle">' + (fromTeam ? "Missing a player?" : "Make a request") + "</h2>" +
          '<button type="button" class="modal-close" data-act="close" aria-label="Close">×</button>' +
        "</div>" +
        '<form class="req-form" novalidate>' +
          (fromTeam ? "" :
            '<div class="req-type">' + segmented("reqType", [
              { value: "team", label: "A roster" },
              { value: "player", label: "A missing player" },
              { value: "other", label: "Other" }
            ], type === "player" || type === "other" ? type : "team") + "</div>") +
          '<div class="req-group" data-for="team">' +
            '<label class="req-field"><span>Which squad?</span>' +
              '<input name="teamName" maxlength="120" placeholder="e.g. Athletic Club, Chelsea Women, Brazil 2002" autocomplete="off"></label>' +
            '<div class="req-field req-combo req-select"><label id="catLabel">Type</label>' +
              '<button type="button" class="select-trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="catLabel catValue">' +
                '<span id="catValue">' + esc(categories[0]) + "</span>" +
              "</button>" +
              '<span class="combo-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
              '<input type="hidden" name="category" value="' + esc(categories[0]) + '">' +
              '<ul class="combo-list" role="listbox" aria-labelledby="catLabel" hidden>' +
                categories.map((c, i) =>
                  '<li role="option" data-i="' + i + '" data-value="' + esc(c) + '" aria-selected="' + (i === 0) + '"><span class="combo-name">' + esc(c) + "</span></li>"
                ).join("") +
              "</ul>" +
            "</div>" +
            '<label class="req-field"><span>League or competition <em>(optional)</em></span>' +
              '<input name="league" maxlength="120" placeholder="e.g. LaLiga, WSL, World Cup" autocomplete="off"></label>' +
          "</div>" +
          '<div class="req-group" data-for="player">' +
            '<div class="req-field req-combo"><label for="squadSearch">Squad</label>' +
              '<input id="squadSearch" name="squadSearch" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="squadList" placeholder="Search squads…" autocomplete="off"' + (fromTeam ? " readonly" : "") + ">" +
              (fromTeam ? "" : '<span class="combo-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>') +
              '<input type="hidden" name="squad">' +
              '<ul class="combo-list" id="squadList" role="listbox" hidden></ul>' +
            "</div>" +
            '<label class="req-field"><span>Who\'s missing?</span>' +
              '<input name="playerName" maxlength="120" placeholder="Player name" autocomplete="off"></label>' +
          "</div>" +
          '<div class="req-group" data-for="other">' +
            '<label class="req-field"><span>Your message</span>' +
              '<textarea name="message" maxlength="1000" rows="5" placeholder="An idea, a bug, or if you just wanna say hi to me :)"></textarea></label>' +
          "</div>" +
          '<label class="req-field req-notes"><span>Anything else? <em>(optional)</em></span>' +
            '<textarea name="notes" maxlength="500" rows="3" placeholder="Shirt number, position, a link…"></textarea></label>' +
          '<label class="req-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
          '<p class="req-status" role="status"></p>' +
          '<div class="req-actions"><button type="submit" class="btn btn-primary">Send request</button></div>' +
        "</form>" +
      "</div>";
    openModal(modal);

    const form = modal.querySelector(".req-form");
    const status = modal.querySelector(".req-status");
    const submit = form.querySelector('[type="submit"]');
    const currentType = () => fromTeam ? "player" : form.querySelector('input[name="reqType"]:checked').value;
    const showGroup = () => {
      const t = currentType();
      form.querySelectorAll(".req-group").forEach(g => { g.hidden = g.dataset.for !== t; });
      form.querySelector(".req-notes").hidden = t === "other";
      form.querySelector('[type="submit"]').textContent = t === "other" ? "Send message" : "Send request";
      status.textContent = "";
      return form.querySelector('.req-group[data-for="' + t + '"]');
    };
    const syncType = () => {
      if (!MOTION_OK) return showGroup();
      const before = form.offsetHeight;
      const group = showGroup();
      const after = form.offsetHeight;
      group.classList.remove("req-enter");
      void group.offsetWidth;
      group.classList.add("req-enter");
      form.style.height = before + "px";
      form.style.overflow = "hidden";
      void form.offsetHeight;
      form.style.transition = "height 280ms cubic-bezier(0.22, 0.8, 0.24, 1)";
      form.style.height = after + "px";
      clearTimeout(syncType.timer);
      syncType.timer = setTimeout(() => {
        form.style.height = "";
        form.style.overflow = "";
        form.style.transition = "";
      }, 300);
    };
    form.querySelectorAll('input[name="reqType"]').forEach(r => r.addEventListener("change", syncType));
    form.addEventListener("input", () => {
      if (!submit.disabled) status.textContent = "";
    });
    showGroup();
    const combo = squadCombo(form, teamId);
    pickerSelect(form.querySelector(".req-select"));

    const missingNames = SECTIONS.flatMap(s => (s.groups || []).flatMap(g => g.teams || [])).filter(id => INDEX[id] && !TEAMS[id]);
    if (missingNames.length) {
      Promise.all(missingNames.map(ensureTeam)).then(() => combo.refresh());
    }

    const firstInput = form.querySelector(fromTeam ? 'input[name="playerName"]' : type === "other" ? 'textarea[name="message"]' : 'input[name="teamName"]');
    setTimeout(() => (firstInput || modal.querySelector(".modal-close")).focus(), 30);

    function close() {
      closeModal(modal);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    modal.addEventListener("click", e => {
      if (e.target === modal || e.target.closest('[data-act="close"]')) close();
      if (e.target.closest('[data-act="another"]')) {
        modal.remove();
        document.removeEventListener("keydown", onKey);
        openRequest(currentType(), teamId);
      }
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      const t = currentType();
      const val = name => (form.elements[name] ? form.elements[name].value.trim() : "");
      const squadId = fromTeam ? fromTeam.id : val("squad");
      const squadTeam = TEAMS[squadId];
      const payload = t === "other" ? {
        type: t,
        category: "",
        squad: "",
        squadId: "",
        name: "",
        notes: val("message"),
        page: location.origin + location.pathname + location.hash,
        website: val("website")
      } : {
        type: t,
        category: t === "team" ? val("category") : (INDEX[squadId] ? INDEX[squadId].section.name : ""),
        squad: t === "team" ? val("teamName") : (squadTeam ? squadTeam.name : squadId),
        squadId: t === "team" ? "" : squadId,
        name: t === "team" ? val("league") : val("playerName"),
        notes: val("notes"),
        page: location.origin + location.pathname + location.hash,
        website: val("website")
      };
      if (t === "other" && !payload.notes) {
        status.textContent = "Write your message first.";
        form.elements.message.focus();
        return;
      }
      if (t === "team" && !payload.squad) {
        status.textContent = "Add the name of the squad you'd like to see.";
        form.elements.teamName.focus();
        return;
      }
      if (t === "player" && !INDEX[squadId]) {
        status.textContent = "Pick a squad from the list.";
        form.elements.squadSearch.focus();
        return;
      }
      if (t === "player" && !payload.name) {
        status.textContent = "Add the name of the missing player.";
        form.elements.playerName.focus();
        return;
      }
      if (Date.now() - lastRequestAt < 15000) {
        status.textContent = "Thanks! Give it a few seconds before sending another one.";
        return;
      }
      submit.disabled = true;
      status.textContent = "Sending…";
      fetch(REQUESTS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      }).then(() => {
        lastRequestAt = Date.now();
        modal.querySelector(".modal-card").innerHTML =
          '<div class="req-done">' +
            '<span class="req-done-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
            "<h2>" + (t === "other" ? "Message sent" : "Request sent") + "</h2>" +
            "<p>Thanks! " + (t === "other" ? "Your message is on its way." : t === "team" ? esc(payload.squad) + " is on the list." : esc(payload.name) + " has been flagged for " + esc(payload.squad) + ".") + "</p>" +
            '<div class="req-actions">' +
              '<button type="button" class="btn btn-primary" data-act="close">Done</button>' +
              '<button type="button" class="btn btn-ghost" data-act="another">Send another</button>' +
            "</div>" +
          "</div>";
        const done = modal.querySelector('[data-act="close"]');
        if (done) done.focus();
      }).catch(() => {
        submit.disabled = false;
        status.textContent = "Couldn't send that. Check your connection and try again.";
      });
    });
  }

  document.addEventListener("click", e => {
    const trigger = e.target.closest("[data-request]");
    if (!trigger) return;
    openRequest(trigger.dataset.request, trigger.dataset.team);
    const field = trigger.dataset.prefill && document.querySelector('.request-modal:not(.is-closing) input[name="teamName"]');
    if (field) field.value = trigger.dataset.prefill;
  });

  function rankScale(rank) {
    return Math.max(0, (4 - rank) / 3);
  }

  function rowTint(kit, rank) {
    const sc = rankScale(rank);
    if (sc <= 0) return 0;
    const strength = kit.rowTintStrength != null ? kit.rowTintStrength : 0.07;
    const floor = kit.rowTintFloor || 0;
    return strength * (floor + (1 - floor) * sc);
  }

  const STATS_URL = MANIFEST.statsUrl || "";
  const STATS_CACHE = {};

  function deviceId() {
    let id = storeGet("device");
    if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
      storeSet("device", id);
    }
    return id;
  }

  function rankingGroups(team, state) {
    const prefix = team.id + ":";
    return MergeSorter.ranking(state).map(row => row.ids.map(key => key.slice(prefix.length)));
  }

  function isFullSquad(team, state) {
    const ids = MergeSorter.allIds(state).map(key => key.split(":")[1]);
    return ids.length === team.players.length && team.players.every(p => ids.includes(p.id));
  }

  const SENDING = {};

  function submitRanking(team) {
    if (!STATS_URL || !team) return Promise.resolve(false);
    const saved = storeGet(team.id);
    if (!saved || !saved.state || !saved.state.done) return Promise.resolve(false);
    let order;
    try {
      if (!isValidSaved(team, saved) || !isFullSquad(team, saved.state)) return Promise.resolve(false);
      order = rankingGroups(team, saved.state);
    } catch (e) {
      return Promise.resolve(false);
    }
    const signature = JSON.stringify(order);
    if (storeGet("sent2:" + team.id) === signature) return Promise.resolve(true);
    if (SENDING[team.id] && SENDING[team.id].signature === signature) return SENDING[team.id].promise;
    const promise = fetch(STATS_URL, {
      method: "POST",
      body: JSON.stringify({ type: "ranking", squadId: team.id, device: deviceId(), order, season: team.season })
    })
      .then(r => r.json())
      .then(reply => {
        if (!reply || reply.ok !== true) return false;
        storeSet("sent2:" + team.id, signature);
        delete STATS_CACHE[team.id];
        return true;
      })
      .catch(() => false)
      .finally(() => {
        delete SENDING[team.id];
      });
    SENDING[team.id] = { signature, promise };
    return promise;
  }

  function fetchStats(team) {
    const hit = STATS_CACHE[team.id];
    if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.promise;
    const url = STATS_URL + (STATS_URL.indexOf("?") < 0 ? "?" : "&") + "action=stats&squad=" + encodeURIComponent(team.id);
    const promise = fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data || data.ok === false) throw new Error("stats");
        if (typeof data.count !== "number") {
          const err = new Error("outdated");
          err.outdated = true;
          throw err;
        }
        return data;
      });
    STATS_CACHE[team.id] = { at: Date.now(), promise };
    promise.catch(() => delete STATS_CACHE[team.id]);
    return promise;
  }

  function ordinal(n) {
    const v = n % 100;
    const suffix = v >= 11 && v <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    return n + suffix;
  }

  function pct(part, whole) {
    return whole ? Math.round((part / whole) * 100) : 0;
  }

  function communityOrder(team, data) {
    return team.players
      .filter(p => data.players[p.id])
      .map(p => Object.assign({ player: p }, data.players[p.id]))
      .sort((a, b) => a.avg - b.avg || b.top1 - a.top1);
  }

  function yourRanks(team) {
    const saved = storeGet(team.id);
    if (!saved || !saved.state || !saved.state.done || !isFullSquad(team, saved.state)) return null;
    const ranks = {};
    MergeSorter.ranking(saved.state).forEach(row => row.ids.forEach(key => {
      ranks[key.split(":")[1]] = row.rank;
    }));
    return ranks;
  }

  function statsTeaser(team, data) {
    if (data.count < data.min) {
      return data.count + " of " + data.min + " rankings so far · stats unlock at " + data.min;
    }
    const mine = yourRanks(team);
    const order = communityOrder(team, data);
    if (!mine) return data.count + " rankings so far";
    const crowdTop = new Set(order.slice(0, 10).map(e => e.player.id));
    const yoursTop = Object.keys(mine).filter(id => mine[id] <= 10);
    const shared = yoursTop.filter(id => crowdTop.has(id)).length;
    return data.count + " rankings · you agree with the crowd on " + shared + " of your top " + Math.min(10, yoursTop.length);
  }

  function statsEntry(team) {
    if (!STATS_URL) return "";
    return (
      '<button type="button" class="stats-entry" data-go="' + team.id + '/stats">' +
        '<span class="stats-entry-text">' +
          '<b>See how everyone else ranked ' + esc(team.shortName || team.name) + "</b>" +
          '<span class="stats-entry-sub">Community ranking</span>' +
        "</span>" +
        '<span class="stats-entry-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
      "</button>"
    );
  }

  function statsAvatar(team, player, size) {
    return '<span class="avatar st-avatar st-av-' + size + '" data-team="' + team.id + '" style="' + themeVars(team) + '">' +
      '<span class="avatar-fallback"><span>' + esc(player.number != null ? player.number : "") + "</span></span>" +
      imgTag(photoPaths(team, player)) +
    "</span>";
  }

  function renderStats(team) {
    session = null;
    applyTheme(team);
    const head =
      '<button type="button" class="back-link" data-go="' + team.id + '">← ' + esc(team.name) + "</button>" +
      '<div class="setup-head">' +
        crestMarkup(team, "crest-lg") +
        "<div>" +
          '<p class="eyebrow">Community ranking</p>' +
          "<h1>" + esc(team.name) + "</h1>" +
        "</div>" +
        kitPicker(team) +
      "</div>" +
      '<p class="missing-line missing-line-top st-sub" id="statsSub">Loading…</p>';

    render(
      '<section class="stats" data-stats="' + team.id + '">' + head +
        '<div class="st-body">' +
          '<div class="st-skeleton" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
        "</div>" +
      "</section>"
    );

    const token = navToken;
    submitRanking(team).then(() => {
      if (token === navToken) loadStats(team, token);
    });
  }

  function loadStats(team, token) {
    const body = app.querySelector(".st-body");
    const sub = app.querySelector("#statsSub");
    if (!body || !sub) return;
    sub.textContent = "Loading…";
    body.classList.remove("st-in");
    body.innerHTML = '<div class="st-skeleton" aria-hidden="true"><span></span><span></span><span></span><span></span></div>';
    fetchStats(team).then(data => {
      if (token !== navToken || !app.querySelector('[data-stats="' + team.id + '"]')) return;
      paintStats(team, data);
    }).catch(err => {
      if (token !== navToken || !app.contains(body)) return;
      if (err && err.outdated) console.warn("Player Sorter: the stats script replied without stats. Publish a new version of the Apps Script deployment.");
      else console.warn("Player Sorter: couldn't load stats", err);
      sub.textContent = "Stats unavailable right now";
      body.innerHTML =
        '<div class="st-lock"><h2>Couldn\'t load the stats</h2>' +
        "<p>" + (err && err.outdated
          ? "Community stats aren't switched on yet. Check back soon."
          : "Check your connection and try again in a moment.") + "</p>" +
        '<button type="button" class="btn btn-primary" data-act="retry">Try again</button></div>';
      body.classList.remove("st-in");
      void body.offsetWidth;
      body.classList.add("st-in");
      body.querySelector('[data-act="retry"]').addEventListener("click", () => {
        delete STATS_CACHE[team.id];
        loadStats(team, token);
      });
    });
  }

  function paintStats(team, data) {
    const body = app.querySelector(".st-body");
    const sub = app.querySelector("#statsSub");
    if (data.count < data.min) {
      const left = data.min - data.count;
      sub.textContent = "";
      body.innerHTML =
        '<div class="st-lock">' +
          '<p class="eyebrow">Community ranking</p>' +
          "<h2>Stats unlock at " + data.min + " rankings</h2>" +
          "<p>" + data.count + (data.count === 1 ? " person has" : " people have") + " ranked the full " + esc(team.name) + " squad so far. " +
            left + " more and you'll see how everyone ranks them.</p>" +
          '<div class="st-prog"><i style="width:' + pct(data.count, data.min) + '%"></i></div>' +
          '<p class="st-prog-label">' + data.count + " / " + data.min + "</p>" +
          '<button type="button" class="btn btn-primary" data-go="' + team.id + '">Rank the squad</button>' +
        "</div>";
      wireImages(body);
      return;
    }

    sub.textContent = "Based on " + data.count + " rankings · updated every 15 min";
    const order = communityOrder(team, data);
    const used = new Set();
    const best = (score, avoid) => {
      const pool = order.filter(e => !(avoid && used.has(e.player.id)));
      const pick = pool.slice().sort((a, b) => score(b) - score(a))[0] || order[0];
      used.add(pick.player.id);
      return pick;
    };
    const fav = best(e => e.top1 / e.n);
    const reg = best(e => e.top3 / e.n, true);
    const hasSplit = order.some(e => typeof e.topQ === "number");
    const split = e => Math.min(e.topQ || 0, e.bottomQ || 0) / e.n;
    const divPool = order.filter(e => e.n >= data.count * 0.5 && !used.has(e.player.id) && split(e) >= 0.1);
    const div = hasSplit
      ? divPool.sort((a, b) => split(b) - split(a) || ((b.topQ + b.bottomQ) - (a.topQ + a.bottomQ)))[0] || null
      : best(e => (e.n >= data.count * 0.5 ? e.sd : -1), true);
    if (div) used.add(div.player.id);
    const quarter = Math.max(1, Math.round(team.players.length / 4));
    const last = best(e => e.bottom3 / e.n, true);

    const card = (label, e, statHtml) =>
      '<div class="st-card">' +
        '<p class="eyebrow">' + label + "</p>" +
        '<div class="st-card-who">' + statsAvatar(team, e.player, 44) + '<span class="st-card-name">' + esc(e.player.name) + "</span></div>" +
        '<p class="st-card-stat">' + statHtml + "</p>" +
      "</div>";

    const bars = (key, cls) => order.slice().sort((a, b) => b[key] / b.n - a[key] / a.n).slice(0, 5).map(e => {
      const v = pct(e[key], e.n);
      return '<li class="st-bar-row">' + statsAvatar(team, e.player, 36) +
        '<span class="st-bar-name">' + esc(e.player.name) + "</span>" +
        '<span class="st-bar"><i class="' + cls + '" style="--w:' + v + '%"></i></span>' +
        "<b>" + v + "%</b></li>";
    }).join("");

    const mine = yourRanks(team);
    let you = "";
    if (mine) {
      const crowdRank = {};
      order.forEach((e, i) => { crowdRank[e.player.id] = i + 1; });
      const diffs = order
        .filter(e => mine[e.player.id])
        .map(e => ({ e, yours: mine[e.player.id], theirs: crowdRank[e.player.id], d: crowdRank[e.player.id] - mine[e.player.id] }))
        .filter(x => x.d !== 0)
        .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
        .slice(0, 3);
      if (diffs.length) {
        you =
          '<h2 class="st-h">Where you differ most</h2>' +
          '<div class="st-you">' + diffs.map(x =>
            '<div class="st-diff">' + statsAvatar(team, x.e.player, 40) +
              "<p><b>" + esc(x.e.player.name) + "</b><br>You: " + ordinal(x.yours) + " · Everyone: " + ordinal(x.theirs) + "</p>" +
              '<span class="st-chip ' + (x.d > 0 ? "is-up" : "is-down") + '">' + (x.d > 0 ? "+" : "−") + Math.abs(x.d) + "</span>" +
            "</div>"
          ).join("") + "</div>";
      }
    }

    const kit = kitOf(team);
    const top = order.slice(0, 10).map((e, i) => {
      const r = i + 1;
      return '<li class="rank-row" data-rank="' + r + '" style="--s:' + rankScale(r).toFixed(3) + ";--t:" + rowTint(kit, r).toFixed(3) + '">' +
        '<span class="rank-num">' + r + "</span>" +
        '<span class="rank-slot">' + avatarMarkup(team, e.player, "avatar-rank") + "</span>" +
        '<span class="rank-text">' +
          '<span class="rank-name">' + esc(e.player.name) + "</span>" +
          '<span class="rank-meta">Average position ' + e.avg.toFixed(1) + "</span>" +
        "</span>" +
      "</li>";
    }).join("");

    body.innerHTML =
      '<div class="st-cards">' +
        card("Fan favourite", fav, "<b>" + pct(fav.top1, fav.n) + "%</b> ranked #1") +
        card("Top 3 regular", reg, "In <b>" + pct(reg.top3, reg.n) + "%</b> of top 3s") +
        (div ? card("Most divisive", div, hasSplit
          ? "<b>" + pct(div.topQ, div.n) + "%</b> rank them top " + quarter + " · <b>" + pct(div.bottomQ, div.n) + "%</b> bottom " + quarter
          : "Ranked anywhere from <b>" + ordinal(div.min) + "</b> to <b>" + ordinal(div.max) + "</b>") : "") +
        card("Usually last", last, "In <b>" + pct(last.bottom3, last.n) + "%</b> of bottom 3s") +
      "</div>" +
      '<div class="st-cols">' +
        '<div class="st-panel"><h2>Most often top 3</h2><ul>' + bars("top3", "up") + "</ul></div>" +
        '<div class="st-panel"><h2>Most often bottom 3</h2><ul>' + bars("bottom3", "down") + "</ul></div>" +
      "</div>" +
      you +
      '<h2 class="st-h">The community\'s top 10</h2>' +
      '<ol class="rank-list">' + top + "</ol>" +
      '<p class="st-foot">Only full-squad rankings count, one per device. Sorting the squad again replaces your previous ranking. Nothing personal is collected.</p>';
    body.classList.add("st-in");
    wireImages(body);
    requestAnimationFrame(() => body.querySelectorAll(".st-bar i").forEach(i => i.classList.add("is-on")));
  }

  function renderResults() {
    const { team, state } = session;
    const kit = kitOf(team);
    applyTheme(team);
    const ranking = MergeSorter.ranking(state);
    const rows = [];
    ranking.forEach(row => row.ids.forEach(key => {
      const hit = lookup(key);
      if (!hit) return;
      const tied = row.ids.length > 1;
      rows.push(
        '<li class="rank-row" data-rank="' + row.rank + '" style="--s:' + rankScale(row.rank).toFixed(3) + ";--t:" + rowTint(kit, row.rank).toFixed(3) + '">' +
          '<span class="rank-num">' + row.rank + (tied ? '<small>=</small>' : "") + "</span>" +
          '<span class="rank-slot">' + avatarMarkup(hit.team, hit.player, "avatar-rank") + "</span>" +
          '<span class="rank-text">' +
            '<span class="rank-name">' + esc(hit.player.name) + "</span>" +
            '<span class="rank-meta">' + POSITIONS[hit.player.position] + " · #" + esc(hit.player.number) + "</span>" +
          "</span>" +
        "</li>"
      );
    }));

    render(
      '<section class="results">' +
        '<button type="button" class="back-link" data-go="' + sectionOf(team) + '">← All squads</button>' +
        '<div class="setup-head">' +
          crestMarkup(team, "crest-lg") +
          "<div>" +
            '<p class="eyebrow">Your ranking</p>' +
            "<h1>" + esc(team.name) + "</h1>" +
          "</div>" +
          kitPicker(team) +
        "</div>" +
        missingLine(team, true) +
        statsEntry(team) +
        '<div class="setup-actions results-actions">' +
          '<button class="btn btn-primary" data-act="share">Share ranking</button>' +
          '<button class="btn btn-ghost" data-act="again">Sort again</button>' +
          '<button type="button" class="btn btn-ghost" data-go="' + sectionOf(team) + '">All squads</button>' +
        "</div>" +
        '<ol class="rank-list">' + rows.join("") + "</ol>" +
      "</section>"
    );

    app.querySelector('[data-act="share"]').addEventListener("click", () => openShare(team, shareEntries(ranking)));
    const entry = app.querySelector(".stats-entry .stats-entry-sub");
    submitRanking(team).then(() => {
      if (!entry || !app.contains(entry)) return;
      return fetchStats(team).then(data => {
        if (app.contains(entry)) entry.textContent = statsTeaser(team, data);
      });
    }).catch(() => {});
    app.querySelector('[data-act="again"]').addEventListener("click", () => swapScreen(() => {
      storeDel(team.id);
      renderTeamSetup(team);
    }));
  }

  function isValidSaved(team, saved) {
    if (!saved || !saved.state) return false;
    try {
      return MergeSorter.allIds(saved.state).every(key => lookup(key) && key.startsWith(team.id + ":"));
    } catch (e) {
      return false;
    }
  }

  function go(id) {
    try {
      history.pushState(null, "", id ? "#/" + id : location.pathname + location.search);
    } catch (e) {}
    show(id);
  }

  function route() {
    document.querySelectorAll(".modal .modal-close").forEach(btn => btn.click());
    document.querySelectorAll(".save-view").forEach(el => el.remove());
    show(location.hash.replace(/^#\/?/, ""));
  }

  function show(id) {
    const token = ++navToken;
    const parts = id.split("/");
    if (!INDEX[parts[0]]) {
      renderHome(parts[0], token);
      return;
    }
    ensureTeam(parts[0]).then(team => {
      if (token !== navToken) return;
      if (!team) {
        renderHome("", token);
        return;
      }
      swapScreen(() => {
        const saved = storeGet(team.id);
        if (!isValidSaved(team, saved)) {
          storeDel(team.id);
        } else {
          submitRanking(team);
          if (parts[1] === "results" && saved.state.done) {
            session = { team, state: saved.state };
            renderResults();
            return;
          }
        }
        if (parts[1] === "stats" && STATS_URL) {
          renderStats(team);
          return;
        }
        renderTeamSetup(team);
      });
    });
  }

  document.addEventListener("keydown", e => {
    if (!session || session.state.done || !app.querySelector(".battle")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); pick("left"); }
    else if (e.key === "ArrowRight") { e.preventDefault(); pick("right"); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); pick("tie"); }
    else if (e.key === "Backspace") { e.preventDefault(); doUndo(); }
  });

  app.addEventListener("change", e => {
    if (e.target.name === "site-kit" && TEAMS[e.target.dataset.team]) setKit(TEAMS[e.target.dataset.team], e.target.value);
  });

  app.addEventListener("click", e => {
    const target = e.target.closest("[data-go]");
    if (!target) return;
    e.preventDefault();
    go(target.dataset.go);
  });

  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);
  importRanking().then(route);
})();