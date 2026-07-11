import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ShoppingCart, X, Plus, Minus, Menu, LogOut, Search, User, Package, MapPin, HelpCircle } from "lucide-react";

const API_BASE = "https://earlybird-backend-vh85.onrender.com/api";

const TOKENS = {
  bg: "#EAF3FB",
  bgAlt: "#DCEAF6",
  ink: "#1B2A3D",
  inkSoft: "#4C6478",
  sky: "#5FA8D3",
  skyDeep: "#2F6E96",
  skyPale: "#CFE6F5",
  mist: "#F2F8FC",
  line: "#C6DCEC",
  cream: "#FFFFFF",
  error: "#B3452F",
  coral: "#E2795E",
  coralPale: "#FBE0D4",
};

// Each category gets its own tile color so the product grid has real
// variety instead of one flat blue repeated in every card.
const CATEGORY_COLORS = {
  "Mats & Props": { pale: "#CFE6F5", deep: "#2F6E96" },
  "Apparel": { pale: "#FBE0D4", deep: "#C25C3F" },
  "Meditation": { pale: "#E7DCF5", deep: "#6E4F96" },
  "Accessories": { pale: "#D7F0E4", deep: "#2F9668" },
};
function categoryColor(category) {
  return CATEGORY_COLORS[category] || { pale: TOKENS.skyPale, deep: TOKENS.skyDeep };
}

const CATEGORIES = ["All", "Mats & Props", "Apparel", "Meditation", "Accessories"];

// UI-chrome translations. Product names/descriptions come from the
// database and aren't translated here — that would need a separate
// translated-content field per product, which is a bigger backend
// change than this covers.
const TRANSLATIONS = {
  en: {
    shop: "Shop", materials: "Materials", ourPractice: "Our practice",
    heroTag: "Props made from what the earth already gave us",
    heroTitle1: "Find your ground,", heroTitle2: "one breath at a time.",
    heroBody: "Mats, blocks and quiet-room essentials built from cork, natural rubber and undyed fiber — made to hold a pose and hold up for years.",
    shopCollection: "Shop the collection",
    freeShipping: "Free shipping over $50", returns: "30-day returns", naturalOnly: "Natural materials only",
    featured: "Featured this week",
    searchPlaceholder: "Search products by name or material…",
    all: "All", matsProps: "Mats & Props", apparel: "Apparel", meditation: "Meditation", accessories: "Accessories",
    price: "Price", inStockOnly: "In stock only", clearFilters: "Clear filters",
    loadingProducts: "Loading products…", addToBag: "Add to bag", outOfStock: "Out of stock",
    yourBag: "Your bag", bagEmpty: "Your bag is empty. Add something that feels steady.",
    subtotal: "Subtotal", checkout: "Checkout", checkoutGuest: "Checkout as guest",
    signInPrompt: "Have an account? Sign in for faster checkout & order history",
    emailForUpdates: "Email for order updates", backToBag: "← Back to bag",
    account: "Account", offerBanner: "Limited-time offer — 15% off all mats this week, no code needed",
  },
  de: {
    shop: "Shop", materials: "Materialien", ourPractice: "Unsere Praxis",
    heroTag: "Zubehör aus dem, was die Erde bereits gegeben hat",
    heroTitle1: "Finde deinen Halt,", heroTitle2: "einen Atemzug nach dem anderen.",
    heroBody: "Matten, Blöcke und Zubehör für den ruhigen Raum aus Kork, Naturkautschuk und ungefärbter Faser — gemacht, um eine Haltung zu tragen und jahrelang zu halten.",
    shopCollection: "Kollektion ansehen",
    freeShipping: "Kostenloser Versand ab 50 $", returns: "30 Tage Rückgabe", naturalOnly: "Nur Naturmaterialien",
    featured: "Diese Woche im Fokus",
    searchPlaceholder: "Produkte nach Name oder Material suchen…",
    all: "Alle", matsProps: "Matten & Zubehör", apparel: "Kleidung", meditation: "Meditation", accessories: "Accessoires",
    price: "Preis", inStockOnly: "Nur auf Lager", clearFilters: "Filter zurücksetzen",
    loadingProducts: "Produkte werden geladen…", addToBag: "In die Tasche", outOfStock: "Ausverkauft",
    yourBag: "Deine Tasche", bagEmpty: "Deine Tasche ist leer. Füge etwas Erdendes hinzu.",
    subtotal: "Zwischensumme", checkout: "Zur Kasse", checkoutGuest: "Als Gast bestellen",
    signInPrompt: "Schon ein Konto? Anmelden für schnelleren Checkout & Bestellverlauf",
    emailForUpdates: "E-Mail für Bestell-Updates", backToBag: "← Zurück zur Tasche",
    account: "Konto", offerBanner: "Zeitlich begrenztes Angebot — diese Woche 15 % auf alle Matten, kein Code nötig",
  },
};

const CATEGORY_KEY_MAP = { "All": "all", "Mats & Props": "matsProps", "Apparel": "apparel", "Meditation": "meditation", "Accessories": "accessories" };

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Small edit-distance function so search tolerates minor typos
// ("corc" still finds "cork") without needing an external library.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(query, text) {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return true;
  if (t.includes(q)) return true;
  // Fall back to per-word edit distance for short queries/typos —
  // tolerance scales a little with word length so short words aren't
  // matched too loosely.
  return t.split(/\s+/).some((word) => levenshtein(word, q) <= (q.length > 5 ? 2 : 1));
}

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

// Small wrapper around fetch that adds the API base URL, JSON headers,
// the auth token when present, and throws a readable error message
// pulled from the backend's { error: "..." } response shape.
async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}

