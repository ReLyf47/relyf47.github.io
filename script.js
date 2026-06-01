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
const rssUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=UCCjVznfRth9YPgDM7UbcYMQ";
const api = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rssUrl);

fetch(api)
    .then(res => res.json())
    .then(data => {
        const items = data.items;
        if (items.length > 0) {
            const randomItem = items[Math.floor(Math.random() * items.length)];
            const videoUrl = randomItem.link;
            const videoId = videoUrl.split("v=")[1];
            const iframe = document.getElementById("latest-video");
            iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
        }
    })
    .catch(err => console.error("Failed to load YouTube video:", err));

// Instagram embed with persistent white background patch
document.addEventListener("DOMContentLoaded", () => {
    const iframe = document.getElementById("random-insta");

    // Create persistent white placeholder
    const placeholder = document.createElement("div");
    placeholder.className = "insta-placeholder";

    // Append it to the container
    const embedContainer = iframe.parentElement;
    embedContainer.appendChild(placeholder);

    // Set the iframe src to a random Instagram post
    const instaPosts = [
        "https://www.instagram.com/relyf_/p/DJeQuF7vgm7/",
        "https://www.instagram.com/relyf_/p/DHa-qSmvVzn/",
        "https://www.instagram.com/relyf_/p/C7mIhjLhEwH/",
        "https://www.instagram.com/relyf_/p/CzQxKbTB5km/",
        "https://www.instagram.com/relyf_/p/CsWL7oWvljl/",
        "https://www.instagram.com/relyf_/p/Cs83cNopvk4/",
        "https://www.instagram.com/relyf_/p/Cfq9kOTJ05a/"
    ];

    const randomPost = instaPosts[Math.floor(Math.random() * instaPosts.length)];
    const embedUrl = `https://www.instagram.com/p/${randomPost.split("/p/")[1].split("/")[0]}/embed`;

    iframe.src = embedUrl;
});

document.addEventListener("DOMContentLoaded", () => {
  const iframe = document.getElementById("latest-video");
  const placeholder = document.querySelector(".vpost-placeholder");

  iframe.addEventListener("load", () => {
    placeholder.style.opacity = "0";
  });

  // Set your YouTube video src
  iframe.src = "https://www.youtube.com/embed/YOUR_VIDEO_ID";
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
document.querySelectorAll('.post, .instapost, .vpost').forEach(card => {
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