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

fetch('https://api.countapi.xyz/hit/relyf47.github.io/visits')
  .then(response => response.json())
  .then(data => {
    document.getElementById('visits').innerText = data.value;
  });