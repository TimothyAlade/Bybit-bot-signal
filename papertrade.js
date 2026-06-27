// papertrade.js
// Professional Paper Trading Engine

const PaperTrader = {
    START_BALANCE: 10000,
    MAX_RISK_PERCENT: 2,
    MIN_RISK_PERCENT: 0.5,
    MAX_OPEN_TRADES: 5,
    MAX_DAILY_LOSS: 5, // Stop trading if 5% daily loss
    TRAILING_STOP_ACTIVATION: 0.03, // 3% profit activates trailing stop
    TRAILING_STOP_DISTANCE: 0.015, // 1.5% trailing distance
    
    balance: 10000,
    trades: [],
    dailyStats: {
        date: new Date().toDateString(),
        startBalance: 10000,
        trades: 0,
        losses: 0,
        lossAmount: 0
    },

    init() {
        // Load balance
        const savedBalance = localStorage.getItem("paper_balance");
        if (savedBalance) {
            const parsed = JSON.parse(savedBalance);
            this.balance = (typeof parsed === "number" && !isNaN(parsed) && parsed > 0) ? parsed : this.START_BALANCE;
        }

        // Load trades
        const savedTrades = localStorage.getItem("paper_trades");
        if (savedTrades) {
            try {
                const parsed = JSON.parse(savedTrades);
                this.trades = Array.isArray(parsed) ? parsed : [];
            } catch(e) { this.trades = []; }
        }

        // Load daily stats
        const savedDaily = localStorage.getItem("daily_stats");
        if (savedDaily) {
            try {
                const parsed = JSON.parse(savedDaily);
                if (parsed.date === new Date().toDateString()) {
                    this.dailyStats = parsed;
                } else {
                    this.resetDailyStats();
                }
            } catch(e) { this.resetDailyStats(); }
        }

        // Close stale trades (open > 7 days)
        const now = Date.now();
        this.trades.forEach(trade => {
            if (trade.status === "OPEN" && (now - trade.openTime) > 604800000) {
                trade.status = "EXPIRED";
                trade.closeTime = now;
                trade.profit = 0;
            }
        });

        this.save();
        this.updateDashboard();
        console.log("PaperTrader Ready | Balance: $" + this.balance.toFixed(2) + " | Trades: " + this.trades.length);
    },

    resetDailyStats() {
        this.dailyStats = {
            date: new Date().toDateString(),
            startBalance: this.balance,
            trades: 0,
            losses: 0,
            lossAmount: 0
        };
    },

    save() {
        localStorage.setItem("paper_balance", JSON.stringify(this.balance));
        localStorage.setItem("paper_trades", JSON.stringify(this.trades));
        localStorage.setItem("daily_stats", JSON.stringify(this.dailyStats));
        
        // Update equity curve
        let equity = [];
        const saved = localStorage.getItem("equity_curve");
        if (saved) {
            try { equity = JSON.parse(saved); } catch(e) { equity = []; }
        }
        equity.push({ balance: this.balance, timestamp: Date.now() });
        if (equity.length > 500) equity = equity.slice(-500);
        localStorage.setItem("equity_curve", JSON.stringify(equity));
    },

    getOpenTrades() {
        return this.trades.filter(t => t.status === "OPEN");
    },

    hasOpenTrade(symbol) {
        return this.getOpenTrades().some(t => t.coin === symbol);
    },

    getStats() {
        const total = this.trades.length;
        const wins = this.trades.filter(t => t.status === "WIN").length;
        const losses = this.trades.filter(t => t.status === "LOSS").length;
        const open = this.trades.filter(t => t.status === "OPEN").length;
        const expired = this.trades.filter(t => t.status === "EXPIRED").length;
        const closed = wins + losses + expired;
        const winRate = closed > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : "0.0";
        
        // Calculate profit metrics
        const totalProfit = this.trades
            .filter(t => t.profit)
            .reduce((sum, t) => sum + t.profit, 0);
        
        const avgWin = wins > 0 ? 
            this.trades.filter(t => t.status === "WIN").reduce((sum, t) => sum + t.profit, 0) / wins : 0;
        const avgLoss = losses > 0 ? 
            Math.abs(this.trades.filter(t => t.status === "LOSS").reduce((sum, t) => sum + t.profit, 0) / losses) : 0;
        const profitFactor = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "0.00";
        
        return { total, wins, losses, open, expired, winRate, totalProfit, profitFactor };
    },

    canTrade() {
        // Check daily loss limit
        const dailyLossPercent = ((this.dailyStats.startBalance - this.balance) / this.dailyStats.startBalance) * 100;
        if (dailyLossPercent >= this.MAX_DAILY_LOSS) {
            console.log("Daily loss limit reached:", dailyLossPercent.toFixed(1) + "%");
            return false;
        }
        
        // Check max open trades
        if (this.getOpenTrades().length >= this.MAX_OPEN_TRADES) {
            console.log("Max open trades reached");
            return false;
        }
        
        return true;
    },

    updateDashboard() {
        const stats = this.getStats();

        document.getElementById("balance").textContent = "$" + this.balance.toFixed(2);
        document.getElementById("totalTrades").textContent = stats.total;
        document.getElementById("winRate").textContent = stats.winRate + "%";
        document.getElementById("openSignals").textContent = stats.open;

        this.renderHistory();
        if (window.App && App.chart) App.updateChart();
    },

    openTrade(signal) {
        if (!signal || !signal.coin) return false;
        if (!this.canTrade()) return false;
        if (this.hasOpenTrade(signal.coin)) return false;

        // Dynamic position sizing based on risk score
        const baseRisk = this.MAX_RISK_PERCENT;
        const positionMultiplier = signal.positionMultiplier || 1;
        const riskPercent = Math.max(this.MIN_RISK_PERCENT, baseRisk * positionMultiplier);
        const riskAmount = this.balance * (riskPercent / 100);

        const trade = {
            id: Date.now().toString(),
            coin: signal.coin,
            market: signal.market || "futures",
            direction: signal.signal,
            confidence: signal.confidence,
            entry: Number(signal.entry),
            stopLoss: Number(signal.stopLoss),
            takeProfit: Number(signal.takeProfit),
            riskAmount: Number(riskAmount.toFixed(2)),
            riskPercent: Number(riskPercent.toFixed(2)),
            profit: 0,
            status: "OPEN",
            openTime: Date.now(),
            closeTime: null,
            exit: null,
            regime: signal.regime,
            riskScore: signal.riskScore,
            trailingActivated: false,
            trailingStop: null
        };

        this.trades.push(trade);
        this.dailyStats.trades++;
        this.save();
        this.updateDashboard();

        console.log("✅ Trade Opened:", trade.coin, trade.direction, 
            "@ $" + trade.entry, "| Risk: $" + trade.riskAmount, 
            "(" + trade.riskPercent + "%)");
        return true;
    },

    closeTrade(tradeId, result, exitPrice) {
        const trade = this.trades.find(t => t.id === tradeId);
        if (!trade || trade.status !== "OPEN") return;

        trade.status = result;
        trade.closeTime = Date.now();
        trade.exit = Number(exitPrice);

        if (result === "WIN") {
            trade.profit = Number((trade.riskAmount * 2).toFixed(2));
        } else if (result === "LOSS") {
            trade.profit = Number((-trade.riskAmount).toFixed(2));
        } else {
            trade.profit = 0;
        }

        this.balance = Number((this.balance + trade.profit).toFixed(2));
        
        // Update daily stats
        if (result === "LOSS") {
            this.dailyStats.losses++;
            this.dailyStats.lossAmount += Math.abs(trade.profit);
        }

        // Check balance safety
        if (this.balance < this.START_BALANCE * 0.1) {
            console.warn("⚠️ Balance critically low! Consider stopping trading.");
        }

        this.save();
        this.updateDashboard();

        const profitStr = trade.profit >= 0 ? "+$" + trade.profit.toFixed(2) : "-$" + Math.abs(trade.profit).toFixed(2);
        console.log("💰 Trade Closed:", trade.coin, result, "| Profit:", profitStr, "| Balance: $" + this.balance.toFixed(2));
    },

    // Trailing stop update
    updateTrailingStop(trade, currentPrice) {
        if (!trade.trailingActivated) {
            // Check if profit target for trailing activation reached
            const profitPercent = trade.direction === "BUY"
                ? (currentPrice - trade.entry) / trade.entry
                : (trade.entry - currentPrice) / trade.entry;
            
            if (profitPercent >= this.TRAILING_STOP_ACTIVATION) {
                trade.trailingActivated = true;
                trade.trailingStop = trade.direction === "BUY"
                    ? currentPrice * (1 - this.TRAILING_STOP_DISTANCE)
                    : currentPrice * (1 + this.TRAILING_STOP_DISTANCE);
            }
        } else {
            // Update trailing stop
            const newStop = trade.direction === "BUY"
                ? currentPrice * (1 - this.TRAILING_STOP_DISTANCE)
                : currentPrice * (1 + this.TRAILING_STOP_DISTANCE);
            
            if (trade.direction === "BUY" && newStop > trade.trailingStop) {
                trade.trailingStop = newStop;
            } else if (trade.direction === "SELL" && newStop < trade.trailingStop) {
                trade.trailingStop = newStop;
            }
        }
    },

    async monitorTrades() {
        const openTrades = this.getOpenTrades();
        if (openTrades.length === 0) return;

        for (const trade of openTrades) {
            try {
                const candles = await BybitAPI.getCandles(
                    trade.coin,
                    trade.market === "spot" ? "spot" : "linear",
                    "1",
                    2
                );

                if (!candles || candles.length === 0) continue;
                const currentPrice = Number(candles[candles.length - 1][4]);
                if (isNaN(currentPrice)) continue;

                // Update trailing stop
                this.updateTrailingStop(trade, currentPrice);

                const isLong = trade.direction === "BUY";
                
                // Check trailing stop first
                if (trade.trailingActivated) {
                    if (isLong && currentPrice <= trade.trailingStop) {
                        this.closeTrade(trade.id, "WIN", currentPrice);
                        continue;
                    } else if (!isLong && currentPrice >= trade.trailingStop) {
                        this.closeTrade(trade.id, "WIN", currentPrice);
                        continue;
                    }
                }

                // Check take profit
                if (isLong && currentPrice >= trade.takeProfit) {
                    this.closeTrade(trade.id, "WIN", currentPrice);
                }
                // Check stop loss
                else if (isLong && currentPrice <= trade.stopLoss) {
                    this.closeTrade(trade.id, "LOSS", currentPrice);
                }
                // Short take profit
                else if (!isLong && currentPrice <= trade.takeProfit) {
                    this.closeTrade(trade.id, "WIN", currentPrice);
                }
                // Short stop loss
                else if (!isLong && currentPrice >= trade.stopLoss) {
                    this.closeTrade(trade.id, "LOSS", currentPrice);
                }

            } catch (e) {
                console.error("Monitor error:", trade.coin, e);
            }
        }
    },

    renderHistory() {
        const table = document.getElementById("historyTable");
        if (!table) return;

        table.innerHTML = "";

        if (this.trades.length === 0) {
            table.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;">No trades yet</td></tr>`;
            return;
        }

        [...this.trades].reverse().forEach(trade => {
            const color = trade.status === "WIN" ? "#14b814" : 
                         trade.status === "LOSS" ? "#ff3b3b" : 
                         trade.status === "EXPIRED" ? "#888" : "#f5a623";
            
            const profit = trade.profit || 0;
            const profitStr = profit !== 0 ? 
                (profit >= 0 ? "+$" + profit.toFixed(2) : "-$" + Math.abs(profit).toFixed(2)) : 
                "$0.00";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${new Date(trade.openTime).toLocaleString()}</td>
                <td><strong>${trade.coin}</strong></td>
                <td>${trade.market}</td>
                <td style="color:${trade.direction === 'BUY' ? '#14b814' : '#ff3b3b'}">${trade.direction}</td>
                <td>$${Number(trade.entry).toFixed(2)}</td>
                <td>$${Number(trade.takeProfit).toFixed(2)}</td>
                <td>$${Number(trade.stopLoss).toFixed(2)}</td>
                <td style="color:${color};font-weight:bold;">${profitStr}</td>
                <td style="color:${color};font-weight:bold;">${trade.status}</td>
            `;
            table.appendChild(row);
        });
    },

    // Performance report
    getPerformanceReport() {
        const stats = this.getStats();
        const openTrades = this.getOpenTrades();
        const dailyPL = this.balance - this.dailyStats.startBalance;
        
        return {
            balance: this.balance,
            totalTrades: stats.total,
            winRate: stats.winRate,
            profitFactor: stats.profitFactor,
            openTrades: openTrades.length,
            dailyPL: dailyPL.toFixed(2),
            dailyLossCount: this.dailyStats.losses,
            maxDrawdown: this.calculateMaxDrawdown()
        };
    },

    calculateMaxDrawdown() {
        const equity = [];
        const saved = localStorage.getItem("equity_curve");
        if (saved) {
            try { equity.push(...JSON.parse(saved)); } catch(e) {}
        }
        
        if (equity.length < 2) return "0.00";
        
        let peak = equity[0].balance;
        let maxDrawdown = 0;
        
        equity.forEach(point => {
            if (point.balance > peak) peak = point.balance;
            const drawdown = (peak - point.balance) / peak * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });
        
        return maxDrawdown.toFixed(2);
    },

    reset() {
        if (confirm("Reset paper trading account? This cannot be undone.")) {
            this.balance = this.START_BALANCE;
            this.trades = [];
            localStorage.removeItem("paper_balance");
            localStorage.removeItem("paper_trades");
            localStorage.removeItem("equity_curve");
            localStorage.removeItem("daily_stats");
            this.resetDailyStats();
            this.save();
            this.updateDashboard();
            console.log("Account reset to $" + this.START_BALANCE);
        }
    }
};

window.PaperTrader = PaperTrader;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => PaperTrader.init(), 200);
    
    // Monitor trades every 30 seconds
    setInterval(() => PaperTrader.monitorTrades(), 30000);
});