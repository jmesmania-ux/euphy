const API_BASE = '';
let ADMIN_PASS = '';
let activeCustomerId = null;
let carouselPosition = 0;
const itemWidth = 300;

// Screen Switch
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn,.tab-content').forEach(e => e.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});

// Login
document.getElementById('login-btn').onclick = () => {
  ADMIN_PASS = document.getElementById('admin-pass').value;
  fetch(`${API_BASE}/api/admin/shop-status`, {headers:{'x-admin-password': ADMIN_PASS}})
  .then(res => res.ok ? res.json() : Promise.reject())
  .then(data => {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    updateShopUI(data.isOpen);
    loadOrders(); loadProducts(); loadUpdates();
  }).catch(() => alert('Wrong password!'));
};

// Shop Status
document.getElementById('toggle-shop-btn').onclick = () => {
  fetch(`${API_BASE}/api/admin/toggle-shop`, {method:'POST',headers:{'x-admin-password': ADMIN_PASS}})
  .then(r => r.json()).then(d => updateShopUI(d.isOpen));
};
function updateShopUI(isOpen) {
  const el = document.getElementById('status-text');
  el.textContent = isOpen ? '✅ OPEN' : '❌ CLOSED';
  el.className = isOpen ? 'status-open' : 'status-closed';
}

// -- ORDERS --
function loadOrders() {
  fetch(`${API_BASE}/api/admin/orders`, {headers:{'x-admin-password': ADMIN_PASS}})
  .then(r => r.json()).then(orders => {
    const list = document.getElementById('orders-list'); list.innerHTML = '';
    orders.forEach(o => {
      const div = document.createElement('div'); div.className = 'order-card';
      div.innerHTML = `
        <h4>Order #${o._id.slice(-6)}</h4>
        <p>👤 ${o.telegramName} | 🆔 ${o.telegramId}</p>
        <p>📦 ${o.items.map(i=>`${i.name}x${i.qty}`).join(', ')}</p>
        <p>💵 ₱${o.totalAmount} | <strong>Status: ${o.status}</strong></p>
        <div class="order-actions">
          <button class="btn-approve" onclick="updateOrder('${o._id}','approved')">Approve</button>
          <button class="btn-decline" onclick="updateOrder('${o._id}','denied')">Decline</button>
          <button class="btn-chat" onclick="openChat('${o.telegramId}','${o.telegramName}')">Chat</button>
        </div>
      `;
      list.appendChild(div);
    });
  });
}
function updateOrder(id, status) {
  fetch(`${API_BASE}/api/admin/update-order`, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-admin-password': ADMIN_PASS},
    body:JSON.stringify({orderId:id,status})
  }).then(() => loadOrders());
}

// -- PRODUCTS --
document.getElementById('add-product-btn').onclick = () => {
  const prod = {
    id:document.getElementById('p-id').value,
    name:document.getElementById('p-name').value,
    description:document.getElementById('p-desc').value,
    price:Number(document.getElementById('p-price').value),
    category:document.getElementById('p-cat').value,
    available:true
  };
  fetch(`${API_BASE}/api/admin/add-product`, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-admin-password': ADMIN_PASS},
    body:JSON.stringify(prod)
  }).then(() => {loadProducts();['p-id','p-name','p-desc','p-price'].forEach(id=>document.getElementById(id).value='');});
};
function loadProducts() {
  fetch(`${API_BASE}/api/admin/products`, {headers:{'x-admin-password': ADMIN_PASS}})
  .then(r => r.json()).then(prods => {
    const list = document.getElementById('products-list'); list.innerHTML = '';
    prods.forEach(p => {
      const div = document.createElement('div'); div.className = 'product-card';
      div.innerHTML = `
        <h4>${p.name} (${p.id})</h4>
        <p>${p.description} | ₱${p.price} | ${p.category}</p>
        <p>Status: ${p.available ? '✅ Available' : '❌ Unavailable'}</p>
        <button onclick="toggleProd('${p.id}')">Toggle Avail</button>
        <button onclick="removeProd('${p.id}')" style="background:#c53030">Remove</button>
      `;
      list.appendChild(div);
    });
  });
}
function toggleProd(id) {
  fetch(`${API_BASE}/api/admin/toggle-product`, {method:'POST',headers:{'Content-Type':'application/json','x-admin-password': ADMIN_PASS},body:JSON.stringify({id})}).then(()=>loadProducts());
}
function removeProd(id) {
  fetch(`${API_BASE}/api/admin/remove-product`, {method:'POST',headers:{'Content-Type':'application/json','x-admin-password': ADMIN_PASS},body:JSON.stringify({id})}).then(()=>loadProducts());
}

