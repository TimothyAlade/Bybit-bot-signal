// coin-monitor.js
// Live Coin Market Monitor - Top 40 Crypto

const CoinMonitor = {
    // Configuration
    TOP_40_COINS: [
        "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
        "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT",
        "LINKUSDT", "UNIUSDT", "ATOMUSDT", "LTCUSDT", "ETCUSDT",
        "XLMUSDT", "FILUSDT", "TRXUSDT", "NEARUSDT", "ALGOUSDT",
        "VETUSDT", "ICPUSDT", "SANDUSDT", "MANAUSDT", "THETAUSDT",
        "AXSUSDT", "FTMUSDT", "GRTUSDT", "EOSUSDT", "AAVEUSDT",
        "MKRUSDT", "SNXUSDT", "COMPUSDT", "ZECUSDT", "BATUSDT",
        "SUSHIUSDT", "CRVUSDT", "ENJUSDT", "CHZUSDT", "HOTUSDT"
    ],

    currentCoin: "BTCUSDT",
    currentInterval: "15",
    monitoring: false,
    monitorInterval: null,
    priceChart: null,
    indicatorChart: null,
    previousPrice: 0,
    coinPrices: {}, // Cache prices for tabs

    // API Module (built-in)
    API: {
        BASE_URL: "https://api.bybit.com",
        CACHE: new Map(),
        CACHE_TIME: 10000,

        async request(endpoint) {
            const cache = this.CACHE.get(endpoint);
            if (cache && Date.now() - cache.time < this.CACHE_TIME) {
                return cache.data;
            }

            try {
                const response = await fetch(`${this.BASE_URL}${endpoint}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const json = await response.json();
                if (json.retCode !== 0) throw new Error(json.retMsg);
                
                this.CACHE.set(endpoint, { time: Date.now(), data: json });
                return json;
            } catch (error) {
                console.error("API Error:", error);
                return null;
            }
        },

        async getCandles(symbol, interval = "15", limit = 200) {
            const data = await this.request(
                `/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`
            );
            return data?.result?.list?.reverse() || [];
        },

        async getTicker(symbol) {
            const data = await this.request(
                `/v5/market/tickers?category=linear&symbol=${symbol}`
            );
            return data?.result?.list?.[0] || null;
        },

        async getAllTickers() {
            const data = await this.request(
                "/v5/market/tickers?category=linear"
            );
            return data?.result?.list || [];
        }
    },

    // Initialize
    async init() {
        console.log("🚀 Initializing Coin Monitor...");
        
        // Load top 40 coins
        await this.loadCoinTabs();
        
        // Initialize charts
        this.initCharts();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start monitoring default coin
        await this.selectCoin(this.currentCoin);
        this.startMonitoring();
        
        console.log("✅ Coin Monitor Ready");
    },

    // Load all coin tabs with prices
    async loadCoinTabs() {
        const tabsContainer = document.getElementById("coinTabs");
        tabsContainer.innerHTML = '<span style="color:#888;padding:10px;">Loading top 40 coins...</span>';

        try {
            const tickers = await this.API.getAllTickers();
            
            if (!tickers || tickers.length === 0) {
                tabsContainer.innerHTML = '<span style="color:#ff3b3b;padding:10px;">Failed to load coins. Check connection.</span>';
                return;
            }

            // Create a map for quick lookup
            const tickerMap = {};
            tickers.forEach(t => {
                tickerMap[t.symbol] = t;
            });

            tabsContainer.innerHTML = "";

            // Create tabs for our top 40 coins
            this.TOP_40_COINS.forEach(symbol => {
                const ticker = tickerMap[symbol];
                const price = ticker ? Number(ticker.lastPrice).toFixed(2) : "0.00";
                const change = ticker ? Number(ticker.price24hPcnt) * 100 : 0;
                
                // Store price for tabs
                this.coinPrices[symbol] = {
                    price: Number(price),
                    change: Number(change.toFixed(2))
                };

                const tab = document.createElement("span");
                tab.className = "coin-tab";
                tab.id = `tab-${symbol}`;
                tab.title = `${symbol} - $${price}`;
                
                const changeClass = change >= 0 ? "tab-up" : "tab-down";
                const changeSymbol = change >= 0 ? "▲" : "▼";
                
                // Short display name
                const shortName = symbol.replace("USDT", "");
                
                tab.innerHTML = `
                    ${shortName}
                    <span class="tab-change ${changeClass}">
                        ${changeSymbol} ${Math.abs(change).toFixed(1)}%
                    </span>
                `;
                
                tab.addEventListener("click", () => this.selectCoin(symbol));
                tabsContainer.appendChild(tab);
            });

            // Highlight default coin
            this.highlightActiveTab();

            console.log("✅ Loaded", Object.keys(this.coinPrices).length, "coin prices");

        } catch (error) {
            console.error("Failed to load coins:", error);
            tabsContainer.innerHTML = '<span style="color:#ff3b3b;padding:10px;">Error loading coins. Retry.</span>';
        }
    },

    // Highlight active tab
    highlightActiveTab() {
        document.querySelectorAll(".coin-tab").forEach(tab => {
            tab.classList.remove("active");
        });
        const activeTab = document.getElementById(`tab-${this.currentCoin}`);
        if (activeTab) {
            activeTab.classList.add("active");
            activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    },

    // Select a coin
    async selectCoin(symbol) {
        console.log("🔄 Switching to:", symbol);
        
        this.currentCoin = symbol;
        this.highlightActiveTab();
        
        document.getElementById("selectedCoinBadge").textContent = symbol;
        document.getElementById("coinTitle").textContent = symbol.replace("USDT", "/USDT");
        
        // Update price display immediately if cached
        if (this.coinPrices[symbol]) {
            document.getElementById("currentPrice").textContent = 
                "$" + this.coinPrices[symbol].price.toFixed(2);
        }
        
        // Fetch full data
        await this.updateData();
        
        // Update tab prices periodically
        this.updateAllTabPrices();
    },

    // Initialize Charts
    initCharts() {
        // Price Chart
        const priceCtx = document.getElementById("priceChart").getContext("2d");
        this.priceChart = new Chart(priceCtx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Price",
                        data: [],
                        borderColor: "#e0e0e0",
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1,
                        order: 2
                    },
                    {
                        label: "EMA 9",
                        data: [],
                        borderColor: "#2196F3",
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0.1,
                        order: 1
                    },
                    {
                        label: "EMA 21",
                        data: [],
                        borderColor: "#FF9800",
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0.1,
                        order: 1
                    },
                    {
                        label: "EMA 50",
                        data: [],
                        borderColor: "#9C27B0",
                        borderWidth: 1,
                        pointRadius: 0,
                        tension: 0.1,
                        order: 1,
                        borderDash: [3, 3]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index"
                },
                plugins: {
                    legend: {
                        labels: { color: "#888", usePointStyle: true, boxWidth: 8 }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: "#888", callback: v => "$" + v },
                        grid: { color: "rgba(42,42,90,0.3)" }
                    },
                    x: {
                        ticks: { color: "#888", maxTicksLimit: 8 },
                        grid: { display: false }
                    }
                }
            }
        });

        // Indicator Chart
        const indCtx = document.getElementById("indicatorChart").getContext("2d");
        this.indicatorChart = new Chart(indCtx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "RSI",
                        data: [],
                        borderColor: "#E91E63",
                        borderWidth: 2,
                        pointRadius: 0,
                        yAxisID: "rsi"
                    },
                    {
                        label: "Volume",
                        data: [],
                        backgroundColor: "rgba(76,175,80,0.3)",
                        borderColor: "rgba(76,175,80,0.5)",
                        borderWidth: 1,
                        type: "bar",
                        yAxisID: "volume"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: "#888", usePointStyle: true, boxWidth: 8 }
                    }
                },
                scales: {
                    rsi: {
                        position: "left",
                        min: 0,
                        max: 100,
                        ticks: { color: "#888" },
                        grid: { 
                            color: (ctx) => {
                                if (ctx.tick.value === 70) return "rgba(255,59,59,0.5)";
                                if (ctx.tick.value === 30) return "rgba(20,184,20,0.5)";
                                if (ctx.tick.value === 50) return "rgba(245,166,35,0.3)";
                                return "rgba(42,42,90,0.2)";
                            }
                        }
                    },
                    volume: {
                        position: "right",
                        ticks: { color: "#888", callback: v => this.formatNumber(v) },
                        grid: { display: false }
                    },
                    x: {
                        ticks: { color: "#888", maxTicksLimit: 8 },
                        grid: { display: false }
                    }
                }
            }
        });
    },

    // Setup Event Listeners
    setupEventListeners() {
        document.getElementById("startBtn").addEventListener("click", () => this.startMonitoring());
        document.getElementById("stopBtn").addEventListener("click", () => this.stopMonitoring());
        document.getElementById("refreshBtn").addEventListener("click", () => this.updateData());
        
        document.getElementById("timeframeSelect").addEventListener("change", (e) => {
            this.currentInterval = e.target.value;
            if (this.monitoring) {
                this.updateData();
            }
        });
    },

    // Start Monitoring
    startMonitoring() {
        this.monitoring = true;
        document.getElementById("startBtn").disabled = true;
        document.getElementById("stopBtn").disabled = false;
        
        this.updateData();
        
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        this.monitorInterval = setInterval(() => this.updateData(), 15000);
        
        console.log("▶ Monitoring started for", this.currentCoin);
    },

    // Stop Monitoring
    stopMonitoring() {
        this.monitoring = false;
        document.getElementById("startBtn").disabled = false;
        document.getElementById("stopBtn").disabled = true;
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        console.log("⏹ Monitoring stopped");
    },

    // Update All Data
    async updateData() {
        try {
            await Promise.all([
                this.updateTicker(),
                this.updateCandles()
            ]);
        } catch (error) {
            console.error("Update error:", error);
        }
    },

    // Update Ticker (Price & Stats)
    async updateTicker() {
        const ticker = await this.API.getTicker(this.currentCoin);
        if (!ticker) return;

        const price = Number(ticker.lastPrice);
        const change = Number(ticker.price24hPcnt) * 100;
        const high = Number(ticker.highPrice24h);
        const low = Number(ticker.lowPrice24h);
        const volume = Number(ticker.turnover24h);
        const spread = ((high - low) / price) * 100;

        // Update price display
        document.getElementById("currentPrice").textContent = "$" + price.toFixed(2);
        document.getElementById("high24h").textContent = "$" + high.toFixed(2);
        document.getElementById("low24h").textContent = "$" + low.toFixed(2);
        document.getElementById("volume24h").textContent = "$" + this.formatNumber(volume);
        document.getElementById("spread").textContent = spread.toFixed(2) + "%";
        document.getElementById("updateTime").textContent = "Updated: " + new Date().toLocaleTimeString();

        // Price change
        const changeContainer = document.getElementById("priceChangeContainer");
        if (change >= 0) {
            changeContainer.innerHTML = `<span class="price-change price-up">▲ ${change.toFixed(2)}%</span>`;
        } else {
            changeContainer.innerHTML = `<span class="price-change price-down">▼ ${Math.abs(change).toFixed(2)}%</span>`;
        }

        // Update cached price
        this.coinPrices[this.currentCoin] = {
            price: price,
            change: Number(change.toFixed(2))
        };

        // Alert on big moves
        if (this.previousPrice > 0) {
            const priceChange = Math.abs(price - this.previousPrice) / this.previousPrice;
            if (priceChange > 0.03) {
                this.showAlert(
                    `🚨 Big Move! ${this.currentCoin.replace("USDT", "")} ${price > this.previousPrice ? '▲ UP' : '▼ DOWN'} ${(priceChange * 100).toFixed(1)}% to $${price.toFixed(2)}`
                );
            }
        }
        this.previousPrice = price;

        // Update the coin tab
        this.updateSingleTabPrice(this.currentCoin);
    },

    // Update Candles & Technical Analysis
    async updateCandles() {
        const candles = await this.API.getCandles(this.currentCoin, this.currentInterval, 200);
        if (!candles || candles.length < 30) return;

        const prices = candles.map(c => Number(c[4]));
        const volumes = candles.map(c => Number(c[5]));
        const labels = candles.map((c, i) => {
            if (i % 30 === 0) {
                const d = new Date(Number(c[0]));
                return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            }
            return "";
        });

        // Calculate indicators
        const ema9 = this.calculateEMA(prices, 9);
        const ema21 = this.calculateEMA(prices, 21);
        const ema50 = this.calculateEMA(prices, 50);
        const rsi = this.calculateRSI(prices);
        const atr = this.calculateATR(candles);
        const macd = this.calculateMACD(prices);
        const sr = this.findSupportResistance(prices);

        // Update Price Chart
        this.priceChart.data.labels = labels;
        this.priceChart.data.datasets[0].data = prices;
        this.priceChart.data.datasets[1].data = ema9;
        this.priceChart.data.datasets[2].data = ema21;
        this.priceChart.data.datasets[3].data = ema50;
        this.priceChart.update();

        // Update Indicator Chart
        this.indicatorChart.data.labels = labels;
        this.indicatorChart.data.datasets[0].data = rsi;
        this.indicatorChart.data.datasets[1].data = volumes;
        this.indicatorChart.update();

        // Update indicator cards
        this.updateIndicatorCards(prices, rsi, macd, atr, sr, ema9, ema21, ema50);
    },

    // Update Indicator Cards
    updateIndicatorCards(prices, rsi, macd, atr, sr, ema9, ema21, ema50) {
        const currentPrice = prices[prices.length - 1];
        const lastRSI = rsi[rsi.length - 1];

        // RSI
        document.getElementById("rsiValue").textContent = lastRSI ? lastRSI.toFixed(1) : "--";
        const rsiSignal = document.getElementById("rsiSignal");
        if (lastRSI > 70) {
            rsiSignal.textContent = "Overbought ⚠️";
            rsiSignal.className = "indicator-signal signal-bearish";
        } else if (lastRSI < 30) {
            rsiSignal.textContent = "Oversold 💡";
            rsiSignal.className = "indicator-signal signal-bullish";
        } else if (lastRSI >= 40 && lastRSI <= 60) {
            rsiSignal.textContent = "Healthy ✅";
            rsiSignal.className = "indicator-signal signal-bullish";
        } else {
            rsiSignal.textContent = "Neutral";
            rsiSignal.className = "indicator-signal signal-neutral";
        }

        // MACD
        document.getElementById("macdValue").textContent = macd.macd.toFixed(4);
        const macdSignal = document.getElementById("macdSignal");
        if (macd.histogram > 0 && macd.macd > macd.signal) {
            macdSignal.textContent = "Strong Bullish 📈";
            macdSignal.className = "indicator-signal signal-bullish";
        } else if (macd.histogram > 0) {
            macdSignal.textContent = "Weak Bullish";
            macdSignal.className = "indicator-signal signal-bullish";
        } else if (macd.histogram < 0 && macd.macd < macd.signal) {
            macdSignal.textContent = "Strong Bearish 📉";
            macdSignal.className = "indicator-signal signal-bearish";
        } else {
            macdSignal.textContent = "Weak Bearish";
            macdSignal.className = "indicator-signal signal-bearish";
        }

        // EMA Trend
        const last9 = ema9[ema9.length - 1];
        const last21 = ema21[ema21.length - 1];
        const last50 = ema50[ema50.length - 1];
        
        let emaTrendText = "Sideways";
        let emaTrendClass = "signal-neutral";
        
        if (last9 && last21 && last50) {
            if (last9 > last21 && last21 > last50) {
                emaTrendText = "Strong Uptrend 🚀";
                emaTrendClass = "signal-bullish";
            } else if (last9 > last21) {
                emaTrendText = "Weak Uptrend";
                emaTrendClass = "signal-bullish";
            } else if (last9 < last21 && last21 < last50) {
                emaTrendText = "Strong Downtrend 🔻";
                emaTrendClass = "signal-bearish";
            } else if (last9 < last21) {
                emaTrendText = "Weak Downtrend";
                emaTrendClass = "signal-bearish";
            }
        }
        
        document.getElementById("emaTrendValue").textContent = emaTrendText;
        document.getElementById("emaSignal").textContent = last9 > last21 ? "Bullish" : "Bearish";
        document.getElementById("emaSignal").className = "indicator-signal " + emaTrendClass;

        // Support/Resistance
        document.getElementById("srValue").textContent = 
            "S: $" + sr.support.toFixed(2) + " / R: $" + sr.resistance.toFixed(2);
        const srPosition = (currentPrice - sr.support) / (sr.resistance - sr.support);
        const srSignal = document.getElementById("srSignal");
        if (srPosition < 0.25) {
            srSignal.textContent = "Near Support 💡";
            srSignal.className = "indicator-signal signal-bullish";
        } else if (srPosition > 0.75) {
            srSignal.textContent = "Near Resistance ⚠️";
            srSignal.className = "indicator-signal signal-bearish";
        } else {
            srSignal.textContent = "Mid-Range";
            srSignal.className = "indicator-signal signal-neutral";
        }

        // ATR
        document.getElementById("atrValue").textContent = "$" + atr.toFixed(4);
        const atrSignal = document.getElementById("atrSignal");
        const atrPercent = (atr / currentPrice) * 100;
        if (atrPercent > 5) {
            atrSignal.textContent = "Very High 🌋";
            atrSignal.className = "indicator-signal signal-bearish";
        } else if (atrPercent > 2) {
            atrSignal.textContent = "High";
            atrSignal.className = "indicator-signal signal-neutral";
        } else if (atrPercent < 1) {
            atrSignal.textContent = "Low (Consolidating)";
            atrSignal.className = "indicator-signal signal-neutral";
        } else {
            atrSignal.textContent = "Normal ✅";
            atrSignal.className = "indicator-signal signal-bullish";
        }

        // Market Regime
        document.getElementById("regimeValue").textContent = emaTrendText;
        document.getElementById("regimeSignal").textContent = "Analyzing...";
        document.getElementById("regimeSignal").className = "indicator-signal " + emaTrendClass;
    },

    // Update single tab price
    updateSingleTabPrice(symbol) {
        const data = this.coinPrices[symbol];
        if (!data) return;
        
        const tab = document.getElementById(`tab-${symbol}`);
        if (!tab) return;
        
        const shortName = symbol.replace("USDT", "");
        const changeClass = data.change >= 0 ? "tab-up" : "tab-down";
        const changeSymbol = data.change >= 0 ? "▲" : "▼";
        
        tab.innerHTML = `
            ${shortName}
            <span class="tab-change ${changeClass}">
                ${changeSymbol} ${Math.abs(data.change).toFixed(1)}%
            </span>
        `;
    },

    // Update all tab prices periodically
    async updateAllTabPrices() {
        try {
            const tickers = await this.API.getAllTickers();
            if (!tickers) return;

            tickers.forEach(ticker => {
                if (this.coinPrices[ticker.symbol] !== undefined) {
                    this.coinPrices[ticker.symbol] = {
                        price: Number(ticker.lastPrice),
                        change: Number((Number(ticker.price24hPcnt) * 100).toFixed(2))
                    };
                }
            });

            // Update tab displays
            Object.keys(this.coinPrices).forEach(symbol => {
                this.updateSingleTabPrice(symbol);
            });
        } catch (error) {
            console.error("Failed to update tab prices:", error);
        }
    },

    // ============ TECHNICAL INDICATORS ============

    calculateEMA(prices, period) {
        if (prices.length < period) return new Array(prices.length).fill(null);
        const ema = [];
        const multiplier = 2 / (period + 1);
        let currentEMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        for (let i = 0; i < period - 1; i++) ema.push(null);
        ema.push(currentEMA);
        
        for (let i = period; i < prices.length; i++) {
            currentEMA = ((prices[i] - currentEMA) * multiplier) + currentEMA;
            ema.push(currentEMA);
        }
        return ema;
    },

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return new Array(prices.length).fill(50);
        const rsiValues = new Array(period).fill(null);
        
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        rsiValues.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
        
        for (let i = period + 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            avgGain = ((avgGain * (period - 1)) + (change > 0 ? change : 0)) / period;
            avgLoss = ((avgLoss * (period - 1)) + (change < 0 ? -change : 0)) / period;
            rsiValues.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
        }
        return rsiValues;
    },

    calculateMACD(prices) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        
        const macdLine = [];
        for (let i = 0; i < prices.length; i++) {
            if (ema12[i] === null || ema26[i] === null) {
                macdLine.push(null);
            } else {
                macdLine.push(ema12[i] - ema26[i]);
            }
        }
        
        const validMACD = macdLine.filter(v => v !== null);
        const signalLine = validMACD.length >= 9 ? this.calculateEMA(validMACD, 9) : [];
        
        const lastMACD = validMACD[validMACD.length - 1] || 0;
        const lastSignal = signalLine[signalLine.length - 1] || 0;
        
        return {
            macd: lastMACD,
            signal: lastSignal,
            histogram: lastMACD - lastSignal
        };
    },

    calculateATR(candles, period = 14) {
        const highs = candles.map(c => Number(c[2]));
        const lows = candles.map(c => Number(c[3]));
        const closes = candles.map(c => Number(c[4]));
        
        const trValues = [];
        for (let i = 1; i < highs.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trValues.push(tr);
        }
        
        if (trValues.length < period) return trValues.reduce((a, b) => a + b, 0) / trValues.length;
        return trValues.slice(-period).reduce((a, b) => a + b, 0) / period;
    },

    findSupportResistance(prices) {
        const recent = prices.slice(-50);
        const pivotHighs = [];
        const pivotLows = [];
        
        for (let i = 3; i < recent.length - 3; i++) {
            // Pivot high
            if (recent[i] > recent[i-1] && recent[i] > recent[i-2] && recent[i] > recent[i-3] &&
                recent[i] > recent[i+1] && recent[i] > recent[i+2] && recent[i] > recent[i+3]) {
                pivotHighs.push(recent[i]);
            }
            // Pivot low
            if (recent[i] < recent[i-1] && recent[i] < recent[i-2] && recent[i] < recent[i-3] &&
                recent[i] < recent[i+1] && recent[i] < recent[i+2] && recent[i] < recent[i+3]) {
                pivotLows.push(recent[i]);
            }
        }
        
        const resistance = pivotHighs.length > 0 
            ? pivotHighs.reduce((a, b) => a + b, 0) / pivotHighs.length 
            : prices[prices.length - 1] * 1.02;
            
        const support = pivotLows.length > 0 
            ? pivotLows.reduce((a, b) => a + b, 0) / pivotLows.length 
            : prices[prices.length - 1] * 0.98;
        
        return { support, resistance };
    },

    // ============ UTILITIES ============

    formatNumber(num) {
        if (!num || num === 0) return "0";
        const n = Number(num);
        if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
        if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
        if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
        return n.toFixed(2);
    },

    showAlert(message) {
        const alertBox = document.getElementById("alertBox");
        alertBox.textContent = message;
        alertBox.className = "alert-box show";
        
        clearTimeout(this.alertTimeout);
        this.alertTimeout = setTimeout(() => {
            alertBox.classList.remove("show");
        }, 5000);
    }
};

// Start the monitor when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    CoinMonitor.init();
});

// Update tab prices every 2 minutes
setInterval(() => {
    if (CoinMonitor.monitoring) {
        CoinMonitor.updateAllTabPrices();
    }
}, 120000);

console.log("📦 Coin Monitor JS Loaded | Top 40 Coins | Real-Time Analysis");