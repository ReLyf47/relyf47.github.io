function showAdblockWarning() {
    const warning = document.createElement("div");

    warning.innerHTML = `
        <div id="adblock-warning">
            Some features may not work because a content blocker is preventing required resources from loading.
            <br><br>
            Please whitelist this site if you want comments and embeds to work.
        </div>
    `;

    document.body.appendChild(warning);
}

function detectAdBlock() {
    const bait = document.getElementById("adblock-test");

    if (
        !bait ||
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0 ||
        getComputedStyle(bait).display === "none"
    ) {
        return true;
    }

    return false;
}

window.addEventListener("load", () => {
    if (detectAdBlock()) {
        showAdblockWarning();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const images = [
        "resources/LAB/1.jpeg",
        "resources/LAB/2.jpeg",
        "resources/LAB/3.jpeg",
        "resources/LAB/4.jpeg",
        "resources/LAB/5.jpeg",
        "resources/LAB/6.jpeg",
        "resources/LAB/7.jpeg",
        "resources/LAB/8.jpeg",
        "resources/LAB/9.jpeg"
    ];

    const imgA = document.getElementById("imgA");
    const imgB = document.getElementById("imgB");
    const gallery = document.querySelector(".experience-gallery");

    let current = imgA;
    let next = imgB;

    function updateGalleryHeight(img) {
        const measure = () => {
            if (!img.naturalWidth || !img.naturalHeight || !gallery) return;
            const fullH = gallery.clientWidth * (img.naturalHeight / img.naturalWidth);
            const peekH = Math.ceil(fullH * PEEK_RATIO);
            gallery.style.setProperty("--exp-full", `${Math.ceil(fullH)}px`);
            gallery.style.setProperty("--exp-peek", `${peekH}px`);
        };
        if (img.complete && img.naturalWidth) measure();
        else img.addEventListener("load", measure, { once: true });
    }

    let currentImage = images[Math.floor(Math.random() * images.length)];
    current.src = currentImage;
    updateGalleryHeight(current);

    setInterval(() => {
        let newImage;

        do {
            newImage = images[Math.floor(Math.random() * images.length)];
        } while (newImage === currentImage);

        currentImage = newImage;

        next.src = newImage;

        next.classList.add("active");
        current.classList.remove("active");
        updateGalleryHeight(next);

        [current, next] = [next, current];
    }, 5000);
});

// Peek ratio: how much of the full image to show when collapsed
const PEEK_RATIO = 0.35;

function updateSliderHeight(slider) {
  const img = slider.querySelector(".banner-image.active");
  if (!img) return;

  const measure = () => {
    if (!img.naturalWidth || !img.naturalHeight) return;

    const fullHeight =
      slider.clientWidth *
      (img.naturalHeight / img.naturalWidth);

    const peekHeight = Math.ceil(fullHeight * PEEK_RATIO);

    slider.style.setProperty("--full-height", `${Math.ceil(fullHeight)}px`);
    slider.style.setProperty("--peek-height", `${peekHeight}px`);
  };

  if (img.complete && img.naturalWidth) {
    measure();
  } else {
    img.addEventListener("load", measure, { once: true });
  }
}

document.querySelectorAll(".banner-slider").forEach(slider => {
  updateSliderHeight(slider);

  window.addEventListener("resize", () => {
    updateSliderHeight(slider);
  });
});

function setActiveImage(slider, nextImage) {
  slider.querySelector('.active')?.classList.remove('active');
  nextImage.classList.add('active');

  updateSliderHeight(slider);
}

async function createBannerSlider(sliderId, jsonPath) {
    const response = await fetch(jsonPath);
    const images = await response.json();

    if (!images || images.length === 0) return;

    const slider = document.getElementById(sliderId);
    const imgA = slider.children[0];
    const imgB = slider.children[1];

    let current = 0;
    let showingA = true;

    imgA.src = images[current];
    setActiveImage(slider, imgA);

    setInterval(() => {
        let next;

        do {
            next = Math.floor(Math.random() * images.length);
        } while (images.length > 1 && next === current);

        current = next;

        const visible = showingA ? imgA : imgB;
        const hidden  = showingA ? imgB : imgA;

        hidden.src = images[current];

        // Wait for the new image to load before measuring + swapping
        const doSwap = () => {
            setActiveImage(slider, hidden);
            showingA = !showingA;
        };

        if (hidden.complete && hidden.naturalWidth) {
            doSwap();
        } else {
            hidden.addEventListener("load", doSwap, { once: true });
        }

    }, 8000);
}

createBannerSlider(
    "anime-slider",
    "extra/animanga/assets/anime-banners.json"
);

createBannerSlider(
    "manga-slider",
    "extra/animanga/assets/manga-banners.json"
);

// Set video wrapper peek/full heights based on 16:9 ratio
(function initVideoHeight() {
    const wrapper = document.querySelector(".video-wrapper");
    if (!wrapper) return;

    const setVideoHeights = () => {
        const fullH = wrapper.clientWidth * (9 / 16);
        const peekH = Math.ceil(fullH * PEEK_RATIO);
        wrapper.style.setProperty("--video-full", `${Math.ceil(fullH)}px`);
        wrapper.style.setProperty("--video-peek", `${peekH}px`);
    };

    setVideoHeights();
    window.addEventListener("resize", setVideoHeights);
})();

// Set insta-embed peek/full heights (1:1 square embed)
(function initInstaHeight() {
    const embed = document.querySelector(".insta-embed");
    if (!embed) return;

    const setInstaHeights = () => {
        const fullH = embed.clientWidth; // 1:1 ratio
        const peekH = Math.ceil(fullH * PEEK_RATIO);
        embed.style.setProperty("--insta-full", `${Math.ceil(fullH)}px`);
        embed.style.setProperty("--insta-peek", `${peekH}px`);
    };

    setInstaHeights();
    window.addEventListener("resize", setInstaHeights);
})();

// Set ipost peek/full heights based on each image's natural dimensions
document.querySelectorAll(".ipost").forEach(ipost => {
    const inner = ipost.querySelector(".ipost-inner");
    const img = ipost.querySelector("img");
    if (!inner || !img) return;

    const measure = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        const fullH = inner.clientWidth * (img.naturalHeight / img.naturalWidth);
        const peekH = Math.ceil(fullH * PEEK_RATIO);
        inner.style.setProperty("--ipost-full", `${Math.ceil(fullH)}px`);
        inner.style.setProperty("--ipost-peek", `${peekH}px`);
    };

    if (img.complete && img.naturalWidth) measure();
    else img.addEventListener("load", measure, { once: true });

    window.addEventListener("resize", measure);
});



