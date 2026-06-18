import { config } from '../config.js';

let bot = null;

async function getBot() {
  if (bot) return bot;
  if (!config.telegram.botToken || !config.telegram.chatId) return null;
  try {
    const TelegramBot = (await import('node-telegram-bot-api')).default;
    bot = new TelegramBot(config.telegram.botToken, { polling: false });
    return bot;
  } catch {
    console.warn('[Telegram] Bot not available');
    return null;
  }
}

export async function sendAlert(message) {
  const b = await getBot();
  if (!b) {
    console.log(`[Telegram] ${message}`);
    return;
  }
  try {
    await b.sendMessage(config.telegram.chatId, `🤖 *Renaissance*\n${message}`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.warn('[Telegram] Send failed:', err.message);
  }
}

export async function sendTradeAlert(trade) {
  if (!trade) return;
  const emoji = trade.direction === 'LONG' ? '🟢' : '🔴';
  const msg = `${emoji} *${trade.direction}* ${trade.symbol}\nSize: $${trade.size}\nLeverage: ${trade.leverage || 5}x\nTx: \`${trade.txHash || 'simulated'}\``;
  await sendAlert(msg);
}

export async function sendDailySummary(summary) {
  const msg = `📊 *Daily Summary*\nPortfolio: $${summary.currentValue.toFixed(2)}\nPnL: ${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl.toFixed(2)}\nDrawdown: ${summary.drawdownPct.toFixed(1)}%\nTrades: ${summary.tradeCount}\nCosts: $${summary.totalCosts.toFixed(2)}`;
  await sendAlert(msg);
}
