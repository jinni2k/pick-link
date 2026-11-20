(function () {
  "use strict";

  const FALLBACK_SVG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="184" height="184" viewBox="0 0 184 184">' +
        '<rect width="184" height="184" fill="#eef2f6"/>' +
        '<rect x="46" y="46" width="92" height="92" rx="18" fill="#cbd5e1"/>' +
        '<text x="92" y="98" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#334155">PICKLAB</text>' +
      "</svg>"
    );

  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearch");
  const categoryChips = document.getElementById("categoryChips");
  const productList = document.getElementById("productList");
  const resultCount = document.getElementById("resultCount");
  const modal = document.getElementById("businessModal");
  const openModalBtn = document.getElementById("openBizModalBtn");
  const closeModalBtn = document.getElementById("closeBizModalBtn");
  const bizForm = document.getElementById("bizForm");
  const copyEmailBtn = document.getElementById("copyEmailBtn");
  const shareHubBtn = document.getElementById("shareHubBtn");
  const toastEl = document.getElementById("toast");

  let config = readBootstrap("bootstrapConfig", {});
  let allItems = (readBootstrap("bootstrapProducts", {}).items || []).slice();
  let activeCategory = "전체";
  let query = new URLSearchParams(window.location.search).get("q") || "";

  function readBootstrap(id, fallback) {
    try {
      const el = document.getElementById(id);
      return el ? JSON.parse(el.textContent || "{}") : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toastEl.hidden = true;
    }, 2200);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function matchesQuery(item, q) {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return true;
    const numOnly = /^\d+$/.test(trimmed) ? String(parseInt(trimmed, 10)) : "";
    const itemNum = String(parseInt(item.code, 10));
    if (numOnly && itemNum === numOnly) return true;
    const bag = [item.code, itemNum, item.title, item.category, item.badge, ...(item.keywords || [])]
      .join(" ")
      .toLowerCase();
    return bag.includes(trimmed);
  }

  function renderChips() {
    const categories = config.categories || ["전체"];
    categoryChips.innerHTML = categories
      .map((cat) => {
        const activeClass = cat === activeCategory ? "chip is-active" : "chip";
        return `<button type="button" class="${activeClass}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
      })
      .join("");
  }

  function renderItems() {
    clearSearchBtn.hidden = !query.trim();
    const filtered = allItems
      .filter((item) => activeCategory === "전체" || item.category === activeCategory)
      .filter((item) => matchesQuery(item, query))
      .sort((a, b) => parseInt(b.code, 10) - parseInt(a.code, 10));

    resultCount.textContent = `등록 상품 ${filtered.length}건`;

    if (!filtered.length) {
      productList.innerHTML =
        '<div class="empty-state">일치하는 상품이 없습니다. 번호 또는 다른 키워드로 검색해 보세요.</div>';
      return;
    }

    productList.innerHTML = filtered
      .map((item) => {
        const url = String(item.affiliate_url || "").trim();
        const isLiveCoupang = url.startsWith("https://link.coupang.com/");
        const cta = isLiveCoupang
          ? `<a class="cta-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer sponsored">쿠팡 최저가 보기</a>`
          : `<span class="cta-btn is-pending">제휴 링크 연동 준비 중</span>`;
        const thumbSrc = escapeHtml(item.thumbnail || "");
        return `
          <article class="product-card">
            <div class="thumb-wrap">
              <img src="${thumbSrc || FALLBACK_SVG}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='${FALLBACK_SVG}'">
            </div>
            <div class="card-body">
              <div class="card-tags">
                <span class="code-pill">[${escapeHtml(item.code)}]</span>
                ${item.badge ? `<span class="badge-pill">${escapeHtml(item.badge)}</span>` : ""}
              </div>
              <h2 class="card-title">${escapeHtml(item.title)}</h2>
              <div class="card-foot">
                <span class="price-label">${escapeHtml(item.price_label || "")}</span>
                ${cta}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function refreshRemoteCatalog() {
    try {
      const resp = await fetch("data/products.json", { cache: "no-store" });
      if (resp.ok) {
        const payload = await resp.json();
        if (Array.isArray(payload.items)) {
          allItems = payload.items;
          renderItems();
        }
      }
    } catch (_) {
      // File protocol or offline fallback keeps bootstrap JSON.
    }
  }

  searchInput.value = query;
  searchInput.addEventListener("input", (e) => {
    query = e.target.value;
    renderItems();
  });

  clearSearchBtn.addEventListener("click", () => {
    query = "";
    searchInput.value = "";
    searchInput.focus();
    renderItems();
  });

  categoryChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    activeCategory = btn.getAttribute("data-cat") || "전체";
    renderChips();
    renderItems();
  });

  openModalBtn.addEventListener("click", () => {
    modal.hidden = false;
  });

  closeModalBtn.addEventListener("click", () => {
    modal.hidden = true;
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  bizForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const kind = document.getElementById("bizType").value;
    const sender = document.getElementById("bizSender").value.trim();
    const prod = document.getElementById("bizProduct").value.trim();
    const msg = document.getElementById("bizMessage").value.trim();
    const subject = encodeURIComponent(`[${config.brand_en || "PICKLAB"} ${kind}] ${sender} - ${prod}`);
    const body = encodeURIComponent(
      `제안 유형: ${kind}\n브랜드·담당자: ${sender}\n제안 상품: ${prod}\n\n제안 내용:\n${msg}`
    );
    window.location.href = `mailto:${config.business_email || "jinni2k@gmail.com"}?subject=${subject}&body=${body}`;
  });

  copyEmailBtn.addEventListener("click", async () => {
    const email = config.business_email || "jinni2k@gmail.com";
    try {
      await navigator.clipboard.writeText(email);
      showToast("이메일 주소를 복사했습니다.");
    } catch (_) {
      showToast(email);
    }
  });

  shareHubBtn.addEventListener("click", async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("링크 허브 주소를 복사했습니다.");
    } catch (_) {
      showToast(shareUrl);
    }
  });

  renderChips();
  renderItems();
  refreshRemoteCatalog();
})();
