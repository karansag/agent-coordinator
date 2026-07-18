//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
//#endregion
//#region node_modules/preact/dist/preact.module.js
var n$1;
var l$1;
var u$1;
var i$1;
var r$1;
var o$1;
var e$1;
var f$1;
var c$1;
var a$1;
var s$1;
var h$1;
var p$1;
var v$1;
var d$1 = {};
var w$1 = [];
var _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var g = Array.isArray;
function m$2(n, l) {
	for (var u in l) n[u] = l[u];
	return n;
}
function b(n) {
	n && n.parentNode && n.parentNode.removeChild(n);
}
function k$1(l, u, t) {
	var i, r, o, e = {};
	for (o in u) "key" == o ? i = u[o] : "ref" == o ? r = u[o] : e[o] = u[o];
	if (arguments.length > 2 && (e.children = arguments.length > 3 ? n$1.call(arguments, 2) : t), "function" == typeof l && null != l.defaultProps) for (o in l.defaultProps) void 0 === e[o] && (e[o] = l.defaultProps[o]);
	return x(l, e, i, r, null);
}
function x(n, t, i, r, o) {
	var e = {
		type: n,
		props: t,
		key: i,
		ref: r,
		__k: null,
		__: null,
		__b: 0,
		__e: null,
		__c: null,
		constructor: void 0,
		__v: null == o ? ++u$1 : o,
		__i: -1,
		__u: 0
	};
	return null == o && null != l$1.vnode && l$1.vnode(e), e;
}
function S(n) {
	return n.children;
}
function C$1(n, l) {
	this.props = n, this.context = l;
}
function $(n, l) {
	if (null == l) return n.__ ? $(n.__, n.__i + 1) : null;
	for (var u; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) return u.__e;
	return "function" == typeof n.type ? $(n) : null;
}
function I(n) {
	if (n.__P && n.__d) {
		var u = n.__v, t = u.__e, i = [], r = [], o = m$2({}, u);
		o.__v = u.__v + 1, l$1.vnode && l$1.vnode(o), q(n.__P, o, u, n.__n, n.__P.namespaceURI, 32 & u.__u ? [t] : null, i, null == t ? $(u) : t, !!(32 & u.__u), r), o.__v = u.__v, o.__.__k[o.__i] = o, D$1(i, o, r), u.__e = u.__ = null, o.__e != t && P(o);
	}
}
function P(n) {
	if (null != (n = n.__) && null != n.__c) return n.__e = n.__c.base = null, n.__k.some(function(l) {
		if (null != l && null != l.__e) return n.__e = n.__c.base = l.__e;
	}), P(n);
}
function A$1(n) {
	(!n.__d && (n.__d = !0) && i$1.push(n) && !H.__r++ || r$1 != l$1.debounceRendering) && ((r$1 = l$1.debounceRendering) || o$1)(H);
}
function H() {
	try {
		for (var n, l = 1; i$1.length;) i$1.length > l && i$1.sort(e$1), n = i$1.shift(), l = i$1.length, I(n);
	} finally {
		i$1.length = H.__r = 0;
	}
}
function L(n, l, u, t, i, r, o, e, f, c, a) {
	var s, h, p, v, y, _, g, m = t && t.__k || w$1, b = l.length;
	for (f = T$1(u, l, m, f, b), s = 0; s < b; s++) null != (p = u.__k[s]) && (h = -1 != p.__i && m[p.__i] || d$1, p.__i = s, _ = q(n, p, h, i, r, o, e, f, c, a), v = p.__e, p.ref && h.ref != p.ref && (h.ref && J(h.ref, null, p), a.push(p.ref, p.__c || v, p)), null == y && null != v && (y = v), (g = !!(4 & p.__u)) || h.__k === p.__k ? (f = j$1(p, f, n, g), g && h.__e && (h.__e = null)) : "function" == typeof p.type && void 0 !== _ ? f = _ : v && (f = v.nextSibling), p.__u &= -7);
	return u.__e = y, f;
}
function T$1(n, l, u, t, i) {
	var r, o, e, f, c, a = u.length, s = a, h = 0;
	for (n.__k = new Array(i), r = 0; r < i; r++) null != (o = l[r]) && "boolean" != typeof o && "function" != typeof o ? ("string" == typeof o || "number" == typeof o || "bigint" == typeof o || o.constructor == String ? o = n.__k[r] = x(null, o, null, null, null) : g(o) ? o = n.__k[r] = x(S, { children: o }, null, null, null) : void 0 === o.constructor && o.__b > 0 ? o = n.__k[r] = x(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v) : n.__k[r] = o, f = r + h, o.__ = n, o.__b = n.__b + 1, e = null, -1 != (c = o.__i = O(o, u, f, s)) && (s--, (e = u[c]) && (e.__u |= 2)), null == e || null == e.__v ? (-1 == c && (i > a ? h-- : i < a && h++), "function" != typeof o.type && (o.__u |= 4)) : c != f && (c == f - 1 ? h-- : c == f + 1 ? h++ : (c > f ? h-- : h++, o.__u |= 4))) : n.__k[r] = null;
	if (s) for (r = 0; r < a; r++) null != (e = u[r]) && 0 == (2 & e.__u) && (e.__e == t && (t = $(e)), K(e, e));
	return t;
}
function j$1(n, l, u, t) {
	var i, r;
	if ("function" == typeof n.type) {
		for (i = n.__k, r = 0; i && r < i.length; r++) i[r] && (i[r].__ = n, l = j$1(i[r], l, u, t));
		return l;
	}
	n.__e != l && (t && (l && n.type && !l.parentNode && (l = $(n)), u.insertBefore(n.__e, l || null)), l = n.__e);
	do
		l = l && l.nextSibling;
	while (null != l && 8 == l.nodeType);
	return l;
}
function O(n, l, u, t) {
	var i, r, o, e = n.key, f = n.type, c = l[u], a = null != c && 0 == (2 & c.__u);
	if (null === c && null == e || a && e == c.key && f == c.type) return u;
	if (t > (a ? 1 : 0)) {
		for (i = u - 1, r = u + 1; i >= 0 || r < l.length;) if (null != (c = l[o = i >= 0 ? i-- : r++]) && 0 == (2 & c.__u) && e == c.key && f == c.type) return o;
	}
	return -1;
}
function z$1(n, l, u) {
	"-" == l[0] ? n.setProperty(l, null == u ? "" : u) : n[l] = null == u ? "" : "number" != typeof u || _.test(l) ? u : u + "px";
}
function N(n, l, u, t, i) {
	var r, o;
	n: if ("style" == l) if ("string" == typeof u) n.style.cssText = u;
	else {
		if ("string" == typeof t && (n.style.cssText = t = ""), t) for (l in t) u && l in u || z$1(n.style, l, "");
		if (u) for (l in u) t && u[l] == t[l] || z$1(n.style, l, u[l]);
	}
	else if ("o" == l[0] && "n" == l[1]) r = l != (l = l.replace(s$1, "$1")), o = l.toLowerCase(), l = o in n || "onFocusOut" == l || "onFocusIn" == l ? o.slice(2) : l.slice(2), n.l || (n.l = {}), n.l[l + r] = u, u ? t ? u[a$1] = t[a$1] : (u[a$1] = h$1, n.addEventListener(l, r ? v$1 : p$1, r)) : n.removeEventListener(l, r ? v$1 : p$1, r);
	else {
		if ("http://www.w3.org/2000/svg" == i) l = l.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
		else if ("width" != l && "height" != l && "href" != l && "list" != l && "form" != l && "tabIndex" != l && "download" != l && "rowSpan" != l && "colSpan" != l && "role" != l && "popover" != l && l in n) try {
			n[l] = null == u ? "" : u;
			break n;
		} catch (n) {}
		"function" == typeof u || (null == u || !1 === u && "-" != l[4] ? n.removeAttribute(l) : n.setAttribute(l, "popover" == l && 1 == u ? "" : u));
	}
}
function V(n) {
	return function(u) {
		if (this.l) {
			var t = this.l[u.type + n];
			if (null == u[c$1]) u[c$1] = h$1++;
			else if (u[c$1] < t[a$1]) return;
			return t(l$1.event ? l$1.event(u) : u);
		}
	};
}
function q(n, u, t, i, r, o, e, f, c, a) {
	var s, h, p, v, y, d, _, k, x, M, $, I, P, A, H, T, j = u.type;
	if (void 0 !== u.constructor) return null;
	128 & t.__u && (c = !!(32 & t.__u), o = [f = u.__e = t.__e]), (s = l$1.__b) && s(u);
	n: if ("function" == typeof j) {
		h = e.length;
		try {
			if (x = u.props, M = j.prototype && j.prototype.render, $ = (s = j.contextType) && i[s.__c], I = s ? $ ? $.props.value : s.__ : i, t.__c ? k = (p = u.__c = t.__c).__ = p.__E : (M ? u.__c = p = new j(x, I) : (u.__c = p = new C$1(x, I), p.constructor = j, p.render = Q), $ && $.sub(p), p.state || (p.state = {}), p.__n = i, v = p.__d = !0, p.__h = [], p._sb = []), M && null == p.__s && (p.__s = p.state), M && null != j.getDerivedStateFromProps && (p.__s == p.state && (p.__s = m$2({}, p.__s)), m$2(p.__s, j.getDerivedStateFromProps(x, p.__s))), y = p.props, d = p.state, p.__v = u, v) M && null == j.getDerivedStateFromProps && null != p.componentWillMount && p.componentWillMount(), M && null != p.componentDidMount && p.__h.push(p.componentDidMount);
			else {
				if (M && null == j.getDerivedStateFromProps && x !== y && null != p.componentWillReceiveProps && p.componentWillReceiveProps(x, I), u.__v == t.__v || !p.__e && null != p.shouldComponentUpdate && !1 === p.shouldComponentUpdate(x, p.__s, I)) {
					u.__v != t.__v && (p.props = x, p.state = p.__s, p.__d = !1), u.__e = t.__e, u.__k = t.__k, u.__k.some(function(n) {
						n && (n.__ = u);
					}), w$1.push.apply(p.__h, p._sb), p._sb = [], p.__h.length && e.push(p);
					break n;
				}
				null != p.componentWillUpdate && p.componentWillUpdate(x, p.__s, I), M && null != p.componentDidUpdate && p.__h.push(function() {
					p.componentDidUpdate(y, d, _);
				});
			}
			if (p.context = I, p.props = x, p.__P = n, p.__e = !1, P = l$1.__r, A = 0, M) p.state = p.__s, p.__d = !1, P && P(u), s = p.render(p.props, p.state, p.context), w$1.push.apply(p.__h, p._sb), p._sb = [];
			else do
				p.__d = !1, P && P(u), s = p.render(p.props, p.state, p.context), p.state = p.__s;
			while (p.__d && ++A < 25);
			p.state = p.__s, null != p.getChildContext && (i = m$2(m$2({}, i), p.getChildContext())), M && !v && null != p.getSnapshotBeforeUpdate && (_ = p.getSnapshotBeforeUpdate(y, d)), H = null != s && s.type === S && null == s.key ? E(s.props.children) : s, f = L(n, g(H) ? H : [H], u, t, i, r, o, e, f, c, a), p.base = u.__e, u.__u &= -161, p.__h.length && e.push(p), k && (p.__E = p.__ = null);
		} catch (n) {
			if (e.length = h, u.__v = null, c || null != o) {
				if (n.then) {
					for (u.__u |= c ? 160 : 128; f && 8 == f.nodeType && f.nextSibling;) f = f.nextSibling;
					null != o && (o[o.indexOf(f)] = null), u.__e = f;
				} else if (null != o) for (T = o.length; T--;) b(o[T]);
			} else u.__e = t.__e;
			u.__k ??= t.__k || [], n.then || B$1(u), l$1.__e(n, u, t);
		}
	} else null == o && u.__v == t.__v ? (u.__k = t.__k, u.__e = t.__e) : f = u.__e = G(t.__e, u, t, i, r, o, e, c, a);
	return (s = l$1.diffed) && s(u), 128 & u.__u ? void 0 : f;
}
function B$1(n) {
	n && (n.__c && (n.__c.__e = !0), n.__k && n.__k.some(B$1));
}
function D$1(n, u, t) {
	for (var i = 0; i < t.length; i++) J(t[i], t[++i], t[++i]);
	l$1.__c && l$1.__c(u, n), n.some(function(u) {
		try {
			n = u.__h, u.__h = [], n.some(function(n) {
				n.call(u);
			});
		} catch (n) {
			l$1.__e(n, u.__v);
		}
	});
}
function E(n) {
	return "object" != typeof n || null == n || n.__b > 0 ? n : g(n) ? n.map(E) : void 0 !== n.constructor ? null : m$2({}, n);
}
function G(u, t, i, r, o, e, f, c, a) {
	var s, h, p, v, y, w, _, m = i.props || d$1, k = t.props, x = t.type;
	if ("svg" == x ? o = "http://www.w3.org/2000/svg" : "math" == x ? o = "http://www.w3.org/1998/Math/MathML" : o || (o = "http://www.w3.org/1999/xhtml"), null != e) {
		for (s = 0; s < e.length; s++) if ((y = e[s]) && "setAttribute" in y == !!x && (x ? y.localName == x : 3 == y.nodeType)) {
			u = y, e[s] = null;
			break;
		}
	}
	if (null == u) {
		if (null == x) return document.createTextNode(k);
		u = document.createElementNS(o, x, k.is && k), c && (l$1.__m && l$1.__m(t, e), c = !1), e = null;
	}
	if (null == x) m === k || c && u.data == k || (u.data = k);
	else {
		if (e = "textarea" == x && null != k.defaultValue ? null : e && n$1.call(u.childNodes), !c && null != e) for (m = {}, s = 0; s < u.attributes.length; s++) m[(y = u.attributes[s]).name] = y.value;
		for (s in m) y = m[s], "dangerouslySetInnerHTML" == s ? p = y : "children" == s || s in k || "value" == s && "defaultValue" in k || "checked" == s && "defaultChecked" in k || N(u, s, null, y, o);
		for (s in k) y = k[s], "children" == s ? v = y : "dangerouslySetInnerHTML" == s ? h = y : "value" == s ? w = y : "checked" == s ? _ = y : c && "function" != typeof y || m[s] === y || N(u, s, y, m[s], o);
		if (h) c || p && (h.__html == p.__html || h.__html == u.innerHTML) || (u.innerHTML = h.__html), t.__k = [];
		else if (p && (u.innerHTML = ""), L("template" == t.type ? u.content : u, g(v) ? v : [v], t, i, r, "foreignObject" == x ? "http://www.w3.org/1999/xhtml" : o, e, f, e ? e[0] : i.__k && $(i, 0), c, a), null != e) for (s = e.length; s--;) b(e[s]);
		c && "textarea" != x || (s = "value", "progress" == x && null == w ? u.removeAttribute("value") : null != w && (w !== u[s] || "progress" == x && !w || "option" == x && w != m[s]) && N(u, s, w, m[s], o), s = "checked", null != _ && _ != u[s] && N(u, s, _, m[s], o));
	}
	return u;
}
function J(n, u, t) {
	try {
		if ("function" == typeof n) {
			var i = "function" == typeof n.__u;
			i && n.__u(), i && null == u || (n.__u = n(u));
		} else n.current = u;
	} catch (n) {
		l$1.__e(n, t);
	}
}
function K(n, u, t) {
	var i, r;
	if (l$1.unmount && l$1.unmount(n), (i = n.ref) && (i.current && i.current != n.__e || J(i, null, u)), null != (i = n.__c)) {
		if (i.componentWillUnmount) try {
			i.componentWillUnmount();
		} catch (n) {
			l$1.__e(n, u);
		}
		i.base = i.__P = i.__n = null;
	}
	if (i = n.__k) for (r = 0; r < i.length; r++) i[r] && K(i[r], u, t || "function" != typeof n.type);
	t || b(n.__e), n.__c = n.__ = n.__e = void 0;
}
function Q(n, l, u) {
	return this.constructor(n, u);
}
function R(u, t, i) {
	var r, o, e, f;
	t == document && (t = document.documentElement), l$1.__ && l$1.__(u, t), o = (r = "function" == typeof i) ? null : i && i.__k || t.__k, e = [], f = [], q(t, u = (!r && i || t).__k = k$1(S, null, [u]), o || d$1, d$1, t.namespaceURI, !r && i ? [i] : o ? null : t.firstChild ? n$1.call(t.childNodes) : null, e, !r && i ? i : o ? o.__e : t.firstChild, r, f), D$1(e, u, f), u.props.children = null;
}
n$1 = w$1.slice, l$1 = { __e: function(n, l, u, t) {
	for (var i, r, o; l = l.__;) if ((i = l.__c) && !i.__) try {
		if ((r = i.constructor) && null != r.getDerivedStateFromError && (i.setState(r.getDerivedStateFromError(n)), o = i.__d), null != i.componentDidCatch && (i.componentDidCatch(n, t || {}), o = i.__d), o) return i.__E = i;
	} catch (l) {
		n = l;
	}
	throw n;
} }, u$1 = 0, C$1.prototype.setState = function(n, l) {
	var u = null != this.__s && this.__s != this.state ? this.__s : this.__s = m$2({}, this.state);
	"function" == typeof n && (n = n(m$2({}, u), this.props)), n && m$2(u, n), null != n && this.__v && (l && this._sb.push(l), A$1(this));
}, C$1.prototype.forceUpdate = function(n) {
	this.__v && (this.__e = !0, n && this.__h.push(n), A$1(this));
}, C$1.prototype.render = S, i$1 = [], o$1 = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e$1 = function(n, l) {
	return n.__v.__b - l.__v.__b;
}, H.__r = 0, f$1 = Math.random().toString(8), c$1 = "__d" + f$1, a$1 = "__a" + f$1, s$1 = /(PointerCapture)$|Capture$/i, h$1 = 0, p$1 = V(!1), v$1 = V(!0);
//#endregion
//#region node_modules/htm/dist/htm.module.js
var n = function(t, s, r, e) {
	var u;
	s[0] = 0;
	for (var h = 1; h < s.length; h++) {
		var p = s[h++], a = s[h] ? (s[0] |= p ? 1 : 2, r[s[h++]]) : s[++h];
		3 === p ? e[0] = a : 4 === p ? e[1] = Object.assign(e[1] || {}, a) : 5 === p ? (e[1] = e[1] || {})[s[++h]] = a : 6 === p ? e[1][s[++h]] += a + "" : p ? (u = t.apply(a, n(t, a, r, ["", null])), e.push(u), a[0] ? s[0] |= 2 : (s[h - 2] = 0, s[h] = u)) : e.push(a);
	}
	return e;
};
var t$1 = /* @__PURE__ */ new Map();
function htm_module_default(s) {
	var r = t$1.get(this);
	return r || (r = /* @__PURE__ */ new Map(), t$1.set(this, r)), (r = n(this, r.get(s) || (r.set(s, r = function(n) {
		for (var t, s, r = 1, e = "", u = "", h = [0], p = function(n) {
			1 === r && (n || (e = e.replace(/^\s*\n\s*|\s*\n\s*$/g, ""))) ? h.push(0, n, e) : 3 === r && (n || e) ? (h.push(3, n, e), r = 2) : 2 === r && "..." === e && n ? h.push(4, n, 0) : 2 === r && e && !n ? h.push(5, 0, !0, e) : r >= 5 && ((e || !n && 5 === r) && (h.push(r, 0, e, s), r = 6), n && (h.push(r, n, 0, s), r = 6)), e = "";
		}, a = 0; a < n.length; a++) {
			a && (1 === r && p(), p(a));
			for (var l = 0; l < n[a].length; l++) t = n[a][l], 1 === r ? "<" === t ? (p(), h = [h], r = 3) : e += t : 4 === r ? "--" === e && ">" === t ? (r = 1, e = "") : e = t + e[0] : u ? t === u ? u = "" : e += t : "\"" === t || "'" === t ? u = t : ">" === t ? (p(), r = 1) : r && ("=" === t ? (r = 5, s = e, e = "") : "/" === t && (r < 5 || ">" === n[a][l + 1]) ? (p(), 3 === r && (h = h[0]), r = h, (h = h[0]).push(2, 0, r), r = 0) : " " === t || "	" === t || "\n" === t || "\r" === t ? (p(), r = 2) : e += t), 3 === r && "!--" === e && (r = 4, h = h[0]);
		}
		return p(), h;
	}(s)), r), arguments, [])).length > 1 ? r : r[0];
}
//#endregion
//#region node_modules/htm/preact/index.module.js
var m$1 = htm_module_default.bind(k$1);
//#endregion
//#region node_modules/preact/hooks/dist/hooks.module.js
var t;
var r;
var u;
var i;
var o = 0;
var f = [];
var c = l$1;
var e = c.__b;
var a = c.__r;
var v = c.diffed;
var l = c.__c;
var m = c.unmount;
var p = c.__;
function s(n, t) {
	c.__h && c.__h(r, n, o || t), o = 0;
	var u = r.__H || (r.__H = {
		__: [],
		__h: []
	});
	return n >= u.__.length && u.__.push({}), u.__[n];
}
function d(n) {
	return o = 1, y(D, n);
}
function y(n, u, i) {
	var o = s(t++, 2);
	if (o.t = n, !o.__c && (o.__ = [i ? i(u) : D(void 0, u), function(n) {
		var t = o.__N ? o.__N[0] : o.__[0], r = o.t(t, n);
		t !== r && (o.__N = [r, o.__[1]], o.__c.setState({}));
	}], o.__c = r, !r.__f)) {
		var f = function(n, t, r) {
			if (!o.__c.__H) return !0;
			var u = !1, i = o.__c.props !== n;
			if (o.__c.__H.__.some(function(n) {
				if (n.__N) {
					u = !0;
					var t = n.__[0];
					n.__ = n.__N, n.__N = void 0, t !== n.__[0] && (i = !0);
				}
			}), c) {
				var f = c.call(this, n, t, r);
				return u ? f || i : f;
			}
			return !u || i;
		};
		r.__f = !0;
		var c = r.shouldComponentUpdate, e = r.componentWillUpdate;
		r.componentWillUpdate = function(n, t, r) {
			if (this.__e) {
				var u = c;
				c = void 0, f(n, t, r), c = u;
			}
			e && e.call(this, n, t, r);
		}, r.shouldComponentUpdate = f;
	}
	return o.__N || o.__;
}
function h(n, u) {
	var i = s(t++, 3);
	!c.__s && C(i.__H, u) && (i.__ = n, i.u = u, r.__H.__h.push(i));
}
function A(n) {
	return o = 5, T(function() {
		return { current: n };
	}, []);
}
function T(n, r) {
	var u = s(t++, 7);
	return C(u.__H, r) && (u.__ = n(), u.__H = r, u.__h = n), u.__;
}
function j() {
	for (var n; n = f.shift();) {
		var t = n.__H;
		if (n.__P && t) try {
			t.__h.some(z), t.__h.some(B), t.__h = [];
		} catch (r) {
			t.__h = [], c.__e(r, n.__v);
		}
	}
}
c.__b = function(n) {
	r = null, e && e(n);
}, c.__ = function(n, t) {
	n && t.__k && t.__k.__m && (n.__m = t.__k.__m), p && p(n, t);
}, c.__r = function(n) {
	a && a(n), t = 0;
	var i = (r = n.__c).__H;
	i && (u === r ? (i.__h = [], r.__h = [], i.__.some(function(n) {
		n.__N && (n.__ = n.__N), n.u = n.__N = void 0;
	})) : (i.__h.some(z), i.__h.some(B), i.__h = [], t = 0)), u = r;
}, c.diffed = function(n) {
	v && v(n);
	var t = n.__c;
	t && t.__H && (t.__H.__h.length && (1 !== f.push(t) && i === c.requestAnimationFrame || ((i = c.requestAnimationFrame) || w)(j)), t.__H.__.some(function(n) {
		n.u && (n.__H = n.u, n.u = void 0);
	})), u = r = null;
}, c.__c = function(n, t) {
	t.some(function(n) {
		try {
			n.__h.some(z), n.__h = n.__h.filter(function(n) {
				return !n.__ || B(n);
			});
		} catch (r) {
			t.some(function(n) {
				n.__h && (n.__h = []);
			}), t = [], c.__e(r, n.__v);
		}
	}), l && l(n, t);
}, c.unmount = function(n) {
	m && m(n);
	var t, r = n.__c;
	r && r.__H && (r.__H.__.some(function(n) {
		try {
			z(n);
		} catch (n) {
			t = n;
		}
	}), r.__H = void 0, t && c.__e(t, r.__v));
};
var k = "function" == typeof requestAnimationFrame;
function w(n) {
	var t, r = function() {
		clearTimeout(u), k && cancelAnimationFrame(t), setTimeout(n);
	}, u = setTimeout(r, 35);
	k && (t = requestAnimationFrame(r));
}
function z(n) {
	var t = r, u = n.__c;
	"function" == typeof u && (n.__c = void 0, u()), r = t;
}
function B(n) {
	var t = r;
	n.__c = n.__(), r = t;
}
function C(n, t) {
	return !n || n.length !== t.length || t.some(function(t, r) {
		return t !== n[r];
	});
}
function D(n, t) {
	return "function" == typeof t ? t(n) : t;
}
//#endregion
//#region web/src/shared.js
var POLL_MS = 2e3;
var PEEK_MS = 2e3;
var JSONH = { "content-type": "application/json" };
var FLAVOR_ICON = {
	claude: "✳",
	codex: "◇",
	pi: "π",
	hermes: "☿",
	generic: "▪"
};
var STATE = {
	working: {
		cls: "working",
		word: "working",
		color: "var(--state-working)"
	},
	needs_attention: {
		cls: "attention",
		word: "needs attention",
		color: "var(--state-attention)"
	},
	idle: {
		cls: "idle",
		word: "idle",
		color: "var(--state-idle)"
	},
	unknown: {
		cls: "unknown",
		word: "unknown",
		color: "var(--state-unknown)"
	},
	stopped: {
		cls: "stopped",
		word: "stopped",
		color: "var(--state-stopped)"
	}
};
function agentStatus(r) {
	if (!r.pane_alive) return "stopped";
	const s = r.activity && r.activity.status;
	if (s && s !== "unknown") return s;
	return "unknown";
}
var ANIMAL_EMOJI = {
	otter: "🦦",
	badger: "🦡",
	panda: "🐼",
	raccoon: "🦝",
	hedgehog: "🦔",
	viper: "🐍",
	gecko: "🦎",
	newt: "🦎",
	salamander: "🦎",
	capybara: "🦫",
	manatee: "🦭",
	lemur: "🐒",
	kestrel: "🦅",
	magpie: "🐦‍⬛",
	ibis: "🦩",
	heron: "🪿",
	puffin: "🐧",
	narwhal: "🐳",
	axolotl: "🐟",
	quokka: "🐨",
	wombat: "🐨",
	dormouse: "🐁",
	shrew: "🐁",
	fennec: "🦊",
	mongoose: "🦦",
	stoat: "🦦",
	marten: "🦦",
	ferret: "🦦",
	ocelot: "🐆",
	pangolin: "🦎",
	tapir: "🐗",
	civet: "🐱"
};
function hue(name) {
	let h = 0;
	for (const c of name) h = (h * 31 + c.codePointAt(0)) % 360;
	return h;
}
function rel(ts, now) {
	const d = Math.max(0, now - ts);
	if (d < 50) return "just now";
	if (d < 3600) return `${Math.round(d / 60)}m ago`;
	if (d < 86400) return `${Math.round(d / 3600)}h ago`;
	return `${Math.round(d / 86400)}d ago`;
}
function currentTask(tasks, user) {
	const mine = (tasks || []).filter((t) => t.assignee === user && t.status !== "done");
	if (!mine.length) return null;
	const picked = mine.filter((t) => t.status === "picked_up");
	return (picked.length ? picked : mine).sort((a, b) => b.updated_at - a.updated_at)[0];
}
function pairKey(a, b) {
	return [a, b].sort().join(" ");
}
var disp = (u) => u === "owner" ? m$1`<span class="owner-name">owner</span>` : u;
var focusHash = (u) => `#/agent/${encodeURIComponent(u)}`;
async function patchTask(id, patch) {
	await fetch(`/tasks/${id}`, {
		method: "PATCH",
		headers: JSONH,
		body: JSON.stringify(patch)
	});
}
//#endregion
//#region web/src/hive.js
function HiveView({ state, refresh }) {
	const canvasRef = A(null);
	const stateRef = A(state);
	const beesRef = A(/* @__PURE__ */ new Map());
	const streaksRef = A([]);
	const pendingRef = A([]);
	const lastSeenRef = A(null);
	const hoverRef = A(null);
	const taskHoverRef = A(null);
	const taskCellsRef = A([]);
	const taskStatusesRef = A(null);
	const pendingShipmentsRef = A([]);
	const shipmentsRef = A([]);
	const dragTaskRef = A(null);
	const dragBeeRef = A(null);
	const dragPointRef = A(null);
	const dropTargetRef = A(null);
	const dropTeamRef = A(null);
	const dragBoxRef = A(null);
	const teamBoxesRef = A([]);
	const drawRef = A(null);
	const [dropStatus, setDropStatus] = d("");
	stateRef.current = state;
	const messages = state.messages || [];
	const maxId = Math.max(0, ...messages.map((m) => m.id));
	if (lastSeenRef.current === null) lastSeenRef.current = maxId;
	else if (maxId > lastSeenRef.current) {
		pendingRef.current.push(...messages.filter((m) => m.id > lastSeenRef.current).slice(-8));
		lastSeenRef.current = maxId;
	}
	const taskSnapshot = new Map((state.tasks || []).map((t) => [t.id, t]));
	if (taskStatusesRef.current === null) taskStatusesRef.current = taskSnapshot;
	else {
		for (const task of state.tasks || []) {
			const before = taskStatusesRef.current.get(task.id);
			if (before && before.status !== "done" && task.status === "done") pendingShipmentsRef.current.push(task);
		}
		taskStatusesRef.current = taskSnapshot;
	}
	h(() => {
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
		let frame = 0;
		let cssWidth = 0;
		let lastDraw = 0;
		const POS_KEY = "agent-msg-hive-team-pos";
		const teamPos = /* @__PURE__ */ new Map();
		try {
			for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(POS_KEY) || "{}"))) if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) teamPos.set(Number(k), {
				x: v.x,
				y: v.y
			});
		} catch {}
		const savePos = () => {
			const known = new Set((stateRef.current.teams || []).map((t) => t.id));
			const obj = {};
			for (const [id, p] of teamPos) if (known.has(id)) obj[id] = {
				x: Math.round(p.x),
				y: Math.round(p.y)
			};
			try {
				localStorage.setItem(POS_KEY, JSON.stringify(obj));
			} catch {}
		};
		const hex = (x, y, radius, fill, stroke) => {
			ctx.beginPath();
			for (let i = 0; i < 6; i++) {
				const a = i * Math.PI / 3;
				const px = x + Math.cos(a) * radius;
				const py = y + Math.sin(a) * radius;
				i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
			}
			ctx.closePath();
			ctx.fillStyle = fill;
			ctx.fill();
			ctx.strokeStyle = stroke;
			ctx.lineWidth = 1;
			ctx.stroke();
		};
		const token = (task, x, y) => {
			hex(x, y, 8, "rgba(242,169,59,.15)", "#b97f27");
			ctx.fillStyle = "#f2a93b";
			ctx.font = "8px ui-monospace, monospace";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(`#${task.id}`, x, y + .5);
		};
		const ensureSize = () => {
			const width = Math.max(1, canvas.clientWidth);
			const dpr = devicePixelRatio || 1;
			if (width !== cssWidth || canvas.width !== Math.round(width * dpr)) {
				cssWidth = width;
				canvas.width = Math.round(width * dpr);
				canvas.height = Math.round(260 * dpr);
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			return width;
		};
		const point = (a, b, c, u) => {
			const v = 1 - u;
			return {
				x: v * v * a.x + 2 * v * u * c.x + u * u * b.x,
				y: v * v * a.y + 2 * v * u * c.y + u * u * b.y
			};
		};
		const draw = (now, still = false) => {
			const width = ensureSize();
			const data = stateRef.current;
			const running = (data.recipients || []).filter((r) => r.pane_alive);
			const live = new Set(running.map((r) => r.user_id));
			const bees = beesRef.current;
			for (const name of bees.keys()) if (!live.has(name)) bees.delete(name);
			ctx.clearRect(0, 0, width, 260);
			const center = {
				x: width / 2,
				y: 118
			};
			const ownerNode = {
				x: width / 2,
				y: 235
			};
			const done = (data.tasks || []).filter((t) => t.status === "done").length;
			const doneX = width - 28;
			hex(doneX - 7, 34, 11, "rgba(143,191,111,.07)", "#567546");
			hex(doneX, 28, 14, "rgba(143,191,111,.15)", "#8fbf6f");
			ctx.fillStyle = "#8fbf6f";
			ctx.textAlign = "right";
			ctx.textBaseline = "middle";
			ctx.fillText(`shipped · ${done}`, doneX - 24, 28);
			const teamsList = data.teams || [];
			const teamById = new Map(teamsList.map((t) => [t.id, t]));
			const teamColor = (name, alpha) => `hsl(${hue(name)} 45% 62% / ${alpha})`;
			const grouped = [...running].sort((a, b) => (a.team_id && teamById.has(a.team_id) ? a.team_id : 1e9) - (b.team_id && teamById.has(b.team_id) ? b.team_id : 1e9));
			const positioned = new Set([...teamPos.keys()].filter((id) => teamById.has(id)));
			const posOf = (id) => {
				const p = teamPos.get(id);
				return {
					x: Math.max(56, Math.min(width - 56, p.x)),
					y: Math.max(58, Math.min(202, p.y))
				};
			};
			const clusterCount = /* @__PURE__ */ new Map();
			for (const r of grouped) if (r.team_id && positioned.has(r.team_id)) clusterCount.set(r.team_id, (clusterCount.get(r.team_id) || 0) + 1);
			const looseList = grouped.filter((r) => !(r.team_id && positioned.has(r.team_id)));
			const looseIndex = new Map(looseList.map((r, i) => [r.user_id, i]));
			const clusterSeen = /* @__PURE__ */ new Map();
			const homes = grouped.map((r) => {
				if (r.team_id && positioned.has(r.team_id)) {
					const pos = posOf(r.team_id);
					const count = clusterCount.get(r.team_id);
					const j = clusterSeen.get(r.team_id) || 0;
					clusterSeen.set(r.team_id, j + 1);
					const cols = Math.min(3, count);
					const rows = Math.ceil(count / cols);
					const row = Math.floor(j / cols);
					const inRow = row === rows - 1 ? count - row * cols : cols;
					return {
						x: pos.x + (j % cols - (inRow - 1) / 2) * 58,
						y: pos.y + (row - (rows - 1) / 2) * 46
					};
				}
				const i = looseIndex.get(r.user_id);
				const angle = Math.PI + i / Math.max(1, looseList.length) * Math.PI * 2;
				return {
					x: center.x + Math.cos(angle) * Math.min(width * .36, 330),
					y: 132 + Math.sin(angle) * 67
				};
			});
			teamBoxesRef.current = [];
			{
				const bounds = /* @__PURE__ */ new Map();
				grouped.forEach((r, i) => {
					if (!r.team_id || !teamById.has(r.team_id)) return;
					const h = homes[i];
					const b = bounds.get(r.team_id) || {
						minX: h.x,
						maxX: h.x,
						minY: h.y,
						maxY: h.y
					};
					b.minX = Math.min(b.minX, h.x);
					b.maxX = Math.max(b.maxX, h.x);
					b.minY = Math.min(b.minY, h.y);
					b.maxY = Math.max(b.maxY, h.y);
					bounds.set(r.team_id, b);
				});
				let emptyX = 12;
				for (const t of teamsList) {
					const b = bounds.get(t.id);
					const pos = positioned.has(t.id) ? posOf(t.id) : null;
					const box = b ? {
						x: b.minX - 44,
						y: b.minY - 40,
						w: b.maxX - b.minX + 88,
						h: b.maxY - b.minY + 90
					} : pos ? {
						x: pos.x - 47,
						y: pos.y - 22,
						w: 94,
						h: 44
					} : {
						x: emptyX,
						y: 28,
						w: 94,
						h: 44
					};
					if (!b && !pos) emptyX += 104;
					box.x = Math.max(4, box.x);
					box.y = Math.max(24, box.y);
					box.w = Math.min(box.w, width - box.x - 4);
					box.h = Math.min(box.h, 254 - box.y);
					teamBoxesRef.current.push({
						id: t.id,
						name: t.name,
						queen: t.queen,
						...box
					});
				}
				const draggingSomething = dragTaskRef.current !== null || dragBeeRef.current;
				for (const box of teamBoxesRef.current) {
					const over = draggingSomething && dropTeamRef.current === box.id;
					const moving = dragBoxRef.current === box.id;
					ctx.save();
					ctx.strokeStyle = teamColor(box.name, over || moving ? .95 : .4);
					ctx.lineWidth = over || moving ? 2 : 1;
					ctx.setLineDash(over || moving ? [] : [5, 4]);
					ctx.beginPath();
					ctx.roundRect(box.x, box.y, box.w, box.h, 12);
					ctx.stroke();
					if (over || moving) {
						ctx.fillStyle = teamColor(box.name, over ? .08 : .05);
						ctx.beginPath();
						ctx.roundRect(box.x, box.y, box.w, box.h, 12);
						ctx.fill();
					}
					ctx.restore();
					ctx.fillStyle = teamColor(box.name, .95);
					ctx.font = "9px ui-monospace, monospace";
					ctx.textAlign = "left";
					ctx.textBaseline = "alphabetic";
					ctx.fillText(box.queen ? `${box.name} · ♛ ${box.queen}` : box.name, box.x + 8, box.y + 11);
				}
			}
			const waiting = (data.tasks || []).filter((t) => t.status !== "done" && (!t.assignee || !live.has(t.assignee)));
			const carriedCount = (data.tasks || []).filter((t) => t.status !== "done" && t.assignee && live.has(t.assignee)).length;
			const visible = waiting.slice(0, 15);
			const cols = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(visible.length || 1))));
			const rows = Math.ceil(visible.length / cols);
			const cellX = 38, cellY = 34;
			taskCellsRef.current = [];
			if (dragTaskRef.current === null && !dragBeeRef.current && dragBoxRef.current === null) {
				ctx.fillStyle = "#a89878";
				ctx.font = "10px ui-monospace, monospace";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(`task comb · ${waiting.length} waiting · ${carriedCount} carried`, center.x, 17);
			}
			const doneIds = new Set((data.tasks || []).filter((t) => t.status === "done").map((t) => t.id));
			visible.forEach((task, i) => {
				const col = i % cols, row = Math.floor(i / cols);
				const x = center.x + (col - (cols - 1) / 2) * cellX;
				const y = center.y - (rows - 1) * cellY / 2 + row * cellY + (col % 2 ? cellY / 2 : 0);
				const stranded = task.assignee && !live.has(task.assignee);
				const team = task.team_id && teamById.get(task.team_id) || null;
				const blocked = (task.depends_on || []).some((d) => !doneIds.has(d));
				taskCellsRef.current.push({
					x,
					y,
					task,
					stranded,
					team,
					blocked
				});
			});
			const cellById = new Map(taskCellsRef.current.map((c) => [c.task.id, c]));
			ctx.save();
			ctx.strokeStyle = "rgba(242,169,59,.3)";
			ctx.lineWidth = 1;
			for (const cell of taskCellsRef.current) for (const dep of cell.task.depends_on || []) {
				const from = cellById.get(dep);
				if (!from) continue;
				ctx.beginPath();
				ctx.moveTo(from.x, from.y);
				ctx.lineTo(cell.x, cell.y);
				ctx.stroke();
			}
			ctx.restore();
			for (const cell of taskCellsRef.current) {
				const { x, y, task, stranded, team, blocked } = cell;
				const lifted = dragPointRef.current && dragTaskRef.current === task.id;
				if (lifted) ctx.globalAlpha = .3;
				ctx.save();
				if (blocked) ctx.setLineDash([3, 3]);
				hex(x, y, 18, stranded ? "rgba(224,108,85,.10)" : team ? teamColor(team.name, .12) : "rgba(242,169,59,.12)", stranded ? "#e06c55" : team ? teamColor(team.name, .8) : "#b97f27");
				ctx.restore();
				ctx.fillStyle = stranded ? "#e06c55" : "#f2a93b";
				ctx.font = "9px ui-monospace, monospace";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(`#${task.id}`, x, y + .5);
				if (lifted) ctx.globalAlpha = 1;
			}
			if (waiting.length > visible.length) {
				ctx.fillStyle = "#a89878";
				ctx.font = "9px ui-monospace, monospace";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(`+${waiting.length - visible.length} more`, center.x, 202);
			}
			hex(ownerNode.x, ownerNode.y, 8, "rgba(242,169,59,.09)", "#b97f27");
			ctx.fillStyle = "#f2a93b";
			ctx.font = "9px ui-monospace, monospace";
			ctx.textAlign = "center";
			ctx.textBaseline = "alphabetic";
			ctx.fillText("owner", ownerNode.x, 253);
			const beeData = grouped.map((r, i) => {
				const name = r.user_id;
				const seed = hue(name);
				const mine = (data.tasks || []).filter((t) => t.assignee === name && t.status !== "done").sort((a, b) => (a.status === "picked_up" ? -1 : 1) - (b.status === "picked_up" ? -1 : 1) || b.updated_at - a.updated_at);
				const picked = mine.find((t) => t.status === "picked_up");
				const assigned = !picked && mine.find((t) => t.status === "open");
				const primary = picked || assigned;
				const extras = mine.filter((t) => !primary || t.id !== primary.id);
				const phase = seed / 57;
				const working = r.activity && r.activity.status === "working";
				const busy = !!picked || working;
				const speed = busy ? 2.5 : 1;
				const clustered = r.team_id && positioned.has(r.team_id);
				const amp = (busy ? 26 : 18) * (clustered ? .55 : 1);
				const q = still ? 0 : now / 8e3 * Math.PI * 2 * speed + phase;
				return {
					r,
					name,
					seed,
					x: homes[i].x + (still ? 0 : Math.sin(q) * amp),
					y: homes[i].y + (still ? 0 : Math.sin(q * 1.7 + phase) * amp * .55),
					dx: still ? 1 : Math.cos(q),
					dy: still ? 0 : Math.cos(q * 1.7 + phase) * .94,
					q,
					picked,
					assigned,
					primary,
					extras,
					working,
					busy
				};
			});
			for (const bee of beeData) {
				for (const box of teamBoxesRef.current) {
					if (bee.r.team_id === box.id) continue;
					const m = 14;
					if (bee.x <= box.x - m || bee.x >= box.x + box.w + m || bee.y <= box.y - m || bee.y >= box.y + box.h + m) continue;
					const out = [
						{
							d: bee.x - (box.x - m),
							x: box.x - m,
							y: bee.y
						},
						{
							d: box.x + box.w + m - bee.x,
							x: box.x + box.w + m,
							y: bee.y
						},
						{
							d: bee.y - (box.y - m),
							x: bee.x,
							y: box.y - m
						},
						{
							d: box.y + box.h + m - bee.y,
							x: bee.x,
							y: box.y + box.h + m
						}
					].reduce((a, b) => a.d <= b.d ? a : b);
					bee.x = out.x;
					bee.y = out.y;
				}
				bee.x = Math.max(16, Math.min(width - 16, bee.x));
				bee.y = Math.max(34, Math.min(244, bee.y));
			}
			for (const bee of beeData) {
				const { r, name, seed, x, y, dx, dy, q, picked, assigned, primary, extras, working, busy } = bee;
				bees.set(name, {
					x,
					y,
					task: primary
				});
				if (assigned) token(assigned, x + 22, y + Math.sin(q * .8) * 3);
				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(Math.atan2(dy, dx));
				if (working) {
					ctx.fillStyle = "rgba(143,191,111,.25)";
					ctx.beginPath();
					ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
					ctx.fill();
				}
				const flap = still ? 0 : Math.sin(now / 1e3 * (busy ? 44 : 30)) * .35;
				ctx.fillStyle = "rgba(240,230,210,.5)";
				ctx.beginPath();
				ctx.ellipse(-2, -7, 6, 3, -.45 - flap, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.ellipse(-2, 7, 6, 3, .45 + flap, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = `hsl(${seed} 42% 58%)`;
				ctx.beginPath();
				ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "rgba(22,18,12,.5)";
				ctx.fillRect(-4, -6, 2.5, 12);
				ctx.fillRect(2, -6, 2.5, 12);
				ctx.fillStyle = "#16120c";
				ctx.beginPath();
				ctx.arc(11, 0, 3.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
				if (picked) token(picked, x, y + 16);
				extras.slice(0, 4).forEach((task, j) => {
					const a = -1.15 + j * .75;
					token(task, x + Math.cos(a) * 25, y + Math.sin(a) * 22);
				});
				if (extras.length > 4) {
					ctx.fillStyle = "#a89878";
					ctx.font = "8px ui-monospace, monospace";
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.fillText(`+${extras.length - 4}`, x + 29, y + 12);
				}
				ctx.fillStyle = "#a89878";
				ctx.font = "10px ui-monospace, monospace";
				ctx.textAlign = "center";
				ctx.textBaseline = "alphabetic";
				ctx.fillText(name, x, y + (picked ? 35 : 19));
				const attention = r.activity && r.activity.status === "needs_attention";
				if (attention) {
					ctx.fillStyle = "#f2a93b";
					ctx.font = "bold 13px ui-monospace, monospace";
					ctx.textBaseline = "alphabetic";
					ctx.fillText("!", x, y - 14);
				}
				const myTeam = r.team_id && teamById.get(r.team_id) || null;
				if (myTeam && myTeam.queen === name) {
					ctx.fillStyle = "#f2a93b";
					ctx.font = "11px ui-monospace, monospace";
					ctx.textAlign = "center";
					ctx.textBaseline = "alphabetic";
					ctx.fillText("♛", x, y - (attention ? 26 : 14));
				}
			}
			if (dragTaskRef.current !== null && dragPointRef.current) {
				const dragged = (data.tasks || []).find((t) => t.id === dragTaskRef.current);
				if (dragged) token(dragged, dragPointRef.current.x, dragPointRef.current.y);
			}
			const dragBee = dragBeeRef.current && bees.get(dragBeeRef.current);
			if (dragBee && dragPointRef.current) {
				const p = dragPointRef.current;
				ctx.save();
				ctx.strokeStyle = "rgba(240,230,210,.3)";
				ctx.setLineDash([3, 4]);
				ctx.beginPath();
				ctx.moveTo(dragBee.x, dragBee.y);
				ctx.lineTo(p.x, p.y);
				ctx.stroke();
				ctx.restore();
				ctx.save();
				ctx.globalAlpha = .85;
				ctx.fillStyle = `hsl(${hue(dragBeeRef.current)} 42% 58%)`;
				ctx.beginPath();
				ctx.ellipse(p.x, p.y, 12, 6, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "rgba(22,18,12,.5)";
				ctx.fillRect(p.x - 4, p.y - 6, 2.5, 12);
				ctx.fillRect(p.x + 2, p.y - 6, 2.5, 12);
				ctx.restore();
			}
			const dropLabel = (label, ax, ay) => {
				ctx.font = "11px ui-monospace, monospace";
				const labelW = ctx.measureText(label).width + 14;
				const lx = Math.max(5, Math.min(width - labelW - 5, ax - labelW / 2));
				const ly = Math.max(5, ay);
				ctx.fillStyle = "#241c11";
				ctx.beginPath();
				ctx.roundRect(lx, ly, labelW, 21, 6);
				ctx.fill();
				ctx.strokeStyle = "#f2a93b";
				ctx.stroke();
				ctx.fillStyle = "#f0e6d2";
				ctx.textAlign = "left";
				ctx.textBaseline = "middle";
				ctx.fillText(label, lx + 7, ly + 11);
			};
			const banner = (text) => {
				ctx.fillStyle = "#f2a93b";
				ctx.font = "11px ui-monospace, monospace";
				ctx.textAlign = "center";
				ctx.textBaseline = "alphabetic";
				ctx.fillText(text, width / 2, 18);
			};
			const targetBox = dropTeamRef.current != null && teamBoxesRef.current.find((b) => b.id === dropTeamRef.current);
			const dropTarget = dropTargetRef.current && bees.get(dropTargetRef.current);
			if (dragTaskRef.current && dropTarget) {
				ctx.save();
				ctx.strokeStyle = "#f2a93b";
				ctx.lineWidth = 2;
				ctx.shadowColor = "rgba(242,169,59,.8)";
				ctx.shadowBlur = 13;
				ctx.beginPath();
				ctx.arc(dropTarget.x, dropTarget.y, 24, 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();
				dropLabel(`assign #${dragTaskRef.current} to ${dropTargetRef.current}`, dropTarget.x, Math.max(5, dropTarget.y - 43));
			} else if (dragTaskRef.current && targetBox) dropLabel(`assign #${dragTaskRef.current} to team ${targetBox.name}`, targetBox.x + targetBox.w / 2, Math.max(5, targetBox.y - 26));
			else if (dragTaskRef.current) banner(`drop task #${dragTaskRef.current} on a bee or a team`);
			else if (dragBeeRef.current && targetBox) dropLabel(`move ${dragBeeRef.current} to team ${targetBox.name}`, targetBox.x + targetBox.w / 2, Math.max(5, targetBox.y - 26));
			else if (dragBeeRef.current) {
				const r = grouped.find((x) => x.user_id === dragBeeRef.current);
				const home = r && r.team_id && teamById.get(r.team_id);
				banner(home ? `release to take ${dragBeeRef.current} out of team ${home.name}` : `drop ${dragBeeRef.current} on a team`);
			} else if (dragBoxRef.current !== null) {
				const moving = teamBoxesRef.current.find((b) => b.id === dragBoxRef.current);
				if (moving) banner(`release to place team ${moving.name}`);
			}
			const endpoint = (name) => name === "owner" ? ownerNode : bees.get(name) || ownerNode;
			if (!still && pendingRef.current.length) {
				const born = now;
				streaksRef.current.push(...pendingRef.current.splice(0, 8).map((m) => ({
					born,
					a: { ...endpoint(m.sender) },
					b: { ...endpoint(m.recipient) },
					id: m.id
				})));
			} else if (still) pendingRef.current.length = 0;
			streaksRef.current = streaksRef.current.filter((s) => now - s.born < 900);
			if (!still) for (const s of streaksRef.current) {
				const u = Math.min(1, (now - s.born) / 900);
				const c = {
					x: (s.a.x + s.b.x) / 2,
					y: (s.a.y + s.b.y) / 2 - 40
				};
				for (let i = 9; i >= 0; i--) {
					const p = point(s.a, s.b, c, Math.max(0, u - i * .025));
					ctx.fillStyle = `rgba(242,169,59,${(10 - i) / 13})`;
					ctx.beginPath();
					ctx.arc(p.x, p.y, i ? 1.2 : 2.5, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			if (!still && pendingShipmentsRef.current.length) {
				const born = now;
				shipmentsRef.current.push(...pendingShipmentsRef.current.splice(0).map((task) => ({
					born,
					task,
					a: { ...bees.get(task.assignee) || ownerNode },
					b: {
						x: doneX,
						y: 28
					}
				})));
			} else if (still) pendingShipmentsRef.current.length = 0;
			shipmentsRef.current = shipmentsRef.current.filter((s) => now - s.born < 1100);
			if (!still) for (const shipment of shipmentsRef.current) {
				const u = Math.min(1, (now - shipment.born) / 1100);
				const c = {
					x: (shipment.a.x + shipment.b.x) / 2,
					y: Math.min(shipment.a.y, shipment.b.y) - 45
				};
				const p = point(shipment.a, shipment.b, c, u);
				ctx.save();
				ctx.globalAlpha = Math.min(1, (1 - u) * 2.4);
				token(shipment.task, p.x, p.y);
				ctx.restore();
			}
			const hovered = hoverRef.current && bees.get(hoverRef.current);
			if (hovered) {
				const title = hovered.task ? ` · ${hovered.task.title}` : "";
				const label = hoverRef.current + title;
				ctx.font = "10px ui-monospace, monospace";
				const w = ctx.measureText(label).width + 12;
				const tx = Math.max(4, Math.min(width - w - 4, hovered.x - w / 2));
				const ty = Math.max(4, hovered.y - 31);
				ctx.fillStyle = "#241c11";
				ctx.beginPath();
				ctx.roundRect(tx, ty, w, 19, 5);
				ctx.fill();
				ctx.strokeStyle = "#3a2d1a";
				ctx.stroke();
				ctx.fillStyle = "#f0e6d2";
				ctx.textAlign = "left";
				ctx.textBaseline = "middle";
				ctx.fillText(label, tx + 6, ty + 10);
			}
			const taskCell = taskHoverRef.current;
			if (!hovered && taskCell) {
				const task = taskCell.task;
				const stateLabel = taskCell.stranded ? `assigned to stopped ${task.assignee}` : taskCell.team ? `team ${taskCell.team.name}` : "waiting";
				const blockedLabel = taskCell.blocked ? ` · blocked (after ${(task.depends_on || []).map((d) => `#${d}`).join(" ")})` : "";
				const label = `#${task.id} · ${task.title} · ${stateLabel}${blockedLabel} · drag onto a bee or team`;
				ctx.font = "10px ui-monospace, monospace";
				const w = Math.min(width - 16, ctx.measureText(label).width + 12);
				const tx = Math.max(8, Math.min(width - w - 8, taskCell.x - w / 2));
				const ty = Math.min(232, taskCell.y + 25);
				ctx.fillStyle = "#241c11";
				ctx.beginPath();
				ctx.roundRect(tx, ty, w, 19, 5);
				ctx.fill();
				ctx.strokeStyle = taskCell.stranded ? "#e06c55" : "#b97f27";
				ctx.stroke();
				ctx.fillStyle = "#f0e6d2";
				ctx.textAlign = "left";
				ctx.textBaseline = "middle";
				ctx.fillText(label, tx + 6, ty + 10, w - 12);
			}
		};
		drawRef.current = draw;
		const at = (e) => {
			const r = canvas.getBoundingClientRect();
			return {
				x: e.clientX - r.left,
				y: e.clientY - r.top
			};
		};
		const hit = (e) => {
			const p = at(e);
			return [...beesRef.current].find(([, b]) => Math.hypot(p.x - b.x, p.y - b.y) < 24)?.[0] || null;
		};
		const hitTask = (e) => {
			const p = at(e);
			return taskCellsRef.current.find((cell) => Math.hypot(p.x - cell.x, p.y - cell.y) < 20) || null;
		};
		const hitTeam = (e) => {
			const p = at(e);
			return teamBoxesRef.current.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) || null;
		};
		const taskId = (e) => {
			const raw = e.dataTransfer?.getData("application/x-agent-msg-task") || e.dataTransfer?.getData("text/plain");
			return /^\d+$/.test(raw || "") ? Number(raw) : null;
		};
		const clearDrop = () => {
			dragTaskRef.current = null;
			dragBeeRef.current = null;
			dragPointRef.current = null;
			dropTargetRef.current = null;
			dropTeamRef.current = null;
			dragBoxRef.current = null;
			canvas.style.cursor = "default";
			if (reduced) draw(performance.now(), true);
		};
		const teamCenter = (id) => {
			const stored = teamPos.get(id);
			if (stored) return stored;
			const members = (stateRef.current.recipients || []).filter((r) => r.team_id === id && r.pane_alive).map((r) => beesRef.current.get(r.user_id)).filter(Boolean);
			if (members.length) return {
				x: members.reduce((s, b) => s + b.x, 0) / members.length,
				y: members.reduce((s, b) => s + b.y, 0) / members.length
			};
			const box = teamBoxesRef.current.find((b) => b.id === id);
			return box ? {
				x: box.x + box.w / 2,
				y: box.y + box.h / 2
			} : null;
		};
		const assign = async (id, assignee) => {
			const task = (stateRef.current.tasks || []).find((t) => t.id === id);
			if (!task || task.status === "done") {
				setDropStatus(`Task #${id} cannot be assigned by drag.`);
				return;
			}
			if (task.assignee === assignee) {
				setDropStatus(`#${id} is already assigned to ${assignee}.`);
				return;
			}
			try {
				if (!(await fetch(`/tasks/${id}`, {
					method: "PATCH",
					headers: JSONH,
					body: JSON.stringify({ assignee })
				})).ok) throw new Error("assignment failed");
				setDropStatus(`Assigned #${id} to ${assignee}.`);
				refresh();
			} catch {
				setDropStatus(`Could not assign #${id}; task was not changed.`);
			}
		};
		const assignTeam = async (id, box) => {
			const task = (stateRef.current.tasks || []).find((t) => t.id === id);
			if (!task || task.status === "done") {
				setDropStatus(`Task #${id} cannot be assigned by drag.`);
				return;
			}
			if (task.team_id === box.id) {
				setDropStatus(`#${id} is already assigned to team ${box.name}.`);
				return;
			}
			try {
				if (!(await fetch(`/tasks/${id}`, {
					method: "PATCH",
					headers: JSONH,
					body: JSON.stringify({ team_id: box.id })
				})).ok) throw new Error("assignment failed");
				setDropStatus(`Assigned #${id} to team ${box.name}.`);
				refresh();
			} catch {
				setDropStatus(`Could not assign #${id}; task was not changed.`);
			}
		};
		const setBeeTeam = async (user, teamId, doneLabel) => {
			try {
				if (!(await fetch(`/agents/${encodeURIComponent(user)}/team`, {
					method: "POST",
					headers: JSONH,
					body: JSON.stringify({ team_id: teamId })
				})).ok) throw new Error("move failed");
				setDropStatus(doneLabel);
				refresh();
			} catch {
				setDropStatus(`Could not move ${user}.`);
			}
		};
		let press = null;
		let suppressClick = false;
		const pointerDown = (e) => {
			if (e.button !== 0) return;
			const bee = hit(e);
			if (bee) {
				press = {
					bee,
					start: at(e),
					moved: false
				};
				canvas.setPointerCapture(e.pointerId);
				return;
			}
			const cell = hitTask(e);
			if (cell) {
				press = {
					id: cell.task.id,
					start: at(e),
					moved: false
				};
				canvas.setPointerCapture(e.pointerId);
				return;
			}
			const box = hitTeam(e);
			if (!box) return;
			const p = at(e);
			const c = teamCenter(box.id) || {
				x: box.x + box.w / 2,
				y: box.y + box.h / 2
			};
			press = {
				boxId: box.id,
				start: p,
				off: {
					x: c.x - p.x,
					y: c.y - p.y
				},
				moved: false
			};
			canvas.setPointerCapture(e.pointerId);
		};
		const pointerMove = (e) => {
			if (!press) return;
			const p = at(e);
			if (!press.moved && Math.hypot(p.x - press.start.x, p.y - press.start.y) < 5) return;
			press.moved = true;
			hoverRef.current = null;
			taskHoverRef.current = null;
			if (press.boxId != null) {
				dragBoxRef.current = press.boxId;
				teamPos.set(press.boxId, {
					x: p.x + press.off.x,
					y: p.y + press.off.y
				});
				canvas.style.cursor = "grabbing";
				if (reduced) draw(performance.now(), true);
				return;
			}
			dragPointRef.current = p;
			if (press.bee) {
				dragBeeRef.current = press.bee;
				const box = hitTeam(e);
				dropTeamRef.current = box ? box.id : null;
				canvas.style.cursor = "grabbing";
			} else {
				dragTaskRef.current = press.id;
				dropTargetRef.current = hit(e);
				const box = dropTargetRef.current ? null : hitTeam(e);
				dropTeamRef.current = box ? box.id : null;
				canvas.style.cursor = dropTargetRef.current || dropTeamRef.current != null ? "copy" : "grabbing";
			}
			if (reduced) draw(performance.now(), true);
		};
		const pointerUp = async (e) => {
			if (!press) return;
			const { id, bee, boxId, moved } = press;
			press = null;
			if (!moved) return;
			suppressClick = true;
			if (boxId != null) {
				savePos();
				clearDrop();
				return;
			}
			const targetBee = hit(e);
			const box = hitTeam(e);
			clearDrop();
			if (bee) {
				const r = (stateRef.current.recipients || []).find((x) => x.user_id === bee);
				const teams = stateRef.current.teams || [];
				const current = r && teams.find((t) => t.id === r.team_id);
				if (box && (!current || current.id !== box.id)) await setBeeTeam(bee, box.id, `Moved ${bee} to team ${box.name}.`);
				else if (!box && current) await setBeeTeam(bee, null, `Removed ${bee} from team ${current.name}.`);
				return;
			}
			if (targetBee) await assign(id, targetBee);
			else if (box) await assignTeam(id, box);
		};
		const pointerCancel = () => {
			press = null;
			clearDrop();
		};
		const move = (e) => {
			if (press) return;
			hoverRef.current = hit(e);
			taskHoverRef.current = hoverRef.current ? null : hitTask(e);
			const overBox = !hoverRef.current && !taskHoverRef.current && hitTeam(e);
			canvas.style.cursor = hoverRef.current ? "pointer" : taskHoverRef.current || overBox ? "grab" : "default";
			if (reduced) draw(performance.now(), true);
		};
		const leave = () => {
			if (press) return;
			hoverRef.current = null;
			taskHoverRef.current = null;
			if (dragTaskRef.current) clearDrop();
			else {
				canvas.style.cursor = "default";
				if (reduced) draw(performance.now(), true);
			}
		};
		const click = (e) => {
			if (suppressClick) {
				suppressClick = false;
				return;
			}
			const name = hit(e);
			if (name) location.hash = focusHash(name);
		};
		const dragOver = (e) => {
			const id = taskId(e);
			if (id === null) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			dragTaskRef.current = id;
			dropTargetRef.current = hit(e);
			const box = dropTargetRef.current ? null : hitTeam(e);
			dropTeamRef.current = box ? box.id : null;
			canvas.style.cursor = dropTargetRef.current || dropTeamRef.current != null ? "copy" : "not-allowed";
			if (reduced) draw(performance.now(), true);
		};
		const dragLeave = (e) => {
			if (e.target === canvas) clearDrop();
		};
		const drop = async (e) => {
			const id = taskId(e);
			const assignee = hit(e);
			const box = hitTeam(e);
			e.preventDefault();
			clearDrop();
			if (id === null) return;
			if (assignee) await assign(id, assignee);
			else if (box) await assignTeam(id, box);
		};
		window.__hive = {
			bees: () => beesRef.current,
			teamBoxes: () => teamBoxesRef.current
		};
		canvas.addEventListener("mousemove", move);
		canvas.addEventListener("mouseleave", leave);
		canvas.addEventListener("click", click);
		canvas.addEventListener("pointerdown", pointerDown);
		canvas.addEventListener("pointermove", pointerMove);
		canvas.addEventListener("pointerup", pointerUp);
		canvas.addEventListener("pointercancel", pointerCancel);
		canvas.addEventListener("dragover", dragOver);
		canvas.addEventListener("dragleave", dragLeave);
		canvas.addEventListener("drop", drop);
		canvas.addEventListener("dragend", clearDrop);
		window.addEventListener("dragend", clearDrop);
		if (reduced) draw(performance.now(), true);
		else {
			const tick = (now) => {
				if (!document.hidden && now - lastDraw >= 32) {
					draw(now);
					lastDraw = now;
				}
				frame = requestAnimationFrame(tick);
			};
			frame = requestAnimationFrame(tick);
		}
		return () => {
			cancelAnimationFrame(frame);
			drawRef.current = null;
			delete window.__hive;
			canvas.removeEventListener("mousemove", move);
			canvas.removeEventListener("mouseleave", leave);
			canvas.removeEventListener("click", click);
			canvas.removeEventListener("pointerdown", pointerDown);
			canvas.removeEventListener("pointermove", pointerMove);
			canvas.removeEventListener("pointerup", pointerUp);
			canvas.removeEventListener("pointercancel", pointerCancel);
			canvas.removeEventListener("dragover", dragOver);
			canvas.removeEventListener("dragleave", dragLeave);
			canvas.removeEventListener("drop", drop);
			canvas.removeEventListener("dragend", clearDrop);
			window.removeEventListener("dragend", clearDrop);
		};
	}, []);
	h(() => {
		if (matchMedia("(prefers-reduced-motion: reduce)").matches && drawRef.current) drawRef.current(performance.now(), true);
	}, [state]);
	return m$1`<div class="hive-panel"><canvas ref=${canvasRef} tabindex="0"
    aria-label="Live activity. Drag a comb cell or a task card onto a bee or a team outline to assign the task; drag a bee into or out of a team outline to change its team; drag a team outline by its empty space to move the whole team somewhere else. Bees outside a team are kept out of team outlines. The task assignee select and the sidebar team boxes are the keyboard and touch alternatives."></canvas>
    <span class="sr-only" aria-live="polite">${dropStatus}</span></div>`;
}
//#endregion
//#region web/src/main.js
function Avatar({ name, size }) {
	const base = name.replace(/-\d+$/, "");
	const emoji = ANIMAL_EMOJI[base];
	return m$1`<div class=${`hex ${size || ""}`} style=${`--hue: hsl(${hue(name)} 42% 58%)`}>
    ${emoji || m$1`<span class="mono2">${base.slice(0, 2)}</span>`}
  </div>`;
}
function RosterChip({ r, state, team, selected, unread, ping, refresh }) {
	const [stopping, setStopping] = d(false);
	const [crowning, setCrowning] = d(false);
	const isQueen = !!team && team.queen === r.user_id;
	const task = currentTask(state.tasks, r.user_id);
	const flavor = (r.flavor || "generic").toLowerCase();
	const status = agentStatus(r);
	const st = STATE[status] || STATE.unknown;
	const detail = r.activity && r.activity.detail;
	const attention = status === "needs_attention";
	const sub = attention ? m$1`<span class="attn" title=${detail || "needs attention"}>${detail || "needs attention"}</span>` : task ? m$1`<span class="on">#${task.id}</span> ${task.title}` : m$1`<span class="stateword" style=${`color:${st.color}`}>${st.word}</span>`;
	const stop = async (e) => {
		e.stopPropagation();
		if (!confirm(`Stop ${r.user_id}? This will kill tmux pane ${r.tmux_pane}.`)) return;
		setStopping(true);
		const res = await fetch(`/agents/${encodeURIComponent(r.user_id)}/stop`, { method: "POST" });
		setStopping(false);
		if (res.ok) {
			if (selected) {
				const next = state.recipients.find((x) => x.pane_alive && x.user_id !== r.user_id);
				location.hash = next ? focusHash(next.user_id) : "#/";
			}
			refresh();
		} else alert(`Could not stop ${r.user_id}.`);
	};
	const crown = async (e) => {
		e.stopPropagation();
		if (isQueen) {
			if (!confirm(`Remove ${r.user_id} as queen of ${team.name}?`)) return;
			setCrowning(true);
			await fetch(`/teams/${team.id}`, {
				method: "PATCH",
				headers: JSONH,
				body: JSON.stringify({ queen: null })
			});
			setCrowning(false);
			refresh();
			return;
		}
		const raw = prompt(`Objective for ${r.user_id} as queen of ${team.name}?`, "Coordinate your team to execute the shared task board.");
		if (raw === null) return;
		setCrowning(true);
		const res = await fetch(`/teams/${team.id}`, {
			method: "PATCH",
			headers: JSONH,
			body: JSON.stringify({
				queen: r.user_id,
				objective: raw.trim()
			})
		});
		setCrowning(false);
		if (!res.ok) alert(`Could not make ${r.user_id} queen.`);
		refresh();
	};
	const dragStart = (e) => {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("application/x-agent-msg-agent", r.user_id);
		e.dataTransfer.setData("text/plain", r.user_id);
	};
	return m$1`<div class=${`chip-card state-${st.cls} ${selected ? "sel" : ""} ${ping ? "ping" : ""}`}
      draggable="true" onDragStart=${dragStart}
      onClick=${() => {
		location.hash = selected ? "#/" : focusHash(r.user_id);
	}}>
    <${Avatar} name=${r.user_id} size="small" />
    <div class="who">
      <div class="nm">${r.user_id}${isQueen && m$1`<span class="crown" title="team queen">♛</span>`}<span class=${`status ${st.cls}`} title=${st.word}></span></div>
      <div class="sub">${sub}</div>
      <div class="tech" title=${`${flavor} · ${r.tmux_pane}`}><span class="flavor">${flavor}</span> · ${r.tmux_pane}</div>
    </div>
    <div class="controls">
      <span class="flav" title=${flavor}>${FLAVOR_ICON[flavor] || FLAVOR_ICON.generic}</span>
      ${team && r.pane_alive && m$1`<button type="button" class="queen-agent" disabled=${crowning}
        title=${isQueen ? `remove ${r.user_id} as queen` : `make ${r.user_id} queen of ${team.name}`}
        aria-label=${isQueen ? `Remove ${r.user_id} as queen` : `Make ${r.user_id} queen of ${team.name}`}
        onClick=${crown}>${crowning ? "…" : isQueen ? "♛ queen" : "♛"}</button>`}
      ${r.pane_alive && m$1`<button type="button" class="stop-agent" disabled=${stopping}
        title=${`stop ${r.user_id}`} onClick=${stop}>${stopping ? "stopping…" : "stop"}</button>`}
    </div>
    ${(unread || attention) && m$1`<span class="badge" title=${attention ? "needs attention" : "new messages"}></span>`}
  </div>`;
}
function SpawnControl({ refresh }) {
	const [flavor, setFlavor] = d("claude");
	const [busy, setBusy] = d(false);
	const [err, setErr] = d("");
	const spawn = async (e) => {
		e.preventDefault();
		setBusy(true);
		setErr("");
		if (!(await fetch("/agents/spawn", {
			method: "POST",
			headers: JSONH,
			body: JSON.stringify({ flavor })
		})).ok) setErr("spawn failed");
		setBusy(false);
		refresh();
	};
	return m$1`<form class="spawn" onSubmit=${spawn}>
    <select value=${flavor} onChange=${(e) => setFlavor(e.target.value)}>
      ${[
		"claude",
		"codex",
		"generic"
	].map((f) => m$1`<option key=${f} value=${f}>${f}</option>`)}
    </select>
    <button class="act" type="submit" disabled=${busy}>${busy ? "spawning…" : "spawn agent"}</button>
    ${err && m$1`<span style="color:var(--alert); font-size:11px">${err}</span>`}
  </form>`;
}
var ACTIVITY_RANK = {
	working: 0,
	needs_attention: 1,
	idle: 2,
	unknown: 3
};
var AGENT_DRAG_TYPE = "application/x-agent-msg-agent";
function sortByActivity(agents) {
	return agents.map((r, i) => [r, i]).sort(([a, ai], [b, bi]) => (ACTIVITY_RANK[agentStatus(a)] ?? 3) - (ACTIVITY_RANK[agentStatus(b)] ?? 3) || ai - bi).map(([r]) => r);
}
async function moveAgentToTeam(user, teamId, refresh) {
	await fetch(`/agents/${encodeURIComponent(user)}/team`, {
		method: "POST",
		headers: JSONH,
		body: JSON.stringify({ team_id: teamId })
	});
	refresh();
}
function agentDropProps(setOver, onDropUser) {
	return {
		onDragOver: (e) => {
			if (![...e.dataTransfer.types].includes(AGENT_DRAG_TYPE)) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			setOver(true);
		},
		onDragLeave: (e) => {
			if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
		},
		onDrop: (e) => {
			e.preventDefault();
			setOver(false);
			const user = e.dataTransfer.getData(AGENT_DRAG_TYPE);
			if (user) onDropUser(user);
		}
	};
}
function TeamBox({ team, members, chip, refresh }) {
	const [over, setOver] = d(false);
	const disband = async (e) => {
		e.stopPropagation();
		if (!confirm(`Disband team ${team.name}? Its agents keep running.`)) return;
		await fetch(`/teams/${team.id}`, { method: "DELETE" });
		refresh();
	};
	return m$1`<div class=${`teambox ${over ? "over" : ""}`}
      ...${agentDropProps(setOver, (user) => moveAgentToTeam(user, team.id, refresh))}>
    <div class="teamhead">
      <span class="teamname">${team.name}</span>
      ${team.queen ? m$1`<span class="queen-tag" title=${`queen: ${team.queen}`}>♛ ${team.queen}</span>` : m$1`<span class="queen-tag" style="opacity:.55">no queen</span>`}
      <button type="button" class="mini" title="disband team" onClick=${disband}>disband</button>
    </div>
    ${members.length === 0 ? m$1`<div class="teamempty">drag agents here</div>` : members.map(chip)}
  </div>`;
}
function NewTeam({ refresh }) {
	const [name, setName] = d("");
	const create = async (e) => {
		e.preventDefault();
		if (!name.trim()) return;
		await fetch("/teams", {
			method: "POST",
			headers: JSONH,
			body: JSON.stringify({ name: name.trim() })
		});
		setName("");
		refresh();
	};
	return m$1`<form class="newteam" onSubmit=${create}>
    <input type="text" placeholder="team name" value=${name}
      onInput=${(e) => setName(e.target.value)} />
    <button class="act" type="submit">new team</button>
  </form>`;
}
function Roster({ state, focusUser, unreadFor, pings, refresh }) {
	const [overUnteam, setOverUnteam] = d(false);
	const teams = state.teams || [];
	const teamById = new Map(teams.map((t) => [t.id, t]));
	const running = sortByActivity(state.recipients.filter((r) => r.pane_alive));
	const stopped = state.recipients.filter((r) => !r.pane_alive);
	const unteamed = running.filter((r) => !teamById.has(r.team_id));
	const chip = (r) => m$1`<${RosterChip} key=${r.user_id} r=${r} state=${state}
    team=${teamById.get(r.team_id) || null}
    selected=${focusUser === r.user_id} unread=${unreadFor(r.user_id)}
    ping=${!!pings[r.user_id]} refresh=${refresh} />`;
	return m$1`<aside class="roster">
    <h2>agents ${running.length > 0 && m$1`<span class="count">· ${running.length}</span>`}</h2>
    ${teams.map((t) => m$1`<${TeamBox} key=${t.id} team=${t} chip=${chip} refresh=${refresh}
      members=${running.filter((r) => r.team_id === t.id)} />`)}
    <${NewTeam} refresh=${refresh} />
    <div class=${`unteam-drop ${overUnteam ? "over" : ""}`}
        ...${agentDropProps(setOverUnteam, (user) => moveAgentToTeam(user, null, refresh))}>
      ${teams.length > 0 && m$1`<div class="hint">no team · drop here to unteam</div>`}
      ${running.length === 0 ? m$1`<div class="empty" style="padding:20px">No agents running.<br /><br />
            <code>agent-msg register</code></div>` : unteamed.map(chip)}
    </div>
    ${stopped.length > 0 && m$1`<details class="stopped">
      <summary>stopped · ${stopped.length}</summary>
      ${stopped.map(chip)}
    </details>`}
    <${SpawnControl} refresh=${refresh} />
  </aside>`;
}
function TaskCard({ t, agentIds, teams, blockers, refresh }) {
	const [dragging, setDragging] = d(false);
	const when = (/* @__PURE__ */ new Date(t.created_at * 1e3)).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	});
	const ids = t.assignee && !agentIds.includes(t.assignee) ? agentIds.concat(t.assignee) : agentIds;
	const act = async (p) => {
		await patchTask(t.id, p);
		refresh();
	};
	const draggable = t.status !== "done";
	const blocked = blockers.length > 0 && t.status !== "done";
	const deps = t.depends_on || [];
	const dragStart = (e) => {
		if (!draggable) return;
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("application/x-agent-msg-task", String(t.id));
		e.dataTransfer.setData("text/plain", String(t.id));
		setDragging(true);
	};
	const onAssign = (e) => {
		const v = e.target.value;
		if (v.startsWith("t:")) act({ team_id: Number(v.slice(2)) });
		else if (v) act({ assignee: v });
		else act({
			assignee: null,
			team_id: null
		});
	};
	return m$1`<div class=${`tcard ${dragging ? "dragging" : ""} ${blocked ? "blocked" : ""}`} draggable=${draggable}
      onDragStart=${dragStart} onDragEnd=${() => setDragging(false)}
      title=${draggable ? "Drag this task onto a bee or team in the activity view to assign it" : "Reopen this task before assigning it by drag"}>
    <div class="t">${t.title}</div>
    <div class="meta">#${t.id} · created ${when}${deps.length > 0 ? ` · after ${deps.map((d) => `#${d}`).join(" ")}` : ""}${t.description ? ` · ${t.description}` : ""}${t.worktree ? ` · worktree ${t.worktree}` : ""}</div>
    ${blocked && m$1`<div class="meta blocked-tag" title="dependencies not yet done">blocked by ${blockers.map((d) => `#${d}`).join(" ")}</div>`}
    <div class="foot">
      <select title="assignee" value=${t.team_id ? `t:${t.team_id}` : t.assignee || ""}
        onChange=${onAssign}>
        <option value="">unassigned</option>
        ${teams.length > 0 && m$1`<optgroup label="teams">
          ${teams.map((x) => m$1`<option key=${`t:${x.id}`} value=${`t:${x.id}`}>team ${x.name}</option>`)}
        </optgroup>`}
        ${ids.map((a) => m$1`<option key=${a} value=${a}>${a}${agentIds.includes(a) ? "" : " (stopped)"}</option>`)}
      </select>
      ${t.status === "done" ? m$1`<button class="mini" onClick=${() => act({ status: "open" })}>reopen</button>` : m$1`<button class="mini" onClick=${() => act({ status: "done" })}>done</button>`}
    </div>
  </div>`;
}
function Kanban({ state, refresh }) {
	const [title, setTitle] = d("");
	const [assignee, setAssignee] = d("");
	const agentIds = state.recipients.filter((r) => r.pane_alive).map((r) => r.user_id);
	const teams = state.teams || [];
	const byId = new Map(state.tasks.map((t) => [t.id, t]));
	const create = async (e) => {
		e.preventDefault();
		if (!title.trim()) return;
		const body = { title: title.trim() };
		if (assignee.startsWith("t:")) body.team_id = Number(assignee.slice(2));
		else if (assignee) body.assignee = assignee;
		await fetch("/tasks", {
			method: "POST",
			headers: JSONH,
			body: JSON.stringify(body)
		});
		setTitle("");
		refresh();
	};
	return m$1`<div>
    <h2>tasks ${state.tasks.length > 0 && m$1`<span class="count">· ${state.tasks.length}</span>`}</h2>
    <form class="newtask" onSubmit=${create}>
      <input type="text" placeholder="task title"
        value=${title} onInput=${(e) => setTitle(e.target.value)} />
      <select value=${assignee} onChange=${(e) => setAssignee(e.target.value)}>
        <option value="">unassigned</option>
        ${teams.length > 0 && m$1`<optgroup label="teams">
          ${teams.map((x) => m$1`<option key=${`t:${x.id}`} value=${`t:${x.id}`}>team ${x.name}</option>`)}
        </optgroup>`}
        ${agentIds.map((a) => m$1`<option key=${a} value=${a}>${a}</option>`)}
      </select>
      <button class="act" type="submit">create task</button>
    </form>
    <div class="board">
      ${[
		["open", "open"],
		["picked_up", "picked up"],
		["done", "done"]
	].map(([status, label]) => {
		const items = state.tasks.filter((t) => t.status === status);
		return m$1`<div key=${status} class=${`col ${status}`}>
          <div class="colhead">${label}<span class="n">${items.length}</span></div>
          <div class="cards">
            ${items.length === 0 ? m$1`<div class="colempty">none</div>` : items.map((t) => m$1`<${TaskCard} key=${t.id} t=${t}
                  agentIds=${agentIds} teams=${teams}
                  blockers=${(t.depends_on || []).filter((d) => (byId.get(d) || {}).status !== "done")}
                  refresh=${refresh} />`)}
          </div>
        </div>`;
	})}
    </div>
  </div>`;
}
function Overview({ state, refresh }) {
	return m$1`<div>
    <h2>activity</h2>
    <${HiveView} state=${state} refresh=${refresh} />
    <${Kanban} state=${state} refresh=${refresh} />
  </div>`;
}
function Scope({ user, refresh }) {
	const [data, setData] = d(null);
	const preRef = A(null);
	const pinned = A(true);
	h(() => {
		let live = true;
		setData(null);
		const load = async () => {
			try {
				const d = await (await fetch(`/api/peek/${encodeURIComponent(user)}`)).json();
				if (live) setData(d);
			} catch {}
		};
		load();
		const t = setInterval(load, PEEK_MS);
		return () => {
			live = false;
			clearInterval(t);
		};
	}, [user]);
	h(() => {
		const pre = preRef.current;
		if (pre && pinned.current) pre.scrollTop = pre.scrollHeight;
	}, [data]);
	const onScroll = (e) => {
		const el = e.target;
		pinned.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
	};
	return m$1`<div class="scope">
    <div class="bar">
      <span class="t">terminal</span>
      <span>${data ? data.tmux_pane : ""}</span>
      <span style="margin-left:auto">live capture · 2s</span>
    </div>
    ${data && data.error ? m$1`<div class="err">could not capture pane: ${data.error}</div>` : m$1`<pre ref=${preRef} onScroll=${onScroll}>${data ? (data.text || "").replace(/\s+$/, "") || "(pane is blank)" : "capturing pane…"}</pre>`}
    <${MessageComposer} recipient=${user} refresh=${refresh} draftId="terminal" />
  </div>`;
}
function MessageComposer({ recipient, refresh, draftId = "thread" }) {
	const [text, setText] = d("");
	const [context, setContext] = d("");
	const [status, setStatus] = d("");
	const [sending, setSending] = d(false);
	const composerRef = A(null);
	const draftKey = `agent-msg:draft:${recipient}:${draftId}`;
	h(() => {
		try {
			const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
			setText(draft?.text || "");
			setContext(draft?.context || "");
			setStatus("");
		} catch {}
	}, [draftKey]);
	h(() => {
		const el = composerRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
	}, [text]);
	const send = async (e) => {
		e.preventDefault();
		const content = text.trim();
		if (!content || sending) return;
		setSending(true);
		setStatus("");
		try {
			if (!(await fetch("/owner/send", {
				method: "POST",
				headers: JSONH,
				body: JSON.stringify({
					recipient,
					content,
					context: context.trim() || null
				})
			})).ok) throw new Error("delivery failed");
			setText("");
			setContext("");
			localStorage.removeItem(draftKey);
			setStatus("delivered");
			setTimeout(() => setStatus(""), 2500);
			refresh();
		} catch {
			setStatus("delivery failed — draft kept");
		} finally {
			setSending(false);
		}
	};
	const updateText = (value) => {
		setText(value);
		localStorage.setItem(draftKey, JSON.stringify({
			text: value,
			context
		}));
	};
	const updateContext = (value) => {
		setContext(value);
		localStorage.setItem(draftKey, JSON.stringify({
			text,
			context: value
		}));
	};
	const clearDraft = () => {
		setText("");
		setContext("");
		setStatus("");
		localStorage.removeItem(draftKey);
		composerRef.current?.focus();
	};
	return m$1`<form class="composer" onSubmit=${send}>
    <div class="compose-row">
      <span class="mark">❯</span>
      <textarea ref=${composerRef} value=${text} rows="2"
        onInput=${(e) => updateText(e.target.value)}
        onKeyDown=${(e) => {
		if (e.key === "Enter" && !e.shiftKey && !(e.metaKey || e.ctrlKey)) send(e);
	}}
        placeholder=${`Message ${recipient}…`} aria-label=${`Message ${recipient} as owner`} />
    </div>
    <div class="compose-meta">
      <input class="context" type="text" value=${context} onInput=${(e) => updateContext(e.target.value)}
        placeholder="context tag (optional)" aria-label="Optional context tag" />
      <span class="count">${text.length} character${text.length === 1 ? "" : "s"}</span>
      <span class="hint">Enter to send · Shift + Enter for a new line</span>
      <div class="actions">
        ${status && m$1`<span class=${status.startsWith("delivery failed") ? "error" : "sent"} role="status">${status}</span>`}
        ${(text || context) && m$1`<button type="button" class="mini" onClick=${clearDraft}>clear</button>`}
        <button class="act" type="submit" disabled=${sending || !text.trim()}>
          ${sending ? "sending…" : "send"}
        </button>
      </div>
    </div>
  </form>`;
}
function Thread({ a, b, msgs, freshIds, now, refresh }) {
	const boxRef = A(null);
	const pinned = A(true);
	const resizeRef = A(null);
	const [historyHeight, setHistoryHeight] = d(null);
	const recipient = a === "owner" ? b : b === "owner" ? a : null;
	h(() => {
		const el = boxRef.current;
		if (el && pinned.current) el.scrollTop = el.scrollHeight;
	}, [msgs.length]);
	const onScroll = (e) => {
		const el = e.target;
		pinned.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
	};
	const resizeBounds = () => ({
		min: 120,
		max: Math.max(120, Math.floor(innerHeight * .85))
	});
	const resizeTo = (height) => {
		const { min, max } = resizeBounds();
		setHistoryHeight(Math.max(min, Math.min(max, Math.round(height))));
	};
	const resizeStart = (e) => {
		e.preventDefault();
		e.currentTarget.setPointerCapture(e.pointerId);
		resizeRef.current = {
			y: e.clientY,
			height: boxRef.current.getBoundingClientRect().height
		};
	};
	const resizeMove = (e) => {
		if (!resizeRef.current) return;
		resizeTo(resizeRef.current.height + e.clientY - resizeRef.current.y);
	};
	const resizeEnd = (e) => {
		if (!resizeRef.current) return;
		resizeRef.current = null;
		if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
	};
	const resizeKey = (e) => {
		const current = historyHeight ?? boxRef.current.getBoundingClientRect().height;
		const { min, max } = resizeBounds();
		const next = e.key === "ArrowUp" ? current - 40 : e.key === "ArrowDown" ? current + 40 : e.key === "Home" ? min : e.key === "End" ? max : null;
		if (next === null) return;
		e.preventDefault();
		resizeTo(next);
	};
	return m$1`<div class="thread">
    <div class="bar">${disp(a)} <span class="swap">⇄</span> ${disp(b)}
      <span class="n">${msgs.length} msg${msgs.length === 1 ? "" : "s"}</span></div>
    <div class="msgs" ref=${boxRef} onScroll=${onScroll}
      style=${historyHeight === null ? null : { height: `${historyHeight}px` }}>
      ${msgs.slice(-40).map((m) => m$1`
        <div key=${m.id} class=${[
		"msg",
		m.sender === a ? "" : "right",
		freshIds.has(m.id) ? "fresh" : "",
		m.delivered ? "" : "failed",
		m.sender === "owner" ? "from-owner" : ""
	].join(" ")}>
          <div class="bubble">${m.content}</div>
          <div class="tag">${disp(m.sender)}${m.context && m$1` · <span class="ctx">${m.context}</span>`} · ${rel(m.ts, now)}${!m.delivered && m$1` · <span class="ctx">undelivered${m.delivery_error ? `: ${m.delivery_error}` : ""}</span>`}</div>
        </div>`)}
    </div>
    <button type="button" class="history-resizer" role="separator" aria-orientation="horizontal"
      aria-label="Resize conversation history"
      aria-valuemin="120" aria-valuemax=${resizeBounds().max}
      aria-valuenow=${historyHeight ?? 340} title="Drag to resize conversation history"
      onPointerDown=${resizeStart} onPointerMove=${resizeMove}
      onPointerUp=${resizeEnd} onPointerCancel=${resizeEnd} onKeyDown=${resizeKey}>
      <span>drag to resize history</span>
    </button>
    ${recipient && m$1`<${MessageComposer} recipient=${recipient} refresh=${refresh} />`}
  </div>`;
}
function FocusView({ user, state, refresh, freshIds }) {
	const r = state.recipients.find((x) => x.user_id === user);
	if (!r) return m$1`<div class="empty">No agent named "${user}".
    <br /><br /><button class="mini" onClick=${() => {
		location.hash = "#/";
	}}>back to overview</button></div>`;
	const flavor = (r.flavor || "generic").toLowerCase();
	const status = agentStatus(r);
	const st = STATE[status] || STATE.unknown;
	const detail = r.activity && r.activity.detail;
	const myTasks = state.tasks.filter((t) => t.assignee === user);
	const agentIds = state.recipients.filter((x) => x.pane_alive).map((x) => x.user_id);
	const taskIds = agentIds.includes(user) ? agentIds : agentIds.concat(user);
	const groups = /* @__PURE__ */ new Map();
	for (const m of state.messages) {
		if (m.sender !== user && m.recipient !== user) continue;
		const k = pairKey(m.sender, m.recipient);
		if (!groups.has(k)) groups.set(k, []);
		groups.get(k).push(m);
	}
	const threads = [...groups.values()].sort((x, y) => y[y.length - 1].ts - x[x.length - 1].ts);
	const hasOwnerThread = threads.some((msgs) => msgs.some((m) => m.sender === "owner" || m.recipient === "owner"));
	const act = async (id, p) => {
		await patchTask(id, p);
		refresh();
	};
	return m$1`<div>
    <button type="button" class="focus-back" onClick=${() => {
		location.hash = "#/";
	}}>← back to overview</button>
    <div class="fhead">
      <${Avatar} name=${user} />
      <div class="who">
        <div class="nm">${user}<span class=${`status ${st.cls}`} title=${st.word}></span></div>
        <div class="meta">
          <span class="chip">${FLAVOR_ICON[flavor] || FLAVOR_ICON.generic} ${flavor}</span>
          ${r.model && m$1` <b>${r.model}</b>`} · pane <b>${r.tmux_pane}</b>${r.pane_alive ? "" : " (stopped)"}
          · joined ${rel(r.registered_at, state.now)}
          · <span style=${`color:${st.color}`}>${st.word}</span>${status === "needs_attention" && detail ? m$1` <span class="attn">${detail}</span>` : ""}
        </div>
        ${r.instructions && m$1`<div class="inst">"${r.instructions}"</div>`}
      </div>
    </div>
    <${Scope} user=${user} refresh=${refresh} />
    <h2>conversations ${threads.length > 0 && m$1`<span class="count">· ${threads.length}</span>`}</h2>
    ${threads.length === 0 ? m$1`<div class="thread"><div class="empty">Nothing yet. Start a conversation with ${user} below.</div>
          <${MessageComposer} recipient=${user} refresh=${refresh} /></div>` : threads.map((msgs) => {
		const [a, b] = pairKey(msgs[0].sender, msgs[0].recipient).split(" ");
		return m$1`<${Thread} key=${pairKey(a, b)} a=${a} b=${b} msgs=${msgs}
            freshIds=${freshIds} now=${state.now} refresh=${refresh} />`;
	})}
    ${threads.length > 0 && !hasOwnerThread && m$1`<div class="thread" style="margin-top:14px">
      <div class="bar">${disp("owner")} <span class="swap">⇄</span> ${user}</div>
      <${MessageComposer} recipient=${user} refresh=${refresh} />
    </div>`}
    <h2 style="margin-top:26px">tasks ${myTasks.length > 0 && m$1`<span class="count">· ${myTasks.length}</span>`}</h2>
    ${myTasks.length === 0 ? m$1`<div class="empty">No tasks assigned to ${user}. Assign one from the overview board.</div>` : myTasks.map((t) => m$1`<div key=${t.id} class=${`trow ${t.status}`}>
          <span class="tid">#${t.id}</span>
          <span class="t">${t.title}</span>
          <span class=${`pill ${t.status}`}>${t.status.replace("_", " ")}</span>
          <select title="assignee" value=${t.assignee || ""}
            onChange=${(e) => act(t.id, { assignee: e.target.value })}>
            <option value="">unassigned</option>
            ${taskIds.map((a) => m$1`<option key=${a} value=${a}>${a}${agentIds.includes(a) ? "" : " (stopped)"}</option>`)}
          </select>
          ${t.status === "done" ? m$1`<button class="mini" onClick=${() => act(t.id, { status: "open" })}>reopen</button>` : m$1`<button class="mini" onClick=${() => act(t.id, { status: "done" })}>done</button>`}
        </div>`)}
  </div>`;
}
function App() {
	const [state, setState] = d(null);
	const [connected, setConnected] = d(true);
	const [clock, setClock] = d((/* @__PURE__ */ new Date()).toLocaleTimeString());
	const [route, setRoute] = d(location.hash);
	const [freshIds, setFreshIds] = d(/* @__PURE__ */ new Set());
	const [pings, setPings] = d({});
	const seen = A({
		maxId: 0,
		first: true,
		byAgent: {}
	});
	const focusUser = route.startsWith("#/agent/") ? decodeURIComponent(route.slice(8)) : null;
	const poll = async () => {
		try {
			const s = await (await fetch("/api/state")).json();
			const st = seen.current;
			const maxId = Math.max(st.maxId, ...s.messages.map((m) => m.id), 0);
			const fresh = s.messages.filter((m) => m.id > st.maxId);
			if (!st.first && fresh.length) {
				setFreshIds(new Set(fresh.map((m) => m.id)));
				setPings(Object.fromEntries(fresh.flatMap((m) => [[m.sender, 1], [m.recipient, 1]])));
				setTimeout(() => setPings({}), 1e3);
			}
			for (const rec of s.recipients) if (st.first || !(rec.user_id in st.byAgent)) st.byAgent[rec.user_id] = maxId;
			st.maxId = maxId;
			st.first = false;
			setState(s);
			setConnected(true);
		} catch {
			setConnected(false);
		}
	};
	h(() => {
		poll();
		const t = setInterval(poll, POLL_MS);
		const c = setInterval(() => setClock((/* @__PURE__ */ new Date()).toLocaleTimeString()), 1e3);
		const onHash = () => setRoute(location.hash);
		const onKey = (e) => {
			if (e.key === "Escape" && ![
				"INPUT",
				"SELECT",
				"TEXTAREA"
			].includes(document.activeElement.tagName)) location.hash = "#/";
		};
		addEventListener("hashchange", onHash);
		addEventListener("keydown", onKey);
		return () => {
			clearInterval(t);
			clearInterval(c);
			removeEventListener("hashchange", onHash);
			removeEventListener("keydown", onKey);
		};
	}, []);
	if (focusUser && seen.current.byAgent[focusUser] !== void 0) seen.current.byAgent[focusUser] = seen.current.maxId;
	const unreadFor = (u) => {
		if (!state || u === focusUser) return false;
		const since = seen.current.byAgent[u] ?? seen.current.maxId;
		return state.messages.some((m) => m.id > since && (m.sender === u || m.recipient === u));
	};
	const header = m$1`<header class="top">
    <h1 style="cursor:pointer" onClick=${() => {
		location.hash = "#/";
	}}>agent dashboard</h1>
    <span class="sub">agent-msg</span>
    <div class="right">
      <span><span class=${`beacon ${connected ? "" : "down"}`}></span>${connected ? "watching" : "server unreachable"}</span>
      <span>${clock}</span>
    </div>
  </header>`;
	if (!state) return m$1`${header}<main><div class="stage"><div class="empty">connecting…</div></div></main>`;
	return m$1`${header}
  <main>
    <div class="stage">
      ${focusUser ? m$1`<${FocusView} user=${focusUser} state=${state} refresh=${poll} freshIds=${freshIds} />` : m$1`<${Overview} state=${state} refresh=${poll} />`}
    </div>
    <${Roster} state=${state} focusUser=${focusUser} unreadFor=${unreadFor}
      pings=${pings} refresh=${poll} />
  </main>`;
}
R(m$1`<${App} />`, document.getElementById("app"));
//#endregion
