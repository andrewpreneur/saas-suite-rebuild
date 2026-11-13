// Top Navigation Help Widget injected into the HighLevel header.
//
// Embed hook the Software Onboarding popup should implement:
//   Parent -> iframe postMessage, target origin https://yoursoftwareonboarding.com:
//     { type: "saassuite:popup-open", source: "saassuite-host", host: "top-nav", tab, path, user? }
//   The iframe loads /popup/<agency>?tab=<tab>&host=top-nav. host=top-nav means the
//   bottom-right launcher is not required; popup_enabled must not refuse this frame.
//   user is set only for a trusted email, or a trusted id plus name. It is never in the URL.
//   tab is the last segment of the option target (education, support-chat, support-ticket, …).
//   HighLevel's parent origin changes per white label, so the popup should trust
//   source/type, not a fixed parent origin.
//   Optional in-iframe global: window.SaaSSuiteEmbed.open({ tab, path }).
// Host page (this script, or the popup launcher in dynamic-styles):
//   window.SaaSSuitePopup.open({ tab, path, source: "top-nav-help", user })
//   window.SaaSSuitePopup.close()
// Top-nav embed does not require popup_enabled. The iframe is
//   /popup/<agency>?tab=<tab>&host=top-nav
// and the postMessage includes user only when the install tag has a real email,
// or both a real id and name. The bottom-right launcher stays off when popup_enabled is false.
//   Same-window postMessage { type: "saassuite:popup-open", ... } is accepted only
//   when event.source === window.
// If none of that is available, this script mounts the same .lvb-panel. If that
// fails, the option opens in a new tab.

import { popupFrameRuntimeJS } from "../_shared/popupFrame.ts";
import { popupHostUserRuntimeJS } from "../_shared/popupHostIdentity.ts";
import {
  sanitizeTopNavWidgetConfig,
  stripControlChars,
  topNavWidgetIconMap,
  type TopNavWidgetConfig,
  type TopNavWidgetOption,
  type TopNavWidgetShowOn,
} from "../_shared/topNavWidgetOptions.ts";

const POPUP_ORIGIN = "https://yoursoftwareonboarding.com";

