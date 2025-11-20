// chat.js
// Chat logic: name entry, emoji picker, reply, localStorage, professional UI

document.addEventListener('DOMContentLoaded', function () {
  const chatKey = 'dashboardChatMessages';
  let userName = '';
  let replyTo = null;

  const chatBody = document.getElementById('chatBody');
  const nameEntry = document.getElementById('nameEntry');
  const userNameInput = document.getElementById('userNameInput');
  const setNameBtn = document.getElementById('setNameBtn');
  const chatControls = document.getElementById('chatControls');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const emojiBtn = document.getElementById('emojiBtn');
  const messageTemplate = document.getElementById('messageTemplate');

  // Emoji picker (UMD global)
  let picker;
  if (window.EmojiButton) {
    picker = new window.EmojiButton({ position: 'top-end', zIndex: 9999 });
    emojiBtn.addEventListener('click', () => {
      picker.togglePicker(emojiBtn);
    });
    picker.on('emoji', (emoji) => {
      messageInput.value += emoji;
      messageInput.focus();
    });
  } else {
    emojiBtn.disabled = true;
    emojiBtn.title = 'Emoji picker failed to load';
  }

  // Name entry
  setNameBtn.onclick = () => {
    const name = userNameInput.value.trim();
    if (!name) {
      alert('Please enter your name.');
      return;
    }
    userName = name;
    nameEntry.classList.add('hidden');
    chatControls.classList.remove('hidden');
    messageInput.focus();
  };

  // Send message
  sendBtn.onclick = sendMessage;
  messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    const messages = getMessages();
    const msg = {
      id: Date.now() + Math.random().toString(36).slice(2),
      user: userName,
      text,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      replyTo: replyTo ? replyTo.id : null,
      replyText: replyTo ? replyTo.text : null,
      replyUser: replyTo ? replyTo.user : null,
    };
    messages.push(msg);
    localStorage.setItem(chatKey, JSON.stringify(messages));
    messageInput.value = '';
    replyTo = null;
    renderMessages();
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function getMessages() {
    return JSON.parse(localStorage.getItem(chatKey) || '[]');
  }

  function renderMessages() {
    chatBody.innerHTML = '';
    const messages = getMessages();
    messages.forEach((msg) => {
      const node = messageTemplate.content.cloneNode(true);
      node.querySelector('.msg-user').textContent = msg.user;
      node.querySelector('.msg-time').textContent = msg.time;
      node.querySelector('.msg-content').textContent = msg.text;
      if (msg.replyTo) {
        const replyDiv = node.querySelector('.reply-to');
        replyDiv.textContent = `Reply to ${msg.replyUser}: ${msg.replyText}`;
        node.querySelector('.message').classList.add('replying');
      }
      node.querySelector('.reply-btn').onclick = () => {
        replyTo = msg;
        messageInput.focus();
        messageInput.placeholder = `Replying to ${msg.user}...`;
      };
      chatBody.appendChild(node);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // Live update chat (simulate real-time)
  setInterval(renderMessages, 1200);

  renderMessages();
});
