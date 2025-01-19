document.addEventListener("scroll", () => {
    const mainTitle = document.getElementById("main-title");
    const fadeInText = document.getElementById("fade-in-text");
    const scrollY = window.scrollY;

    // Handle the main title (ReLyf) movement and shrinking
    if (scrollY > 0) {
        mainTitle.style.top = "10px";
        mainTitle.style.left = "10px";
        mainTitle.style.fontSize = "2rem"; // Shrink size
    } else {
        mainTitle.style.top = "50%";
        mainTitle.style.left = "50%";
        mainTitle.style.fontSize = "50vmin"; // Original size
    }

    // Fade in the biography text when scrolled
    if (scrollY > 200) {
        fadeInText.style.opacity = "1";
    } else {
        fadeInText.style.opacity = "0";
    }
});
