// analysis.js
// Safe Analysis Engine - Quality Over Quantity

const AnalysisEngine = {
    CONFIG: {
        MIN_CANDLES: 200,
        RSI_PERIOD: 14,
        MIN_CONFIDENCE: 70  // Hard minimum
    },

    toNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    },

    getCloses(candles) {
        return Array.isArray(candles) ? candles.map(c => this.toNumber(c[4])) : [];
    },

    getHighs(candles) {
        return Array.isArray(candles) ? candles.map(c => this.toNumber(c[2])) : [];
    },

    getLows(candles) {
        return Array.isArray(candles) ? candles.map(c => this.toNumber(c[3])) : [];
    },

    getVolumes(candles) {
        return Array.isArray(candles) ? candles.map(c => this.toNumber(c[5])) : [];
    },

    calculateEMA(prices, period) {
        if (!prices || prices.length < period) return [];
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
        if (!prices || prices.length < period + 1) return 50;
        
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = prices[prices.length - period - 1 + i] - prices[prices.length - period - 2 + i];
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        for (let i = prices.length - period; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
            }
        }
        
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return Number((100 - (100 / (1 + rs))).toFixed(2));
    },

    calculateMACD(prices) {
        if (!prices || prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
        
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
        
        return { macd: lastMACD, signal: lastSignal, histogram: lastMACD - lastSignal };
    },

    calculateATR(candles, period = 14) {
        const highs = this.getHighs(candles);
        const lows = this.getLows(candles);
        const closes = this.getCloses(candles);
        
        if (highs.length < 2) return 0;
        
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

    calculateVolumeStrength(volumes) {
        if (!volumes || volumes.length < 20) return 1;
        const recent = volumes.slice(-10);
        const previous = volumes.slice(-20, -10);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
        if (previousAvg === 0) return 1;
        return Number((recentAvg / previousAvg).toFixed(2));
    },

    findSupportResistance(prices) {
        if (!prices || prices.length < 50) {
            const p = prices[prices.length - 1];
            return { support: p * 0.98, resistance: p * 1.02 };
        }
        
        const recent = prices.slice(-50);
        const pivotHighs = [];
        const pivotLows = [];
        
        for (let i = 3; i < recent.length - 3; i++) {
            if (recent[i] > recent[i-1] && recent[i] > recent[i-2] && recent[i] > recent[i-3] &&
                recent[i] > recent[i+1] && recent[i] > recent[i+2] && recent[i] > recent[i+3]) {
                pivotHighs.push(recent[i]);
            }
            if (recent[i] < recent[i-1] && recent[i] < recent[i-2] && recent[i] < recent[i-3] &&
                recent[i] < recent[i+1] && recent[i] < recent[i+2] && recent[i] < recent[i+3]) {
                pivotLows.push(recent[i]);
            }
        }
        
        return {
            resistance: pivotHighs.length > 0 ? pivotHighs.reduce((a, b) => a + b, 0) / pivotHighs.length : prices[prices.length-1] * 1.02,
            support: pivotLows.length > 0 ? pivotLows.reduce((a, b) => a + b, 0) / pivotLows.length : prices[prices.length-1] * 0.98
        };
    },

    // ========================================
    // HIGH QUALITY SIGNAL GENERATOR
    // ========================================
    generateSignal(candles) {
        // STRICT requirements for quality
        if (!candles || candles.length < 200) {
            console.log("❌ Need 200 candles, got:", candles?.length || 0);
            return null;
        }

        const prices = this.getCloses(candles);
        const volumes = this.getVolumes(candles);
        
        if (prices.length < 200) return null;

        const currentPrice = prices[prices.length - 1];
        const previousPrice = prices[prices.length - 2];

        if (!currentPrice || currentPrice <= 0) return null;

        // Calculate ALL indicators for thorough analysis
        const ema20 = this.calculateEMA(prices, 20);
        const ema50 = this.calculateEMA(prices, 50);
        const ema200 = this.calculateEMA(prices, 200);
        const rsi = this.calculateRSI(prices);
        const macd = this.calculateMACD(prices);
        const atr = this.calculateATR(candles);
        const volumeStrength = this.calculateVolumeStrength(volumes);
        const sr = this.findSupportResistance(prices);

        if (!ema20.length || !ema50.length || !ema200.length) return null;

        const last20 = ema20[ema20.length - 1];
        const last50 = ema50[ema50.length - 1];
        const last200 = ema200[ema200.length - 1];

        if (last20 === null || last50 === null || last200 === null) return null;

        // Market regime check - Avoid sideways markets
        const trendSpread = Math.abs(last20 - last200) / last200;
        if (trendSpread < 0.02) {
            console.log("❌ Sideways market detected, skipping");
            return null;
        }

        let buyScore = 0;
        let sellScore = 0;
        const reasons = [];

        // ===== BUY CONDITIONS (Strict) =====
        
        // Strong EMA alignment (30 points max)
        if (last20 > last50 && last50 > last200) {
            buyScore += 30;
            reasons.push("Strong Bullish EMA Alignment");
        } else if (last20 > last50 && last20 > last200) {
            buyScore += 20;
            reasons.push("Bullish EMA Crossover");
        } else if (last20 > last50) {
            buyScore += 10;
            reasons.push("Short-term Bullish");
        } else {
            // No EMA alignment = no buy signal
            buyScore = -100;
        }
        
        // RSI in optimal zone (25 points)
        if (rsi >= 50 && rsi <= 60) {
            buyScore += 25;
            reasons.push("Optimal RSI (" + rsi.toFixed(0) + ")");
        } else if (rsi >= 45 && rsi <= 65) {
            buyScore += 15;
            reasons.push("Healthy RSI (" + rsi.toFixed(0) + ")");
        } else if (rsi > 70 || rsi < 30) {
            buyScore -= 20; // Penalty for extreme RSI
        }
        
        // MACD confirmation (20 points)
        if (macd.histogram > 0 && macd.macd > 0 && macd.macd > macd.signal) {
            buyScore += 20;
            reasons.push("MACD Strong Bullish");
        } else if (macd.histogram > 0) {
            buyScore += 10;
            reasons.push("MACD Bullish");
        }
        
        // Price position vs EMAs (10 points)
        if (currentPrice > last20) {
            buyScore += 10;
            reasons.push("Price Above EMA20");
        }
        
        // Volume confirmation (10 points)
        if (volumeStrength >= 1.3) {
            buyScore += 10;
            reasons.push("Strong Volume");
        } else if (volumeStrength < 0.7) {
            buyScore -= 10; // Penalty for low volume
        }
        
        // Momentum (5 points)
        if (currentPrice > previousPrice) {
            buyScore += 5;
        }

        // ===== SELL CONDITIONS (Strict) =====
        
        if (last20 < last50 && last50 < last200) {
            sellScore += 30;
        } else if (last20 < last50 && last20 < last200) {
            sellScore += 20;
        } else if (last20 < last50) {
            sellScore += 10;
        } else {
            sellScore = -100;
        }
        
        if (rsi >= 40 && rsi <= 50) {
            sellScore += 25;
        } else if (rsi >= 35 && rsi <= 55) {
            sellScore += 15;
        } else if (rsi > 70 || rsi < 30) {
            sellScore -= 20;
        }
        
        if (macd.histogram < 0 && macd.macd < 0 && macd.macd < macd.signal) {
            sellScore += 20;
        } else if (macd.histogram < 0) {
            sellScore += 10;
        }
        
        if (currentPrice < last20) {
            sellScore += 10;
        }
        
        if (volumeStrength >= 1.3) {
            sellScore += 10;
        } else if (volumeStrength < 0.7) {
            sellScore -= 10;
        }
        
        if (currentPrice < previousPrice) {
            sellScore += 5;
        }

        // STRICT confidence threshold
        let signal = null;
        let confidence = 0;

        if (buyScore >= 70 && buyScore > sellScore) {
            signal = "BUY";
            confidence = Math.min(buyScore, 95);
        } else if (sellScore >= 70 && sellScore > buyScore) {
            signal = "SELL";
            confidence = Math.min(sellScore, 95);
        }

        if (!signal) {
            console.log("❌ No quality signal (Buy:", buyScore, "Sell:", sellScore, ")");
            return null;
        }

        // Dynamic risk management
        const atrStop = atr > 0 ? atr * 2 : currentPrice * 0.02;
        const stopLoss = signal === "BUY"
            ? Math.max(currentPrice - atrStop, currentPrice * 0.97)
            : Math.min(currentPrice + atrStop, currentPrice * 1.03);

        const riskAmount = Math.abs(currentPrice - stopLoss);
        const takeProfit = signal === "BUY"
            ? currentPrice + (riskAmount * 2) // 1:2 risk-reward minimum
            : currentPrice - (riskAmount * 2);

        console.log("✅ Quality Signal:", signal, confidence + "%", reasons.slice(0, 3).join(", "));

        return {
            signal,
            confidence,
            currentPrice: Number(currentPrice.toFixed(4)),
            entry: Number(currentPrice.toFixed(4)),
            stopLoss: Number(stopLoss.toFixed(4)),
            takeProfit: Number(takeProfit.toFixed(4)),
            rsi: Number(rsi.toFixed(1)),
            volumeStrength: Number(volumeStrength.toFixed(2)),
            reasons
        };
    }
};

window.AnalysisEngine = AnalysisEngine;
console.log("✅ Safe Analysis Engine Loaded - Quality Over Quantity");