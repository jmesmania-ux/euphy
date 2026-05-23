const tg = window.Telegram.WebApp;
tg.ready();

let productsData = {};
let cart = [];
let shopOpen = true;

const user = tg.initDataUnsafe.user || {};
const userData = {
  telegramId: user.id || 'N/A',
  telegramName: user.first_name + ' ' + (user.last_name || ''),
  telegramUsername: user.username || 'N/A'
};

// Load announcement
fetch('/announcement')
  .then(res => res.json())
  .then(ann => {
    if (ann.active && ann.text) {
      const el = document.getElementById('announcement');
      el.textContent = `📢 ${ann.text}`;
      el.style.display = 'block';
    }
  });

// Load shop status
fetch('/shop-status')
  .then(res => res.json())
  .then(data => { shopOpen = data.isOpen; updateShopBanner(); });

// Load products
fetch('/products')
  .then(res => res.json())
  .then(data => { productsData = data; renderProducts(); });

function updateShopBanner() {
  const banner = document.getElementById('shop-status');
  if (shopOpen) {
    banner.className = 'status-banner status-open';
    banner.textContent = '✅ BUKAS KAMI — Pwede na umorder!';
  } else {
    banner.className = 'status-banner status-closed';
    banner.textContent = '❌ SARADO MUNA — Bumalik lang mamaya!';
    document.getElementById('submit-order').disabled = true;
    document.getElementById('submit-order').style.opacity = '0.6';
  }
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

function renderProducts() {
  const sigEl = document.getElementById('signatures');
  productsData.Signatures.forEach(p => sigEl.appendChild(createProductEl(p)));

  const flavEl = document.getElementById('flavored');
  productsData.Flavored.forEach(p => flavEl.appendChild(createProductEl(p)));

  const theeEl = document.getElementById('thee');
  productsData.TheE.forEach(p => theeEl.appendChild(createProductEl(p)));

  const addEl = document.getElementById('addons');
  [...productsData.AddOns.Essentials, ...productsData.AddOns.Miscellaneous, ...productsData.AddOns.Pops]
    .forEach(p => addEl.appendChild(createProductEl(p)));
}

function createProductEl(product) {
  const div = document.createElement('div');
  div.className = `product ${product.available ? '' : 'unavailable'}`;
  div.innerHTML = `
    <h4>${product.name}</h4>
    <p>${product.description}</p>
    <p class="price">₱${product.price}</p>
    <div class="qty-controls">
      <button class="qty-btn minus" ${!product.available ? 'disabled' : ''}>-</button>
      <span class="qty">0</span>
      <button class="qty-btn plus" ${!product.available ? 'disabled' : ''}>+</button>
    </div>
  `;

  if (!product.available) return div;

  let qty = 0;
  const qtyEl = div.querySelector('.qty');
  div.querySelector('.plus').addEventListener('click', () => { qty++; qtyEl.textContent = qty; updateCart(product, qty); });
  div.querySelector('.minus').addEventListener('click', () => { if (qty>0) qty--; qtyEl.textContent = qty; updateCart(product, qty); });
  return div;
}

function updateCart(product, qty) {
  const exists = cart.find(i => i.id === product.id);
  if (exists) { if (!qty) cart = cart.filter(i => i.id !== product.id); else exists.qty = qty; }
  else if (qty>0) cart.push({...product, qty});
  renderCart();
}

function renderCart() {
  const el = document.getElementById('cart-items'); el.innerHTML = '';
  let total = 0;
  cart.forEach(i => {
    total += i.price * i.qty;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `<span>${i.name} x${i.qty}</span><span>₱${i.price*i.qty}</span>`;
    el.appendChild(div);
  });
  document.getElementById('total-amount').textContent = total;
}

// Submit order
document.getElementById('submit-order').addEventListener('click', async () => {
  if (!shopOpen) return tg.showAlert('❌ Pasensya na, sarado muna kami!');
  if (cart.length === 0) return tg.showAlert('Wala pang laman ang order mo! 😅');

  tg.showPopup({ message: 'Nagsusulat ng order... sandali lang po ⏳' });
  const orderData = {...userData, items: cart, total: cart.reduce((s,i)=>s+(i.price*i.qty),0)};

  try {
    const res = await fetch('/submit-order', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(orderData) });
    const result = await res.json();
    if (result.success) {
      tg.showAlert('✅ Order naipadala na sa Admin! Antay lang ng sagot. 🥰');
      cart = []; renderCart();
      document.querySelectorAll('.qty').forEach(e => e.textContent = '0');
    } else {
      tg.showAlert(result.message);
    }
  } catch {
    tg.showAlert('❌ Hindi maipadala — subukan ulit mamaya.');
  }
});

// Send message
document.getElementById('send-msg-btn').addEventListener('click', async () => {
  const text = document.getElementById('message-text').value.trim();
  if (!text) return;

  fetch('/send-message', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ senderId: userData.telegramId, senderName: userData.telegramName, text })
  });

  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg msg-to-admin';
  msgEl.textContent = text;
  document.getElementById('chat-messages').appendChild(msgEl);
  document.getElementById('message-text').value = '';
});
