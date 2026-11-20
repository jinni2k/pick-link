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
  const goRedirectBanner = document.getElementById("goRedirectBanner");
  const shareModal = document.getElementById("shareModal");
  const closeShareModalBtn = document.getElementById("closeShareModalBtn");
  const shareTargetTitle = document.getElementById("shareTargetTitle");
  const copyDetailLinkBtn = document.getElementById("copyDetailLinkBtn");
  const copyGoLinkBtn = document.getElementById("copyGoLinkBtn");
  const copyShareCaptionBtn = document.getElementById("copyShareCaptionBtn");
  const shareXBtn = document.getElementById("shareXBtn");
  const shareFbBtn = document.getElementById("shareFbBtn");
  const shareNaverBtn = document.getElementById("shareNaverBtn");
  const shareBandBtn = document.getElementById("shareBandBtn");
  const toastEl = document.getElementById("toast");

  let config = readBootstrap("bootstrapConfig", {});
  let allItems = (readBootstrap("bootstrapProducts", {}).items || []).slice();
  let backupEntries = (readBootstrap("bootstrapBackups", {}).entries || []).slice();
  let activeCategory = "전체";
  const urlParams = new URLSearchParams(window.location.search);
  const goCode = (urlParams.get("go") || "").trim();
  let query = urlParams.get("q") || goCode || "";
  let currentSharePack = null;
  let goTimer = null;

  const userAgentStr = navigator.userAgent || "";
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgentStr);
  const isAndroidUa = /Android/i.test(userAgentStr);
  const isInAppUa = /YouTube|Instagram|KAKAOTALK|NAVER|FBAN|FBAV|Line|TikTok|musical_ly|BytedanceWebview/i.test(userAgentStr);

  function coupangLinkAttrs() {
    return isMobileUa
      ? 'target="_self" rel="sponsored"'
      : 'target="_blank" rel="noopener noreferrer sponsored"';
  }

  function findBackupsForCode(code) {
    return backupEntries
      .filter((entry) => entry && String(entry.code) === String(code))
      .sort((a, b) => (Number(a.priority || 99) - Number(b.priority || 99)));
  }

  function buildChromeIntentUrl(targetUrl) {
    const stripped = String(targetUrl || "").replace(/^https?:\/\//i, "");
    return `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`;
  }

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
        const hubBase = (
          window.location.origin && window.location.origin !== "null"
            ? window.location.origin
            : config.hub_url || "https://pick-link.pages.dev"
        ).replace(/\/$/, "");
        const directUrl = `${hubBase}/?q=${encodeURIComponent(item.code)}`;
        const linkAttrs = coupangLinkAttrs();
        const cta = isLiveCoupang
          ? `<a class="cta-btn" href="${escapeHtml(url)}" ${linkAttrs}>쿠팡에서 최저가·재고 바로 보기</a>`
          : `<span class="cta-btn is-pending">제휴 링크 연동 준비 중</span>`;

        const itemBackups = findBackupsForCode(item.code);
        const readyBackup = itemBackups.find(
          (b) => b.status === "ready" && String(b.affiliateUrl || "").startsWith("https://link.coupang.com/") && b.affiliateUrl !== url
        );
        const standbyBackup = itemBackups.find((b) => b.status === "needs_shortlink" && Boolean(b.sourceProductUrl));
        let backupCtaHtml = "";
        let backupNoteHtml = "";
        if (readyBackup) {
          backupCtaHtml = `<a class="backup-cta-btn" href="${escapeHtml(readyBackup.affiliateUrl)}" ${linkAttrs}>품절 시 동일 제품 예비 판매처 보기</a>`;
        } else if (standbyBackup) {
          const prodMatch = String(standbyBackup.sourceProductUrl || "").match(/\/products\/(\d+)/);
          const pidText = prodMatch ? `상품번호 ${prodMatch[1]}` : "동일 품목 판매처";
          backupCtaHtml = `<button type="button" class="backup-cta-btn is-standby" data-backup-info="${escapeHtml(item.code)}">품절 시 동일 제품 예비 판매처 보기</button>`;
          backupNoteHtml =
            `<div id="backup-note-${escapeHtml(item.code)}" class="backup-standby-note" hidden>` +
              `<strong>예비 판매처 대기 중 (${escapeHtml(pidText)})</strong><br>` +
              `${escapeHtml(standbyBackup.title || item.title)} · 파트너스 단축 URL 등록 즉시 자동 연결됩니다.` +
            `</div>`;
        }

        const inAppHtml = isInAppUa
          ? `<div class="inapp-notice"><span>인앱 브라우저에서 상품 화면이 안 열리면 외부 브라우저(Chrome·Safari)로 열어 주세요.</span>` +
              (isAndroidUa ? `<a class="inapp-ext-link" href="${escapeHtml(buildChromeIntentUrl(directUrl))}">Chrome으로 열기</a>` : "") +
            `</div>`
          : "";

        const thumbSrc = escapeHtml(item.thumbnail || "");
        const overlayBadges =
          `<div class="thumb-overlay-top">` +
            `<span class="code-pill">NO. ${escapeHtml(item.code)}</span>` +
            (item.badge ? `<span class="badge-pill">${escapeHtml(item.badge)}</span>` : "") +
          `</div>`;
        const thumbHtml = isLiveCoupang
          ? `<a class="hero-thumb-link" href="${escapeHtml(url)}" ${linkAttrs} aria-label="${escapeHtml(item.title)} 바로가기">
               <img src="${thumbSrc || FALLBACK_SVG}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='${FALLBACK_SVG}'">
               ${overlayBadges}
             </a>`
          : `<div class="hero-thumb-link">
               <img src="${thumbSrc || FALLBACK_SVG}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='${FALLBACK_SVG}'">
               ${overlayBadges}
             </div>`;
        const titleHtml = isLiveCoupang
          ? `<a class="card-title-link" href="${escapeHtml(url)}" ${linkAttrs}>${escapeHtml(item.title)}</a>`
          : escapeHtml(item.title);
        const specs = []
          .concat(item.verified_specs || [], item.detail_highlights || [])
          .filter((v, i, arr) => v && arr.indexOf(v) === i);
        const recFor = item.recommended_for || [];
        const pros = item.review_pros || [];
        const cons = item.review_cons || [];
        const hasDetail = Boolean(specs.length || recFor.length || pros.length || cons.length || item.review_rating);
        const isAutoOpen = hasDetail && Boolean(query.trim());
        const chipList = (item.keywords || []).slice(0, 3);
        const specChipsHtml = chipList.length
          ? `<div class="spec-chip-row">${chipList.map((k) => `<span class="spec-chip">${escapeHtml(k)}</span>`).join("")}</div>`
          : "";
        const detailSections = [];
        if (item.review_rating) {
          detailSections.push(
            `<div class="review-badge-row"><span class="code-pill">상품평 ${escapeHtml(item.review_rating)}점</span>` +
              (item.review_count ? `<span class="badge-pill">${escapeHtml(item.review_count)}개 후기 확인</span>` : "") +
              `</div>`
          );
        }
        if (specs.length) {
          detailSections.push(
            `<div class="detail-section"><h3>주요 특징 및 상세 스펙</h3><ul class="detail-list">` +
              specs.map((s) => `<li>${escapeHtml(s)}</li>`).join("") +
              `</ul></div>`
          );
        }
        if (recFor.length) {
          detailSections.push(
            `<div class="detail-section"><h3>추천 대상</h3><ul class="detail-list">` +
              recFor.map((r) => `<li>${escapeHtml(r)}</li>`).join("") +
              `</ul></div>`
          );
        }
        if (pros.length || cons.length) {
          detailSections.push(
            `<div class="detail-section"><h3>상품평·구매 전 체크포인트</h3><ul class="detail-list">` +
              pros.concat(cons).map((p) => `<li>${escapeHtml(p)}</li>`).join("") +
              `</ul></div>`
          );
        }
        const detailToggleBtn = hasDetail
          ? `<button type="button" class="detail-toggle-btn" data-toggle-detail="${escapeHtml(item.code)}" aria-expanded="${isAutoOpen ? "true" : "false"}">${isAutoOpen ? "상세 설명 접기" : "상세 설명 보기"}</button>`
          : "";
        const detailPanelHtml = hasDetail
          ? `<div id="detail-${escapeHtml(item.code)}" class="detail-panel"${isAutoOpen ? "" : " hidden"}>${detailSections.join("")}</div>`
          : "";
        return `
          <article class="product-card">
            ${thumbHtml}
            <div class="card-body">
              <div class="card-tags">
                ${item.category ? `<span class="amber-pill">${escapeHtml(item.category)}</span>` : ""}
                ${item.review_rating ? `<span class="amber-pill">평점 ${escapeHtml(item.review_rating)}</span>` : ""}
              </div>
              <h2 class="card-title">${titleHtml}</h2>
              ${specChipsHtml}
              <div class="primary-cta-stack">
                ${cta}
                ${backupCtaHtml}
                ${backupNoteHtml}
                ${inAppHtml}
              </div>
              <div class="direct-link-line">${escapeHtml(directUrl.replace(/^https?:\/\//, ""))}</div>
              <div class="card-foot">
                <span class="price-label">${escapeHtml(item.price_label || "")}</span>
                <div class="card-actions">
                  ${detailToggleBtn}
                  <button type="button" class="share-btn" data-share-code="${escapeHtml(item.code)}">공유</button>
                  <button type="button" class="copy-url-btn" data-copy-url="${escapeHtml(directUrl)}">주소 복사</button>
                </div>
              </div>
            </div>
            ${detailPanelHtml}
          </article>
        `;
      })
      .join("");
  }

  async function refreshRemoteCatalog() {
    try {
      const [respProd, respBack] = await Promise.all([
        fetch("data/products.json", { cache: "no-store" }),
        fetch("data/backup_links.json", { cache: "no-store" }).catch(() => null),
      ]);
      if (respBack && respBack.ok) {
        const bPayload = await respBack.json();
        if (Array.isArray(bPayload.entries)) {
          backupEntries = bPayload.entries;
        }
      }
      if (respProd.ok) {
        const payload = await respProd.json();
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

  function getHubBase() {
    return (
      window.location.origin && window.location.origin !== "null"
        ? window.location.origin
        : config.hub_url || "https://pick-link.pages.dev"
    ).replace(/\/$/, "");
  }

  function buildSharePack(item) {
    const hubBase = getHubBase();
    if (!item) {
      const title = `${config.brand_name || "픽랩"} ${config.brand_en || "PICKLAB"} 추천 제품 모음`;
      const caption = `${title}\n${config.slogan || ""}\n${hubBase}\n${config.ftc_disclosure || ""}`;
      return {
        title,
        detailUrl: hubBase,
        goUrl: hubBase,
        caption,
      };
    }
    const detailUrl = `${hubBase}/?q=${encodeURIComponent(item.code)}`;
    const goUrl = `${hubBase}/?go=${encodeURIComponent(item.code)}`;
    const specs = (item.verified_specs || item.summary_bullets || []).slice(0, 2);
    const caption = [
      `[${item.code}] ${item.title}`,
      ...specs.map((s) => `- ${s}`),
      `자세히 보기 ${detailUrl}`,
      config.ftc_disclosure || "",
    ].filter(Boolean).join("\n");
    return {
      title: `[${item.code}] ${item.title}`,
      detailUrl,
      goUrl,
      caption,
    };
  }

  function showShareFallbackModal(pack) {
    currentSharePack = pack;
    if (shareTargetTitle) shareTargetTitle.textContent = pack.title;
    if (shareXBtn) {
      shareXBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(pack.title)}&url=${encodeURIComponent(pack.detailUrl)}`;
    }
    if (shareFbBtn) {
      shareFbBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pack.detailUrl)}`;
    }
    if (shareNaverBtn) {
      shareNaverBtn.href = `https://share.naver.com/web/shareView?url=${encodeURIComponent(pack.detailUrl)}&title=${encodeURIComponent(pack.title)}`;
    }
    if (shareBandBtn) {
      shareBandBtn.href = `https://band.us/plugin/share?body=${encodeURIComponent(pack.title + "\n" + pack.detailUrl)}&route=${encodeURIComponent(getHubBase())}`;
    }
    if (shareModal) shareModal.hidden = false;
  }

  async function triggerShare(item) {
    const pack = buildSharePack(item);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: pack.title, text: pack.caption, url: pack.detailUrl });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    showShareFallbackModal(pack);
  }

  function initGoRedirect(rawCode) {
    if (!rawCode || !goRedirectBanner) return;
    const targetNum = /^\d+$/.test(rawCode) ? String(parseInt(rawCode, 10)) : "";
    const match = allItems.find((it) => {
      const codeNum = String(parseInt(it.code, 10));
      return it.code === rawCode || (targetNum && codeNum === targetNum);
    });
    if (!match) return;
    const url = String(match.affiliate_url || "").trim();
    if (!url.startsWith("https://link.coupang.com/")) {
      goRedirectBanner.innerHTML =
        `<p class="go-banner-title">[${escapeHtml(match.code)}] ${escapeHtml(match.title)}</p>` +
        `<p class="go-banner-sub">현재 제휴 링크를 교체 또는 확인 중입니다. 아래 상품 상세 카드를 확인해 주세요.</p>`;
      goRedirectBanner.hidden = false;
      return;
    }
    const goLinksHtml =
      `<a class="btn btn-primary" href="${escapeHtml(url)}" ${coupangLinkAttrs()}>지금 바로 이동</a>` +
      `<button id="cancelGoBtn" type="button" class="btn btn-secondary">자동 이동 취소</button>`;
    const inAppGoNote = isInAppUa
      ? `<p class="go-banner-sub">인앱 브라우저에서 앱 연결이 멈추면 외부 브라우저(Chrome·Safari)에서 열어 주세요.</p>`
      : "";
    goRedirectBanner.innerHTML =
      `<p class="go-banner-title">[${escapeHtml(match.code)}] 쿠팡 공식 파트너스 상품으로 즉시 연결합니다</p>` +
      `<p class="go-banner-sub">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>` +
      inAppGoNote +
      `<div class="go-banner-actions">${goLinksHtml}</div>`;
    goRedirectBanner.hidden = false;
    const cancelBtn = document.getElementById("cancelGoBtn");
    goTimer = setTimeout(() => {
      window.location.href = url;
    }, 1200);
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        if (goTimer) {
          clearTimeout(goTimer);
          goTimer = null;
        }
        const sub = goRedirectBanner.querySelector(".go-banner-sub");
        if (sub) sub.textContent = "자동 이동을 취소했습니다. 아래 카드 또는 위 버튼을 눌러 직접 이동할 수 있습니다.";
      });
    }
  }

  shareHubBtn.addEventListener("click", () => {
    void triggerShare(null);
  });

  if (closeShareModalBtn && shareModal) {
    closeShareModalBtn.addEventListener("click", () => {
      shareModal.hidden = true;
    });
    shareModal.addEventListener("click", (e) => {
      if (e.target === shareModal) shareModal.hidden = true;
    });
  }

  if (copyDetailLinkBtn) {
    copyDetailLinkBtn.addEventListener("click", async () => {
      if (!currentSharePack) return;
      try {
        await navigator.clipboard.writeText(currentSharePack.detailUrl);
        showToast("상품 상세 직링크를 복사했습니다.");
      } catch (_) {
        showToast(currentSharePack.detailUrl);
      }
    });
  }

  if (copyGoLinkBtn) {
    copyGoLinkBtn.addEventListener("click", async () => {
      if (!currentSharePack) return;
      try {
        await navigator.clipboard.writeText(currentSharePack.goUrl);
        showToast("쿠팡 즉시 이동 링크를 복사했습니다.");
      } catch (_) {
        showToast(currentSharePack.goUrl);
      }
    });
  }

  if (copyShareCaptionBtn) {
    copyShareCaptionBtn.addEventListener("click", async () => {
      if (!currentSharePack) return;
      try {
        await navigator.clipboard.writeText(currentSharePack.caption);
        showToast("공유 문구와 직링크를 복사했습니다.");
      } catch (_) {
        showToast("복사 권한을 확인해 주세요.");
      }
    });
  }

  productList.addEventListener("click", async (e) => {
    const backupBtn = e.target.closest("[data-backup-info]");
    if (backupBtn) {
      const code = backupBtn.getAttribute("data-backup-info") || "";
      const note = document.getElementById(`backup-note-${code}`);
      if (note) note.hidden = !note.hidden;
      const panel = document.getElementById(`detail-${code}`);
      if (panel && panel.hidden) {
        panel.hidden = false;
      }
      return;
    }
    const shareBtn = e.target.closest("[data-share-code]");
    if (shareBtn) {
      const code = shareBtn.getAttribute("data-share-code") || "";
      const target = allItems.find((it) => it.code === code) || null;
      void triggerShare(target);
      return;
    }
    const toggleBtn = e.target.closest("[data-toggle-detail]");
    if (toggleBtn) {
      const code = toggleBtn.getAttribute("data-toggle-detail") || "";
      const panel = document.getElementById(`detail-${code}`);
      if (panel) {
        const willOpen = panel.hidden;
        panel.hidden = !willOpen;
        toggleBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
        toggleBtn.textContent = willOpen ? "상세 설명 접기" : "상세 설명 보기";
      }
      return;
    }
    const btn = e.target.closest("[data-copy-url]");
    if (!btn) return;
    const copyUrl = btn.getAttribute("data-copy-url") || "";
    if (!copyUrl) return;
    try {
      await navigator.clipboard.writeText(copyUrl);
      showToast("상품 바로가기 주소를 복사했습니다.");
    } catch (_) {
      showToast(copyUrl);
    }
  });

  renderChips();
  renderItems();
  initGoRedirect(goCode);
  refreshRemoteCatalog();
})();
