(() => {
  const nav = document.getElementById("site-nav");
  const grain = document.querySelector(".grain");
  const body = document.body;
  const root = document.documentElement;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     Theme: auto by time of day (dark 8pm–6am, light otherwise),
     with a manual Day/Night toggle that overrides auto going forward.
     Initial data-theme is already set by the blocking head script.
     ------------------------------------------------------------------ */
  const THEME_KEY = "theme-preference";

  const getAutoTheme = () => {
    const h = new Date().getHours();
    return h >= 20 || h < 6 ? "dark" : "light";
  };

  const toggleEl = document.getElementById("theme-toggle");
  const indicator = document.getElementById("theme-toggle-indicator");
  const options = toggleEl ? Array.from(toggleEl.querySelectorAll("[data-theme-option]")) : [];

  const positionIndicator = (theme) => {
    if (!indicator) return;
    const active = options.find((o) => o.dataset.themeOption === theme);
    if (!active) return;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft - 3}px)`;
  };

  const updateToggleUI = (theme) => {
    options.forEach((o) => o.classList.toggle("is-active", o.dataset.themeOption === theme));
    positionIndicator(theme);
  };

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    updateToggleUI(theme);
    if (dotField) dotField.render(0, false);
  };

  options.forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.themeOption;
      localStorage.setItem(THEME_KEY, theme);
      applyTheme(theme);
    });
  });

  // Re-check every 5 minutes so an open tab crosses the 8pm/6am boundary live,
  // but only while the user hasn't explicitly overridden the auto choice.
  setInterval(() => {
    const pref = localStorage.getItem(THEME_KEY) || "auto";
    if (pref === "auto") applyTheme(getAutoTheme());
  }, 5 * 60 * 1000);

  // Sync the toggle UI to whatever theme the head script already applied.
  updateToggleUI(root.getAttribute("data-theme") || "light");
  window.addEventListener("resize", () => updateToggleUI(root.getAttribute("data-theme") || "light"));
  // Re-measure once the display font swaps in, so the indicator isn't sized off the fallback font
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => updateToggleUI(root.getAttribute("data-theme") || "light"));
  }

  /* ------------------------------------------------------------------
     Ambient dot-wave field
     ------------------------------------------------------------------ */
  class DotField {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.spacing = 34;
      this.time = 0;
      this.mouse = { x: -9999, y: -9999 };
      this._raf = null;
      this.resize();
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("pointermove", (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      });
      window.addEventListener("pointerleave", () => {
        this.mouse.x = -9999;
        this.mouse.y = -9999;
      });
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.cols = Math.ceil(this.width / this.spacing) + 1;
      this.rows = Math.ceil(this.height / this.spacing) + 1;
      this.render(0, false);
    }

    rgb() {
      return root.getAttribute("data-theme") === "dark" ? "235, 235, 235" : "20, 20, 20";
    }

    render(dt, animate) {
      if (animate) this.time += dt;
      const ctx = this.ctx;
      const rgb = this.rgb();
      ctx.clearRect(0, 0, this.width, this.height);
      for (let iy = 0; iy < this.rows; iy++) {
        for (let ix = 0; ix < this.cols; ix++) {
          const x = ix * this.spacing;
          const y = iy * this.spacing;
          const wave = Math.sin(this.time * 0.0006 + x * 0.012 + y * 0.008);
          const dx = x - this.mouse.x;
          const dy = y - this.mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximity = Math.max(0, 1 - dist / 160);
          const r = Math.max(0.4, 1 + wave * 0.6 + proximity * 1.8);
          const alpha = Math.max(0.03, 0.1 + wave * 0.05 + proximity * 0.25);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
          ctx.fill();
        }
      }
    }

    start() {
      let last = performance.now();
      const loop = (now) => {
        const dt = now - last;
        last = now;
        this.render(dt, true);
        this._raf = requestAnimationFrame(loop);
      };
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(loop);
    }

    stop() {
      cancelAnimationFrame(this._raf);
      this._raf = null;
      this.render(0, false);
    }
  }

  const dotCanvas = document.getElementById("dot-field");
  const dotField = dotCanvas ? new DotField(dotCanvas) : null;
  if (dotField) {
    if (prefersReducedMotion) dotField.render(0, false);
    else dotField.start();
  }

  /* Nav hairline border on scroll */
  const onScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Smooth scroll without scrollIntoView (safe inside iframes) */
  const scrollToId = (id) => {
    const target = id === "top" ? document.body : document.getElementById(id);
    if (!target) return;
    const top = id === "top" ? 0 : target.getBoundingClientRect().top + window.scrollY - 0;
    window.scrollTo({
      top,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  document.querySelectorAll("[data-scroll-to]").forEach((el) => {
    el.addEventListener("click", () => scrollToId(el.dataset.scrollTo));
  });

  /* Scroll-triggered reveal animations, staggered per section */
  const revealGroups = new Map();
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    const section = el.closest("section, footer") || document.body;
    if (!revealGroups.has(section)) revealGroups.set(section, []);
    revealGroups.get(section).push(el);
  });

  revealGroups.forEach((els) => {
    els.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i, 6) * 70}ms`;
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));

  /* Subtle hero parallax */
  const heroName = document.querySelector(".hero__name");
  if (heroName && !prefersReducedMotion) {
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const offset = Math.min(window.scrollY * 0.08, 40);
          heroName.style.transform = `translateY(${offset}px)`;
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  /* Tweaks panel */
  const tweaksToggle = document.getElementById("tweaks-toggle");
  const tweaksPanel = document.getElementById("tweaks-panel");
  const tweaksClose = document.getElementById("tweaks-close");
  const grainToggle = document.getElementById("tweak-grain");
  const motionToggle = document.getElementById("tweak-motion");

  tweaksToggle.addEventListener("click", () => tweaksPanel.classList.toggle("is-open"));
  tweaksClose.addEventListener("click", () => tweaksPanel.classList.remove("is-open"));

  grainToggle.addEventListener("change", () => {
    grain.classList.toggle("is-off", !grainToggle.checked);
  });

  motionToggle.checked = prefersReducedMotion;
  body.classList.toggle("reduce-motion", motionToggle.checked);
  motionToggle.addEventListener("change", () => {
    body.classList.toggle("reduce-motion", motionToggle.checked);
    if (dotField) {
      if (motionToggle.checked) dotField.stop();
      else dotField.start();
    }
  });
})();
