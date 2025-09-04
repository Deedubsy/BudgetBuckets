// Pricing page JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for internal anchors
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Note: Login button handler removed as it was empty and unnecessary
  // Links to /auth/login work naturally without JavaScript
});