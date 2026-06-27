// papertrade.js
// Professional Paper Trading Engine

const PaperTrader = {
    START_BALANCE: 10000,
    MAX_RISK_PERCENT: 2,
    MIN_RISK_PERCENT: 0.5,
    MAX_OPEN_TRADES: 5,
    MAX_DAILY_LOSS: 5,
    TRAILING_STOP_ACTIVATION: 0.03,
    TRAILING_STOP_DISTANCE: 0.015,
    MIN_CONFIDENCE: 70, // Only trade signals with 70%+ confidence
    
    balance: 10000,
    trades: [],
    generatedSignals: [], // Track all generated signals to prevent duplicates
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

        // Load generated signals history
        const savedSignals = localStorage.getItem("generated_signals_history");
        if (savedSignals) {
            try {
                const parsed = JSON.parse(savedSignals);
                this.generatedSignals = Array.isArray(parsed) ? parsed : [];
            } catch(e) { this.generatedSignals = []; }
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

        // Clean old generated signals (keep last 7 days)
        const sevenDaysAgo = Date.now() - 604800000;
        this.generatedSignals = this.generatedSignals.filter(s => s.timestamp > sevenDaysAgo);

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
        localStorage.setItem("generated_signals_history", JSON.stringify(this.generatedSignals));
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

    // Check if signal was already generated for this coin
    isDuplicateSignal(coin, direction) {
        const recentSignals = this.generatedSignals.filter(s => 
            s.coin === coin && 
            s.direction === direction &&
            (Date.now() - s.timestamp) < 3600000 // Within last hour
        );
        return recentSignals.length > 0;
    },

    // Add signal to history
    addToSignalHistory(signal) {
        this.generatedSignals.push({
            coin: signal.coin,
            direction: signal.signal,
            confidence: signal.confidence,
            price: signal.entry,
            timestamp: Date.now(),
            regime: signal.regime || "UNKNOWN",
            riskScore: signal.riskScore || 0
        });
        
        // Keep only last 500 signals
        if (this.generatedSignals.length > 500) {
            this.generatedSignals = this.generatedSignals.slice(-500);
        }
        
        this.save();
    },

    getOpenTrades() {
        return this.trades.filter(t => t.status === "OPEN");
    },

    hasOpenTrade(symbol) {
        return this.getOpenTrades().some(t => t.coin === symbol);
    },

    // Get confidence-based win rate
    getConfidenceStats() {
        const closedTrades = this.trades.filter(t => t.status === "WIN" || t.status === "LOSS");
        
        const confidenceBrackets = {
            "70-79": { total: 0, wins: 0 },
            "80-89": { total: 0, wins: 0 },
            "90-100": { total: 0, wins: 0 }
        };
        
        closedTrades.forEach(trade => {
            const conf = trade.confidence || 0;
            let bracket;
            if (conf >= 90) bracket = "90-100";
            else if (conf >= 80) bracket = "80-89";
            else bracket = "70-79";
            
            confidenceBrackets[bracket].total++;
            if (trade.status === "WIN") confidenceBrackets[bracket].wins++;
        });
        
        return confidenceBrackets;
    },

    getStats() {
        const total = this.trades.length;
        const wins = this.trades.filter(t => t.status === "WIN").length;
        const losses = this.trades.filter(t => t.status === "LOSS").length;
        const open = this.trades.filter(t => t.status === "OPEN").length;
        const expired = this.trades.filter(t => t.status === "EXPIRED").length;
        const closed = wins + losses;
        const winRate = closed > 0 ? ((wins / closed) * 100).toFixed(1) : "0.0";
        
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
        const dailyLossPercent = ((this.dailyStats.startBalance - this.balance) / this.dailyStats.startBalance) * 100;
        if (dailyLossPercent >= this.MAX_DAILY_LOSS) {
            console.log("⚠️ Daily loss limit reached:", dailyLossPercent.toFixed(1) + "%");
            return false;
        }
        
        if (this.getOpenTrades().length >= this.MAX_OPEN_TRADES) {
            console.log("⚠️ Max open trades reached");
            return false;
        }
        
        return true;
    },

    updateDashboard() {
        const stats = this.getStats();
        const confStats = this.getConfidenceStats();

        document.getElementById("balance").textContent = "$" + this.balance.toFixed(2);
        document.getElementById("totalTrades").textContent = stats.total;
        document.getElementById("winRate").textContent = stats.winRate + "%";
        document.getElementById("openSignals").textContent = stats.open;

        // Update confidence stats display
        const confContainer = document.getElementById("confidenceStats");
        if (confContainer) {
            let html = "";
            Object.entries(confStats).forEach(([bracket, data]) => {
                const rate = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(1) : "0.0";
                html += `
                    <div class="conf-bracket">
                        <span class="conf-label">${bracket}%</span>
                        <span class="conf-rate">${rate}% Win (${data.wins}/${data.total})</span>
                    </div>
                `;
            });
            confContainer.innerHTML = html;
        }

        this.renderHistory();
        if (window.App && App.chart) App.updateChart();
    },

    openTrade(signal) {
        if (!signal || !signal.coin) return false;
        
        // Filter: Only 70%+ confidence
        if (signal.confidence < this.MIN_CONFIDENCE) {
            console.log("❌ Confidence too low:", signal.confidence + "% (min " + this.MIN_CONFIDENCE + "%)");
            return false;
        }
        
        // Check duplicate
        if (this.isDuplicateSignal(signal.coin, signal.signal)) {
            console.log("❌ Duplicate signal for", signal.coin, signal.signal, "- already generated recently");
            return false;
        }
        
        if (!this.canTrade()) return false;
        if (this.hasOpenTrade(signal.coin)) return false;

        // Add to signal history
        this.addToSignalHistory(signal);

        const positionMultiplier = signal.positionMultiplier || 1;
        const riskPercent = Math.max(this.MIN_RISK_PERCENT, this.MAX_RISK_PERCENT * positionMultiplier);
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
            "@ $" + trade.entry, "| Confidence:", trade.confidence + "%",
            "| Risk: $" + trade.riskAmount);
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
        
        if (result === "LOSS") {
            this.dailyStats.losses++;
            this.dailyStats.lossAmount += Math.abs(trade.profit);
        }

        if (this.balance < this.START_BALANCE * 0.1) {
            console.warn("⚠️ Balance critically low! Consider stopping trading.");
        }

        this.save();
        this.updateDashboard();

        const profitStr = trade.profit >= 0 ? "+$" + trade.profit.toFixed(2) : "-$" + Math.abs(trade.profit).toFixed(2);
        console.log("💰 Trade Closed:", trade.coin, result, 
            "| Confidence:", trade.confidence + "%",
            "| Profit:", profitStr, 
            "| Balance: $" + this.balance.toFixed(2));
    },

    updateTrailingStop(trade, currentPrice) {
        if (!trade.trailingActivated) {
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

                this.updateTrailingStop(trade, currentPrice);

                const isLong = trade.direction === "BUY";
                
                if (trade.trailingActivated) {
                    if (isLong && currentPrice <= trade.trailingStop) {
                        this.closeTrade(trade.id, "WIN", currentPrice);
                        continue;
                    } else if (!isLong && currentPrice >= trade.trailingStop) {
                        this.closeTrade(trade.id, "WIN", currentPrice);
                        continue;
                    }
                }

                if (isLong && currentPrice >= trade.takeProfit) {
                    this.closeTrade(trade.id, "WIN", currentPrice);
                } else if (isLong && currentPrice <= trade.stopLoss) {
                    this.closeTrade(trade.id, "LOSS", currentPrice);
                } else if (!isLong && currentPrice <= trade.takeProfit) {
                    this.closeTrade(trade.id, "WIN", currentPrice);
                } else if (!isLong && currentPrice >= trade.stopLoss) {
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
            table.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;">No trades yet. Click Scan Market to start!</td></tr>`;
            return;
        }

        // Show signal history summary first
        const signalSummary = document.createElement("tr");
        signalSummary.style.background = "#1a1a2e";
        signalSummary.innerHTML = `
            <td colspan="11" style="padding:10px; font-weight:bold; color:#4CAF50;">
                📊 Trade History (Last ${this.trades.length} trades) | 
                Signals Generated Today: ${this.generatedSignals.filter(s => new Date(s.timestamp).toDateString() === new Date().toDateString()).length}
            </td>
        `;
        table.appendChild(signalSummary);

        // Column headers
        const headerRow = document.createElement("tr");
        headerRow.style.background = "#16213e";
        headerRow.style.color = "#888";
        headerRow.innerHTML = `
            <th style="padding:8px;">Date</th>
            <th style="padding:8px;">Coin</th>
            <th style="padding:8px;">Market</th>
            <th style="padding:8px;">Signal</th>
            <th style="padding:8px;">Confidence</th>
            <th style="padding:8px;">Entry</th>
            <th style="padding:8px;">TP</th>
            <th style="padding:8px;">SL</th>
            <th style="padding:8px;">Exit</th>
            <th style="padding:8px;">Profit</th>
            <th style="padding:8px;">Status</th>
        `;
        table.appendChild(headerRow);

        [...this.trades].reverse().forEach(trade => {
            const isWin = trade.status === "WIN";
            const isLoss = trade.status === "LOSS";
            
            const statusColor = isWin ? "#14b814" : isLoss ? "#ff3b3b" : "#f5a623";
            const profitColor = trade.profit > 0 ? "#14b814" : trade.profit < 0 ? "#ff3b3b" : "#888";
            
            // Confidence color
            let confColor = "#f5a623";
            if (trade.confidence >= 90) confColor = "#14b814";
            else if (trade.confidence >= 80) confColor = "#4CAF50";
            else if (trade.confidence >= 70) confColor = "#8BC34A";
            
            const profit = trade.profit || 0;
            const profitStr = profit !== 0 ? 
                (profit >= 0 ? "+$" + profit.toFixed(2) : "-$" + Math.abs(profit).toFixed(2)) : 
                "--";

            const row = document.createElement("tr");
            row.style.borderBottom = "1px solid #2a2a4a";
            
            // Highlight winning confidence levels
            if (isWin && trade.confidence >= 80) {
                row.style.background = "rgba(20, 184, 20, 0.05)";
            } else if (isLoss && trade.confidence < 75) {
                row.style.background = "rgba(255, 59, 59, 0.05)";
            }
            
            row.innerHTML = `
                <td style="padding:8px;font-size:12px;">${new Date(trade.openTime).toLocaleString()}</td>
                <td style="padding:8px;"><strong>${trade.coin}</strong></td>
                <td style="padding:8px;font-size:12px;">${trade.market}</td>
                <td style="padding:8px;color:${trade.direction === 'BUY' ? '#14b814' : '#ff3b3b'};font-weight:bold;">${trade.direction}</td>
                <td style="padding:8px;color:${confColor};font-weight:bold;">${trade.confidence || 0}%</td>
                <td style="padding:8px;">$${Number(trade.entry).toFixed(2)}</td>
                <td style="padding:8px;color:#14b814;">$${Number(trade.takeProfit).toFixed(2)}</td>
                <td style="padding:8px;color:#ff3b3b;">$${Number(trade.stopLoss).toFixed(2)}</td>
                <td style="padding:8px;">${trade.exit ? '$' + Number(trade.exit).toFixed(2) : '--'}</td>
                <td style="padding:8px;color:${profitColor};font-weight:bold;">${profitStr}</td>
                <td style="padding:8px;color:${statusColor};font-weight:bold;">${trade.status}</td>
            `;
            table.appendChild(row);
        });

        // Add confidence analysis at bottom
        const confStats = this.getConfidenceStats();
        const summaryRow = document.createElement("tr");
        summaryRow.style.background = "#1a1a2e";
        summaryRow.innerHTML = `
            <td colspan="11" style="padding:15px;">
                <div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:10px;">
                    <div style="text-align:center;">
                        <strong>70-79% Confidence</strong><br>
                        <span style="color:#8BC34A;">${confStats['70-79'].wins}W / ${confStats['70-79'].total}L</span><br>
                        <small>Win Rate: ${confStats['70-79'].total > 0 ? ((confStats['70-79'].wins/confStats['70-79'].total)*100).toFixed(1) : '0'}%</small>
                    </div>
                    <div style="text-align:center;">
                        <strong>80-89% Confidence</strong><br>
                        <span style="color:#4CAF50;">${confStats['80-89'].wins}W / ${confStats['80-89'].total}L</span><br>
                        <small>Win Rate: ${confStats['80-89'].total > 0 ? ((confStats['80-89'].wins/confStats['80-89'].total)*100).toFixed(1) : '0'}%</small>
                    </div>
                    <div style="text-align:center;">
                        <strong>90-100% Confidence</strong><br>
                        <span style="color:#14b814;">${confStats['90-100'].wins}W / ${confStats['90-100'].total}L</span><br>
                        <small>Win Rate: ${confStats['90-100'].total > 0 ? ((confStats['90-100'].wins/confStats['90-100'].total)*100).toFixed(1) : '0'}%</small>
                    </div>
                </div>
            </td>
        `;
        table.appendChild(summaryRow);
    },

    getPerformanceReport() {
        const stats = this.getStats();
        const confStats = this.getConfidenceStats();
        
        return {
            balance: this.balance,
            totalTrades: stats.total,
            winRate: stats.winRate,
            profitFactor: stats.profitFactor,
            openTrades: this.getOpenTrades().length,
            dailyPL: (this.balance - this.dailyStats.startBalance).toFixed(2),
            dailyLossCount: this.dailyStats.losses,
            maxDrawdown: this.calculateMaxDrawdown(),
            confidenceStats: confStats
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
            this.generatedSignals = [];
            localStorage.removeItem("paper_balance");
            localStorage.removeItem("paper_trades");
            localStorage.removeItem("generated_signals_history");
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

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => PaperTrader.init(), 200);
    setInterval(() => PaperTrader.monitorTrades(), 30000);
});

console.log("✅ PaperTrader Loaded | Min Confidence: " + PaperTrader.MIN_CONFIDENCE + "% | Duplicate Prevention: Active");