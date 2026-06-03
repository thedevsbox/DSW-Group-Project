document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    const modal = document.getElementById('settingsModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');

    // 1. GLOBAL PANEL TOGGLES
    const setupToggle = (btnId, panelId, closeId) => {
        const btn = document.getElementById(btnId);
        const panel = document.getElementById(panelId);
        const close = document.getElementById(closeId);
        if(btn && panel && close) {
            btn.onclick = () => panel.classList.add('active');
            close.onclick = () => panel.classList.remove('active');
        }
    };

    setupToggle('menuBtn', 'menuPanel', 'closeMenu');
    setupToggle('accountBtn', 'accountPanel', 'closeAccount');

    // 2. GLOBAL SETTINGS MODAL
    const openSettings = (type) => {
        if(!modal) return;
        modal.style.display = 'flex';
        if (type === 'personal') {
            modalTitle.innerText = "Personal Info";
            modalBody.innerHTML = `
                <label>Display Name</label>
                <input type="text" class="modal-input" value="Christenvie Nlolo">
                <label>Email Address</label>
                <input type="email" class="modal-input" value="Christenvienlolo3@gmail.com">
            `;
        } else if (type === 'password') {
            modalTitle.innerText = "Security & Password";
            modalBody.innerHTML = `
                <input type="password" class="modal-input" placeholder="Current Password">
                <input type="password" class="modal-input" placeholder="New Password">
            `;
        }
    };

    document.querySelectorAll('.account-menu li').forEach(item => {
        item.onclick = () => openSettings(item.getAttribute('data-view'));
    });

    const closeModal = document.getElementById('closeModal');
    if(closeModal) closeModal.onclick = () => modal.style.display = 'none';

    // 3. LOG OUT
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) {
        logoutBtn.onclick = () => {
            if(confirm("Are you sure you want to log out?")) window.location.href = "login.html";
        };
    }
});