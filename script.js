(function () {
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var progress = document.querySelector(".scroll-progress");
  var revealItems = Array.prototype.slice.call(document.querySelectorAll(".reveal, .entry"));
  var sections = Array.prototype.slice.call(document.querySelectorAll("main [id]"));
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc-link[href^='#']"));

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
  } else {
    revealItems.forEach(function (item) {
      var rect = item.getBoundingClientRect();
      var isOnScreen = rect.top < window.innerHeight && rect.bottom > 0;

      if (isOnScreen) {
        item.classList.add("is-visible");
      }
    });

    document.body.classList.add("is-loaded");

    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12
    });

    revealItems.forEach(function (item) {
      if (!item.classList.contains("is-visible")) {
        revealObserver.observe(item);
      }
    });
  }

  if (!document.body.classList.contains("is-loaded")) {
    document.body.classList.add("is-loaded");
  }

  function updateProgress() {
    if (!progress) {
      return;
    }

    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var height = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = height > 0 ? Math.min(scrollTop / height, 1) : 0;
    progress.style.width = ratio * 100 + "%";
  }

  function updateActiveLink() {
    if (!sections.length || !tocLinks.length) {
      return;
    }

    var activeId = sections[0].id;
    var anchorLine = window.scrollY + 140;

    sections.forEach(function (section) {
      if (section.offsetTop <= anchorLine) {
        activeId = section.id;
      }
    });

    tocLinks.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === "#" + activeId);
    });
  }

  function onScroll() {
    updateProgress();
    updateActiveLink();
  }

  updateProgress();
  updateActiveLink();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
