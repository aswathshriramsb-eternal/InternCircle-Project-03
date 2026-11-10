/**
 * NEXORA — Pricing Page Interactive Behavior
 * Pure Vanilla JavaScript (ES6+), modular and accessible.
 *
 * Modules:
 *  1. Billing Cycle Toggle (Monthly / Yearly via HTML data-* attributes + price transition)
 *  2. Responsive Single-Tree Navigation (Popover on narrow, Inline on wide, Sticky shadow)
 *  3. Scrollspy Active Navigation Indicator (Native scroll-target-group + IntersectionObserver fallback)
 *  4. Responsive Popular-Card DOM Synchronization (< 800px Tab-order alignment)
 *  5. Accessible FAQ Accordion (aria-expanded + hidden="until-found" + beforematch)
 *  6. Native <dialog> Demo Interactions (Plan Preview, Team Sales Inquiry, Sign-In Simulation)
 */

(() => {
  "use strict";

  /* ------------------------------------------------------------------------
     State & Shared Media Queries
     ------------------------------------------------------------------------ */
  const state = {
    billingPeriod: "monthly",
  };

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------------------
     1. Billing Period Toggle (Monthly / Yearly)
     ------------------------------------------------------------------------ */
  function initBillingToggle() {
    const monthlyBtn = document.getElementById("billing-monthly");
    const yearlyBtn = document.getElementById("billing-yearly");
    const savingsIndicator = document.getElementById("savings-indicator");
    const savingsCopy = savingsIndicator?.querySelector(".savings-indicator-copy");
    const announcer = document.getElementById("billing-announcer");

    const priceAmounts = document.querySelectorAll(".price-amount");
    const priceUnits = document.querySelectorAll(".price-unit");
    const billingNotes = document.querySelectorAll(".plan-billing-note");

    if (!monthlyBtn || !yearlyBtn) return;

    const buttons = {
      monthly: monthlyBtn,
      yearly: yearlyBtn,
    };

    function animatePriceChange(el) {
      if (reducedMotionQuery.matches || typeof el.animate !== "function") return;
      el.getAnimations().forEach((anim) => anim.cancel());
      el.animate(
        [
          { opacity: 0.35, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        }
      );
    }

    function applyBillingPeriod(period, announce = false) {
      if (period !== "monthly" && period !== "yearly") return;
      const didChange = state.billingPeriod !== period;
      state.billingPeriod = period;

      // Update prices from HTML data-monthly / data-yearly attributes
      priceAmounts.forEach((el) => {
        const nextPrice = el.dataset[period];
        if (nextPrice) {
          el.textContent = nextPrice;
          if (announce && didChange) {
            animatePriceChange(el);
          }
        }
      });

      // Update billing units ("per month" / "per year")
      const unitKey = period === "monthly" ? "monthlyUnit" : "yearlyUnit";
      priceUnits.forEach((el) => {
        const nextUnit = el.dataset[unitKey];
        if (nextUnit) el.textContent = nextUnit;
      });

      // Update contextual savings / billing notes on each card
      const noteKey = period === "monthly" ? "monthlyNote" : "yearlyNote";
      billingNotes.forEach((el) => {
        const nextNote = el.dataset[noteKey];
        if (nextNote) el.textContent = nextNote;
      });

      // Update button active styles and aria-pressed states
      Object.entries(buttons).forEach(([key, button]) => {
        const isActive = key === period;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });

      // Update savings banner indicator
      if (savingsIndicator && savingsCopy) {
        const textKey = period === "monthly" ? "monthlyText" : "yearlyText";
        const nextText = savingsIndicator.dataset[textKey];
        if (nextText) savingsCopy.textContent = nextText;
        savingsIndicator.classList.toggle("is-yearly", period === "yearly");
      }

      // Announce change politely only on user action
      if (announce && announcer) {
        announcer.textContent =
          period === "yearly"
            ? "Yearly billing selected. All plan prices updated with a 20% annual discount."
            : "Monthly billing selected. All plan prices updated to monthly rates.";
      }
    }

    monthlyBtn.addEventListener("click", () => applyBillingPeriod("monthly", true));
    yearlyBtn.addEventListener("click", () => applyBillingPeriod("yearly", true));

    // Default initial state
    applyBillingPeriod("monthly", false);
  }

  /* ------------------------------------------------------------------------
     2. Responsive Single-Tree Navigation (Popover <-> Inline + Sticky State)
     ------------------------------------------------------------------------ */
  function initNavigation() {
    const header = document.querySelector(".site-header");
    const headerInner = header?.querySelector(".header-inner");
    const menuButton = header?.querySelector(".menu-button");
    const siteMenu = document.getElementById("site-menu");

    if (!header || !headerInner || !menuButton || !siteMenu) return;

    // Sticky navbar elevation on scroll
    function syncHeaderScrollState() {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    }

    let scrollTicking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (!scrollTicking) {
          scrollTicking = true;
          requestAnimationFrame(() => {
            syncHeaderScrollState();
            scrollTicking = false;
          });
        }
      },
      { passive: true }
    );
    syncHeaderScrollState();

    // Load native popover polyfill conditionally only when unsupported
    if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
      import("https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js").catch(
        () => {
          // Graceful click fallback if offline and browser lacks Popover API
          menuButton.addEventListener("click", () => {
            const isOpen = siteMenu.classList.toggle(":popover-open");
            menuButton.setAttribute("aria-expanded", String(isOpen));
          });
        }
      );
    }

    let lastMeasuredHeaderWidth = 0;
    let isInitialized = false;

    function syncNavigationLayout() {
      const currentWidth = headerInner.clientWidth;
      const isCurrentlyWide = header.classList.contains("is-wide");

      // Avoid layout thrashing while collapsed unless header grew or initializing
      if (isInitialized && !isCurrentlyWide && currentWidth <= lastMeasuredHeaderWidth) {
        return;
      }

      lastMeasuredHeaderWidth = currentWidth;
      isInitialized = true;

      const wasOpen =
        siteMenu.matches(":popover-open") || siteMenu.classList.contains(":popover-open");

      header.classList.add("is-measuring");
      header.classList.add("is-wide");
      siteMenu.removeAttribute("popover");

      // Compare intrinsic inline row width vs available container width
      const fitsInline = headerInner.scrollWidth <= headerInner.clientWidth;

      if (fitsInline) {
        menuButton.setAttribute("aria-expanded", "false");
      } else {
        header.classList.remove("is-wide");
        siteMenu.setAttribute("popover", "auto");

        if (wasOpen && typeof siteMenu.showPopover === "function") {
          try {
            siteMenu.showPopover();
          } catch {
            // Ignore if already open or detached
          }
        }
      }

      requestAnimationFrame(() => {
        header.classList.remove("is-measuring");
      });
    }

    // Sync aria-expanded from native popover toggle events
    siteMenu.addEventListener("toggle", (event) => {
      const isOpen = event.newState === "open";
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    // Close collapsed mobile popover cleanly when an item is activated
    siteMenu.addEventListener("click", (event) => {
      const target = event.target.closest("a, button");
      if (!target || header.classList.contains("is-wide")) return;

      if (typeof siteMenu.hidePopover === "function") {
        try {
          siteMenu.hidePopover();
        } catch {
          siteMenu.classList.remove(":popover-open");
          menuButton.setAttribute("aria-expanded", "false");
        }
      }
    });

    if (typeof ResizeObserver === "function") {
      const resizeObserver = new ResizeObserver(() => {
        syncNavigationLayout();
      });
      resizeObserver.observe(header);
      resizeObserver.observe(siteMenu);
    } else {
      window.addEventListener("resize", syncNavigationLayout);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        lastMeasuredHeaderWidth = 0;
        syncNavigationLayout();
      });
    }

    syncNavigationLayout();
  }

  /* ------------------------------------------------------------------------
     3. Scrollspy Active Navigation Indicator
     Uses native CSS scroll-target-group when supported + IntersectionObserver fallback
     ------------------------------------------------------------------------ */
  function initScrollspy() {
    const navLinks = Array.from(document.querySelectorAll("#site-menu .nav-link"));
    const trackedSections = Array.from(document.querySelectorAll("main section[id]"));
    if (!navLinks.length || !trackedSections.length) return;

    const supportsScrollTargetGroup = CSS.supports("scroll-target-group: auto");

    function setFallbackActiveLink(targetLink) {
      navLinks.forEach((link) => {
        const isActive = link === targetLink;
        link.classList.toggle("target-current", isActive);
        link.setAttribute("aria-current", isActive ? "true" : "false");
      });
    }

    if (supportsScrollTargetGroup) {
      let spyTimer = 0;

      const syncAriaCurrent = () => {
        const nativeCurrent = document.querySelector("#site-menu .nav-link:target-current");
        if (nativeCurrent) {
          navLinks.forEach((link) => {
            link.classList.remove("target-current");
            link.setAttribute("aria-current", link === nativeCurrent ? "true" : "false");
          });
        } else if (window.scrollY < 160) {
          // Near top of page above hero fold before first section enters scrollspy range
          setFallbackActiveLink(navLinks[0]);
        } else {
          navLinks.forEach((link) => {
            link.classList.remove("target-current");
          });
        }
      };

      syncAriaCurrent();
      window.addEventListener(
        "scroll",
        () => {
          clearTimeout(spyTimer);
          // Wait one paint cycle + settle so Blink updates :target-current after instant/programmatic scrolls
          spyTimer = window.setTimeout(() => {
            requestAnimationFrame(syncAriaCurrent);
          }, 80);
        },
        { passive: true }
      );
      document.addEventListener("scrollend", syncAriaCurrent);
      window.addEventListener("hashchange", () =>
        requestAnimationFrame(() => requestAnimationFrame(syncAriaCurrent))
      );
    } else {
      setFallbackActiveLink(navLinks[0]);

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute("id");
              const matchingLink = navLinks.find(
                (link) => link.getAttribute("href") === `#${id}`
              );
              if (matchingLink) {
                setFallbackActiveLink(matchingLink);
              }
            }
          });
        },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
      );

      trackedSections.forEach((section) => observer.observe(section));
    }
  }

  /* ------------------------------------------------------------------------
     4. Responsive Popular-Card DOM Order Sync (< 800px)
     Keeps keyboard Tab order aligned with mobile visual order (Popular first)
     ------------------------------------------------------------------------ */
  function initResponsivePopularOrder() {
    const grid = document.getElementById("pricing-grid");
    const popularCard = grid?.querySelector(".pricing-card--popular");
    if (!grid || !popularCard) return;

    const mobileQuery = window.matchMedia("(max-width: 799px)");

    function reorderCards(isMobile) {
      const cards = Array.from(grid.querySelectorAll(".pricing-card"));
      if (cards.length < 3) return;

      const desiredOrder = isMobile
        ? [
            popularCard,
            ...cards
              .filter((card) => card !== popularCard)
              .sort((a, b) => Number(a.dataset.planIndex) - Number(b.dataset.planIndex)),
          ]
        : cards.sort((a, b) => Number(a.dataset.planIndex) - Number(b.dataset.planIndex));

      const alreadyAligned = desiredOrder.every((card, index) => grid.children[index] === card);
      if (alreadyAligned) return;

      const activeEl = document.activeElement;
      const focusInsideGrid = activeEl && grid.contains(activeEl);

      desiredOrder.forEach((card) => {
        if (typeof grid.moveBefore === "function") {
          grid.moveBefore(card, null);
        } else {
          grid.appendChild(card);
        }
      });

      if (focusInsideGrid && activeEl instanceof HTMLElement) {
        activeEl.focus({ preventScroll: true });
      }
    }

    reorderCards(mobileQuery.matches);
    mobileQuery.addEventListener("change", (event) => reorderCards(event.matches));
  }

  /* ------------------------------------------------------------------------
     5. Accessible FAQ Accordion
     ------------------------------------------------------------------------ */
  function initFaqAccordion() {
    const triggers = document.querySelectorAll(".faq-trigger");
    const panels = document.querySelectorAll(".faq-panel");

    if (!triggers.length) return;

    function setPanelState(trigger, panel, expand) {
      trigger.setAttribute("aria-expanded", String(expand));
      if (expand) {
        panel.hidden = false;
      } else {
        panel.setAttribute("hidden", "until-found");
      }
    }

    triggers.forEach((trigger) => {
      const panelId = trigger.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      if (!panel) return;

      trigger.addEventListener("click", () => {
        const isExpanded = trigger.getAttribute("aria-expanded") === "true";
        setPanelState(trigger, panel, !isExpanded);
      });
    });

    // Sync aria-expanded when browser Find-in-Page reveals hidden="until-found"
    panels.forEach((panel) => {
      panel.addEventListener("beforematch", () => {
        const trigger = document.querySelector(
          `.faq-trigger[aria-controls="${CSS.escape(panel.id)}"]`
        );
        if (trigger) {
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     6. Interactive Demo Modal Dialogs (<dialog>)
     ------------------------------------------------------------------------ */
  function initDialogs() {
    const planDialog = document.getElementById("plan-dialog");
    const planDialogTitle = document.getElementById("plan-dialog-title");
    const dialogPriceValue = document.getElementById("dialog-price-value");
    const dialogPriceUnit = document.getElementById("dialog-price-unit");
    const dialogBillingSummary = document.getElementById("dialog-billing-summary");
    const dialogFeatureList = document.getElementById("dialog-feature-list");
    const planDemoForm = document.getElementById("plan-demo-form");
    const workspaceInput = document.getElementById("demo-workspace-name");
    const planFeedback = document.getElementById("plan-demo-feedback");
    const planCancelBtn = document.getElementById("plan-dialog-cancel");

    const salesDialog = document.getElementById("sales-dialog");
    const openSalesBtn = document.getElementById("open-sales-btn");
    const salesDemoForm = document.getElementById("sales-demo-form");
    const salesFeedback = document.getElementById("sales-demo-feedback");
    const salesCancelBtn = document.getElementById("sales-dialog-cancel");

    const signinDialog = document.getElementById("signin-dialog");
    const openSigninBtn = document.getElementById("open-signin-btn");
    const signinDemoForm = document.getElementById("signin-demo-form");
    const signinFeedback = document.getElementById("signin-demo-feedback");
    const signinCancelBtn = document.getElementById("signin-dialog-cancel");

    // Light-dismiss fallback for browsers without native <dialog closedby="any">
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const isOutsideDialog = (event, dialog) => {
        const rect = dialog.getBoundingClientRect();
        return (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        );
      };

      document.querySelectorAll('dialog[closedby="any"]').forEach((dialog) => {
        let pressedOutside = false;
        dialog.addEventListener("pointerdown", (event) => {
          pressedOutside = isOutsideDialog(event, dialog);
        });
        dialog.addEventListener("pointerup", (event) => {
          if (pressedOutside && isOutsideDialog(event, dialog)) {
            dialog.close();
          }
        });
      });
    }

    // Clear returnValue on close to avoid stale values across invocations
    [planDialog, salesDialog, signinDialog].forEach((dialog) => {
      if (!dialog) return;
      dialog.addEventListener("close", () => {
        dialog.returnValue = "";
      });
    });

    // Plan CTA Click -> Populate & Open Demo Plan Modal
    let activeModalPlan = null;

    document.querySelectorAll("[data-plan-trigger]").forEach((ctaButton) => {
      ctaButton.addEventListener("click", () => {
        if (!planDialog) return;

        const card = ctaButton.closest(".pricing-card");
        if (!card) return;

        const planName = ctaButton.dataset.planTrigger || card.dataset.plan || "Selected";
        const priceEl = card.querySelector(".price-amount");
        const unitEl = card.querySelector(".price-unit");
        const noteEl = card.querySelector(".plan-billing-note");
        const featureNodes = card.querySelectorAll(".plan-features li span");

        const currentPrice = priceEl ? priceEl.textContent.trim() : "";
        const currentUnit = unitEl ? unitEl.textContent.trim() : "";
        const currentNote = noteEl ? noteEl.textContent.trim() : "";

        activeModalPlan = {
          name: planName,
          price: currentPrice,
          unit: currentUnit,
          period: state.billingPeriod,
        };

        if (planDialogTitle) planDialogTitle.textContent = `${planName} Plan Preview`;
        if (dialogPriceValue) dialogPriceValue.textContent = currentPrice;
        if (dialogPriceUnit) dialogPriceUnit.textContent = currentUnit;
        if (dialogBillingSummary) dialogBillingSummary.textContent = currentNote;

        if (dialogFeatureList) {
          dialogFeatureList.textContent = "";
          featureNodes.forEach((node) => {
            const li = document.createElement("li");
            li.textContent = node.textContent.trim();
            dialogFeatureList.appendChild(li);
          });
        }

        if (planFeedback) {
          planFeedback.hidden = true;
          planFeedback.textContent = "";
        }
        if (workspaceInput) workspaceInput.value = "";

        planDialog.showModal();
      });
    });

    if (planCancelBtn && planDialog) {
      planCancelBtn.addEventListener("click", () => planDialog.close("cancel"));
    }

    if (planDemoForm && planFeedback) {
      planDemoForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const workspaceName = workspaceInput?.value.trim();
        const workspaceLabel = workspaceName ? ` "${workspaceName}"` : "";
        const planInfo = activeModalPlan
          ? `${activeModalPlan.name} (${activeModalPlan.period} · ${activeModalPlan.price} ${activeModalPlan.unit})`
          : "your selected plan";

        planFeedback.textContent = `Demo workspace${workspaceLabel} ready with ${planInfo}. No account was created and no real payment was processed.`;
        planFeedback.hidden = false;
      });
    }

    // Team Sales Inquiry Trigger & Local Preview
    if (openSalesBtn && salesDialog) {
      openSalesBtn.addEventListener("click", () => {
        if (salesDemoForm) salesDemoForm.reset();
        if (salesFeedback) {
          salesFeedback.hidden = true;
          salesFeedback.textContent = "";
        }
        salesDialog.showModal();
      });
    }

    if (salesCancelBtn && salesDialog) {
      salesCancelBtn.addEventListener("click", () => salesDialog.close("cancel"));
    }

    if (salesDemoForm && salesFeedback) {
      salesDemoForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const emailField = document.getElementById("sales-email");
        const sizeField = document.getElementById("sales-team-size");
        const email = emailField instanceof HTMLInputElement ? emailField.value.trim() : "";
        const teamSize = sizeField instanceof HTMLInputElement ? sizeField.value.trim() : "";

        salesFeedback.textContent = `Local Team inquiry preview prepared for ${
          email || "your team"
        } (${teamSize || "multi-seat"} seats on Team at ₹999/mo or ₹9,590/yr). No external message or billing request was sent.`;
        salesFeedback.hidden = false;
      });
    }

    // Sign In Trigger & Simulation
    if (openSigninBtn && signinDialog) {
      openSigninBtn.addEventListener("click", () => {
        if (signinDemoForm) signinDemoForm.reset();
        if (signinFeedback) {
          signinFeedback.hidden = true;
          signinFeedback.textContent = "";
        }
        signinDialog.showModal();
      });
    }

    if (signinCancelBtn && signinDialog) {
      signinCancelBtn.addEventListener("click", () => signinDialog.close("cancel"));
    }

    if (signinDemoForm && signinFeedback) {
      signinDemoForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const emailField = document.getElementById("signin-email");
        const email = emailField instanceof HTMLInputElement ? emailField.value.trim() : "";

        signinFeedback.textContent = `Demo simulation complete for ${
          email || "your email"
        }. No network request or authentication occurred.`;
        signinFeedback.hidden = false;
      });
    }
  }

  /* ------------------------------------------------------------------------
     Bootstrap
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    initBillingToggle();
    initNavigation();
    initScrollspy();
    initResponsivePopularOrder();
    initFaqAccordion();
    initDialogs();
  });
})();
