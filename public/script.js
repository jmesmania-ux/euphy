const tg = window.Telegram.WebApp;
tg.ready();

let productsData = {};
let cart = [];
let shopOpen = true;

const user = tg.initDataUnsafe.user || {};
const userData = {
  telegramId: user.id || 'N/A',
  telegramName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
  telegramUsername: user.username || 'N/A'
};

// Load Announcement
fetch('/announcement')
  .then(r => r.json())
  .then(a => { if (a?.active && a.text) { document.getElementById('announcement').textContent = `📢 ${a.text}`; document.getElementById('announcement').style.display='block'; } });

// Load Shop Status
fetch('/shop-status')
  .then(r => r.json())
  .then(d => { shopOpen = d.isOpen; updateShopBanner(); });

// Load Products
fetch('/products')
  .then(r => r.json())
  .then(d => { productsData = d; renderProducts(); });

function updateShopBanner() {
  const el = document.getElementById('shop-status');
  el.className = shopOpen ? 'status-banner status-open' : 'status-banner status-closed';
  el.textContent = shopOpen ? '✅ BUKAS KAMI — Pwede na umorder!' : '❌ SARADO MUNA — Bumalik lang mamaya!';
  document.getElementById('submit-order').disabled = !shopOpen;
}

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn,.tab-content').forEach(e => e.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  }
});

// Render Products
function renderProducts() {
  document.getElementById('signatures').innerHTML = '';
  document.getElementById('flavored').innerHTML = '';
  document.getElementById('thee').innerHTML = '';
  document.getElementById('addons').innerHTML = '';

  productsData.Signatures?.forEach(p => document.getElementById('signatures').appendChild(createEl(p)));
  productsData.Flavored?.forEach(p => document.getElementById('flavored').appendChild(createEl(p)));
  productsData.TheE?.forEach(p => document.getElementById('thee').appendChild(createEl(p)));
  [...(productsData.AddOns?.Essentials||[]),...(productsData.AddOns?.Miscellaneous||[]),...(productsData.AddOns?.Pops||[])].forEach(p => document.getElementById('addons').appendChild(createEl(p)));
}

function createEl(p) {
  const div = document.createElement('div');
  div.className = `product ${p.available?'':'unavailable'}`;
  div.innerHTML = `
    <h4>${p.name}</h4>
    <p>${p.description||''}</p>
    <p class="price">₱${p.price}</p>
    <div class="qty-controls">
      <button class="qty-btn minus" ${!p.available?'disabled':''}>-</button>
      <span class="qty">0</span>
      <button class="qty-btn plus" ${!p.available?'disabled':''}>+</button>
    </div>
  `;
  if (!p.available) return div;

  let q=0;
  const qEl=div.querySelector('.qty');
  div.querySelector('.plus').onclick=()=>{q++;qEl.textContent=q;updateCart(p,q);};
  div.querySelector('.minus').onclick=()=>{if(q>0)q--;qEl.textContent=q;updateCart(p,q);};
  return div;
}

// Cart
function updateCart(p,q) {
  const exists=cart.find(i=>i.id===p.id);
  if(exists){if(!q)cart=cart.filter(i=>i.id!==p.id);else exists.qty=q;}
  else if(q>0)cart.push({...p,qty:q});
  renderCart();
}
function renderCart() {
  const el=document.getElementById('cart-items'); el.innerHTML='';
  let total=0;
  cart.forEach(i=>{
    total+=i.price*i.qty;
    const d=document.createElement('div');d.className='cart-item';
    d.innerHTML=`<span>${i.name} x${i.qty}</span><span>₱${i.price*i.qty}</span>`;
    el.appendChild(d);
  });
  document.getElementById('total-amount').textContent=total;
}

// Submit Order
document.getElementById('submit-order').onclick=async()=>{
  if(cart.length===0)return tg.showAlert('Wala pang laman ang order mo! 😅');
  const res=await fetch('/submit-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...userData,items:cart,total:cart.reduce((s,i)=>s+i.price*i.qty,0)})});
  const r=await res.json();
  tg.showAlert(r.success?'✅ Order naipadala na sa Admin! Antay lang ng sagot. 🥰':r.message);
  if(r.success){cart=[];renderCart();document.querySelectorAll('.qty').forEach(e=>e.textContent='0');}
};
