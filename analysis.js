// analysis.js
// Professional Grade Analysis Engine

const AnalysisEngine = {
    CONFIG: {
        MIN_CANDLES: 200,
        EMA_FAST: 9,
        EMA_MID: 21,
        EMA_SLOW: 50,
        EMA_LONG: 200,
        RSI_PERIOD: 14,
        ATR_PERIOD: 14,
        MACD_FAST: 12,
        MACD_SLOW: 26,
        MACD_SIGNAL: 9,
        BB_PERIOD: 20,
        BB_STD: 2,
        VOLUME_MA: 20
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

    getOpens(candles) {
        return Array.isArray(candles) ? candles.map(c => this.toNumber(c[1])) : [];
    },

    calculateSMA(prices, period) {
        if (!prices || prices.length < period) return [];
        const sma = [];
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    },

    calculateEMA(prices, period) {
        if (!prices || prices.length < period) return [];
        const ema = [];
        const multiplier = 2 / (period + 1);
        const firstEMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        ema.push(firstEMA);
        for (let i = period; i < prices.length; i++) {
            const next = ((prices[i] - ema[ema.length - 1]) * multiplier) + ema[ema.length - 1];
            ema.push(next);
        }
        return ema;
    },

    calculateRSI(prices, period = 14) {
        if (!prices || prices.length < period + 1) return 50;
        
        let gains = 0, losses = 0;
        
        // Calculate initial average gain/loss
        for (let i = 1; i <= period; i++) {
            const change = prices[prices.length - period - 1 + i] - prices[prices.length - period - 2 + i];
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        // Use smoothed RSI for remaining periods
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

    // FIX 1: ATR for dynamic stop loss
    calculateATR(candles, period = 14) {
        const highs = this.getHighs(candles);
        const lows = this.getLows(candles);
        const closes = this.getCloses(candles);
        
        if (highs.length < period + 1) return 0;
        
        const trValues = [];
        for (let i = 1; i < highs.length; i++) {
            const high = highs[i];
            const low = lows[i];
            const prevClose = closes[i - 1];
            
            const tr1 = high - low;
            const tr2 = Math.abs(high - prevClose);
            const tr3 = Math.abs(low - prevClose);
            
            trValues.push(Math.max(tr1, tr2, tr3));
        }
        
        const atr = trValues.slice(-period).reduce((a, b) => a + b, 0) / period;
        return this.toNumber(atr);
    },

    // FIX 2: MACD for trend confirmation
    calculateMACD(prices) {
        if (!prices || prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
        
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        
        if (!ema12.length || !ema26.length) return { macd: 0, signal: 0, histogram: 0 };
        
        // Calculate MACD line
        const macdLine = [];
        const minLength = Math.min(ema12.length, ema26.length);
        for (let i = 0; i < minLength; i++) {
            macdLine.push(ema12[ema12.length - minLength + i] - ema26[ema26.length - minLength + i]);
        }
        
        // Calculate Signal line (9-period EMA of MACD)
        const signalLine = this.calculateEMA(macdLine, 9);
        
        const macd = macdLine[macdLine.length - 1] || 0;
        const signal = signalLine[signalLine.length - 1] || 0;
        const histogram = macd - signal;
        
        return { macd, signal, histogram };
    },

    // FIX 3: Bollinger Bands for volatility
    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        if (!prices || prices.length < period) {
            return { upper: 0, middle: 0, lower: 0, width: 0, position: 0 };
        }
        
        const sma = this.calculateSMA(prices, period);
        const middle = sma[sma.length - 1];
        
        const recentPrices = prices.slice(-period);
        const mean = recentPrices.reduce((a, b) => a + b, 0) / period;
        
        const squaredDiffs = recentPrices.map(p => Math.pow(p - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const std = Math.sqrt(variance);
        
        const upper = middle + (stdDev * std);
        const lower = middle - (stdDev * std);
        const width = ((upper - lower) / middle) * 100;
        const position = ((prices[prices.length - 1] - lower) / (upper - lower)) * 100;
        
        return { upper, middle, lower, width, position };
    },

    // FIX 4: Volume analysis with moving average
    calculateVolumeAnalysis(volumes) {
        if (!volumes || volumes.length < 20) return { strength: 1, trend: "NORMAL", spike: false };
        
        const recent = volumes.slice(-5);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / 5;
        
        const all = volumes.slice(-20);
        const avg20 = all.reduce((a, b) => a + b, 0) / 20;
        
        const strength = recentAvg / avg20;
        
        let trend = "NORMAL";
        if (strength > 2) trend = "EXTREME";
        else if (strength > 1.5) trend = "HIGH";
        else if (strength < 0.5) trend = "LOW";
        
        const spike = strength > 2.5;
        
        return { strength: Number(strength.toFixed(2)), trend, spike };
    },

    // FIX 5: Support/Resistance levels
    findSupportResistance(prices, period = 50) {
        if (!prices || prices.length < period) return { support: 0, resistance: 0 };
        
        const recent = prices.slice(-period);
        const highs = [];
        const lows = [];
        
        for (let i = 5; i < recent.length - 5; i++) {
            const current = recent[i];
            
            // Check for swing high
            let isHigh = true;
            for (let j = 1; j <= 5; j++) {
                if (recent[i - j] >= current || recent[i + j] >= current) {
                    isHigh = false;
                    break;
                }
            }
            if (isHigh) highs.push(current);
            
            // Check for swing low
            let isLow = true;
            for (let j = 1; j <= 5; j++) {
                if (recent[i - j] <= current || recent[i + j] <= current) {
                    isLow = false;
                    break;
                }
            }
            if (isLow) lows.push(current);
        }
        
        const resistance = highs.length > 0 ? highs.reduce((a, b) => a + b, 0) / highs.length : prices[prices.length - 1] * 1.05;
        const support = lows.length > 0 ? lows.reduce((a, b) => a + b, 0) / lows.length : prices[prices.length - 1] * 0.95;
        
        return { 
            support: Number(support.toFixed(2)), 
            resistance: Number(resistance.toFixed(2)) 
        };
    },

    // FIX 6: Market Regime Detection
    detectMarketRegime(prices) {
        if (!prices || prices.length < 200) return "UNKNOWN";
        
        const ema20 = this.calculateEMA(prices, 20);
        const ema50 = this.calculateEMA(prices, 50);
        const ema200 = this.calculateEMA(prices, 200);
        const atr = this.calculateATR(prices.map((p, i) => [0, p, p, p, p, 0]));
        const currentPrice = prices[prices.length - 1];
        
        const last20 = ema20[ema20.length - 1];
        const last50 = ema50[ema50.length - 1];
        const last200 = ema200[ema200.length - 1];
        
        // Check for sideways market
        const spread50 = Math.abs(last20 - last50) / last50;
        const spread200 = Math.abs(last20 - last200) / last200;
        
        if (spread50 < 0.005 && spread200 < 0.01) return "SIDEWAYS";
        
        // Check for strong trend
        if (last20 > last50 && last50 > last200 && spread200 > 0.03) return "STRONG_BULLISH";
        if (last20 < last50 && last50 < last200 && spread200 > 0.03) return "STRONG_BEARISH";
        
        // Check for weak trend
        if (last20 > last50 && last50 > last200) return "WEAK_BULLISH";
        if (last20 < last50 && last50 < last200) return "WEAK_BEARISH";
        
        // Check for volatility
        if (atr / currentPrice > 0.05) return "HIGH_VOLATILITY";
        
        return "TRENDING";
    },

    // FIX 7: Comprehensive risk score
    calculateRiskScore(prices, rsi, volumeData, bb) {
        let riskScore = 0;
        const risks = [];
        
        // RSI extremes
        if (rsi > 75 || rsi < 25) {
            riskScore += 30;
            risks.push("RSI Extreme");
        }
        
        // Low volume
        if (volumeData.strength < 0.7) {
            riskScore += 20;
            risks.push("Low Volume");
        }
        
        // Bollinger squeeze
        if (bb.width < 3) {
            riskScore += 15;
            risks.push("BB Squeeze");
        }
        
        // Wide Bollinger Bands
        if (bb.width > 10) {
            riskScore += 15;
            risks.push("High Volatility");
        }
        
        // Price at extremes
        if (bb.position > 90 || bb.position < 10) {
            riskScore += 20;
            risks.push("Price Extreme");
        }
        
        return { score: Math.min(riskScore, 100), risks };
    },

    // FIX 8: Main signal generator with all improvements
    generateSignal(candles) {
        if (!candles || candles.length < 200) {
            console.log("Need at least 200 candles, got:", candles?.length);
            return null;
        }

        const prices = this.getCloses(candles);
        const highs = this.getHighs(candles);
        const lows = this.getLows(candles);
        const volumes = this.getVolumes(candles);
        const opens = this.getOpens(candles);
        
        const currentPrice = prices[prices.length - 1];
        const atr = this.calculateATR(candles);
        
        // Calculate all indicators
        const rsi = this.calculateRSI(prices);
        const macdData = this.calculateMACD(prices);
        const bb = this.calculateBollingerBands(prices);
        const volumeData = this.calculateVolumeAnalysis(volumes);
        const sr = this.findSupportResistance(prices);
        const regime = this.detectMarketRegime(prices);
        const riskData = this.calculateRiskScore(prices, rsi, volumeData, bb);
        
        // Market regime filter - Don't trade in sideways markets
        if (regime === "SIDEWAYS" || regime === "UNKNOWN") {
            console.log("Market regime:", regime, "- skipping");
            return null;
        }
        
        // High risk filter
        if (riskData.score > 60) {
            console.log("Risk too high:", riskData.score, riskData.risks);
            return null;
        }

        const ema20 = this.calculateEMA(prices, 20);
        const ema50 = this.calculateEMA(prices, 50);
        const ema200 = this.calculateEMA(prices, 200);
        
        let buyScore = 0;
        let sellScore = 0;
        const reasons = [];

        // === BUY CONDITIONS ===
        
        // Trend alignment (30 points)
        if (regime.includes("BULLISH")) {
            if (regime === "STRONG_BULLISH") {
                buyScore += 30;
                reasons.push("Strong Bullish Trend");
            } else {
                buyScore += 20;
                reasons.push("Bullish Trend");
            }
        }
        
        // EMA alignment (20 points)
        if (ema20[ema20.length - 1] > ema50[ema50.length - 1] && 
            ema50[ema50.length - 1] > ema200[ema200.length - 1]) {
            buyScore += 20;
            reasons.push("EMA Bullish Alignment");
        } else if (ema20[ema20.length - 1] > ema50[ema50.length - 1]) {
            buyScore += 10;
            reasons.push("Short-term EMA Bullish");
        }
        
        // RSI healthy zone (15 points)
        if (rsi >= 45 && rsi <= 65) {
            buyScore += 15;
            reasons.push("RSI Healthy (" + rsi + ")");
        } else if (rsi >= 40 && rsi <= 70) {
            buyScore += 8;
            reasons.push("RSI Acceptable (" + rsi + ")");
        }
        
        // MACD confirmation (15 points)
        if (macdData.histogram > 0 && macdData.macd > macdData.signal) {
            buyScore += 15;
            reasons.push("MACD Bullish");
        } else if (macdData.histogram > 0) {
            buyScore += 8;
            reasons.push("MACD Slightly Bullish");
        }
        
        // Bollinger Bands position (10 points)
        if (bb.position >= 30 && bb.position <= 70) {
            buyScore += 10;
            reasons.push("BB Mid-Range (Safe Entry)");
        }
        
        // Volume confirmation (10 points)
        if (volumeData.strength >= 1.2 && !volumeData.spike) {
            buyScore += 10;
            reasons.push("Healthy Volume");
        }

        // === SELL CONDITIONS ===
        
        // Trend alignment (30 points)
        if (regime.includes("BEARISH")) {
            if (regime === "STRONG_BEARISH") {
                sellScore += 30;
            } else {
                sellScore += 20;
            }
        }
        
        // EMA alignment (20 points)
        if (ema20[ema20.length - 1] < ema50[ema50.length - 1] && 
            ema50[ema50.length - 1] < ema200[ema200.length - 1]) {
            sellScore += 20;
        } else if (ema20[ema20.length - 1] < ema50[ema50.length - 1]) {
            sellScore += 10;
        }
        
        // RSI healthy zone for shorts (15 points)
        if (rsi >= 35 && rsi <= 55) {
            sellScore += 15;
        }
        
        // MACD confirmation (15 points)
        if (macdData.histogram < 0 && macdData.macd < macdData.signal) {
            sellScore += 15;
        }
        
        // Bollinger Bands position (10 points)
        if (bb.position >= 30 && bb.position <= 70) {
            sellScore += 10;
        }
        
        // Volume confirmation (10 points)
        if (volumeData.strength >= 1.2 && !volumeData.spike) {
            sellScore += 10;
        }
        
        // Determine signal
        let signal = null;
        let confidence = 0;
        
        if (buyScore >= 65 && buyScore > sellScore) {
            signal = "BUY";
            confidence = buyScore;
        } else if (sellScore >= 65 && sellScore > sellScore) {
            signal = "SELL";
            confidence = sellScore;
        }
        
        if (!signal) return null;
        
        // === DYNAMIC RISK MANAGEMENT ===
        
        // ATR-based stop loss (1.5x ATR)
        const atrStop = atr * 1.5;
        
        // Support/Resistance based stop loss
        const srStop = signal === "BUY" 
            ? Math.min(currentPrice - atrStop, sr.support * 0.99)
            : Math.max(currentPrice + atrStop, sr.resistance * 1.01);
        
        // Fixed percentage stop as backup (2%)
        const percentStop = signal === "BUY" 
            ? currentPrice * 0.98 
            : currentPrice * 1.02;
        
        // Use the tighter stop loss
        const stopLoss = signal === "BUY"
            ? Math.max(srStop, percentStop) // For longs, stop shouldn't be too tight
            : Math.min(srStop, percentStop); // For shorts, stop shouldn't be too loose
        
        // Dynamic take profit based on ATR (Risk:Reward 1:2 minimum)
        const riskAmount = Math.abs(currentPrice - stopLoss);
        const takeProfit = signal === "BUY"
            ? currentPrice + (riskAmount * 2)
            : currentPrice - (riskAmount * 2);
        
        // Adjust position size based on risk score
        const positionMultiplier = 1 - (riskData.score / 200); // Lower position size with higher risk
        
        return {
            signal,
            confidence,
            currentPrice: Number(currentPrice.toFixed(4)),
            entry: Number(currentPrice.toFixed(4)),
            stopLoss: Number(stopLoss.toFixed(4)),
            takeProfit: Number(takeProfit.toFixed(4)),
            rsi,
            macd: Number(macdData.macd.toFixed(4)),
            macdSignal: Number(macdData.signal.toFixed(4)),
            macdHistogram: Number(macdData.histogram.toFixed(4)),
            bbUpper: Number(bb.upper.toFixed(4)),
            bbLower: Number(bb.lower.toFixed(4)),
            bbPosition: Number(bb.position.toFixed(1)),
            volumeStrength: volumeData.strength,
            volumeTrend: volumeData.trend,
            atr: Number(atr.toFixed(4)),
            regime,
            riskScore: riskData.score,
            riskFactors: riskData.risks,
            support: sr.support,
            resistance: sr.resistance,
            positionMultiplier: Number(positionMultiplier.toFixed(2)),
            reasons
        };
    }
};

window.AnalysisEngine = AnalysisEngine;
console.log("✅ Upgraded Analysis Engine Loaded");