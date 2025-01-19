document.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const mainTitle = document.getElementById('main-title');
    const fadeInText = document.getElementById('fade-in-text');

    // Shrink and move "ReLyf" to the top left
    if (scrollY > 100) {
        mainTitle.style.transform = 'translate(0, 0) scale(0.8)';
        mainTitle.style.position = 'fixed';
        mainTitle.style.top = '10px';
        mainTitle.style.left = '20px';
        mainTitle.style.textAlign = 'left';
        mainTitle.style.cursor = 'pointer'; // Add pointer cursor for clickable effect
        mainTitle.textContent = 'ReLyf'; // Ensure it stays as "ReLyf"
    } else {
        mainTitle.style.transform = 'translate(-50%, -50%) scale(1)';
        mainTitle.style.position = 'absolute';
        mainTitle.style.top = '50%';
        mainTitle.style.left = '50%';
        mainTitle.style.textAlign = 'center';
        mainTitle.style.cursor = 'default';
    }

    // Fade in "ReLyf's biography"
    if (scrollY > 500) {
        fadeInText.classList.remove('hidden');
        fadeInText.style.opacity = '1';
    } else {
        fadeInText.classList.add('hidden');
        fadeInText.style.opacity = '0';
    }
});

// Optional: Redirect to the home page on clicking the header when it's fixed
document.getElementById('main-title').addEventListener('click', () => {
    if (window.scrollY > 100) {
        window.location.href = 'https://relyf47.github.io';
    }
});
