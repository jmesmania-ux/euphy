const tg = window.Telegram.WebApp;
tg.ready();

let productsData = {};
let cart = [];

// Get user data from Telegram
const user = tg.initDataUnsafe.user || {};
const userData = {
  telegramId: user.id || 'N/A',
  telegramName: user.first_name + ' ' + (user.last_name || ''),
  telegramUsername: user.username || 'N/A'
};

// Load products
fetch('/products')
  .then(res => res.json())
  .then(data => {
    productsData = data;
    renderProducts();
  });

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Render all products
function renderProducts() {
  // Signatures
  const sigEl = document.getElementById('signatures');
  productsData.Signatures.forEach(p => sigEl.appendChild(createProductEl(p)));

  // Flavored
  const flavEl = document.getElementById('flavored');
  productsData.Flavored.forEach(p => flavEl.appendChild(createProductEl(p)));

  // The E
  const theeEl = document.getElementById('thee');
  productsData.TheE.forEach(p => theeEl.appendChild(createProductEl(p)));

  // Add Ons
  const addEl = document.getElementById('addons');
  Object.values(productsData.AddOns).forEach(group => {
    group.forEach(p => addEl.appendChild(createProductEl(p)));
  });
}

// Create product element
function createProductEl(product) {
  const div = document.createElement('div');
  div.className = 'product';
  div.innerHTML = `
    <h4>${product.name}</h4>
    <p>${product.description}</p>
    <p class="price">₱${product.price}</p>
    <div class="qty-controls">
      <button class="qty-btn minus">-</button>
      <span class="qty">0</span>
      <button class="qty-btn plus">+</button>
    </div>
  `;

  let qty = 0;
  const qtyEl = div.querySelector('.qty');
  div.querySelector('.plus').addEventListener('click', () => {
    qty++;
    qtyEl.textContent = qty;
    updateCart(product, qty);
  });
  div.querySelector('.minus').addEventListener('click', () => {
    if (qty > 0) qty--;
    qtyEl.textContent = qty;
    updateCart(product, qty);
  });
  return div;
}

// Update cart
function updateCart(product, qty) {
  const exists = cart.find(i => i.id === product.id);
  if (exists) {
    if (qty === 0) cart = cart.filter(i => i.id !== product.id);
    else exists.qty = qty;
  } else if (qty > 0) {
    cart.push({ ...product, qty });
  }
  renderCart();
}

// Render cart
function renderCart() {
  const cartEl = document.getElementById('cart-items');
  cartEl.innerHTML = '';
  let total = 0;
  cart.forEach(item => {
    total += item.price * item.qty;
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `<span>${item.name} x${item.qty}</span><span>₱${item.price * item.qty}</span>`;
    cartEl.appendChild(el);
  });
  document.getElementById('total-amount').textContent = total;
}

// Submit order
document.getElementById('submit-order').addEventListener('click', async () => {
  if (cart.length === 0) return alert('Wala pang laman ang order mo! Magdagdag muna. 😅');
  
  // Show typing indicator effect
  tg.showPopup({ message: 'Nagsusulat ng order... sandali lang po ⏳' });

  const orderData = {
    ...userData,
    items: cart,
    total: cart.reduce((sum, i) => sum + (i.price * i.qty), 0)
  };

  try {
    const res = await fetch('/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const result = await res.json();
    
    if (result.success) {
      tg.showAlert('✅ Order naipadala na sa Admin! Antay lang ng sagot nila. Salamat! 🥰');
      cart = [];
      renderCart();
      // Reset quantities
      document.querySelectorAll('.qty').forEach(el => el.textContent = '0');
    } else {
      tg.showAlert('❌ May naging problema: ' + result.message);
    }
  } catch (err) {
    tg.showAlert('❌ Hindi maipadala ang order. Subukan ulit mamaya.');
  }
});