function ProductCard({ p, index, onAdd, onView, t }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className="yg-card"
      onClick={() => onView(p)}
      style={{
        cursor: "pointer",
        transitionDelay: `${(index % 4) * 70}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(18px)",
      }}
    >
      {p.image_url ? (
        <div className="yg-tile" style={{ overflow: "hidden" }}>
          <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <div className="yg-tile" style={{ background: `linear-gradient(180deg, ${TOKENS.mist} 0%, ${categoryColor(p.category).pale} 100%)` }}>
          <span className="yg-ripple" style={{ borderColor: categoryColor(p.category).deep }} />
          <span className="yg-ripple yg-ripple-2" style={{ borderColor: categoryColor(p.category).deep }} />
        </div>
      )}
      <div style={{ padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 500 }}>{p.name}</p>
          <p style={{ margin: 0, fontSize: 12.5, color: TOKENS.inkSoft }}>{p.material}</p>
        </div>
        <span className="yg-label" style={{ fontSize: 13, marginTop: "auto", color: categoryColor(p.category).deep }}>
          {formatPrice(p.price_cents)}
        </span>
        <button
          className="yg-add-btn yg-action"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(p.id);
          }}
          disabled={p.stock < 1}
          style={
            p.stock < 1
              ? { opacity: 0.45, cursor: "not-allowed" }
              : { borderColor: TOKENS.coral, color: TOKENS.coral }
          }
        >
          {p.stock < 1 ? t("outOfStock") : t("addToBag")}
        </button>
      </div>
    </div>
  );
}

function StarRating({ value, onChange, size = 16 }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onChange && onChange(n)}
          style={{
            cursor: onChange ? "pointer" : "default",
            fontSize: size,
            color: n <= value ? "#E2A73E" : "#D8D8D8",
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function ProductDetail({ product, allProducts, onClose, onAdd, onSelectRelated, apiRequest, token, t }) {
  const [qty, setQty] = useState(1);
  const colors = categoryColor(product.category);

  // Best-effort real-time stock check: refetch this specific product
  // when the detail view opens, so a stale number from the grid
  // (fetched whenever the page loaded) doesn't mislead someone into
  // adding more than is actually available right now.
  const [liveStock, setLiveStock] = useState(product.stock);
  useEffect(() => {
    setLiveStock(product.stock);
    apiRequest(`/products/${product.slug}`)
      .then((data) => setLiveStock(data.product.stock))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ count: 0, average: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState("");
  const [myPhotoUrl, setMyPhotoUrl] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  useEffect(() => {
    setReviewsLoading(true);
    apiRequest(`/products/${product.id}/reviews`)
      .then((data) => {
        setReviews(data.reviews);
        setReviewSummary({ count: data.count, average: data.average });
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  async function submitReview() {
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await apiRequest(`/products/${product.id}/reviews`, {
        method: "POST",
        token,
        body: { rating: myRating, comment: myComment, photo_url: myPhotoUrl || null },
      });
      const data = await apiRequest(`/products/${product.id}/reviews`);
      setReviews(data.reviews);
      setReviewSummary({ count: data.count, average: data.average });
      setMyComment("");
      setMyPhotoUrl("");
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 3);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      <div className="yg-cart-overlay" onClick={onClose} />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(680px, 92%)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: TOKENS.cream,
          borderRadius: 18,
          boxShadow: "0 24px 60px rgba(27,42,61,0.25)",
          animation: "pop 0.25s ease",
          zIndex: 50,
        }}
      >
        <div style={{ position: "relative" }}>
          {product.image_url ? (
            <div style={{ height: 220, borderRadius: "18px 18px 0 0", overflow: "hidden" }}>
              <img src={product.image_url} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : (
            <div
              className="yg-tile"
              style={{ height: 220, borderRadius: "18px 18px 0 0", background: `linear-gradient(180deg, ${TOKENS.mist} 0%, ${colors.pale} 100%)` }}
            >
              <span className="yg-ripple" style={{ borderColor: colors.deep, width: 100, height: 100 }} />
              <span className="yg-ripple yg-ripple-2" style={{ borderColor: colors.deep, width: 100, height: 100 }} />
            </div>
          )}
          <button
            className="yg-icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ position: "absolute", top: 14, right: 14, background: TOKENS.cream, borderRadius: "50%", width: 32, height: 32 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 28 }}>
          <p className="yg-label" style={{ fontSize: 11, color: colors.deep, marginBottom: 8 }}>{product.category}</p>
          <h2 className="yg-display" style={{ fontSize: 26, fontStyle: "italic", margin: "0 0 8px", color: TOKENS.ink }}>
            {product.name}
          </h2>
          <p style={{ fontSize: 14, color: TOKENS.inkSoft, margin: "0 0 8px" }}>{product.material}</p>

          {reviewSummary.count > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <StarRating value={Math.round(reviewSummary.average)} />
              <span style={{ fontSize: 12.5, color: TOKENS.inkSoft }}>
                {reviewSummary.average.toFixed(1)} ({reviewSummary.count} review{reviewSummary.count !== 1 ? "s" : ""})
              </span>
            </div>
          )}

          <p style={{ fontSize: 15, lineHeight: 1.7, color: TOKENS.ink, margin: "0 0 18px" }}>
            {product.description || "No description available for this product yet."}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginBottom: 20, fontSize: 12.5, color: TOKENS.inkSoft }}>
            <span style={{ color: liveStock < 1 ? TOKENS.error : liveStock <= 5 ? TOKENS.coral : "#2F9668", fontWeight: 500 }}>
              {liveStock < 1 ? "Out of stock" : liveStock <= 5 ? `Only ${liveStock} left` : `${liveStock} in stock`}
            </span>
            <span>Free shipping over $50</span>
            <span>Delivers in 2-3 business days</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span className="yg-label" style={{ fontSize: 18, color: colors.deep }}>{formatPrice(product.price_cents)}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="yg-qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                <Minus size={12} />
              </button>
              <span style={{ fontSize: 14, minWidth: 16, textAlign: "center" }}>{qty}</span>
              <button className="yg-qty-btn" onClick={() => setQty((q) => Math.min(liveStock, q + 1))} aria-label="Increase quantity">
                <Plus size={12} />
              </button>
            </div>
          </div>

          <button
            className="yg-add-btn yg-action"
            disabled={liveStock < 1}
            onClick={() => onAdd(product.id, qty)}
            style={
              liveStock < 1
                ? { opacity: 0.45, cursor: "not-allowed" }
                : { background: TOKENS.coral, borderColor: TOKENS.coral, color: "#fff", padding: "13px 0" }
            }
          >
            {liveStock < 1 ? t("outOfStock") : t("addToBag")}
          </button>

          {related.length > 0 && (
            <div style={{ marginTop: 32, borderTop: `1px solid ${TOKENS.line}`, paddingTop: 22 }}>
              <p className="yg-label" style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 14 }}>You might also like</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {related.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => onSelectRelated(r)}
                    style={{ cursor: "pointer", border: `1px solid ${TOKENS.line}`, borderRadius: 10, overflow: "hidden" }}
                  >
                    <div style={{ height: 64, background: `linear-gradient(180deg, ${TOKENS.mist} 0%, ${categoryColor(r.category).pale} 100%)` }} />
                    <div style={{ padding: 8 }}>
                      <p style={{ fontSize: 12, margin: "0 0 2px", fontWeight: 500 }}>{r.name}</p>
                      <p className="yg-label" style={{ fontSize: 11, margin: 0, color: categoryColor(r.category).deep }}>
                        {formatPrice(r.price_cents)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 32, borderTop: `1px solid ${TOKENS.line}`, paddingTop: 22 }}>
            <p className="yg-label" style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 14 }}>Reviews</p>

            {reviewsLoading && <p style={{ fontSize: 13, color: TOKENS.inkSoft }}>Loading reviews…</p>}
            {!reviewsLoading && reviews.length === 0 && (
              <p style={{ fontSize: 13, color: TOKENS.inkSoft, marginBottom: 16 }}>No reviews yet — be the first.</p>
            )}

            {reviews.map((r) => (
              <div key={r.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${TOKENS.line}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <StarRating value={r.rating} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.user_name}</span>
                </div>
                {r.comment && <p style={{ fontSize: 13.5, color: TOKENS.ink, margin: "4px 0" }}>{r.comment}</p>}
                {r.photo_url && (
                  <img src={r.photo_url} alt="Customer upload" style={{ maxWidth: 120, borderRadius: 8, marginTop: 6 }} />
                )}
              </div>
            ))}

            {token ? (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 13, marginBottom: 8 }}>Leave a review</p>
                <StarRating value={myRating} onChange={setMyRating} size={20} />
                <textarea
                  value={myComment}
                  onChange={(e) => setMyComment(e.target.value)}
                  placeholder="What did you think?"
                  style={{ ...inputStyle, width: "100%", minHeight: 70, marginTop: 10 }}
                />
                <input
                  type="text"
                  value={myPhotoUrl}
                  onChange={(e) => setMyPhotoUrl(e.target.value)}
                  placeholder="Photo URL (optional)"
                  style={{ ...inputStyle, width: "100%", marginTop: 8 }}
                />
                {reviewError && <p style={{ color: TOKENS.error, fontSize: 13, marginTop: 8 }}>{reviewError}</p>}
                <button
                  className="yg-add-btn"
                  onClick={submitReview}
                  disabled={submittingReview}
                  style={{ marginTop: 10, background: TOKENS.skyDeep, borderColor: TOKENS.skyDeep, color: "#fff", padding: "11px 0" }}
                >
                  {submittingReview ? "Submitting…" : "Submit review"}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: TOKENS.inkSoft, marginTop: 12 }}>Sign in from the cart to leave a review.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountPanel({ user, token, onClose, onLogout, apiRequest, formatPrice }) {
  const [tab, setTab] = useState("profile");
  const [name, setName] = useState(user?.name || "");
  const [address, setAddress] = useState(user?.default_address || "");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  useEffect(() => {
    if (tab === "orders" && orders.length === 0) {
      setOrdersLoading(true);
      apiRequest("/orders", { token })
        .then((data) => setOrders(data.orders))
        .catch((err) => setOrdersError(err.message))
        .finally(() => setOrdersLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function saveProfile() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await apiRequest("/auth/me", { method: "PUT", token, body: { name, default_address: address } });
      setSaveMessage("Saved.");
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "orders", label: "My orders", icon: Package },
    { id: "address", label: "Saved address", icon: MapPin },
    { id: "help", label: "Help & support", icon: HelpCircle },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40 }}>
      <div className="yg-cart-overlay" onClick={onClose} />
      <div className="yg-cart-drawer">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px", borderBottom: `1px solid ${TOKENS.line}` }}>
          <p className="yg-display" style={{ fontSize: 20, fontStyle: "italic", margin: 0 }}>Account</p>
          <button className="yg-icon-btn" aria-label="Close account panel" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${TOKENS.line}`, overflowX: "auto" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                minWidth: 90,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "10px 6px",
                background: tab === t.id ? TOKENS.mist : "transparent",
                border: "none",
                borderBottom: tab === t.id ? `2px solid ${TOKENS.skyDeep}` : "2px solid transparent",
                color: tab === t.id ? TOKENS.skyDeep : TOKENS.inkSoft,
                cursor: "pointer",
                fontSize: 10.5,
                fontFamily: "'Space Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {tab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: 0 }}>Email</p>
              <p style={{ fontSize: 14, margin: "0 0 8px" }}>{user?.email}</p>

              <label style={{ fontSize: 13, color: TOKENS.inkSoft }}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

              {saveError && <p style={{ color: TOKENS.error, fontSize: 13, margin: 0 }}>{saveError}</p>}
              {saveMessage && <p style={{ color: TOKENS.skyDeep, fontSize: 13, margin: 0 }}>{saveMessage}</p>}

              <button
                className="yg-add-btn"
                onClick={saveProfile}
                disabled={saving}
                style={{ background: TOKENS.skyDeep, borderColor: TOKENS.skyDeep, color: "#fff", padding: "12px 0" }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>

              <button
                onClick={onLogout}
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "none",
                  border: `1px solid ${TOKENS.line}`,
                  borderRadius: 8,
                  padding: "12px 0",
                  color: TOKENS.error,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}

          {tab === "orders" && (
            <div>
              {ordersLoading && <p style={{ fontSize: 14, color: TOKENS.inkSoft }}>Loading your orders…</p>}
              {ordersError && <p style={{ fontSize: 14, color: TOKENS.error }}>{ordersError}</p>}
              {!ordersLoading && !ordersError && orders.length === 0 && (
                <p style={{ fontSize: 14, color: TOKENS.inkSoft }}>No orders yet.</p>
              )}
              {orders.map((order) => (
                <div key={order.id} style={{ border: `1px solid ${TOKENS.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span className="yg-label" style={{ fontSize: 11 }}>Order #{order.id}</span>
                    <span
                      className="yg-label"
                      style={{
                        fontSize: 10,
                        color: order.status === "paid" ? "#2F9668" : TOKENS.inkSoft,
                      }}
                    >
                      {order.status}
                    </span>
                  </div>
                  {order.items.map((item, i) => (
                    <p key={i} style={{ fontSize: 13, margin: "0 0 4px", color: TOKENS.inkSoft }}>
                      {item.quantity} × {item.product_name}
                    </p>
                  ))}
                  <p style={{ fontSize: 13, fontWeight: 500, margin: "8px 0 0" }}>{formatPrice(order.subtotal_cents)}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "address" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 13, color: TOKENS.inkSoft }}>Default shipping address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, state, ZIP"
                style={{ ...inputStyle, minHeight: 90 }}
              />
              {saveError && <p style={{ color: TOKENS.error, fontSize: 13, margin: 0 }}>{saveError}</p>}
              {saveMessage && <p style={{ color: TOKENS.skyDeep, fontSize: 13, margin: 0 }}>{saveMessage}</p>}
              <button
                className="yg-add-btn"
                onClick={saveProfile}
                disabled={saving}
                style={{ background: TOKENS.skyDeep, borderColor: TOKENS.skyDeep, color: "#fff", padding: "12px 0" }}
              >
                {saving ? "Saving…" : "Save address"}
              </button>
            </div>
          )}

          {tab === "help" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>Order questions</p>
                <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: 0 }}>
                  Check "My orders" for status. For anything else, email support@earlybird.example.
                </p>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>Returns</p>
                <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: 0 }}>30-day returns on unused items in original packaging.</p>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>Shipping</p>
                <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: 0 }}>Free shipping on orders over $50. Typically ships in 2-3 business days.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthForm({ mode, setMode, onLogin, onRequestOtp, onVerifyOtp, loading, error }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpStep, setOtpStep] = useState(false); // false = enter details, true = enter code
  const [code, setCode] = useState("");

  async function handleDetailsSubmit(e) {
    e.preventDefault();
    if (mode === "login") {
      onLogin({ email, password });
      return;
    }
    const sent = await onRequestOtp({ name, email, password });
    if (sent) setOtpStep(true);
  }

  function handleCodeSubmit(e) {
    e.preventDefault();
    onVerifyOtp({ email, code });
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setOtpStep(false);
    setCode("");
  }

  if (mode === "register" && otpStep) {
    return (
      <form onSubmit={handleCodeSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 14, color: TOKENS.inkSoft, margin: 0 }}>
          We sent a 6-digit code to <strong>{email}</strong>. If you haven't set up real email sending yet, check
          the backend's terminal — the code is printed there for local testing.
        </p>
        <input
          type="text"
          inputMode="numeric"
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          maxLength={6}
          style={{ ...inputStyle, letterSpacing: "0.3em", textAlign: "center", fontSize: 18 }}
        />
        {error && <p style={{ color: TOKENS.error, fontSize: 13, margin: 0 }}>{error}</p>}
        <button
          type="submit"
          className="yg-add-btn"
          disabled={loading}
          style={{ background: TOKENS.skyDeep, borderColor: TOKENS.skyDeep, color: "#fff", padding: "13px 0" }}
        >
          {loading ? "Verifying…" : "Verify and create account"}
        </button>
        <button
          type="button"
          onClick={() => setOtpStep(false)}
          style={{ background: "none", border: "none", color: TOKENS.skyDeep, fontSize: 13, cursor: "pointer", padding: 0 }}
        >
          Back
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleDetailsSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 14, color: TOKENS.inkSoft, margin: 0 }}>
        {mode === "login" ? "Sign in to view your bag and check out." : "Create an account to start your bag."}
      </p>

      {mode === "register" && (
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={inputStyle}
        />
      )}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={inputStyle}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        style={inputStyle}
      />

      {error && <p style={{ color: TOKENS.error, fontSize: 13, margin: 0 }}>{error}</p>}

      <button
        type="submit"
        className="yg-add-btn"
        disabled={loading}
        style={{ background: TOKENS.skyDeep, borderColor: TOKENS.skyDeep, color: "#fff", padding: "13px 0" }}
      >
        {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Send verification code"}
      </button>

      <button
        type="button"
        onClick={() => switchMode(mode === "login" ? "register" : "login")}
        style={{ background: "none", border: "none", color: TOKENS.skyDeep, fontSize: 13, cursor: "pointer", padding: 0 }}
      >
        {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

const inputStyle = {
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${TOKENS.line}`,
  fontSize: 14,
  fontFamily: "'Work Sans', sans-serif",
};

function ProductCarousel({ products, onSelect, t }) {
  const featured = products.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || featured.length === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % featured.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [paused, featured.length]);

  if (featured.length === 0) return null;

  const p = featured[index];
  const colors = categoryColor(p.category);

  return (
    <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 8px" }}>
      <p className="yg-label" style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 10 }}>{t("featured")}</p>
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${TOKENS.line}`,
          background: `linear-gradient(120deg, ${TOKENS.mist} 0%, ${colors.pale} 100%)`,
          minHeight: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "28px 32px",
          cursor: "pointer",
          transition: "background 0.4s ease",
        }}
        onClick={() => onSelect(p)}
      >
        <div>
          <p className="yg-label" style={{ fontSize: 10.5, color: colors.deep, marginBottom: 8 }}>{p.category}</p>
          <h3 className="yg-display" style={{ fontSize: 24, fontStyle: "italic", margin: "0 0 8px", color: TOKENS.ink }}>{p.name}</h3>
          <p className="yg-label" style={{ fontSize: 16, color: colors.deep }}>{formatPrice(p.price_cents)}</p>
        </div>
        <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0, borderRadius: 12, overflow: "hidden" }}>
          {p.image_url ? (
            <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="yg-ripple" style={{ borderColor: colors.deep, width: 90, height: 90 }} />
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
        {featured.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Slide ${i + 1}`}
            style={{
              width: i === index ? 20 : 7,
              height: 7,
              borderRadius: 4,
              border: "none",
              background: i === index ? TOKENS.coral : TOKENS.line,
              cursor: "pointer",
              transition: "all 0.25s ease",
              padding: 0,
            }}
          />
        ))}
      </div>
    </section>
  );
}

export default function EarlybirdStore() {
  const [lang, setLang] = useState("de");
  const t = (key) => TRANSLATIONS[lang][key] || TRANSLATIONS.en[key] || key;

  const [activeCategory, setActiveCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  const [token, setToken] = useState(() => localStorage.getItem("earlybird_token"));
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  // Guest cart lives only in memory (not persisted server-side) so
  // people can shop and check out without creating an account.
  const [guestCart, setGuestCart] = useState([]); // [{ product_id, quantity }]
  const [guestEmail, setGuestEmail] = useState("");
  const [cartAuthPrompt, setCartAuthPrompt] = useState(false); // toggles the sign-in form inside the cart

  // Load the catalog once on mount.
  useEffect(() => {
    apiRequest("/products")
      .then((data) => setProducts(data.products))
      .catch((err) => setProductsError(err.message))
      .finally(() => setProductsLoading(false));
  }, []);

  const loadCart = useCallback(() => {
    if (!token) return;
    setCartLoading(true);
    apiRequest("/cart", { token })
      .then((data) => setCartItems(data.items))
      .catch(() => setToken(null))
      .finally(() => setCartLoading(false));
  }, [token]);

  // Whenever we have a token (fresh login, or restored from localStorage),
  // fetch the user's server-side cart so it survives refreshes.
  useEffect(() => {
    if (token) {
      localStorage.setItem("earlybird_token", token);
      loadCart();
    } else {
      localStorage.removeItem("earlybird_token");
      setCartItems([]);
    }
  }, [token, loadCart]);

  const [searchQuery, setSearchQuery] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => fuzzyMatch(q, p.name) || fuzzyMatch(q, p.material || "") || fuzzyMatch(q, p.category));
    }
    if (priceMin !== "") {
      list = list.filter((p) => p.price_cents >= Math.round(parseFloat(priceMin) * 100));
    }
    if (priceMax !== "") {
      list = list.filter((p) => p.price_cents <= Math.round(parseFloat(priceMax) * 100));
    }
    if (inStockOnly) {
      list = list.filter((p) => p.stock > 0);
    }
    return list;
  }, [activeCategory, products, searchQuery, priceMin, priceMax, inStockOnly]);

  // Autocomplete suggestions shown under the search bar while typing.
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => fuzzyMatch(q, p.name)).slice(0, 5);
  }, [products, searchQuery]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const PAGE_SIZE = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery, priceMin, priceMax, inStockOnly]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [offerDismissed, setOfferDismissed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Cart items in a single shape regardless of mode (guest vs logged in).
  const displayCartItems = token
    ? cartItems
    : guestCart.map((g) => {
        const product = products.find((p) => p.id === g.product_id);
        return product
          ? { product_id: product.id, quantity: g.quantity, name: product.name, price_cents: product.price_cents, stock: product.stock, image_url: product.image_url }
          : null;
      }).filter(Boolean);

  const cartCount = displayCartItems.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalCents = displayCartItems.reduce((sum, i) => sum + i.quantity * i.price_cents, 0);

  async function handleLogin({ email, password }) {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
      setUser(data.user);
      setToken(data.token);
      setCartAuthPrompt(false);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Returns true/false so the form knows whether to advance to the
  // "enter your code" step.
  async function handleRequestOtp({ name, email, password }) {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await apiRequest("/auth/register/request-otp", { method: "POST", body: { name, email, password } });
      return true;
    } catch (err) {
      setAuthError(err.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifyOtp({ email, code }) {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await apiRequest("/auth/register/verify-otp", { method: "POST", body: { email, code } });
      setUser(data.user);
      setToken(data.token);
      setCartAuthPrompt(false);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  function addToCart(productId, addQty = 1) {
    if (!token) {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      setGuestCart((cart) => {
        const existing = cart.find((i) => i.product_id === productId);
        const nextQty = Math.min((existing?.quantity || 0) + addQty, product.stock);
        if (existing) {
          return cart.map((i) => (i.product_id === productId ? { ...i, quantity: nextQty } : i));
        }
        return [...cart, { product_id: productId, quantity: nextQty }];
      });
      setSelectedProduct(null);
      setCartOpen(true);
      return;
    }
    (async () => {
      const existing = cartItems.find((i) => i.product_id === productId);
      const quantity = (existing?.quantity || 0) + addQty;
      try {
        await apiRequest("/cart/items", { method: "POST", token, body: { productId, quantity } });
        loadCart();
        setSelectedProduct(null);
        setCartOpen(true);
      } catch (err) {
        setCheckoutError(err.message);
      }
    })();
  }

  function changeQty(productId, delta) {
    if (!token) {
      setGuestCart((cart) => {
        const existing = cart.find((i) => i.product_id === productId);
        if (!existing) return cart;
        const nextQty = existing.quantity + delta;
        if (nextQty <= 0) return cart.filter((i) => i.product_id !== productId);
        return cart.map((i) => (i.product_id === productId ? { ...i, quantity: nextQty } : i));
      });
      return;
    }
    (async () => {
      const existing = cartItems.find((i) => i.product_id === productId);
      if (!existing) return;
      const quantity = existing.quantity + delta;
      try {
        if (quantity <= 0) {
          await apiRequest(`/cart/items/${productId}`, { method: "DELETE", token });
        } else {
          await apiRequest("/cart/items", { method: "POST", token, body: { productId, quantity } });
        }
        loadCart();
      } catch (err) {
        setCheckoutError(err.message);
      }
    })();
  }

  async function checkout() {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      if (token) {
        const data = await apiRequest("/orders/checkout", { method: "POST", token });
        window.location.href = data.checkoutUrl;
      } else {
        if (!guestEmail || !/^\S+@\S+\.\S+$/.test(guestEmail)) {
          setCheckoutError("Enter a valid email to check out as a guest.");
          setCheckoutLoading(false);
          return;
        }
        const items = guestCart.map((i) => ({ productId: i.product_id, quantity: i.quantity }));
        const data = await apiRequest("/orders/guest-checkout", { method: "POST", body: { items, email: guestEmail } });
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div
      style={{
        fontFamily: "'Work Sans', sans-serif",
        background: TOKENS.bg,
        color: TOKENS.ink,
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;1,400;1,500&family=Work+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }

        .yg-label { font-family: 'Space Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; }
        .yg-display { font-family: 'Fraunces', serif; }

        .breathe { animation: breathe 8s ease-in-out infinite; transform-origin: center; }
        @keyframes breathe {
          0%   { transform: scale(0.86); opacity: 0.5; }
          50%  { transform: scale(1);    opacity: 0.95; }
          100% { transform: scale(0.86); opacity: 0.5; }
        }

        @keyframes drift {
          0%   { transform: translate(0, 0); }
          50%  { transform: translate(14px, -10px); }
          100% { transform: translate(0, 0); }
        }
        .yg-cloud { position: absolute; border-radius: 50%; background: radial-gradient(circle, ${TOKENS.skyPale} 0%, transparent 70%); animation: drift 14s ease-in-out infinite; pointer-events: none; }

        @keyframes rippleGrow {
          0%   { transform: scale(0.75); opacity: 0.5; }
          70%  { opacity: 0.12; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .yg-tile { position: relative; height: 160px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .yg-ripple { position: absolute; width: 70px; height: 70px; border-radius: 50%; border: 1px solid; animation: rippleGrow 4s ease-out infinite; }
        .yg-ripple-2 { animation-delay: 2s; }

        .yg-cat-btn {
          font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
          padding: 8px 16px; border-radius: 999px; border: 1px solid ${TOKENS.line}; background: transparent;
          color: ${TOKENS.inkSoft}; cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
        }
        .yg-cat-btn:hover { background: ${TOKENS.skyDeep}; border-color: ${TOKENS.skyDeep}; color: #fff; transform: translateY(-1px); }
        .yg-cat-btn.active { background: ${TOKENS.skyDeep}; border-color: ${TOKENS.skyDeep}; color: #fff; }
        .yg-cat-btn-equal { flex: 1; text-align: center; }

        .yg-card {
          background: ${TOKENS.cream}; border: 1px solid ${TOKENS.line}; border-radius: 14px; overflow: hidden;
          display: flex; flex-direction: column; transition: transform 0.5s ease, box-shadow 0.3s ease, opacity 0.5s ease;
        }
        .yg-card:hover { transform: translateY(-4px) !important; box-shadow: 0 14px 28px rgba(47,110,150,0.14); }

        .yg-add-btn {
          font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
          padding: 9px 0; width: 100%; border-radius: 8px; border: 1px solid ${TOKENS.skyDeep}; background: transparent;
          color: ${TOKENS.skyDeep}; cursor: pointer; transition: all 0.2s ease;
        }
        .yg-add-btn:hover { background: ${TOKENS.skyDeep}; color: #fff; }
        .yg-add-btn.yg-action:hover { background: ${TOKENS.coral} !important; border-color: ${TOKENS.coral} !important; }

        .yg-cart-overlay { position: absolute; inset: 0; background: rgba(27,42,61,0.35); z-index: 40; }
        .yg-cart-drawer {
          position: absolute; top: 0; right: 0; height: 100%; width: min(380px, 90%); background: ${TOKENS.cream};
          z-index: 50; display: flex; flex-direction: column; box-shadow: -12px 0 30px rgba(0,0,0,0.12);
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

        .yg-icon-btn { background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: ${TOKENS.ink}; transition: transform 0.15s ease; }
        .yg-icon-btn:hover { transform: scale(1.08); }

        .yg-qty-btn { width: 24px; height: 24px; border-radius: 50%; border: 1px solid ${TOKENS.line}; background: ${TOKENS.cream}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.15s ease; }
        .yg-qty-btn:hover { border-color: ${TOKENS.sky}; }

        .yg-badge-pop { animation: pop 0.3s ease; }
        @keyframes pop { 0% { transform: scale(0.5); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }

        @media (max-width: 720px) {
          .yg-hero { grid-template-columns: 1fr !important; }
          .yg-hero-visual { display: none !important; }
          .yg-nav-links { display: none !important; }
        }
      `}</style>

      <div className="yg-cloud" style={{ width: 260, height: 260, top: -80, left: -60 }} />
      <div className="yg-cloud" style={{ width: 200, height: 200, top: 120, right: -60, animationDelay: "3s" }} />
      <div className="yg-cloud" style={{ width: 180, height: 180, bottom: 40, left: "30%", animationDelay: "6s" }} />

      <div style={{ position: "sticky", top: 0, zIndex: 30 }}>
        {!offerDismissed && (
          <div style={{ background: TOKENS.coral, color: "#fff" }}>
            <div style={{ maxWidth: 1120, margin: "0 auto", padding: "9px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, position: "relative" }}>
              <span className="yg-label" style={{ fontSize: 11.5, textAlign: "center" }}>
              {t("offerBanner")}
              </span>
              <button
                className="yg-icon-btn"
                onClick={() => setOfferDismissed(true)}
                aria-label="Dismiss offer"
                style={{ position: "absolute", right: 16, color: "#fff" }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <header
          style={{
            background: `${TOKENS.bg}F2`,
            backdropFilter: "blur(6px)", borderBottom: `1px solid ${TOKENS.line}`,
          }}
        >
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "16px 24px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="yg-display" style={{ fontSize: 22, fontStyle: "italic", fontWeight: 500 }}>Earlybird</div>
            <nav className="yg-nav-links" style={{ display: "flex", gap: 28, fontSize: 14, color: TOKENS.inkSoft }}>
              <span>{t("shop")}</span>
              <span>{t("materials")}</span>
              <span>{t("ourPractice")}</span>
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button
                onClick={() => setLang(lang === "de" ? "en" : "de")}
                aria-label="Switch language"
                className="yg-label"
                style={{
                  background: "none",
                  border: `1px solid ${TOKENS.line}`,
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 11,
                  color: TOKENS.inkSoft,
                  cursor: "pointer",
                }}
              >
                {lang === "de" ? "DE / EN" : "EN / DE"}
              </button>
              {token && (
                <button className="yg-icon-btn" aria-label="Account" onClick={() => setAccountOpen(true)} title={t("account")}>
                  <User size={19} />
                </button>
              )}
            </div>
          </div>

          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", flex: "0 0 75%" }}>
              <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: TOKENS.inkSoft }} />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                style={{
                  width: "100%",
                  padding: "9px 14px 9px 38px",
                  borderRadius: 8,
                  border: `1px solid ${TOKENS.line}`,
                  background: TOKENS.mist,
                  fontSize: 13.5,
                  fontFamily: "'Work Sans', sans-serif",
                  color: TOKENS.ink,
                }}
              />
              {showSuggestions && searchSuggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: TOKENS.cream,
                    border: `1px solid ${TOKENS.line}`,
                    borderRadius: 8,
                    boxShadow: "0 10px 24px rgba(27,42,61,0.12)",
                    zIndex: 5,
                    overflow: "hidden",
                  }}
                >
                  {searchSuggestions.map((p) => (
                    <div
                      key={p.id}
                      onMouseDown={() => {
                        setShowSuggestions(false);
                        setSelectedProduct(p);
                      }}
                      style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between" }}
                    >
                      <span>{p.name}</span>
                      <span style={{ color: TOKENS.inkSoft }}>{formatPrice(p.price_cents)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="yg-icon-btn" aria-label="Open cart" onClick={() => setCartOpen(true)} style={{ position: "relative", flex: 1, justifyContent: "center", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "9px 0", background: TOKENS.mist }}>
              <ShoppingCart size={19} />
              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="yg-label yg-badge-pop"
                  style={{
                    position: "absolute", top: -6, right: "calc(50% - 26px)", background: TOKENS.coral, color: "#fff",
                    fontSize: 10, borderRadius: "50%", width: 18, height: 18, display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </header>
      </div>

      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "64px 24px 48px", position: "relative" }}>
        <div className="yg-hero" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 40, alignItems: "center" }}>
          <div>
            <p className="yg-label" style={{ color: TOKENS.skyDeep, fontSize: 12, marginBottom: 18 }}>
              {t("heroTag")}
            </p>
            <h1
              className="yg-display"
              style={{ fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1.08, fontStyle: "italic", fontWeight: 500, margin: "0 0 20px", color: TOKENS.ink }}
            >
              {t("heroTitle1")}
              <br />
              {t("heroTitle2")}
            </h1>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: TOKENS.inkSoft, maxWidth: 440, margin: "0 0 28px" }}>
              {t("heroBody")}
            </p>
            <button
              className="yg-add-btn"
              style={{ width: "auto", padding: "13px 28px", fontSize: 12, borderRadius: 999, background: TOKENS.skyDeep, color: "#fff" }}
              onClick={() => document.getElementById("shop").scrollIntoView({ behavior: "smooth" })}
            >
              {t("shopCollection")}
            </button>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", marginTop: 26 }}>
              {[t("freeShipping"), t("returns"), t("naturalOnly")].map((item) => (
                <span key={item} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: TOKENS.inkSoft }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: TOKENS.sky, flexShrink: 0 }} />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div
            className="yg-hero-visual"
            onClick={() => document.getElementById("shop").scrollIntoView({ behavior: "smooth" })}
            role="button"
            tabIndex={0}
            aria-label="Scroll to shop"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 320, cursor: "pointer" }}
          >
            <svg viewBox="0 0 320 320" width="100%" height="100%" style={{ maxWidth: 320 }} role="img" aria-label="Concentric rings that slowly expand and contract, representing a breathing rhythm">
              <circle cx="160" cy="160" r="150" fill="none" stroke={TOKENS.line} strokeWidth="1" />
              <circle className="breathe" cx="160" cy="160" r="120" fill="none" stroke={TOKENS.sky} strokeWidth="1.5" style={{ animationDelay: "0s" }} />
              <circle className="breathe" cx="160" cy="160" r="90" fill="none" stroke={TOKENS.skyDeep} strokeWidth="1.5" style={{ animationDelay: "-1.3s" }} />
              <circle className="breathe" cx="160" cy="160" r="60" fill="none" stroke={TOKENS.skyPale} strokeWidth="2.5" style={{ animationDelay: "-2.6s" }} />
              <circle cx="160" cy="160" r="4" fill={TOKENS.ink} />
            </svg>
          </div>
        </div>
      </section>

      <ProductCarousel products={products} onSelect={setSelectedProduct} t={t} />

      <section style={{ borderTop: `1px solid ${TOKENS.line}`, borderBottom: `1px solid ${TOKENS.line}`, background: TOKENS.mist, position: "relative" }}>
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "28px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 20,
            textAlign: "center",
          }}
        >
          {[
            { stat: "10,000+", label: "props shipped", color: TOKENS.skyDeep },
            { stat: "4.8 / 5", label: "average rating", color: TOKENS.coral },
            { stat: "3", label: "natural materials sourced", color: "#2F9668" },
          ].map((item) => (
            <div key={item.label}>
              <p className="yg-display" style={{ fontSize: 26, fontStyle: "italic", margin: "0 0 2px", color: item.color }}>
                {item.stat}
              </p>
              <p className="yg-label" style={{ fontSize: 10.5, color: TOKENS.inkSoft, margin: 0 }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="shop" style={{ maxWidth: 1120, margin: "0 auto", padding: "8px 24px 80px", position: "relative" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {CATEGORIES.map((cat) => (
            <button key={cat} className={`yg-cat-btn yg-cat-btn-equal ${activeCategory === cat ? "active" : ""}`} onClick={() => setActiveCategory(cat)}>
              {t(CATEGORY_KEY_MAP[cat])}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 24, fontSize: 13, color: TOKENS.inkSoft }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>{t("price")}</span>
            <input
              type="number"
              placeholder="Min"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              style={{ width: 64, padding: "5px 8px", borderRadius: 6, border: `1px solid ${TOKENS.line}`, fontSize: 13 }}
            />
            <span>–</span>
            <input
              type="number"
              placeholder="Max"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              style={{ width: 64, padding: "5px 8px", borderRadius: 6, border: `1px solid ${TOKENS.line}`, fontSize: 13 }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            {t("inStockOnly")}
          </label>
          {(priceMin !== "" || priceMax !== "" || inStockOnly) && (
            <button
              onClick={() => { setPriceMin(""); setPriceMax(""); setInStockOnly(false); }}
              style={{ background: "none", border: "none", color: TOKENS.skyDeep, cursor: "pointer", fontSize: 13, padding: 0 }}
            >
              {t("clearFilters")}
            </button>
          )}
        </div>

        {searchQuery && (
          <p style={{ fontSize: 13, color: TOKENS.inkSoft, marginBottom: 16 }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{searchQuery}"
          </p>
        )}

        {productsLoading && <p style={{ color: TOKENS.inkSoft, fontSize: 14 }}>{t("loadingProducts")}</p>}
        {productsError && (
          <p style={{ color: TOKENS.error, fontSize: 14 }}>
            Couldn't load products ({productsError}). Is the backend running at {API_BASE}?
          </p>
        )}

        {!productsLoading && !productsError && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
              {paginated.map((p, i) => (
                <ProductCard key={p.id} p={p} index={i} onAdd={addToCart} onView={setSelectedProduct} t={t} />
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 36 }}>
                <button
                  className="yg-cat-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={currentPage === 1 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    className={`yg-cat-btn ${currentPage === pageNum ? "active" : ""}`}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{ minWidth: 36 }}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  className="yg-cat-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={currentPage === totalPages ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          allProducts={products}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
          onSelectRelated={setSelectedProduct}
          apiRequest={apiRequest}
          token={token}
          t={t}
        />
      )}

      {accountOpen && (
        <AccountPanel
          user={user}
          token={token}
          onClose={() => setAccountOpen(false)}
          onLogout={() => {
            setAccountOpen(false);
            logout();
          }}
          apiRequest={apiRequest}
          formatPrice={formatPrice}
        />
      )}

      <footer style={{ background: TOKENS.skyDeep, color: "#fff", position: "relative" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "56px 24px", display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 32 }}>
          <div>
            <div className="yg-display" style={{ fontSize: 20, fontStyle: "italic", marginBottom: 12 }}>Earlybird</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#CFE6F5", maxWidth: 320 }}>
              Steady and easy — the two qualities every pose asks for. We build our props the same way.
            </p>
          </div>
          <div>
            <p className="yg-label" style={{ fontSize: 11, color: "#A9D2EA", marginBottom: 14 }}>Shop</p>
            <p style={{ fontSize: 13.5, margin: "0 0 8px", color: "#CFE6F5" }}>Mats and props</p>
            <p style={{ fontSize: 13.5, margin: "0 0 8px", color: "#CFE6F5" }}>Apparel</p>
            <p style={{ fontSize: 13.5, margin: "0 0 8px", color: "#CFE6F5" }}>Meditation</p>
          </div>
          <div>
            <p className="yg-label" style={{ fontSize: 11, color: "#A9D2EA", marginBottom: 14 }}>Stay grounded</p>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#CFE6F5", marginBottom: 14 }}>New releases and studio notes, once a month.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="email" placeholder="your@email.com" style={{ flex: 1, background: "transparent", border: "1px solid #6FAED0", borderRadius: 8, padding: "9px 10px", color: "#fff", fontSize: 13 }} />
              <button className="yg-label" style={{ border: "1px solid #fff", background: "transparent", color: "#fff", borderRadius: 8, padding: "0 14px", fontSize: 11, cursor: "pointer" }}>
                Join
              </button>
            </div>
          </div>
        </div>
      </footer>

      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40 }}>
          <div className="yg-cart-overlay" onClick={() => setCartOpen(false)} />
          <div className="yg-cart-drawer">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px", borderBottom: `1px solid ${TOKENS.line}` }}>
              <p className="yg-display" style={{ fontSize: 20, fontStyle: "italic", margin: 0 }}>{t("yourBag")}</p>
              <button className="yg-icon-btn" aria-label="Close cart" onClick={() => setCartOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {!token && cartAuthPrompt ? (
              <>
                <div style={{ padding: "12px 20px 0" }}>
                  <button
                    onClick={() => setCartAuthPrompt(false)}
                    style={{ background: "none", border: "none", color: TOKENS.skyDeep, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 6 }}
                  >
                    {t("backToBag")}
                  </button>
                </div>
                <AuthForm
                  mode={authMode}
                  setMode={setAuthMode}
                  onLogin={handleLogin}
                  onRequestOtp={handleRequestOtp}
                  onVerifyOtp={handleVerifyOtp}
                  loading={authLoading}
                  error={authError}
                />
              </>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
                  {cartLoading ? (
                    <p style={{ fontSize: 14, color: TOKENS.inkSoft, marginTop: 24 }}>Loading your bag…</p>
                  ) : displayCartItems.length === 0 ? (
                    <p style={{ fontSize: 14, color: TOKENS.inkSoft, marginTop: 24 }}>{t("bagEmpty")}</p>
                  ) : (
                    displayCartItems.map((item) => (
                      <div key={item.product_id} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${TOKENS.line}` }}>
                        <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: `linear-gradient(180deg, ${TOKENS.mist} 0%, ${TOKENS.skyPale} 100%)` }}>
                          {item.image_url && (
                            <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500 }}>{item.name}</p>
                          <p className="yg-label" style={{ margin: "0 0 8px", fontSize: 12 }}>{formatPrice(item.price_cents)}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button className="yg-qty-btn" onClick={() => changeQty(item.product_id, -1)} aria-label="Decrease quantity">
                              <Minus size={12} />
                            </button>
                            <span style={{ fontSize: 13, minWidth: 14, textAlign: "center" }}>{item.quantity}</span>
                            <button className="yg-qty-btn" onClick={() => changeQty(item.product_id, 1)} aria-label="Increase quantity">
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {!token && displayCartItems.length > 0 && (
                    <button
                      onClick={() => setCartAuthPrompt(true)}
                      style={{ background: "none", border: "none", color: TOKENS.skyDeep, fontSize: 12.5, cursor: "pointer", padding: "10px 0 0", textDecoration: "underline" }}
                    >
                      {t("signInPrompt")}
                    </button>
                  )}
                </div>

                {displayCartItems.length > 0 && (
                  <div style={{ padding: 20, borderTop: `1px solid ${TOKENS.line}` }}>
                    {!token && (
                      <input
                        type="email"
                        placeholder={t("emailForUpdates")}
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        style={{ ...inputStyle, width: "100%", marginBottom: 14 }}
                      />
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 14 }}>
                      <span style={{ color: TOKENS.inkSoft }}>{t("subtotal")}</span>
                      <span className="yg-label">{formatPrice(subtotalCents)}</span>
                    </div>
                    {checkoutError && <p style={{ color: TOKENS.error, fontSize: 13, marginBottom: 10 }}>{checkoutError}</p>}
                    <button
                      className="yg-add-btn yg-action"
                      onClick={checkout}
                      disabled={checkoutLoading}
                      style={{ background: TOKENS.coral, borderColor: TOKENS.coral, color: "#fff", padding: "13px 0" }}
                    >
                      {checkoutLoading ? "Redirecting to payment…" : token ? t("checkout") : t("checkoutGuest")}
                    </button>
                    <p style={{ fontSize: 11, color: TOKENS.inkSoft, textAlign: "center", marginTop: 10 }}>
                      Apple Pay / Google Pay / PayPal appear automatically here once real Stripe keys are live on a hosted (HTTPS) site.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}