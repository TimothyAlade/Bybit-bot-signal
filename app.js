// app.js
const App = {
    chart: null,

    init() {
        if (window.Chart) {
            const canvas = document.getElementById("equityChart");
            if (canvas) {
                this.chart = new Chart(canvas.getContext("2d"), {
                    type: "line",
                    data: {
                        labels: ["Start"],
                        datasets: [{
                            label: "Balance",
                            data: [10000],
                            borderColor: "#4CAF50",
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
            }
        }

        const scanBtn = document.getElementById("scanBtn");
        if (scanBtn) {
            scanBtn.onclick = () => this.scanMarket();
        }

        this.updateChart();
        console.log("App ready");
    },

    updateChart() {
        if (!this.chart) return;
        
        const saved = localStorage.getItem("equity_curve");
        if (!saved) return;

        try {
            const equity = JSON.parse(saved);
            if (Array.isArray(equity) && equity.length > 0) {
                this.chart.data.labels = equity.map((_, i) => i + 1);
                this.chart.data.datasets[0].data = equity.map(p => p.balance);
                this.chart.update();
            }
        } catch(e) {}
    },

    async scanMarket() {
        console.log("=== SCANNING ===");

        const scanBtn = document.getElementById("scanBtn");
        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.textContent = "Scanning...";
        }

        try {
            const marketType = "futures";
            const coins = await BybitAPI.getTopCoins(marketType, 15);

            if (!coins || coins.length === 0) {
                alert("No coins found. Check internet connection.");
                return;
            }

            console.log("Got", coins.length, "coins");

            let tradeCount = 0;

            for (const coin of coins) {
                try {
                    const candles = await BybitAPI.getCandles(coin.symbol, "linear", "60", 200);
                    
                    if (!candles || candles.length < 200) {
                        console.log(coin.symbol, "- not enough candles");
                        continue;
                    }

                    const analysis = AnalysisEngine.generateSignal(candles);
                    
                    if (!analysis) {
                        console.log(coin.symbol, "- no signal");
                        continue;
                    }

                    console.log(coin.symbol, "-", analysis.signal, analysis.confidence + "%");

                    const signal = {
                        coin: coin.symbol,
                        market: marketType,
                        ...analysis
                    };

                    // Open trade
                    const opened = PaperTrader.openTrade(signal);
                    if (opened) tradeCount++;

                    // Render signal card
                    this.renderSignalCard(signal);

                } catch(err) {
                    console.error(coin.symbol, "error:", err);
                }
            }

            console.log("Scan complete.", tradeCount, "trades opened");
            this.updateChart();

        } catch(error) {
            console.error("Scan failed:", error);
            alert("Scan failed. Check console.");
        } finally {
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.textContent = "🔍 Scan Market";
            }
        }
    },

    renderSignalCard(signal) {
        const container = document.getElementById("signalContainer");
        if (!container) return;

        // Clear placeholder on first signal
        if (container.querySelector('.signal-card') && 
            container.querySelector('.signal-card').textContent.includes('Waiting')) {
            container.innerHTML = "";
        }

        const card = document.createElement("div");
        card.className = "signal-card";
        card.innerHTML = `
            <h3>${signal.coin}</h3>
            <p><strong>Signal:</strong> ${signal.signal}</p>
            <p><strong>Entry:</strong> $${signal.entry}</p>
            <p><strong>TP:</strong> $${signal.takeProfit}</p>
            <p><strong>SL:</strong> $${signal.stopLoss}</p>
            <p><strong>Confidence:</strong> ${signal.confidence}%</p>
        `;
        container.insertBefore(card, container.firstChild);
    }
};

window.App = App;

// Start
document.addEventListener("DOMContentLoaded", function() {
    setTimeout(function() {
        App.init();
    }, 100);
});