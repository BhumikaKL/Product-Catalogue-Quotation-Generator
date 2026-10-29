
import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const token = () => localStorage.getItem("sharp_token") || "";

const headers = (extra = {}) => ({
  ...extra,
  Authorization: `Bearer ${token()}`,
});

const imageUrl = (filename) =>
  `http://localhost:5000/images/${encodeURIComponent(
    String(filename || "").split("/").pop()
  )}`;

const blankCustomer = {
  name: "",
  company: "",
  email: "",
  phone: "",
};

const blankProduct = {
  model: "",
  name: "",
  price: "",
  image: "",
  description: "",
};

export default function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin@123");

  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [customer, setCustomer] = useState(blankCustomer);
  const [quantity, setQuantity] = useState(1);
  const [gstRate, setGstRate] = useState(18);

  const [newProduct, setNewProduct] = useState(blankProduct);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(1);

  async function api(path, options = {}) {
    const response = await fetch(API + path, options);

    const data = (
      response.headers.get("content-type") || ""
    ).includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      throw new Error(
        data?.message || `Request failed (${response.status})`
      );
    }

    return { response, data };
  }

  async function loadProducts() {
    const { data } = await api("/products", {
      headers: headers(),
    });

    setProducts(data);
  }

  useEffect(() => {
    if (!token()) return;

    api("/auth/me", {
      headers: headers(),
    })
      .then(async ({ data }) => {
        setUser(data.user);
        await loadProducts();
      })
      .catch(() => {
        localStorage.removeItem("sharp_token");
        setUser(null);
      });
  }, []);

  async function login(event) {
    event.preventDefault();

    setError("");
    setNotice("");

    try {
      const { data } = await api("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      localStorage.setItem("sharp_token", data.token);
      setUser(data.user);

      await loadProducts();

      setNotice(`Signed in as ${data.user.role}.`);
    } catch (error) {
      setError(error.message);
    }
  }

  function logout() {
    localStorage.removeItem("sharp_token");

    setUser(null);
    setProducts([]);
    setSelectedIds([]);
    setCustomer(blankCustomer);
    setQuantity(1);
    setGstRate(18);
    setStage(1);
    setError("");
    setNotice("");
    setPassword("");
    setUsername("admin");
  }

  async function addProduct(event) {
    event.preventDefault();

    setError("");
    setNotice("");

    try {
      await api("/products", {
        method: "POST",
        headers: headers({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          ...newProduct,
          price: Number(newProduct.price),
        }),
      });

      setNewProduct(blankProduct);

      await loadProducts();

      setNotice("Product added to the catalogue.");
    } catch (error) {
      setError(error.message);
    }
  }

  const chosen = products.filter((product) =>
    selectedIds.includes(product.id)
  );

  const qty = Math.max(1, Number(quantity) || 1);

  const subtotal = useMemo(
    () =>
      chosen.reduce(
        (sum, product) => sum + product.price * qty,
        0
      ),
    [chosen, qty]
  );

  const tax =
    (subtotal * Math.max(0, Number(gstRate) || 0)) / 100;

  const total = subtotal + tax;

  function toggle(product) {
    setError("");
    setNotice("");

    setSelectedIds((ids) => {
      if (user.role === "salesperson") {
        return ids.includes(product.id) ? [] : [product.id];
      }

      return ids.includes(product.id)
        ? ids.filter((id) => id !== product.id)
        : [...ids, product.id];
    });
  }

  function continueToDetails() {
    if (!chosen.length) {
      setError("Please select a product first.");
      return;
    }

    setError("");
    setNotice("");
    setStage(2);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function reviewQuotation() {
    if (!customer.name.trim()) {
      setError("Enter the customer's name.");
      return;
    }

    if (!customer.email.trim()) {
      setError("Enter the customer's email address.");
      return;
    }

    setError("");
    setNotice("");
    setStage(3);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function generate() {
    if (!chosen.length) return;

    if (!customer.name.trim()) {
      setError("Enter the customer's name.");
      setStage(2);
      return;
    }

    if (!customer.email.trim()) {
      setError("Enter the customer's email address.");
      setStage(2);
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/quotations/pdf`, {
        method: "POST",
        headers: headers({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          productIds: chosen.map((product) => product.id),
          customer,
          quantity: qty,
          gstRate: Number(gstRate),
        }),
      });

      if (!response.ok) {
        let message = "Could not generate PDF.";

        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `Quotation-${chosen
        .map((product) => product.model)
        .join("-")}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setNotice(
        "Quotation PDF downloaded. It has not been emailed to the customer."
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  // Login screen
  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand">SHARP</div>

          <p className="eyebrow">PRODUCT CATALOGUE</p>

          <h1>Sign in</h1>

          <p className="muted">
            Select a printer and prepare a customer quotation.
          </p>

          <form className="stack" onSubmit={login}>
            <label>
              Username
              <input
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
              />
            </label>

            {error && (
              <p className="alert error">{error}</p>
            )}

            <button className="primary" type="submit">
              Sign in
            </button>
          </form>

          <div className="demo">
            <b>Demo accounts</b>
            <span>admin / Admin@123</span>
            <span>sales1, sales2, sales3 / Sales@123</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="shell">
      {/* Application header */}
      
<header className="topbar">
  <div className="topbar-brand">
    <span className="brand small">SHARP</span>
    <span className="subtitle">
      Product Catalogue &amp; Quotation Generator
    </span>
  </div>

  <div className="account">
    <span className="user-name">{user.name}</span>
    <button className="logout-button" onClick={logout}>
      Log out
    </button>
  </div>
</header>


      <main className="content">
        {/* Page heading */}
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {stage === 1
                ? "STEP 1 OF 3"
                : "QUOTATION WORKSPACE"}
            </p>

            <h1>
              {stage === 1
                ? "Choose a printer"
                : "Create customer quotation"}
            </h1>

            <p className="muted">
              {stage === 1
                ? "Select a product to start. Customer details come next."
                : "Enter customer information, review the total, then download the PDF."}
            </p>
          </div>

          <div className="count">
            {products.length}
            <small>products</small>
          </div>
        </div>

        {/* Workflow steps */}
        <div className="steps">
          <div
            className={
              stage === 1 ? "step active" : "step done"
            }
          >
            <span>1</span>
            <div>
              <b>Select product</b>
              <small>Choose a printer</small>
            </div>
          </div>

          <div
            className={
              stage === 2
                ? "step active"
                : stage === 3
                  ? "step done"
                  : "step"
            }
          >
            <span>2</span>
            <div>
              <b>Customer details</b>
              <small>Contact and quantity</small>
            </div>
          </div>

          <div
            className={stage === 3 ? "step active" : "step"}
          >
            <span>3</span>
            <div>
              <b>Review &amp; PDF</b>
              <small>Check and download</small>
            </div>
          </div>
        </div>

        {error && <p className="alert error">{error}</p>}

        {notice && (
          <p className="alert success">{notice}</p>
        )}

        {/* STEP 1: Product catalogue */}
        {stage === 1 && (
          <>
            {user.role === "admin" && (
              <section className="panel">
                <h2>
                  Add catalogue product{" "}
                  <span className="admin-tag">
                    ADMIN ONLY
                  </span>
                </h2>

                <form
                  className="admin-form"
                  onSubmit={addProduct}
                >
                  <label>
                    Model
                    <input
                      value={newProduct.model}
                      onChange={(event) =>
                        setNewProduct({
                          ...newProduct,
                          model: event.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    Product name
                    <input
                      value={newProduct.name}
                      onChange={(event) =>
                        setNewProduct({
                          ...newProduct,
                          name: event.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    Price (INR)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(event) =>
                        setNewProduct({
                          ...newProduct,
                          price: event.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    Image filename
                    <input
                      placeholder="BP-71_catalog.png"
                      value={newProduct.image}
                      onChange={(event) =>
                        setNewProduct({
                          ...newProduct,
                          image: event.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label className="wide">
                    Description
                    <input
                      value={newProduct.description}
                      onChange={(event) =>
                        setNewProduct({
                          ...newProduct,
                          description: event.target.value,
                        })
                      }
                    />
                  </label>

                  <button className="primary" type="submit">
                    Add product
                  </button>
                </form>

                <p className="hint">
                  Products added while the server is running
                  reset when the backend restarts.
                </p>
              </section>
            )}

            <section className="catalogue">
              {products.map((product) => {
                const isSelected = selectedIds.includes(
                  product.id
                );

                return (
                  <article
                    className={`product ${
                      isSelected ? "chosen" : ""
                    }`}
                    key={product.id}
                  >
                    <div className="photo">
                      <img
                        src={imageUrl(product.image)}
                        alt={product.name}
                      />
                    </div>

                    <div className="product-body">
                      <div className="product-topline">
                        <span className="model">
                          {product.model}
                        </span>

                        {isSelected && (
                          <span className="selected-pill">
                            Selected
                          </span>
                        )}
                      </div>

                      <h2>{product.name}</h2>

                      <p className="muted description">
                        {product.description}
                      </p>

                      <div className="product-footer">
                        <strong>
                          {money(product.price)}
                        </strong>

                        <button
                          type="button"
                          className={
                            isSelected
                              ? "outline"
                              : "primary"
                          }
                          onClick={() => toggle(product)}
                        >
                          {isSelected
                            ? "Selected ✓"
                            : "Select product"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <div className="bottom-action">
              <div>
                <b>
                  {chosen.length} product
                  {chosen.length === 1 ? "" : "s"} selected
                </b>

                <span>
                  {user.role === "salesperson"
                    ? "Salesperson quotations contain one product."
                    : "Admin can include multiple products."}
                </span>
              </div>

              <button
                type="button"
                className="primary"
                disabled={!chosen.length}
                onClick={continueToDetails}
              >
                Continue to customer details →
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Customer details */}
        {stage === 2 && (
          <section className="panel workflow-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">STEP 2</p>
                <h2>Customer details</h2>

                <p className="muted">
                  Enter the details that should appear on the
                  quotation.
                </p>
              </div>

              <button
                type="button"
                className="outline"
                onClick={() => setStage(1)}
              >
                ← Back to products
              </button>
            </div>

            <div className="selected-list">
              {chosen.map((product) => (
                <div
                  className="selected-row"
                  key={product.id}
                >
                  <img
                    src={imageUrl(product.image)}
                    alt={product.name}
                  />

                  <div>
                    <b>{product.name}</b>
                    <span>
                      {product.model} ·{" "}
                      {money(product.price)} per unit
                    </span>
                  </div>

                  <strong>
                    {money(product.price * qty)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="fields customer-fields">
              <label>
                Customer full name *
                <input
                  value={customer.name}
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      name: event.target.value,
                    })
                  }
                  required
                  placeholder="Enter customer name"
                />
              </label>

              <label>
                Company name
                <input
                  value={customer.company}
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      company: event.target.value,
                    })
                  }
                  placeholder="Company (optional)"
                />
              </label>

              <label>
                Customer email address *
                <input
                  type="email"
                  value={customer.email}
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      email: event.target.value,
                    })
                  }
                  required
                  placeholder="name@company.com"
                />
              </label>

              <label>
                Phone number
                <input
                  type="tel"
                  value={customer.phone}
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      phone: event.target.value,
                    })
                  }
                  placeholder="Phone (optional)"
                />
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      Math.max(
                        1,
                        Number(event.target.value) || 1
                      )
                    )
                  }
                />
              </label>

              <label>
                GST (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={gstRate}
                  onChange={(event) =>
                    setGstRate(event.target.value)
                  }
                />
              </label>
            </div>

            <div className="workflow-actions">
              <button
                type="button"
                className="outline"
                onClick={() => setStage(1)}
              >
                Change product
              </button>

              <button
                type="button"
                className="primary"
                onClick={reviewQuotation}
              >
                Review quotation →
              </button>
            </div>
          </section>
        )}

        {/* STEP 3: Review and download PDF */}
        {stage === 3 && (
          <section className="panel workflow-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">STEP 3</p>
                <h2>Review quotation</h2>

                <p className="muted">
                  Check all details before generating the PDF.
                </p>
              </div>

              <button
                type="button"
                className="outline"
                onClick={() => setStage(2)}
              >
                ← Edit details
              </button>
            </div>

            <div className="review-grid">
              <div>
                <h3>Customer</h3>

                <div className="review-card">
                  <b>{customer.name}</b>
                  <span>
                    {customer.company ||
                      "No company provided"}
                  </span>
                  <span>{customer.email}</span>
                  <span>
                    {customer.phone || "No phone provided"}
                  </span>
                </div>

                <h3>
                  Selected product
                  {chosen.length === 1 ? "" : "s"}
                </h3>

                {chosen.map((product) => (
                  <div
                    className="review-product"
                    key={product.id}
                  >
                    <img
                      src={imageUrl(product.image)}
                      alt={product.name}
                    />

                    <div>
                      <b>{product.name}</b>
                      <span>{product.model}</span>
                      <span>
                        {money(product.price)} × {qty}
                      </span>
                    </div>

                    <strong>
                      {money(product.price * qty)}
                    </strong>
                  </div>
                ))}
              </div>

              <aside className="summary-box">
                <h3>Price summary</h3>

                <div className="totals">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(subtotal)}</strong>
                  </div>

                  <div>
                    <span>GST ({gstRate}%)</span>
                    <strong>{money(tax)}</strong>
                  </div>

                  <div className="total">
                    <span>Grand total</span>
                    <strong>{money(total)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="primary full"
                  disabled={busy}
                  onClick={generate}
                >
                  {busy
                    ? "Generating..."
                    : "Download quotation PDF"}
                </button>

                <p className="hint">
                  The PDF will download to your computer.
                  Email delivery is not configured in this
                  demo.
                </p>
              </aside>
            </div>

            <div className="workflow-actions">
              <button
                type="button"
                className="outline"
                onClick={() => setStage(2)}
              >
                Edit customer details
              </button>

              <button
                type="button"
                className="primary"
                onClick={() => {
                  setStage(1);
                  setSelectedIds([]);
                  setCustomer(blankCustomer);
                  setQuantity(1);
                  setGstRate(18);
                  setError("");
                  setNotice(
                    "Ready to create another quotation."
                  );

                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
              >
                Create another quotation
              </button>
            </div>
          </section>
        )}

        <footer>
          Demo app · Verify approved selling prices and GST
          before sending quotations.
        </footer>
      </main>
    </div>
  );
}
