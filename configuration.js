document.addEventListener('DOMContentLoaded', () => {

  // Add click feedback to configuration tiles
  const configCards = document.querySelectorAll('.config-card');

  configCards.forEach(card => {
    card.addEventListener('click', (e) => {
      const label = card.querySelector('.card-label').innerText;
      
      // If the target page doesn't exist yet, show standard confirmation
      const href = card.getAttribute('href');
      if (href === '#' || href.endsWith('.html')) {
        console.log(`Navigating to configuration section: ${label}`);
      }
    });
  });

});