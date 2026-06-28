// coin-monitor.js
// Live Coin Market Monitor - Signals, Search, Top Coins

const CoinMonitor = {
    // All coins from Bybit (will be populated dynamically)
    allCoins: [],
    coinPrices: {},
    coinSignals: {}, // Store generated signals per coin
    
    currentCoin: "BTCUSDT",
    currentInterval: "15",
    monitoring: false,
    monitorInterval: null,
    priceChart: null,
    indicatorChart: null,
    previousPrice: 0,

    API: {
        BASE_URL: "https://api.bybit.com",
        CACHE: new Map(),
        CACHE_TIME: 8000,

        async request(endpoint) {
            const cache = this.CACHE.get(endpoint);
            if (cache && Date.now() - cache.time < this.CACHE_TIME) return cache.data;
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
            const data = await this.request(`/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`);
            return data?.result?.list?.reverse() || [];
        },

        async getTicker(symbol) {
            const data = await this.request(`/v5/market/tickers?category=linear&symbol=${symbol}`);
            return data?.result?.list?.[0] || null;
        },

        async getAllTickers() {
            const data = await this.request("/v5/market/tickers?category=linear");
            return data?.result?.list || [];
        }
    },

    async init() {
        console.log("🚀 Initializing Coin Monitor with Signals...");
        
        document.getElementById("searchInput").addEventListener("input", (e) => this.handleSearch(e.target.value));
        document.getElementById("searchInput").addEventListener("focus", () => {
            if (document.getElementById("searchInput").value) {
                document.getElementById("searchResults").style.display = "block";
            }
        });
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".search-bar")) {
                document.getElementById("searchResults").style.display = "none";
            }
        });

        document.getElementById("startBtn").addEventListener("click", () => this.startMonitoring());
        document.getElementById("stopBtn").addEventListener("click", () => this.stopMonitoring());
        document.getElementById("refreshBtn").addEventListener("click", () => this.updateData());
        document.getElementById("analyzeBtn").addEventListener("click", () => this.analyzeCurrentCoin());
        document.getElementById("timeframeSelect").addEventListener("change", (e) => {
            this.currentInterval = e.target.value;
            if (this.monitoring) this.updateData();
        });

        this.initCharts();
        await this.loadAllCoins();
        await this.selectCoin(this.currentCoin);
        this.startMonitoring();
        
        // Auto-analyze all coins periodically
        this.analyzeAllCoins();
        setInterval(() => this.analyzeAllCoins(), 300000); // Every 5 minutes
        
        console.log("✅ Coin Monitor Ready with Signal Analysis");
    },

    initCharts() {
        const priceCtx = document.getElementById("priceChart").getContext("2d");
        this.priceChart = new Chart(priceCtx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    { label: "Price", data: [], borderColor: "#e0e0e0", borderWidth: 2, pointRadius: 0, tension: 0.1 },
                    { label: "EMA 9", data: [], borderColor: "#2196F3", borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
                    { label: "EMA 21", data: [], borderColor: "#FF9800", borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
                    { label: "EMA 50", data: [], borderColor: "#9C27B0", borderWidth: 1, pointRadius: 0, tension: 0.1, borderDash: [3,3] }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: "#888", usePointStyle: true, boxWidth: 8 } } },
                scales: {
                    y: { ticks: { color: "#888", callback: v => "$" + v }, grid: { color: "rgba(42,42,90,0.3)" } },
                    x: { ticks: { color: "#888", maxTicksLimit: 8 }, grid: { display: false } }
                }
            }
        });

        const indCtx = document.getElementById("indicatorChart").getContext("2d");
        this.indicatorChart = new Chart(indCtx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    { label: "RSI", data: [], borderColor: "#E91E63", borderWidth: 2, pointRadius: 0, yAxisID: "rsi" },
                    { label: "Volume", data: [], backgroundColor: "rgba(76,175,80,0.3)", borderColor: "rgba(76,175,80,0.5)", borderWidth: 1, type: "bar", yAxisID: "volume" }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: "#888", usePointStyle: true, boxWidth: 8 } } },
                scales: {
                    rsi: { position: "left", min: 0, max: 100, ticks: { color: "#888" }, 
                        grid: { color: (ctx) => ctx.tick.value === 70 ? "rgba(255,59,59,0.5)" : ctx.tick.value === 30 ? "rgba(20,184,20,0.5)" : "rgba(42,42,90,0.2)" } },
                    volume: { position: "right", ticks: { color: "#888", callback: v => this.formatNumber(v) }, grid: { display: false } },
                    x: { ticks: { color: "#888", maxTicksLimit: 8 }, grid: { display: false } }
                }
            }
        });
    },

    // Load ALL coins from Bybit
    async loadAllCoins() {
        const tabsContainer = document.getElementById("coinTabs");
        tabsContainer.innerHTML = '<span style="color:#888;padding:10px;">Loading all coins...</span>';

        try {
            const tickers = await this.API.getAllTickers();
            if (!tickers || tickers.length === 0) {
                tabsContainer.innerHTML = '<span style="color:#ff3b3b;">Failed to load</span>';
                return;
            }

            // Store all coins
            this.allCoins = tickers
                .filter(t => t.symbol.endsWith("USDT") && Number(t.turnover24h) > 100000)
                .sort((a, b) => Number(b.turnover24h) - Number(a.turnover24h))
                .slice(0, 100); // Top 100 by volume

            // Store prices
            this.allCoins.forEach(ticker => {
                this.coinPrices[ticker.symbol] = {
                    price: Number(ticker.lastPrice),
                    change: Number((Number(ticker.price24hPcnt) * 100).toFixed(2)),
                    volume: Number(ticker.turnover24h),
                    high: Number(ticker.highPrice24h),
                    low: Number(ticker.lowPrice24h)
                };
            });

            this.renderCoinTabs();
            document.getElementById("searchCount").textContent = `${this.allCoins.length} coins loaded`;

            console.log("✅ Loaded", this.allCoins.length, "coins");
        } catch (error) {
            console.error("Failed to load coins:", error);
            tabsContainer.innerHTML = '<span style="color:#ff3b3b;">Error loading</span>';
        }
    },

    // Render coin tabs
    renderCoinTabs(filter = null) {
        const tabsContainer = document.getElementById("coinTabs");
        tabsContainer.innerHTML = "";

        let coinsToShow = this.allCoins;
        if (filter) {
            const searchTerm = filter.toUpperCase();
            coinsToShow = this.allCoins.filter(c => c.symbol.includes(searchTerm));
        }

        // Show coins with signals first
        const withSignals = coinsToShow.filter(c => this.coinSignals[c.symbol]);
        const withoutSignals = coinsToShow.filter(c => !this.coinSignals[c.symbol]);
        const sortedCoins = [...withSignals, ...withoutSignals];

        sortedCoins.slice(0, 50).forEach(coin => {
            const symbol = coin.symbol;
            const data = this.coinPrices[symbol] || { price: 0, change: 0 };
            const signal = this.coinSignals[symbol];
            
            const tab = document.createElement("span");
            tab.className = "coin-tab";
            tab.id = `tab-${symbol}`;
            tab.title = `${symbol} - $${data.price?.toFixed(2) || "0.00"}`;
            
            const shortName = symbol.replace("USDT", "");
            const changeClass = data.change >= 0 ? "tab-up" : "tab-down";
            const changeSymbol = data.change >= 0 ? "▲" : "▼";
            
            let signalDot = '<span class="tab-signal-dot dot-none"></span>';
            let confidenceHtml = '';
            
            if (signal) {
                signalDot = `<span class="tab-signal-dot dot-${signal.signal === 'BUY' ? 'buy' : 'sell'}"></span>`;
                confidenceHtml = `<span class="tab-confidence">${signal.confidence}%</span>`;
            }
            
            tab.innerHTML = `
                ${signalDot}${shortName}
                <span class="tab-change ${changeClass}">${changeSymbol} ${Math.abs(data.change).toFixed(1)}%</span>
                ${confidenceHtml}
            `;
            
            tab.addEventListener("click", () => this.selectCoin(symbol));
            tabsContainer.appendChild(tab);
        });

        if (sortedCoins.length > 50) {
            const moreTab = document.createElement("span");
            moreTab.className = "coin-tab";
            moreTab.style.color = "#888";
            moreTab.textContent = `+${sortedCoins.length - 50} more (search to find)`;
            tabsContainer.appendChild(moreTab);
        }

        this.highlightActiveTab();
    },

    highlightActiveTab() {
        document.querySelectorAll(".coin-tab").forEach(t => t.classList.remove("active"));
        const active = document.getElementById(`tab-${this.currentCoin}`);
        if (active) {
            active.classList.add("active");
            active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    },

    // Search handler
    handleSearch(query) {
        const resultsDiv = document.getElementById("searchResults");
        
        if (!query || query.length < 1) {
            resultsDiv.style.display = "none";
            this.renderCoinTabs();
            return;
        }

        const searchTerm = query.toUpperCase();
        const matches = this.allCoins.filter(c => c.symbol.includes(searchTerm));
        
        if (matches.length === 0) {
            resultsDiv.innerHTML = '<div class="search-result-item" style="color:#888;">No coins found</div>';
        } else {
            resultsDiv.innerHTML = matches.slice(0, 15).map(coin => {
                const signal = this.coinSignals[coin.symbol];
                let signalBadge = '<span class="sr-no-signal">--</span>';
                if (signal) {
                    signalBadge = `<span class="sr-signal ${signal.signal === 'BUY' ? 'sr-buy' : 'sr-sell'}">${signal.signal} ${signal.confidence}%</span>`;
                }
                return `
                    <div class="search-result-item" onclick="CoinMonitor.selectCoin('${coin.symbol}');document.getElementById('searchResults').style.display='none';document.getElementById('searchInput').value='';">
                        <span>${coin.symbol.replace('USDT', '')} <small style="color:#888;">$${this.coinPrices[coin.symbol]?.price?.toFixed(2) || '0.00'}</small></span>
                        ${signalBadge}
                    </div>
                `;
            }).join("");
        }
        
        resultsDiv.style.display = "block";
        this.renderCoinTabs(query);
    },

    async selectCoin(symbol) {
        this.currentCoin = symbol;
        this.highlightActiveTab();
        document.getElementById("selectedCoinBadge").textContent = symbol;
        document.getElementById("coinTitle").textContent = symbol.replace("USDT", "/USDT");
        
        // Show cached signal
        this.updateSignalBanner();
        
        await this.updateData();
        document.getElementById("searchResults").style.display = "none";
    },

    startMonitoring() {
        this.monitoring = true;
        document.getElementById("startBtn").disabled = true;
        document.getElementById("stopBtn").disabled = false;
        this.updateData();
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        this.monitorInterval = setInterval(() => this.updateData(), 15000);
    },

    stopMonitoring() {
        this.monitoring = false;
        document.getElementById("startBtn").disabled = false;
        document.getElementById("stopBtn").disabled = true;
        if (this.monitorInterval) { clearInterval(this.monitorInterval); this.monitorInterval = null; }
    },

    async updateData() {
        try {
            await Promise.all([this.updateTicker(), this.updateCandles()]);
        } catch (error) {
            console.error("Update error:", error);
        }
    },

    async updateTicker() {
        const ticker = await this.API.getTicker(this.currentCoin);
        if (!ticker) return;

        const price = Number(ticker.lastPrice);
        const change = Number(ticker.price24hPcnt) * 100;
        const high = Number(ticker.highPrice24h);
        const low = Number(ticker.lowPrice24h);
        const volume = Number(ticker.turnover24h);
        const spread = ((high - low) / price) * 100;

        document.getElementById("currentPrice").textContent = "$" + price.toFixed(2);
        document.getElementById("high24h").textContent = "$" + high.toFixed(2);
        document.getElementById("low24h").textContent = "$" + low.toFixed(2);
        document.getElementById("volume24h").textContent = "$" + this.formatNumber(volume);
        document.getElementById("spread").textContent = spread.toFixed(2) + "%";
        document.getElementById("updateTime").textContent = "Updated: " + new Date().toLocaleTimeString();

        const changeContainer = document.getElementById("priceChangeContainer");
        changeContainer.innerHTML = change >= 0 
            ? `<span class="price-change price-up">▲ ${change.toFixed(2)}%</span>`
            : `<span class="price-change price-down">▼ ${Math.abs(change).toFixed(2)}%</span>`;

        this.coinPrices[this.currentCoin] = { price, change: Number(change.toFixed(2)), volume, high, low };

        if (this.previousPrice > 0 && Math.abs(price - this.previousPrice) / this.previousPrice > 0.03) {
            this.showAlert(`🚨 ${this.currentCoin.replace("USDT","")} ${price > this.previousPrice ? '▲' : '▼'} ${(Math.abs(price-this.previousPrice)/this.previousPrice*100).toFixed(1)}%`);
        }
        this.previousPrice = price;
        this.updateSingleTab(this.currentCoin);
    },

    async updateCandles() {
        const candles = await this.API.getCandles(this.currentCoin, this.currentInterval, 200);
        if (!candles || candles.length < 30) return;

        const prices = candles.map(c => Number(c[4]));
        const volumes = candles.map(c => Number(c[5]));
        const labels = candles.map((c, i) => i % 30 === 0 ? new Date(Number(c[0])).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "");

        const ema9 = this.calculateEMA(prices, 9);
        const ema21 = this.calculateEMA(prices, 21);
        const ema50 = this.calculateEMA(prices, 50);
        const rsi = this.calculateRSI(prices);
        const atr = this.calculateATR(candles);
        const macd = this.calculateMACD(prices);
        const sr = this.findSupportResistance(prices);

        this.priceChart.data.labels = labels;
        this.priceChart.data.datasets[0].data = prices;
        this.priceChart.data.datasets[1].data = ema9;
        this.priceChart.data.datasets[2].data = ema21;
        this.priceChart.data.datasets[3].data = ema50;
        this.priceChart.update();

        this.indicatorChart.data.labels = labels;
        this.indicatorChart.data.datasets[0].data = rsi;
        this.indicatorChart.data.datasets[1].data = volumes;
        this.indicatorChart.update();

        this.updateIndicators(prices, rsi, macd, atr, sr, ema9, ema21, ema50);
    },

    updateIndicators(prices, rsi, macd, atr, sr, ema9, ema21, ema50) {
        const currentPrice = prices[prices.length - 1];
        const lastRSI = rsi[rsi.length - 1];

        // RSI
        document.getElementById("rsiValue").textContent = lastRSI?.toFixed(1) || "--";
        const rsiSig = document.getElementById("rsiSignal");
        if (lastRSI > 70) { rsiSig.textContent = "Overbought ⚠️"; rsiSig.className = "indicator-signal signal-bearish"; }
        else if (lastRSI < 30) { rsiSig.textContent = "Oversold 💡"; rsiSig.className = "indicator-signal signal-bullish"; }
        else { rsiSig.textContent = "Neutral"; rsiSig.className = "indicator-signal signal-neutral"; }

        // MACD
        document.getElementById("macdValue").textContent = macd.macd.toFixed(4);
        const macdSig = document.getElementById("macdSignal");
        if (macd.histogram > 0) { macdSig.textContent = "Bullish 📈"; macdSig.className = "indicator-signal signal-bullish"; }
        else { macdSig.textContent = "Bearish 📉"; macdSig.className = "indicator-signal signal-bearish"; }

        // EMA
        const last9 = ema9[ema9.length - 1], last21 = ema21[ema21.length - 1], last50 = ema50[ema50.length - 1];
        let trendText = "Sideways", trendClass = "signal-neutral";
        if (last9 && last21 && last50) {
            if (last9 > last21 && last21 > last50) { trendText = "Strong Uptrend 🚀"; trendClass = "signal-bullish"; }
            else if (last9 > last21) { trendText = "Weak Uptrend"; trendClass = "signal-bullish"; }
            else if (last9 < last21 && last21 < last50) { trendText = "Strong Downtrend 🔻"; trendClass = "signal-bearish"; }
            else if (last9 < last21) { trendText = "Weak Downtrend"; trendClass = "signal-bearish"; }
        }
        document.getElementById("emaTrendValue").textContent = trendText;
        document.getElementById("emaSignal").textContent = last9 > last21 ? "Bullish" : "Bearish";
        document.getElementById("emaSignal").className = "indicator-signal " + trendClass;

        // S/R
        document.getElementById("srValue").textContent = `S: $${sr.support.toFixed(2)} / R: $${sr.resistance.toFixed(2)}`;
        const srPos = (currentPrice - sr.support) / (sr.resistance - sr.support);
        const srSig = document.getElementById("srSignal");
        if (srPos < 0.25) { srSig.textContent = "Near Support 💡"; srSig.className = "indicator-signal signal-bullish"; }
        else if (srPos > 0.75) { srSig.textContent = "Near Resistance ⚠️"; srSig.className = "indicator-signal signal-bearish"; }
        else { srSig.textContent = "Mid-Range"; srSig.className = "indicator-signal signal-neutral"; }

        // ATR
        document.getElementById("atrValue").textContent = "$" + atr.toFixed(4);
        const atrSig = document.getElementById("atrSignal");
        const atrPct = (atr / currentPrice) * 100;
        if (atrPct > 5) { atrSig.textContent = "Very High 🌋"; atrSig.className = "indicator-signal signal-bearish"; }
        else if (atrPct > 2) { atrSig.textContent = "High"; atrSig.className = "indicator-signal signal-neutral"; }
        else { atrSig.textContent = "Normal ✅"; atrSig.className = "indicator-signal signal-bullish"; }

        // Regime
        document.getElementById("regimeValue").textContent = trendText;
        document.getElementById("regimeSignal").textContent = "Active";
        document.getElementById("regimeSignal").className = "indicator-signal " + trendClass;
    },

    updateSignalBanner() {
        const signal = this.coinSignals[this.currentCoin];
        const banner = document.getElementById("signalBanner");
        const badge = document.getElementById("signalBadge");
        const confText = document.getElementById("signalConfidenceText");
        const confFill = document.getElementById("confidenceFill");
        const confPct = document.getElementById("confidencePercent");
        const entryInfo = document.getElementById("signalEntryInfo");
        const reasonsBox = document.getElementById("reasonsBox");
        const reasonsGrid = document.getElementById("reasonsGrid");

        if (signal) {
            banner.className = `signal-banner has-signal-${signal.signal.toLowerCase()}`;
            badge.textContent = signal.signal;
            badge.className = `signal-badge ${signal.signal.toLowerCase()}`;
            confText.textContent = `Confidence: ${signal.confidence}%`;
            confPct.textContent = signal.confidence + "%";
            
            const fillClass = signal.confidence >= 80 ? "high" : signal.confidence >= 70 ? "medium" : "low";
            confFill.className = "confidence-fill " + fillClass;
            confFill.style.width = signal.confidence + "%";
            
            entryInfo.innerHTML = `Entry: <strong>$${signal.entry}</strong> | TP: <strong>$${signal.takeProfit}</strong> | SL: <strong>$${signal.stopLoss}</strong> | RSI: ${signal.rsi}`;
            
            // Show reasons
            if (signal.reasons && signal.reasons.length > 0) {
                reasonsBox.style.display = "block";
                reasonsGrid.innerHTML = signal.reasons.map(r => 
                    `<span class="reason-tag ${signal.signal === 'BUY' ? 'bullish' : 'bearish'}">${r}</span>`
                ).join("");
            }
        } else {
            banner.className = "signal-banner";
            badge.textContent = "NO SIGNAL";
            badge.className = "signal-badge none";
            confText.textContent = "Confidence: N/A";
            confPct.textContent = "0%";
            confFill.className = "confidence-fill low";
            confFill.style.width = "0%";
            entryInfo.innerHTML = "Click 'Analyze Signal' to generate a trading signal";
            reasonsBox.style.display = "none";
        }
    },

    // Analyze current coin for signals
    async analyzeCurrentCoin() {
        console.log("🧠 Analyzing", this.currentCoin);
        
        const candles = await this.API.getCandles(this.currentCoin, "60", 200);
        if (!candles || candles.length < 200) {
            alert("Not enough data to analyze " + this.currentCoin);
            return;
        }

        const signal = this.generateSignal(candles, this.currentCoin);
        if (signal) {
            this.coinSignals[this.currentCoin] = signal;
            console.log("✅ Signal generated:", signal.signal, signal.confidence + "%");
        } else {
            delete this.coinSignals[this.currentCoin];
            console.log("❌ No signal for", this.currentCoin);
        }

        this.updateSignalBanner();
        this.renderCoinTabs();
        this.updateAllSignalsTable();
    },

    // Analyze all coins
    async analyzeAllCoins() {
        console.log("🧠 Analyzing all coins for signals...");
        const coinsToAnalyze = this.allCoins.slice(0, 40); // Top 40 by volume
        
        for (const coin of coinsToAnalyze) {
            try {
                const candles = await this.API.getCandles(coin.symbol, "60", 100);
                if (!candles || candles.length < 50) continue;
                
                const signal = this.generateSignal(candles, coin.symbol);
                if (signal) {
                    this.coinSignals[coin.symbol] = signal;
                }
            } catch (e) {
                // Skip failed coins
            }
        }

        this.renderCoinTabs();
        this.updateAllSignalsTable();
        this.updateSignalBanner();
        console.log("✅ Signal analysis complete. Signals found:", Object.keys(this.coinSignals).length);
    },

    // Generate trading signal (same logic as your bot)
    generateSignal(candles, symbol) {
        if (!candles || candles.length < 50) return null;

        const prices = candles.map(c => Number(c[4]));
        const volumes = candles.map(c => Number(c[5]));
        const currentPrice = prices[prices.length - 1];
        const previousPrice = prices[prices.length - 2];

        const ema9 = this.calculateEMA(prices, 9);
        const ema21 = this.calculateEMA(prices, 21);
        const ema50 = this.calculateEMA(prices, 50);
        const rsi = this.calculateRSI(prices);
        const macd = this.calculateMACD(prices);
        const atr = this.calculateATR(candles);
        const lastRSI = rsi[rsi.length - 1];

        if (!ema9.length || !ema21.length || !ema50.length) return null;

        const last9 = ema9[ema9.length - 1];
        const last21 = ema21[ema21.length - 1];
        const last50 = ema50[ema50.length - 1];

        let buyScore = 0, sellScore = 0;
        const reasons = [];

        // BUY conditions
        if (last9 > last21 && last21 > last50) { buyScore += 25; reasons.push("Strong Bullish EMA"); }
        else if (last9 > last21) { buyScore += 15; reasons.push("Bullish EMA Cross"); }
        
        if (lastRSI >= 45 && lastRSI <= 65) { buyScore += 20; reasons.push("Healthy RSI (" + lastRSI.toFixed(0) + ")"); }
        else if (lastRSI >= 40 && lastRSI <= 70) { buyScore += 10; reasons.push("Acceptable RSI"); }
        
        if (macd.histogram > 0) { buyScore += 15; reasons.push("MACD Bullish"); }
        if (currentPrice > previousPrice) { buyScore += 10; reasons.push("Positive Momentum"); }
        if (currentPrice > last9) { buyScore += 10; reasons.push("Above EMA9"); }

        // SELL conditions
        if (last9 < last21 && last21 < last50) sellScore += 25;
        else if (last9 < last21) sellScore += 15;
        
        if (lastRSI >= 35 && lastRSI <= 55) sellScore += 20;
        if (macd.histogram < 0) sellScore += 15;
        if (currentPrice < previousPrice) sellScore += 10;
        if (currentPrice < last9) sellScore += 10;

        let signal = null, confidence = 0;

        if (buyScore >= 60 && buyScore > sellScore) {
            signal = "BUY";
            confidence = buyScore;
        } else if (sellScore >= 60 && sellScore > buyScore) {
            signal = "SELL";
            confidence = sellScore;
        }

        if (!signal) return null;

        const stopLoss = signal === "BUY" ? currentPrice * 0.98 : currentPrice * 1.02;
        const takeProfit = signal === "BUY" ? currentPrice * 1.04 : currentPrice * 0.96;

        return {
            signal,
            confidence,
            currentPrice: Number(currentPrice.toFixed(4)),
            entry: Number(currentPrice.toFixed(4)),
            takeProfit: Number(takeProfit.toFixed(4)),
            stopLoss: Number(stopLoss.toFixed(4)),
            rsi: Number(lastRSI.toFixed(1)),
            reasons
        };
    },

    // Update all signals table
    updateAllSignalsTable() {
        const tbody = document.getElementById("allSignalsTable");
        
        const signals = Object.entries(this.coinSignals)
            .sort(([, a], [, b]) => b.confidence - a.confidence);

        if (signals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="no-signal-message">No active signals. Click "Analyze Signal" or wait for auto-analysis</td></tr>';
            return;
        }

        tbody.innerHTML = signals.map(([symbol, signal]) => `
            <tr>
                <td><strong>${symbol.replace('USDT', '')}</strong></td>
                <td style="color:${signal.signal === 'BUY' ? '#14b814' : '#ff3b3b'};font-weight:bold;">${signal.signal}</td>
                <td>
                    <div class="confidence-bar" style="width:80px;height:6px;background:#1a1a3e;border-radius:3px;display:inline-block;vertical-align:middle;margin-right:5px;">
                        <div style="width:${signal.confidence}%;height:100%;background:${signal.confidence >= 80 ? '#14b814' : signal.confidence >= 70 ? '#f5a623' : '#ff3b3b'};border-radius:3px;"></div>
                    </div>
                    ${signal.confidence}%
                </td>
                <td>$${signal.currentPrice}</td>
                <td>$${signal.entry}</td>
                <td style="color:#14b814;">$${signal.takeProfit}</td>
                <td style="color:#ff3b3b;">$${signal.stopLoss}</td>
                <td>${signal.reasons?.[0] || '--'}</td>
                <td>${signal.rsi}</td>
                <td><span class="clickable" onclick="CoinMonitor.selectCoin('${symbol}')">View →</span></td>
            </tr>
        `).join("");

        console.log("📊 Signals table updated:", signals.length, "signals");
    },

    updateSingleTab(symbol) {
        const data = this.coinPrices[symbol];
        if (!data) return;
        const tab = document.getElementById(`tab-${symbol}`);
        if (!tab) return;
        
        const shortName = symbol.replace("USDT", "");
        const changeClass = data.change >= 0 ? "tab-up" : "tab-down";
        const changeSymbol = data.change >= 0 ? "▲" : "▼";
        const signal = this.coinSignals[symbol];
        const signalDot = signal ? `<span class="tab-signal-dot dot-${signal.signal === 'BUY' ? 'buy' : 'sell'}"></span>` : '<span class="tab-signal-dot dot-none"></span>';
        const confHtml = signal ? `<span class="tab-confidence">${signal.confidence}%</span>` : '';
        
        tab.innerHTML = `${signalDot}${shortName} <span class="tab-change ${changeClass}">${changeSymbol} ${Math.abs(data.change).toFixed(1)}%</span>${confHtml}`;
    },

    // ===== INDICATOR CALCULATIONS =====
    calculateEMA(prices, period) {
        if (prices.length < period) return new Array(prices.length).fill(null);
        const ema = [];
        const mult = 2 / (period + 1);
        let val = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = 0; i < period - 1; i++) ema.push(null);
        ema.push(val);
        for (let i = period; i < prices.length; i++) {
            val = ((prices[i] - val) * mult) + val;
            ema.push(val);
        }
        return ema;
    },

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return new Array(prices.length).fill(50);
        const rsi = new Array(period).fill(null);
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const c = prices[i] - prices[i-1];
            if (c > 0) gains += c; else losses += Math.abs(c);
        }
        let avgG = gains / period, avgL = losses / period;
        rsi.push(100 - (100 / (1 + avgG / (avgL || 1))));
        for (let i = period + 1; i < prices.length; i++) {
            const c = prices[i] - prices[i-1];
            avgG = ((avgG * (period-1)) + (c > 0 ? c : 0)) / period;
            avgL = ((avgL * (period-1)) + (c < 0 ? -c : 0)) / period;
            rsi.push(100 - (100 / (1 + avgG / (avgL || 1))));
        }
        return rsi;
    },

    calculateMACD(prices) {
        const e12 = this.calculateEMA(prices, 12), e26 = this.calculateEMA(prices, 26);
        const macdL = [];
        for (let i = 0; i < prices.length; i++) {
            macdL.push(e12[i] !== null && e26[i] !== null ? e12[i] - e26[i] : null);
        }
        const valid = macdL.filter(v => v !== null);
        const sigL = valid.length >= 9 ? this.calculateEMA(valid, 9) : [];
        const m = valid[valid.length-1] || 0, s = sigL[sigL.length-1] || 0;
        return { macd: m, signal: s, histogram: m - s };
    },

    calculateATR(candles, period = 14) {
        const h = candles.map(c => Number(c[2])), l = candles.map(c => Number(c[3])), cl = candles.map(c => Number(c[4]));
        const tr = [];
        for (let i = 1; i < h.length; i++) {
            tr.push(Math.max(h[i]-l[i], Math.abs(h[i]-cl[i-1]), Math.abs(l[i]-cl[i-1])));
        }
        return tr.length >= period ? tr.slice(-period).reduce((a,b) => a+b,0) / period : tr.reduce((a,b) => a+b,0) / tr.length;
    },

    findSupportResistance(prices) {
        const recent = prices.slice(-50);
        const highs = [], lows = [];
        for (let i = 3; i < recent.length - 3; i++) {
            if (recent[i] > recent[i-1] && recent[i] > recent[i-2] && recent[i] > recent[i-3] &&
                recent[i] > recent[i+1] && recent[i] > recent[i+2] && recent[i] > recent[i+3]) highs.push(recent[i]);
            if (recent[i] < recent[i-1] && recent[i] < recent[i-2] && recent[i] < recent[i-3] &&
                recent[i] < recent[i+1] && recent[i] < recent[i+2] && recent[i] < recent[i+3]) lows.push(recent[i]);
        }
        return {
            resistance: highs.length > 0 ? highs.reduce((a,b) => a+b, 0) / highs.length : prices[prices.length-1] * 1.02,
            support: lows.length > 0 ? lows.reduce((a,b) => a+b, 0) / lows.length : prices[prices.length-1] * 0.98
        };
    },

    formatNumber(num) {
        if (!num || num === 0) return "0";
        const n = Number(num);
        if (n >= 1e9) return (n/1e9).toFixed(2) + "B";
        if (n >= 1e6) return (n/1e6).toFixed(2) + "M";
        if (n >= 1e3) return (n/1e3).toFixed(2) + "K";
        return n.toFixed(2);
    },

    showAlert(msg) {
        const box = document.getElementById("alertBox");
        box.textContent = msg;
        box.style.display = "block";
        setTimeout(() => box.style.display = "none", 5000);
    }
};

document.addEventListener("DOMContentLoaded", () => CoinMonitor.init());