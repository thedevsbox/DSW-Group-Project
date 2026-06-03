// ── AI CHAT WINDOW ──
const aiFab = document.getElementById('aiFab');
const chatWindow = document.getElementById('chatWindow');
const chatClose = document.getElementById('chatClose');
const chatSend = document.getElementById('chatSend');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

aiFab?.addEventListener('click', () => {
  chatWindow.classList.toggle('open');
  if (chatWindow.classList.contains('open')) chatInput.focus();
});

chatClose?.addEventListener('click', () => {
  chatWindow.classList.remove('open');
});

// ✅ UPDATED FUNCTION (CONNECTED TO PHP)
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // 🧑 User message
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.innerHTML = `<div class="msg-bubble">${text}</div>`;
  chatMessages.appendChild(userMsg);

  chatInput.value = '';
  scrollToBottom();

  // 🤖 Typing indicator
  const botMsg = document.createElement('div');
  botMsg.className = 'chat-msg bot';
  botMsg.innerHTML = `<div class="msg-bubble">Typing...</div>`;
  chatMessages.appendChild(botMsg);
  scrollToBottom();

  try {
    const response = await fetch("https://architecturepro-demo.onrender.com/chatbot.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: text })
    });

    const data = await response.json();
    console.log("AI Response:", data);

    if (data.reply) {
      botMsg.innerHTML = `<div class="msg-bubble">${data.reply}</div>`;
    } else if (data.error) {
      botMsg.innerHTML = `<div class="msg-bubble">❌ Error: ${data.error}</div>`;
    } else {
      botMsg.innerHTML = `<div class="msg-bubble">❌ No response from AI</div>`;
    }
    
  } catch (error) {
    console.error("Fetch error:", error);
    botMsg.innerHTML = `<div class="msg-bubble">❌ Connection failed. Check console.</div>`;
  }
}


// Events
chatSend?.addEventListener('click', sendMessage);

chatInput?.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') sendMessage();
});

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