// Make each .post clickable
document.querySelectorAll('.post').forEach(card => {
    card.addEventListener('click', () => {
        const link = card.getAttribute('data-href');
        if (link) {
            window.location.href = link;
        }
    });
});

// Load a random YouTube video from your channel
document.addEventListener("DOMContentLoaded", () => {
    const iframe = document.getElementById("latest-video");
    const placeholder = document.querySelector(".vpost-placeholder");

    if (iframe) {
        iframe.addEventListener("load", () => {
            if (placeholder) {
                placeholder.style.opacity = "0";
            }
        });
    }

    const rssUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=UCCjVznfRth9YPgDM7UbcYMQ";
    const api = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rssUrl);

    let fallbackVideoIds = [];
    const fallbackPromise = fetch("resources/youtube_videos.json")
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            fallbackVideoIds = Array.isArray(data) ? data : [];
        })
        .catch(err => {
            console.warn("Failed to load fallback video IDs from JSON, using inline emergency list:", err);
            fallbackVideoIds = [
                "0axY2ppXOj8", "1TpwabNAA0k", "2ez7uAKWvY4", "4J6GISEV90I", "4polFEYCrOM",
                "5Qt--fhZfZI", "9GoT0H9N_bg", "arzi9rRReFI", "AuziGiT6YDw", "_Bd1H5mkI4o"
            ];
        });

    function setFallbackVideo() {
        const selectAndSet = () => {
            if (fallbackVideoIds.length > 0) {
                const randomId = fallbackVideoIds[Math.floor(Math.random() * fallbackVideoIds.length)];
                if (iframe) {
                    iframe.src = `https://www.youtube.com/embed/${randomId}?rel=0&modestbranding=1`;
                }
            }
        };

        if (fallbackVideoIds.length === 0) {
            fallbackPromise.then(selectAndSet);
        } else {
            selectAndSet();
        }
    }


    fetch(api)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            if (data && data.status === "ok" && data.items && data.items.length > 0) {
                const randomItem = data.items[Math.floor(Math.random() * data.items.length)];
                const videoUrl = randomItem.link;
                const videoId = videoUrl.split("v=")[1];
                if (videoId && iframe) {
                    iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
                } else {
                    setFallbackVideo();
                }
            } else {
                setFallbackVideo();
            }
        })
        .catch(err => {
            console.warn("Failed to fetch latest YouTube video, using fallback:", err);
            setFallbackVideo();
        });
});

