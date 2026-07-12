import React, { useState, useEffect } from "react";

const API_BASE = "https://earlybird-backend-vh85.onrender.com/api";
const CATEGORIES = ["Mats & Props", "Apparel", "Meditation", "Accessories"];

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

// Uploads a picked file to the backend and returns the hosted URL.
// Uses FormData directly (not apiRequest) since file uploads can't be
// JSON-encoded.
async function uploadImage(file, token) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${API_BASE}/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  return data.url;
}

const emptyForm = { name: "", description: "", category: CATEGORIES[0], material: "", price: "", stock: "", image_url: "" };

export default function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem("earlybird_token"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(null);

  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  function loadProducts() {
    apiRequest("/products/admin/all", { token })
      .then((data) => setProducts(data.products))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (token) loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError(null);
    try {
      const data = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
      localStorage.setItem("earlybird_token", data.token);
      setToken(data.token);
    } catch (err) {
      setLoginError(err.message);
    }
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleFile(file) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file, token);
      updateField("image_url", url);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      category: p.category,
      material: p.material || "",
      price: (p.price_cents / 100).toString(),
      stock: p.stock.toString(),
      image_url: p.image_url || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setUploadError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const body = {
      name: form.name,
      description: form.description,
      category: form.category,
      material: form.material,
      price_cents: Math.round(parseFloat(form.price || "0") * 100),
      stock: parseInt(form.stock || "0", 10),
      image_url: form.image_url || null,
    };
    try {
      if (editingId) {
        await apiRequest(`/products/admin/${editingId}`, { method: "PUT", token, body });
      } else {
        await apiRequest("/products/admin", { method: "POST", token, body });
      }
      cancelEdit();
      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Remove this product from the storefront?")) return;
    try {
      await apiRequest(`/products/admin/${id}`, { method: "DELETE", token });
      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem("earlybird_token");
    setToken(null);
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h2>Admin sign in</h2>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          {loginError && <p style={{ color: "crimson" }}>{loginError}</p>}
          <button type="submit" style={buttonStyle}>Sign in</button>
        </form>
        <p style={{ fontSize: 13, color: "#666", marginTop: 12 }}>
          Only accounts with <code>is_admin = true</code> in the database can manage products. See the README for how to grant this.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "sans-serif", padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1>Earlybird — Product Admin</h1>
        <button onClick={logout} style={{ ...buttonStyle, background: "#999" }}>Log out</button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 30, border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
        <h3 style={{ gridColumn: "1 / -1", margin: 0 }}>{editingId ? "Edit product" : "Add new product"}</h3>

        <input placeholder="Name" value={form.name} onChange={(e) => updateField("name", e.target.value)} required style={inputStyle} />
        <select value={form.category} onChange={(e) => updateField("category", e.target.value)} style={inputStyle}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="Material" value={form.material} onChange={(e) => updateField("material", e.target.value)} style={inputStyle} />
        <input placeholder="Price (e.g. 28.00)" value={form.price} onChange={(e) => updateField("price", e.target.value)} required style={inputStyle} />
        <input placeholder="Stock quantity" value={form.stock} onChange={(e) => updateField("stock", e.target.value)} required style={inputStyle} />

        {/* Product photo: drag-and-drop or click to upload directly, no external site needed */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 13, color: "#555", marginBottom: 6 }}>Product photo</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => document.getElementById("admin-file-input").click()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              border: `2px dashed ${dragActive ? "#2F6E96" : "#ccc"}`,
              borderRadius: 8,
              padding: 14,
              cursor: "pointer",
              background: dragActive ? "#EAF3FB" : "#FAFAFA",
            }}
          >
            {form.image_url ? (
              <img src={form.image_url} alt="Preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 6, background: "#eee", flexShrink: 0 }} />
            )}
            <div>
              <p style={{ margin: 0, fontSize: 14 }}>
                {uploading ? "Uploading…" : "Click to choose a photo, or drag one here"}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>JPG, PNG, WEBP, or GIF — up to 5MB</p>
            </div>
            <input
              id="admin-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => handleFile(e.target.files?.[0])}
              style={{ display: "none" }}
            />
          </div>
          {uploadError && <p style={{ color: "crimson", fontSize: 13, marginTop: 6 }}>{uploadError}</p>}
        </div>

        <textarea placeholder="Description" value={form.description} onChange={(e) => updateField("description", e.target.value)} style={{ ...inputStyle, gridColumn: "1 / -1", minHeight: 60 }} />
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
          <button type="submit" style={buttonStyle} disabled={uploading}>{editingId ? "Save changes" : "Add product"}</button>
          {editingId && <button type="button" onClick={cancelEdit} style={{ ...buttonStyle, background: "#999" }}>Cancel</button>}
        </div>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th style={{ padding: 8 }}></th>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Category</th>
            <th style={{ padding: 8 }}>Price</th>
            <th style={{ padding: 8 }}>Stock</th>
            <th style={{ padding: 8 }}>Active</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: "#eee" }} />
                )}
              </td>
              <td style={{ padding: 8 }}>{p.name}</td>
              <td style={{ padding: 8 }}>{p.category}</td>
              <td style={{ padding: 8 }}>${(p.price_cents / 100).toFixed(2)}</td>
              <td style={{ padding: 8 }}>{p.stock}</td>
              <td style={{ padding: 8 }}>{p.is_active ? "Yes" : "No"}</td>
              <td style={{ padding: 8, display: "flex", gap: 8 }}>
                <button onClick={() => startEdit(p)} style={{ ...buttonStyle, padding: "4px 10px" }}>Edit</button>
                <button onClick={() => handleDelete(p.id)} style={{ ...buttonStyle, padding: "4px 10px", background: "#c0392b" }}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { padding: 8, borderRadius: 6, border: "1px solid #ccc", fontSize: 14 };
const buttonStyle = { padding: "10px 16px", borderRadius: 6, border: "none", background: "#2F6E96", color: "#fff", cursor: "pointer", fontSize: 14 };