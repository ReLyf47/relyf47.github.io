document.querySelectorAll('.post').forEach(card => {
    card.addEventListener('click', () => {
        const link = card.getAttribute('data-href');
        if (link) {
            window.location.href = link;
        }
    });
});
