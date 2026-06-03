// Initialize Lucide Icons
lucide.createIcons();

// Elements
const supportBtn = document.getElementById('support-btn');
const supportModal = document.getElementById('support-modal');
const closeModal = document.getElementById('close-modal');
const liveTimeEl = document.getElementById('live-time');
const contactForm = document.getElementById('contact-form');

// ===== MODAL LOGIC =====
if (supportBtn) {
    supportBtn.addEventListener('click', () => {
        supportModal.style.display = 'flex';
    });
}

if (closeModal) {
    closeModal.addEventListener('click', () => {
        supportModal.style.display = 'none';
    });
}

if (supportModal) {
    supportModal.addEventListener('click', (e) => {
        if(e.target === supportModal) {
            supportModal.style.display = 'none';
        }
    });
}


setInterval(() => {
    const now = new Date();
    const timeString = now.toISOString().replace("T", " ").substring(0, 19);
    if(liveTimeEl) {
        liveTimeEl.textContent = timeString + " UTC";
    }
}, 1000);


if(contactForm) {
    contactForm.addEventListener('submit', (e) => {
        // Don't prevent default - let the form submit naturally to send-email.php
        
        const submitBtn = contactForm.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        
        // Disable button and show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Sending... <i data-lucide="loader-2"></i>';
        lucide.createIcons();
        
        // Form will submit to send-email.php
        // The page will reload/redirect based on PHP response
    });
}


function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}


document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    
    if (status === 'success') {
        showNotification('Message sent successfully! We\'ll get back to you within 24 hours.', 'success');
        if(contactForm) contactForm.reset();
    } else if (status === 'error') {
        const reason = urlParams.get('reason');
        let errorMsg = 'Oops! Something went wrong. Please try again.';
        if (reason === 'invalid_email') errorMsg = 'Please enter a valid email address.';
        if (reason === 'empty') errorMsg = 'Please fill in all required fields.';
        if (reason === 'mail_failed') errorMsg = 'Unable to send message. Please try again later.';
        showNotification(errorMsg, 'error');
    }
    
    if (status) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});