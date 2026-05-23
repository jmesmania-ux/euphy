require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const Order = require('./models/Order');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Database connected'))
.catch(err => console.error('❌ DB Error:', err));

// Telegram Bot Setup
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_CHAT_ID;

// --- PRODUCT CATALOG ---
const products = {
  Signatures: [
    { id: 'U10', name: 'U10', description: 'Sobrang sarap na signature drink, perfect sa mainit na panahon!', price: 100 },
    { id: 'U20', name: 'U20', description: 'Mas malaki at mas masarap na version ng ating classic favorite.', price: 150 },
    { id: 'U30', name: 'U30', description: 'Premium blend, may dagdag na lasa na siguradong magugustuhan mo.', price: 200 },
    { id: 'UHG', name: 'UHG', description: 'Heavy glass serving, puno ng lasa at quality ingredients.', price: 250 },
    { id: 'U1G', name: 'U1G', description: 'One Gallon size! Angkop para sa pamilya o barkada bonding.', price: 450 }
  ],
  Flavored: [
    { id: 'LR', name: 'Lime Rush', description: 'Maasim-matamis na lasa ng dayap, nakakarefresh talaga!', price: 120 },
    { id: 'BS', name: 'Blue Sapphire', description: 'Matamis at malamig na lasa, parang dagat na nasa baso mo.', price: 120 },
    { id: 'PS', name: 'Pink Sakura', description: 'Malambot na lasa, matamis at maganda tignan, parang bulaklak.', price: 120 }
  ],
  TheE: [
    { id: 'E1', name: 'The E 1', description: 'Unang level ng special blend, simple pero masarap.', price: 180 },
    { id: 'E2', name: 'The E 2', description: 'May dagdag na flavor, mas may character ang lasa.', price: 180 },
    { id: 'E3', name: 'The E 3', description: 'Mas matapang at mas mayaman na lasa para sa mga mahilig.', price: 200 },
    { id: 'E4', name: 'The E 4', description: 'Pinaka-espesyal, full flavor experience talaga ito!', price: 220 }
  ],
  AddOns: {
    Essentials: [
      { id: 'STRAW', name: 'Extra Straw', description: 'Karagdagang straw kung kailangan mo pa.', price: 10 },
      { id: 'ICE', name: 'Extra Ice', description: 'Dagdag na yelo para manatiling malamig.', price: 15 }
    ],
    Miscellaneous: [
      { id: 'NAPKIN', name: 'Napkin', description: 'Punasan mo na kasi baka tumapon pa!', price: 5 },
      { id: 'BAG', name: 'Carry Bag', description: 'Matibay na bag para dala mo kahit saan.', price: 20 }
    ],
    Pops: [
      { id: 'POP1', name: 'Fruit Pop', description: 'Matamis na prutas na nakalagay sa stick, masarap pangdagdag.', price: 30 },
      { id: 'POP2', name: 'Cream Pop', description: 'Malambot at creamy na pop, pampaganda ng lasa.', price: 35 }
    ]
  }
};

// --- API ROUTES ---
app.get('/products', (req, res) => {
  res.json(products);
});

// Save new order
app.post('/submit-order', async (req, res) => {
  try {
    const { telegramId, telegramName, telegramUsername, items, total } = req.body;
    
    const newOrder = new Order({
      telegramId,
      telegramName,
      telegramUsername,
      items,
      totalAmount: total,
      status: 'pending'
    });

    await newOrder.save();

    // Send to Admin with buttons
    const orderText = `📥 *Bagong Order Natanggap!*\n\n👤 Pangalan: ${telegramName}\n🆔 ID: ${telegramId}\n📛 Username: @${telegramUsername}\n🛒 Items: ${items.map(i => `${i.name} x${i.qty}`).join(', ')}\n💵 Total: ₱${total}\n\n✅ I-approve o ❌ I-deny?`;

    bot.sendMessage(ADMIN_ID, orderText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Approve', callback_data: `approve_${newOrder._id}` }],
          [{ text: '❌ Deny', callback_data: `deny_${newOrder._id}` }]
        ]
      }
    });

    res.json({ success: true, message: 'Order sent sa admin, antay lang ng sagot!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- BOT ACTIONS ---
bot.on('callback_query', async (query) => {
  const data = query.data;
  const orderId = data.split('_')[1];

  const order = await Order.findById(orderId);
  if (!order) return bot.answerCallbackQuery(query.id, { text: 'Order not found!' });

  if (data.startsWith('approve')) {
    order.status = 'approved';
    await order.save();

    // Send to customer
    bot.sendMessage(order.telegramId, `✅ *Approved na ang order mo!*\n\nSalamat sa pag-order! 🥰\nIto ang kailangan mong gawin:\n1. Gamitin ang QR code sa ibaba para sa bayad.\n2. Pindutin ang link para sa Lalamove at punan ang detalye ng delivery.`, { parse_mode: 'Markdown' });
    
    bot.sendPhoto(order.telegramId, process.env.QR_CODE_URL);
    bot.sendMessage(order.telegramId, `📦 *Lalamove Booking:*\n${process.env.LALAMOVE_LINK}`);

    bot.answerCallbackQuery(query.id, { text: 'Order Approved ✅' });
    bot.editMessageText('✅ Order na-approve na at na-notify na ang customer.', { chat_id: query.message.chat.id, message_id: query.message.message_id });

  } else if (data.startsWith('deny')) {
    order.status = 'denied';
    await order.save();

    bot.sendMessage(order.telegramId, `❌ *Pasensya na, hindi natuloy ang order mo.*\nMay naging problema po, pwede kang umulit o magtanong sa amin. Salamat sa pag-intindi. 🙏`, { parse_mode: 'Markdown' });

    bot.answerCallbackQuery(query.id, { text: 'Order Denied ❌' });
    bot.editMessageText('❌ Order na-deny na at na-notify na ang customer.', { chat_id: query.message.chat.id, message_id: query.message_id });
  }
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 Server running sa http://localhost:${PORT}`);
});

// --- TYPING INDICATOR HELPER ---
async function sendWithTyping(chatId, text, options = {}) {
  await bot.sendChatAction(chatId, 'typing');
  await new Promise(resolve => setTimeout(resolve, 1000)); // simulate typing
  return bot.sendMessage(chatId, text, options);
}