// Instagram embed with persistent white background patch
document.addEventListener("DOMContentLoaded", () => {
    const iframe = document.getElementById("random-insta");

    if (!iframe) return;

    // Create persistent white placeholder
    const placeholder = document.createElement("div");
    placeholder.className = "insta-placeholder";

    // Append it to the container
    const embedContainer = iframe.parentElement;
    if (embedContainer) {
        embedContainer.appendChild(placeholder);
    }

    let instaPosts = [];
    const fallbackPromise = fetch("resources/instagram_posts.json")
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            instaPosts = Array.isArray(data) ? data : [];
        })
        .catch(err => {
            console.warn("Failed to load Instagram posts from JSON, using inline emergency list:", err);
            instaPosts = [
                "DJeQuF7vgm7",
                "DHa-qSmvVzn",
                "C7mIhjLhEwH",
                "CzQxKbTB5km",
                "CsWL7oWvljl",
                "Cs83cNopvk4",
                "Cfq9kOTJ05a"
            ];
        });

    let currentIndex = 0; // Tracks which post is currently showing
    const slideDuration = 8000; // Time in milliseconds (8 seconds)

    // Function to update the iframe with the current post
    function updateSlide() {
        const selectAndSet = () => {
            if (instaPosts.length > 0) {
                const currentPost = instaPosts[currentIndex];
                let postId = currentPost;
                // Support both full URL strings (legacy/fallback) and raw shortcodes
                if (typeof currentPost === "string") {
                    if (currentPost.includes("/p/")) {
                        postId = currentPost.split("/p/")[1].split("/")[0];
                    } else if (currentPost.includes("/reel/")) {
                        postId = currentPost.split("/reel/")[1].split("/")[0];
                    }
                }
                const embedUrl = `https://www.instagram.com/p/${postId}/embed`;
                iframe.src = embedUrl;

                // Increment the index, loop back to 0 if we hit the end of the array
                currentIndex = (currentIndex + 1) % instaPosts.length;
            }
        };

        if (instaPosts.length === 0) {
            fallbackPromise.then(selectAndSet);
        } else {
            selectAndSet();
        }
    }

    // 1. Load the first slide immediately
    updateSlide();

    // 2. Set the interval to automatically change slides
    setInterval(updateSlide, slideDuration);
});



document.addEventListener("DOMContentLoaded", () => {
  const tip = document.getElementById("scrollTip");
  let shown = false;

  window.addEventListener("scroll", () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
      if (!shown) {
        tip.classList.add("show");
        shown = true;

        // Auto-hide after 5 seconds
        setTimeout(() => {
          tip.classList.remove("show");
        }, 5000); // 5000 milliseconds = 5 seconds
      }
    }
  });
});

// Disqus Modal Logic
document.addEventListener("DOMContentLoaded", () => {
    const commentToggle = document.getElementById('comment-toggle');
    const disqusModal = document.getElementById('disqus-modal');
    const closeDisqus = document.getElementById('close-disqus');
    let disqusLoaded = false;

    // Open modal and load Disqus
    commentToggle.addEventListener('click', (e) => {
        e.preventDefault(); // Prevents the <a> tag from jumping the page
        disqusModal.classList.add('show');
        
        // Load the provided embed script ONLY once when the modal is first opened
        if (!disqusLoaded) {
            /* var disqus_config = function () {
            this.page.url = "https://relyf47.github.io"; 
            this.page.identifier = "relyf_home"; 
            };
            */
            var d = document, s = d.createElement('script');
            s.src = 'https://relyf.disqus.com/embed.js';
            s.setAttribute('data-timestamp', +new Date());
            (d.head || d.body).appendChild(s);
            
            disqusLoaded = true;
        }
    });

    // Close modal on 'X' click
    closeDisqus.addEventListener('click', () => {
        disqusModal.classList.remove('show');
    });

    // Close modal when clicking outside the content box
    disqusModal.addEventListener('click', (e) => {
        if (e.target === disqusModal) {
            disqusModal.classList.remove('show');
        }
    });
});

// Make all cards clickable
document.querySelectorAll('.post, .instapost, .vpost, .experience-post').forEach(card => {
    card.addEventListener('click', () => {
        const link = card.getAttribute('data-href');
        if (link) {
            window.location.href = link;
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("privacy-modal");
    const button = document.getElementById("privacy-accept");

    if (!localStorage.getItem("privacyAccepted")) {
        document.body.classList.add("modal-open");
        modal.style.display = "flex";
    } else {
        modal.style.display = "none";
    }

    button.addEventListener("click", () => {
        localStorage.setItem("privacyAccepted", "true");
        modal.style.display = "none";
        document.body.classList.remove("modal-open");
    });
});