function hexColor(value: string | undefined, fallback: string): string {
  const raw = (value || "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : fallback;
}

export function buildTopNavWidgetJS(
  label: string,
  color: string,
  opts: {
    iconColor?: string;
    tileColor?: string;
    hubUrl?: string;
    hideInEmbed?: boolean;
    options?: TopNavWidgetOption[] | unknown;
    title?: string;
    subtitle?: string;
    showOn?: TopNavWidgetShowOn;
    agencyId?: string;
  } = {},
): string {
  const safeLabel =
    stripControlChars(String(label || "Help & Support"))
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 40) || "Help & Support";
  const button = hexColor(color, "#1d1d1f");
  const icon = hexColor(opts.iconColor, "#d4a843");
  const tile = hexColor(opts.tileColor, "#8a6a14");
  const stored: TopNavWidgetConfig = sanitizeTopNavWidgetConfig(
    opts.title || opts.subtitle || opts.showOn
      ? { title: opts.title, subtitle: opts.subtitle, showOn: opts.showOn, options: opts.options }
      : opts.options,
  );
  const options = stored.options;
  const agencyId = String(opts.agencyId || "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 80);
  const hub = String(opts.hubUrl || "").replace(/\/$/, "");
  const helpIcon =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' +
    icon +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9"/><path d="M12 17.2h.01"/></svg>';

  const src = `/* SaaSSuite top-nav Help & Support. Menu z-index 2147483000 stays under the chat popup at 2147483647. */
(function () {
  'use strict';
  var CONFIG = {
    buttonLabel: __LABEL__,
    title: __TITLE__,
    subtitle: __SUBTITLE__,
    showOn: __SHOW__,
    hideInEmbed: __HIDE__,
    gapPx: 8,
    fallbackAfterMs: 8000
  };
  var OPTIONS = __OPTIONS__;
  var ICONS = __ICONS__;
  var HUB = __HUB__;
  var AGENCY = __AGENCY__;
  var POPUP_ORIGIN = __ORIGIN__;
  __POPUP_SIZE__
  __HOST_USER__
  var CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  var CLOSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var HELP = __HELP__;
  var LEGACY = { 'help-library': 'helpLibrary', 'live-support': 'liveSupport', 'open-ticket': 'openTicket' };

  var live = document.getElementById('support-widget-launcher-host');
  if (window.__supportWidgetLoaded && live && live.isConnected && live.shadowRoot) return;
  var TOKEN = (window.__supportWidgetToken || 0) + 1;
  window.__supportWidgetToken = TOKEN;
  window.__supportWidgetLoaded = true;
  function isCurrent() { return window.__supportWidgetToken === TOKEN; }
  if (live && live.parentNode) live.parentNode.removeChild(live);
  var oldPanel = document.getElementById('support-widget-panel-host');
  if (oldPanel && oldPanel.parentNode) oldPanel.parentNode.removeChild(oldPanel);

  var FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif';
  var LAUNCHER_CSS =
    ':host{all:initial;display:inline-flex;align-items:center;vertical-align:middle;max-width:100%;line-height:0}' +
    '.launch{font-family:' + FONT + ';-webkit-font-smoothing:antialiased;height:36px;max-width:100%;padding:0 14px 0 12px;border:none;border-radius:980px;' +
      'background:' + __COLOR__ + ';color:#fff;display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:500;cursor:pointer;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.12);transition:transform .2s cubic-bezier(.25,.1,.25,1);white-space:nowrap;line-height:1}' +
    '.launch:hover{transform:scale(1.03);filter:brightness(.92)}' +
    '.launch:focus-visible{outline:2px solid __ICON__;outline-offset:2px}' +
    '.lbl{overflow:hidden;text-overflow:ellipsis;max-width:148px}' +
    ':host([data-compact="1"]) .lbl{display:none}' +
    ':host([data-compact="1"]) .launch{width:36px;height:36px;padding:0;justify-content:center;gap:0}';

  var PANEL_CSS =
    ':host{all:initial}' +
    '*{box-sizing:border-box}' +
    '.panel{position:fixed;z-index:1;width:340px;max-width:calc(100vw - 24px);max-height:min(480px, calc(100vh - 24px));overflow:auto;padding:8px;font-family:' + FONT + ';' +
      '-webkit-font-smoothing:antialiased;color:#1d1d1f;background:rgba(255,255,255,.96);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);' +
      'border:1px solid rgba(0,0,0,.06);border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.04);' +
      'opacity:0;transform:translateY(-8px) scale(.98);pointer-events:none;transition:opacity .22s ease,transform .28s cubic-bezier(.25,.1,.25,1)}' +
    '.panel.open{opacity:1;transform:none;pointer-events:auto}' +
    '.head{display:flex;align-items:flex-start;justify-content:space-between;padding:12px 8px 12px 12px}' +
    '.title{font-size:17px;font-weight:600;letter-spacing:-.01em;margin:0}' +
    '.sub{font-size:13px;color:#6e6e73;margin-top:2px}' +
    '.x{width:32px;height:32px;border:none;border-radius:50%;background:#f5f5f7;color:#6e6e73;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}' +
    '.x:hover{background:#ececf0}' +
    '.list{display:flex;flex-direction:column;gap:2px}' +
    '.empty{padding:8px 12px 16px;font-size:13px;color:#6e6e73}' +
    '.row{font:inherit;color:inherit;width:100%;min-height:64px;border:none;background:transparent;border-radius:12px;padding:10px 12px;' +
      'display:flex;align-items:center;gap:14px;text-align:left;cursor:pointer}' +
    '.row:hover,.row:focus-visible{background:#f5f5f7;outline:none}' +
    '.tile{width:40px;height:40px;flex:none;border-radius:10px;background:__TILE__22;display:flex;align-items:center;justify-content:center}' +
    '.txt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}' +
    '.name{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.desc{font-size:13px;color:#6e6e73}' +
    '.chev{color:#aeaeb2;display:flex;flex:none}' +
    '@media (max-width:767px){.panel{width:calc(100vw - 24px)}}' +
    '@media (prefers-reduced-motion:reduce){.panel,.launch{transition:none}}';

  var panelHost = document.createElement('div');
  panelHost.id = 'support-widget-panel-host';
  panelHost.setAttribute('data-ss-help-panel', '1');
  panelHost.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;';
  var panelRoot = panelHost.attachShadow({ mode: 'open' });
  panelRoot.innerHTML =
    '<style>' + PANEL_CSS + '</style>' +
    '<div class="panel" role="dialog" aria-label="Support options" aria-hidden="true">' +
      '<div class="head"><div><p class="title"></p><div class="sub"></div></div>' +
      '<button class="x" type="button" aria-label="Close support"></button></div>' +
      '<div class="list"></div></div>';
  panelRoot.querySelector('.title').textContent = CONFIG.title;
  panelRoot.querySelector('.sub').textContent = CONFIG.subtitle;
  panelRoot.querySelector('.x').innerHTML = CLOSE;

  var list = panelRoot.querySelector('.list');
  var visibleCount = 0;
  for (var i = 0; i < OPTIONS.length; i++) {
    if (!OPTIONS[i].visible) continue;
    visibleCount++;
    list.appendChild(buildRow(OPTIONS[i]));
  }
  if (!visibleCount) {
    var empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No help options are turned on.';
    list.appendChild(empty);
  }

  function buildRow(opt) {
    var btn = document.createElement('button');
    btn.className = 'row';
    btn.type = 'button';
    btn.setAttribute('data-action', opt.id);
    var tileEl = document.createElement('span');
    tileEl.className = 'tile';
    tileEl.innerHTML = ICONS[opt.icon] || ICONS.book;
    var txt = document.createElement('span');
    txt.className = 'txt';
    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = opt.label || '';
    txt.appendChild(name);
    if (opt.description) {
      var desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = opt.description;
      txt.appendChild(desc);
    }
    var chev = document.createElement('span');
    chev.className = 'chev';
    chev.innerHTML = CHEV;
    btn.appendChild(tileEl);
    btn.appendChild(txt);
    btn.appendChild(chev);
    function chooseOption(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      suppressLauncherUntil = Date.now() + 80;
      setOpen(false);
    }
    btn.addEventListener('pointerup', chooseOption);
    btn.addEventListener('click', function (e) {
      chooseOption(e);
      runOption(opt);
    });
    return btn;
  }

  var panel = panelRoot.querySelector('.panel');
  var isOpen = false;
  var suppressLauncherUntil = 0;
  var phoneWatch = null;
  var launcherBtn = null;
  var usingFallback = false;
  var observer = null;
  var observedBody = null;
  var timer = null;

  panelRoot.querySelector('.x').addEventListener('click', function () { setOpen(false); });

  function placePanel() {
    if (!launcherBtn) return;
    var rect = launcherBtn.getBoundingClientRect();
    var margin = 12;
    var width = Math.min(340, Math.max(220, window.innerWidth - margin * 2));
    panel.style.width = width + 'px';
    var top = rect.bottom + 10;
    var maxH = window.innerHeight - top - margin;
    if (maxH < 180) {
      var prefer = Math.min(420, window.innerHeight - margin * 2);
      top = Math.max(margin, rect.top - prefer - 10);
      maxH = Math.min(prefer, window.innerHeight - top - margin);
    }
    var right = window.innerWidth - rect.right;
    if (right < margin) right = margin;
    if (right + width > window.innerWidth - margin) right = margin;
    panel.style.top = Math.max(margin, top) + 'px';
    panel.style.right = right + 'px';
    panel.style.left = 'auto';
    panel.style.bottom = 'auto';
    panel.style.maxHeight = Math.max(140, maxH) + 'px';
  }

  function setOpen(next) {
    isOpen = next;
    if (isOpen) placePanel();
    panel.classList.toggle('open', isOpen);
    panel.style.visibility = isOpen ? 'visible' : 'hidden';
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (launcherBtn) launcherBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
      var first = panelRoot.querySelector('.row');
      if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 50);
    }
  }

  var TAB_NAMES = { education: 'Education', 'support-chat': 'Support chat', 'support-ticket': 'ticket form', docs: 'Docs' };

  function knownTab(name) {
    return !!(name && Object.prototype.hasOwnProperty.call(TAB_NAMES, name));
  }

  function tabFor(opt) {
    var fromPath = tabFromTarget(opt && opt.target);
    if (knownTab(fromPath)) return fromPath;
    if (opt && knownTab(opt.embedTab)) return String(opt.embedTab);
    return fromPath || '';
  }

  function tabFromTarget(target) {
    var path = String(target || '');
    try {
      if (/^https?:\\/\\//i.test(path)) {
        var parsed = new URL(path);
        if (parsed.hostname !== 'yoursoftwareonboarding.com') return '';
        path = parsed.pathname;
      }
    } catch (e) { return ''; }
    var parts = path.split('?')[0].split('#')[0].split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  function popupMessage(detail) {
    var tab = (detail && detail.tab) || '';
    var payload = {
      type: 'saassuite:popup-open',
      source: 'saassuite-host',
      host: 'top-nav',
      tab: tab,
      tabName: (detail && detail.tabName) || TAB_NAMES[tab] || '',
      path: (detail && detail.path) || (tab ? '/' + tab : '')
    };
    var hostUser = ssPopupHostUser();
    if (hostUser) payload.user = hostUser;
    return payload;
  }

  function popupSrc(tab) {
    if (tab) return POPUP_ORIGIN + '/popup/' + AGENCY + '?tab=' + encodeURIComponent(tab) + '&host=top-nav';
    return POPUP_ORIGIN + '/popup/' + AGENCY + '?host=top-nav';
  }

  function revealPopup(popupPanel, detail) {
    applyPopupFrameSize(popupPanel);
    popupPanel.classList.add('lvb-open');
    var bubble = document.querySelector('.lvb-launcher');
    if (bubble) bubble.classList.add('lvb-hidden');
    var frame = popupPanel.querySelector('iframe');
    if (!frame) return;
    var tab = detail.tab || '';
    try {
      if (frame.contentWindow) frame.contentWindow.postMessage(popupMessage(detail), POPUP_ORIGIN);
    } catch (e) {}
    if (tab && frame.getAttribute('data-ss-tab') !== tab) {
      frame.setAttribute('data-ss-tab', tab);
      frame.src = popupSrc(tab);
    }
  }

  function mountPopup(detail) {
    if (!document.body) return false;
    var popupPanel = document.createElement('div');
    popupPanel.className = 'lvb-panel lvb-open';
    popupPanel.setAttribute('data-ss-help-embed', '1');
    var style = document.getElementById('saassuite-help-embed-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'saassuite-help-embed-style';
      style.textContent = '.lvb-panel{position:fixed;right:20px;bottom:20px;width:400px !important;height:640px !important;max-width:calc(100vw - 40px) !important;max-height:calc(100vh - 40px) !important;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.25);z-index:2147483647;transform-origin:bottom right;box-sizing:border-box;opacity:0;pointer-events:none;transform:translateY(16px) scale(.95);transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .25s ease}.lvb-panel.lvb-open{transform:none;opacity:1;pointer-events:auto}.lvb-panel iframe{width:100% !important;height:100% !important;max-width:none !important;max-height:none !important;border:0;display:block}.lvb-close{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:9999px;background:rgba(0,0,0,.5);color:#fff;border:0;cursor:pointer;z-index:2}';
      document.head.appendChild(style);
    }
    var tab = detail.tab || '';
    var src = popupSrc(tab);
    popupPanel.innerHTML = '<button class="lvb-close" type="button" aria-label="Close">\\u2715</button><iframe src="' + src + '" data-ss-tab="' + tab + '" allow="clipboard-write; microphone; autoplay; fullscreen" allowfullscreen></iframe>';
    document.body.appendChild(popupPanel);
    applyPopupFrameSize(popupPanel);
    var frame = popupPanel.querySelector('iframe');
    function tell() {
      try {
        if (frame && frame.contentWindow) frame.contentWindow.postMessage(popupMessage(detail), POPUP_ORIGIN);
      } catch (e) {}
    }
    if (frame) frame.addEventListener('load', tell);
    popupPanel.querySelector('.lvb-close').addEventListener('click', function () {
      popupPanel.classList.remove('lvb-open');
    });
    window.__saassuitePopupLoaded = true;
    window.SaaSSuitePopup = {
      open: function (next) { revealPopup(popupPanel, next || detail); },
      close: function () { popupPanel.classList.remove('lvb-open'); }
    };
    return true;
  }

  function openEmbed(opt) {
    var tab = tabFor(opt);
    var path = tab ? '/' + tab : '';
    var detail = { tab: tab, tabName: TAB_NAMES[tab] || '', path: path, source: 'top-nav-help' };
    var api = window.SaaSSuitePopup;
    if (api && typeof api.open === 'function') {
      try { api.open(detail); return true; } catch (e) {}
    }
    var existing = document.querySelector('.lvb-panel');
    if (existing) { revealPopup(existing, detail); return true; }
    return mountPopup(detail);
  }

  function resolveUrl(target) {
    var value = String(target || '');
    if (value.charAt(0) === '/' && value.charAt(1) !== '/') return HUB ? HUB + value : '';
    if (/^https?:\\/\\//i.test(value)) return value;
    return '';
  }

  function runOption(opt) {
    var legacyName = LEGACY[opt.id];
    var ext = window.SupportWidgetActions;
    window.dispatchEvent(new CustomEvent('support-widget:click', { detail: { action: opt.id, openMode: opt.openMode, target: opt.target } }));
    if (legacyName && ext && typeof ext[legacyName] === 'function') {
      try { ext[legacyName](); } catch (e) {}
      return;
    }
    if (opt.openMode === 'embed' && openEmbed(opt)) return;
    var url = resolveUrl(opt.target);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  document.addEventListener('click', function (e) {
    if (!isCurrent() || !isOpen) return;
    var path = e.composedPath ? e.composedPath() : [];
    if (path.indexOf(panelHost) === -1 && path.indexOf(launcherHost) === -1) setOpen(false);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!isCurrent() || !isOpen || e.key !== 'Escape') return;
    setOpen(false);
    if (launcherBtn) launcherBtn.focus();
  });
  window.addEventListener('resize', function () { if (isCurrent() && isOpen) placePanel(); });
  window.addEventListener('message', function (e) {
    if (!isCurrent()) return;
    var data = e && e.data;
    if (!data || data.type !== 'lvb-popup-preferred-size') return;
    rememberPopupSize(data, e, document.querySelector('.lvb-panel'));
  });
  window.addEventListener('scroll', function () { if (isCurrent() && isOpen) placePanel(); }, { capture: true, passive: true });

  var launcherHost = document.createElement('div');
  launcherHost.id = 'support-widget-launcher-host';
  launcherHost.setAttribute('data-ss-help-launcher', '1');
  var launcherRoot = launcherHost.attachShadow({ mode: 'open' });
  launcherRoot.innerHTML = '<style>' + LAUNCHER_CSS + '</style><button class="launch" type="button" aria-expanded="false" aria-haspopup="dialog"></button>';
  launcherBtn = launcherRoot.querySelector('.launch');
  launcherBtn.innerHTML = HELP;
  var labelEl = document.createElement('span');
  labelEl.className = 'lbl';
  labelEl.textContent = CONFIG.buttonLabel;
  launcherBtn.appendChild(labelEl);
  launcherBtn.setAttribute('aria-label', CONFIG.buttonLabel);
  launcherBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (Date.now() < suppressLauncherUntil) return;
    setOpen(!isOpen);
  });

  var IN_NAV_STYLE = 'display:inline-flex !important;align-items:center;align-self:center;vertical-align:middle;flex:0 0 auto;width:auto;max-width:220px;height:auto;margin:0 ' + CONFIG.gapPx + 'px 0 0;padding:0;position:relative;z-index:2;float:none;clear:none;line-height:0;overflow:visible;transform:none;';

  function isVisible(el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (parseFloat(cs.opacity || '1') === 0) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 16) return false;
    if (rect.bottom <= 0 || rect.top > 160) return false;
    return true;
  }

  function looksLikePlaceholder(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var cls = '';
      try { cls = String(node.className || ''); } catch (e) { cls = ''; }
      if (/placeholder|skeleton|shimmer|is-loading|hl-loader|app-loader/i.test(cls)) return true;
      if (node.getAttribute && (node.getAttribute('aria-busy') === 'true' || node.getAttribute('data-loading') === 'true')) return true;
      node = node.parentElement;
    }
    return false;
  }

  function realControlCount(slot) {
    var kids = slot.children;
    var count = 0;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid === launcherHost || kid.id === 'support-widget-launcher-host') continue;
      if (!isVisible(kid) || looksLikePlaceholder(kid)) continue;
      if (kid.matches && kid.matches('button, a, img')) { count++; continue; }
      if (kid.querySelector && kid.querySelector('button, a, img, svg, [class*="avatar"], [class*="Avatar"]')) count++;
    }
    return count;
  }

  function headerReady(slot) {
    if (!slot || looksLikePlaceholder(slot)) return false;
    var header = slot.closest ? slot.closest('.hl_header, .topmenu-nav, header') : null;
    if (header && looksLikePlaceholder(header)) return false;
    return realControlCount(slot) > 0;
  }

  function findSlot() {
    var groups = document.querySelectorAll('.hl_header .hl_header--controls, .topmenu-nav .hl_header--controls, header.hl_header .hl_header--controls');
    var best = null;
    var bestScore = -1;
    for (var n = 0; n < groups.length; n++) {
      var el = groups[n];
      if (!isVisible(el) || !headerReady(el)) continue;
      var rect = el.getBoundingClientRect();
      var score = rect.right * 100000 + rect.left;
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best;
  }

  function viewKind() {
    try {
      if (/\\/location\\//i.test(String(location.pathname || ''))) return 'sub-accounts';
    } catch (e) {}
    if (document.querySelector('.sidebar-v2-location')) return 'sub-accounts';
    if (document.querySelector('.sidebar-v2-agency')) return 'agency';
    return '';
  }

  function allowedHere() {
    var show = CONFIG.showOn || 'both';
    if (show === 'both') return true;
    var view = viewKind();
    if (!view) return false;
    return view === show;
  }

  function slotGap(slot) {
    var raw = '0';
    try { raw = window.getComputedStyle(slot).columnGap || window.getComputedStyle(slot).gap || '0'; } catch (e) {}
    var n = parseFloat(raw);
    return isFinite(n) ? n : 0;
  }

  function iconPitch(slot) {
    var gap = slotGap(slot);
    var width = 32;
    var kids = slot.children;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid === launcherHost || !isVisible(kid)) continue;
      var w = kid.getBoundingClientRect().width;
      if (w >= 16 && w <= 48) { width = w; break; }
    }
    return Math.round(Math.min(48, width + gap));
  }

  function visibleIcons(slot) {
    var list = [];
    var kids = slot.children;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid === launcherHost || !isVisible(kid)) continue;
      var w = kid.getBoundingClientRect().width;
      if (w >= 16 && w <= 64) list.push(kid);
    }
    return list;
  }

  function phoneReady(slot) {
    var nodes = slot.querySelectorAll('button, a, [role="button"], img');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el === launcherHost || (launcherHost.contains && launcherHost.contains(el))) continue;
      var text = '';
      try {
        text = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '') + ' ' +
          ((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || '')) || '');
      } catch (e) {}
      if (!/phone|dialer|softphone/i.test(text)) continue;
      if (isVisible(el) && el.getBoundingClientRect().width >= 16) return true;
    }
    return false;
  }

  // Sub-account headers add the dialer icon after the rest of the bar. Hold its
  // width until that icon is actually visible so the button does not jump left.
  function syncPhoneHold(slot) {
    var base = (CONFIG.gapPx || 0) + 'px';
    if (!slot || slot === document.body || launcherHost.getAttribute('data-compact') === '1' || viewKind() !== 'sub-accounts') {
      phoneWatch = null;
      launcherHost.style.marginRight = base;
      return;
    }
    if (!phoneWatch || phoneWatch.slot !== slot) {
      phoneWatch = { slot: slot, until: Date.now() + 6000, seen: visibleIcons(slot) };
    }
    if (phoneReady(slot)) {
      launcherHost.style.marginRight = base;
      return;
    }
    var icons = visibleIcons(slot);
    var arrived = false;
    for (var i = 0; i < icons.length; i++) {
      if (phoneWatch.seen.indexOf(icons[i]) === -1) arrived = true;
    }
    if (arrived || Date.now() > phoneWatch.until) {
      launcherHost.style.marginRight = base;
      return;
    }
    launcherHost.style.marginRight = ((CONFIG.gapPx || 0) + iconPitch(slot)) + 'px';
  }

  function alignLauncher() {
    var slot = launcherHost.parentElement;
    if (!slot || slot === document.body) return;
    launcherHost.style.transform = 'none';
    var ref = null;
    var kids = slot.children;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid === launcherHost || !isVisible(kid)) continue;
      ref = kid;
      break;
    }
    if (!ref) return;
    var refHeight = ref.getBoundingClientRect().height;
    if (launcherHost.getAttribute('data-compact') === '1') {
      if (launcherBtn) launcherBtn.style.height = '';
    } else if (refHeight >= 28 && refHeight <= 44 && launcherBtn) {
      launcherBtn.style.height = Math.round(refHeight) + 'px';
    }
    var refBox = ref.getBoundingClientRect();
    var ours = launcherHost.getBoundingClientRect();
    var delta = (refBox.top + refBox.height / 2) - (ours.top + ours.height / 2);
    if (Math.abs(delta) >= 0.5) launcherHost.style.transform = 'translateY(' + delta.toFixed(2) + 'px)';
  }

  function placeInSlot(slot) {
    var reverse = window.getComputedStyle(slot).flexDirection === 'row-reverse';
    usingFallback = false;
    launcherHost.setAttribute('style', IN_NAV_STYLE);
    if (reverse) slot.appendChild(launcherHost);
    else slot.insertBefore(launcherHost, slot.firstChild);
    fitLauncher();
  }

  function isPlaced(slot) {
    if (!slot || launcherHost.parentNode !== slot) return false;
    var reverse = window.getComputedStyle(slot).flexDirection === 'row-reverse';
    return reverse ? slot.lastElementChild === launcherHost : slot.firstElementChild === launcherHost;
  }

  function fitLauncher() {
    var header = launcherHost.closest('.hl_header, .topmenu-nav, header');
    var headerWidth = header ? header.getBoundingClientRect().width : window.innerWidth;
    var compact = window.innerWidth < 768 || (headerWidth > 0 && headerWidth < 640);
    launcherHost.setAttribute('data-compact', compact ? '1' : '0');
    launcherHost.style.maxWidth = compact ? '44px' : '220px';
    if (!launcherHost.isConnected) return;
    if (compact) { syncPhoneHold(launcherHost.parentElement); alignLauncher(); return; }
    var lb = launcherHost.getBoundingClientRect();
    var overflow = false;
    if (header) {
      var hb = header.getBoundingClientRect();
      if (lb.left < hb.left + 2 || lb.right > hb.right - 2) overflow = true;
    }
    var next = launcherHost.nextElementSibling || launcherHost.previousElementSibling;
    if (next && next !== launcherHost) {
      var nb = next.getBoundingClientRect();
      var overlapX = Math.min(lb.right, nb.right) - Math.max(lb.left, nb.left);
      var overlapY = Math.min(lb.bottom, nb.bottom) - Math.max(lb.top, nb.top);
      if (overlapX > 6 && overlapY > 6) overflow = true;
    }
    if (overflow) {
      launcherHost.setAttribute('data-compact', '1');
      launcherHost.style.maxWidth = '44px';
    }
    syncPhoneHold(launcherHost.parentElement);
    alignLauncher();
  }

  function dedupe(id, keep) {
    var nodes = document.querySelectorAll('[id="' + id + '"]');
    for (var n = 0; n < nodes.length; n++) {
      if (nodes[n] !== keep && nodes[n].parentNode) nodes[n].parentNode.removeChild(nodes[n]);
    }
  }

  function inEmbed() {
    return !!CONFIG.hideInEmbed && !findSlot();
  }

  function useFallback() {
    if (findSlot() || CONFIG.hideInEmbed || !document.body) return;
    usingFallback = true;
    launcherHost.setAttribute('style', 'position:fixed;top:12px;right:16px;z-index:2147483000;display:inline-flex');
    document.body.appendChild(launcherHost);
    fitLauncher();
  }

  function hideLauncher() {
    setOpen(false);
    if (launcherHost.isConnected) launcherHost.style.setProperty('display', 'none', 'important');
    panelHost.style.setProperty('display', 'none', 'important');
  }

  function reconcile() {
    try {
    if (!isCurrent() || !document.body) return;
    dedupe('support-widget-launcher-host', launcherHost);
    dedupe('support-widget-panel-host', panelHost);
    ensureObserver();
    if (!allowedHere()) { hideLauncher(); return; }
    if (inEmbed()) {
      setOpen(false);
      if (launcherHost.isConnected) launcherHost.style.setProperty('display', 'none', 'important');
      panelHost.style.setProperty('display', 'none', 'important');
      return;
    }
    panelHost.style.removeProperty('display');
    if (!panelHost.isConnected) document.body.appendChild(panelHost);
    var slot = findSlot();
    var hidden = launcherHost.style.getPropertyValue('display') === 'none';
    if (slot) {
      if (!isPlaced(slot) || hidden) placeInSlot(slot);
      else fitLauncher();
    } else if (launcherHost.isConnected && launcherHost.parentElement !== document.body) {
      launcherHost.style.setProperty('display', 'none', 'important');
    }
    if (isOpen) placePanel();
    } catch (e) {}
  }

  function ensureObserver() {
    if (!document.body) return;
    if (!observer) {
      observer = new MutationObserver(function (mutations) {
        if (!isCurrent()) { observer.disconnect(); return; }
        for (var n = 0; n < mutations.length; n++) {
          var target = mutations[n].target;
          if (target === launcherHost || target === panelHost) continue;
          if (launcherHost.contains && launcherHost.contains(target)) continue;
          if (panelHost.contains && panelHost.contains(target)) continue;
          schedule();
          return;
        }
      });
    }
    if (observedBody === document.body) return;
    observer.disconnect();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
    observedBody = document.body;
  }

  var queued = false;
  function schedule() {
    if (!isCurrent() || queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      reconcile();
    });
  }

  function start() {
    try {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', start);
      return;
    }
    reconcile();
    ensureObserver();
    window.addEventListener('resize', schedule);
    window.addEventListener('popstate', schedule);
    timer = setInterval(function () {
      if (!isCurrent()) { clearInterval(timer); return; }
      reconcile();
    }, 1000);
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();`;

  return (
    src
      .replace("__LABEL__", JSON.stringify(safeLabel))
      .replace("__TITLE__", JSON.stringify(stored.title))
      .replace("__SUBTITLE__", JSON.stringify(stored.subtitle))
      .replace("__SHOW__", JSON.stringify(stored.showOn))
      .replace("__COLOR__", JSON.stringify(button))
      .replace("__ICON__", icon)
      .replace("__TILE__", tile)
      .replace("__HIDE__", JSON.stringify(!!opts.hideInEmbed))
      .replace("__OPTIONS__", JSON.stringify(options))
      .replace("__ICONS__", JSON.stringify(topNavWidgetIconMap(tile)))
      .replace("__HELP__", JSON.stringify(helpIcon))
      .replace("__HUB__", JSON.stringify(hub))
      .replace("__AGENCY__", JSON.stringify(agencyId))
      .replace("__ORIGIN__", JSON.stringify(POPUP_ORIGIN))
      .replace("__POPUP_SIZE__", () => popupFrameRuntimeJS())
      .replace("__HOST_USER__", () => popupHostUserRuntimeJS()) + "\n\n"
  );
}
