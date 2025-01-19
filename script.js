document.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const mainTitle = document.getElementById('main-title');
    const fadeInText = document.getElementById('fade-in-text');

    // Shrink and move "ReLyf" to the top left
    if (scrollY > 100) {
        mainTitle.style.transform = 'translate(-50%, -50%) scale(0.8)';
        mainTitle.style.position = 'fixed';
        mainTitle.style.top = '10px';
        mainTitle.style.left = '20px';
        mainTitle.style.textAlign = 'left';
    } else {
        mainTitle.style.transform = 'translate(-50%, -50%) scale(1)';
        mainTitle.style.position = 'absolute';
        mainTitle.style.top = '50%';
        mainTitle.style.left = '50%';
        mainTitle.style.textAlign = 'center';
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