// -- UPDATES & CAROUSEL --
document.getElementById('post-update-btn').onclick = () => {
  const text = document.getElementById('update-text').value;
  const imageInput = document.getElementById('update-image');
  const formData = new FormData();
  
  formData.append('text', text);
  if (imageInput.files[0]) formData.append('image', imageInput.files[0]);

  fetch(`${API_BASE}/api/admin/post-update`, {
    method:'POST',
    headers:{'x-admin-password': ADMIN_PASS},
    body: formData
  }).then(() => {
    document.getElementById('update-text').value = '';
    document.getElementById('update-image').value = '';
    loadUpdates();
  });
};

function loadUpdates() {
  fetch(`${API_BASE}/api/admin/announcements`, {headers:{'x-admin-password': ADMIN_PASS}})
  .then(r => r.json()).then(ups => {
    const wrapper = document.getElementById('carousel-wrapper');
    wrapper.innerHTML = '';
    carouselPosition = 0;

    ups.forEach(u => {
      const div = document.createElement('div');
      div.className = 'carousel-item';
      div.innerHTML = `
        ${u.imageUrl ? `<img src="${u.imageUrl}" alt="Update image">` : ''}
        <div class="carousel-item-text">
          <p>${u.text}</p>
          <small style="color:#888">${new Date(u.createdAt).toLocaleString()}</small>
        </div>
      `;
      wrapper.appendChild(div);
    });
  });
}
function moveCarousel(direction) {
  const wrapper = document.getElementById('carousel-wrapper');
  const maxPosition = -(wrapper.children.length - 1) * itemWidth;
  carouselPosition += direction * itemWidth;
  if (carouselPosition > 0) carouselPosition = 0;
  if (carouselPosition < maxPosition) carouselPosition = maxPosition;
  wrapper.style.transform = `translateX(${carouselPosition}px)`;
}

// -- CHAT SYSTEM --
const modal = document.getElementById('chat-modal');
document.querySelector('.close').onclick = () => modal.style.display = 'none';
document.getElementById('send-chat-btn').onclick = () => {
  const txt = document.getElementById('chat-text').value;
  if(!txt || !activeCustomerId) return;
  fetch(`${API_BASE}/api/admin/send-chat`, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-admin-password': ADMIN_PASS},
    body:JSON.stringify({customerId:activeCustomerId,text:txt})
  }).then(()=>{document.getElementById('chat-text').value='';loadChatHistory();});
};
function openChat(cid, name) {
  activeCustomerId = cid;
  document.getElementById('chat-customer-id').textContent = `${name} (${cid})`;
  modal.style.display = 'block';
  loadChatHistory();
}
function loadChatHistory() {
  fetch(`${API_BASE}/api/admin/messages/${activeCustomerId}`, {headers:{'x-admin-password': ADMIN_PASS}})
  .then(r => r.json()).then(msgs => {
    const box = document.getElementById('chat-messages'); box.innerHTML = '';
    msgs.forEach(m => {
      const div = document.createElement('div');
      div.className = m.direction === 'admin_to_customer' ? 'msg-admin' : 'msg-customer';
      div.textContent = m.text;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}
