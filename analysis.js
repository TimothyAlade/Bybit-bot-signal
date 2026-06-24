// analysis.js
// High Confidence Trading Analysis Engine

const AnalysisEngine = {

    // ==========================
    // Extract Prices
    // ==========================

    getCloses(candles) {
        return candles.map(c => Number(c[4]));
    },

    getVolumes(candles) {
        return candles.map(c => Number(c[5]));
    },

    // ==========================
    // EMA
    // ==========================

    calculateEMA(prices, period) {

        if (prices.length < period) return [];

        const multiplier = 2 / (period + 1);

        let ema = [];

        let sma =
            prices
            .slice(0, period)
            .reduce((a, b) => a + b, 0) / period;

        ema[period - 1] = sma;

        for (let i = period; i < prices.length; i++) {

            ema[i] =
                ((prices[i] - ema[i - 1]) * multiplier)
                + ema[i - 1];
        }

        return ema.filter(Boolean);
    },

    // ==========================
    // RSI
    // ==========================

    calculateRSI(prices, period = 14) {

        if (prices.length < period + 1)
            return 50;

        let gains = 0;
        let losses = 0;

        for (
            let i = prices.length - period;
            i < prices.length;
            i++
        ) {

            const diff =
                prices[i] -
                prices[i - 1];

            if (diff > 0) {
                gains += diff;
            } else {
                losses += Math.abs(diff);
            }
        }

        const avgGain =
            gains / period;

        const avgLoss =
            losses / period;

        if (avgLoss === 0)
            return 100;

        const rs =
            avgGain / avgLoss;

        return Number(
            (
                100 -
                (100 / (1 + rs))
            ).toFixed(2)
        );
    },

    // ==========================
    // Volume Strength
    // ==========================

    calculateVolumeStrength(volumes) {

        if (volumes.length < 21)
            return 1;

        const currentVolume =
            volumes[volumes.length - 1];

        const averageVolume =
            volumes
            .slice(-21, -1)
            .reduce((a, b) => a + b, 0) / 20;

        return currentVolume / averageVolume;
    },

    // ==========================
    // Trend
    // ==========================

    determineTrend(prices) {

        const ema20 =
            this.calculateEMA(prices, 20).at(-1);

        const ema50 =
            this.calculateEMA(prices, 50).at(-1);

        const ema200 =
            this.calculateEMA(prices, 200).at(-1);

        if (
            !ema20 ||
            !ema50 ||
            !ema200
        ) {
            return "UNKNOWN";
        }

        if (
            ema20 > ema50 &&
            ema50 > ema200
        ) {
            return "BULLISH";
        }

        if (
            ema20 < ema50 &&
            ema50 < ema200
        ) {
            return "BEARISH";
        }

        return "SIDEWAYS";
    },

    // ==========================
    // Signal Generator
    // ==========================

    generateSignal(candles) {

        const prices =
            this.getCloses(candles);

        const volumes =
            this.getVolumes(candles);

        if (prices.length < 200)
            return null;

        const currentPrice =
            prices.at(-1);

        const previousPrice =
            prices.at(-2);

        const ema20 =
            this.calculateEMA(prices, 20).at(-1);

        const ema50 =
            this.calculateEMA(prices, 50).at(-1);

        const ema200 =
            this.calculateEMA(prices, 200).at(-1);

        const rsi =
            this.calculateRSI(prices);

        const trend =
            this.determineTrend(prices);

        const volumeStrength =
            this.calculateVolumeStrength(volumes);

        let buyScore = 0;
        let sellScore = 0;

        const reasons = [];

        // ==========================
        // BUY SCORE
        // ==========================

        if (trend === "BULLISH") {
            buyScore += 30;
            reasons.push("Bull Trend");
        }

        if (
            currentPrice > ema20 &&
            ema20 > ema50
        ) {
            buyScore += 20;
            reasons.push("EMA Alignment");
        }

        if (
            rsi >= 50 &&
            rsi <= 65
        ) {
            buyScore += 20;
            reasons.push("Healthy RSI");
        }

        if (
            volumeStrength >= 1.5
        ) {
            buyScore += 20;
            reasons.push("Volume Spike");
        }

        if (
            currentPrice >
            previousPrice
        ) {
            buyScore += 10;
            reasons.push("Momentum");
        }

        // ==========================
        // SELL SCORE
        // ==========================

        if (trend === "BEARISH") {
            sellScore += 30;
        }

        if (
            currentPrice < ema20 &&
            ema20 < ema50
        ) {
            sellScore += 20;
        }

        if (
            rsi >= 35 &&
            rsi <= 50
        ) {
            sellScore += 20;
        }

        if (
            volumeStrength >= 1.5
        ) {
            sellScore += 20;
        }

        if (
            currentPrice <
            previousPrice
        ) {
            sellScore += 10;
        }

        let signal = null;
        let confidence = 0;

        if (
            buyScore >= 70 &&
            buyScore > sellScore
        ) {

            signal = "BUY";
            confidence = buyScore;

        } else if (
            sellScore >= 70 &&
            sellScore > buyScore
        ) {

            signal = "SELL";
            confidence = sellScore;
        }

        // Hard Filter

        if (!signal)
            return null;

        const stopLoss =
            signal === "BUY"
                ? currentPrice * 0.98
                : currentPrice * 1.02;

        const takeProfit =
            signal === "BUY"
                ? currentPrice * 1.05
                : currentPrice * 0.95;

        return {

            signal,

            confidence,

            trend,

            currentPrice:
                Number(
                    currentPrice.toFixed(4)
                ),

            entry:
                Number(
                    currentPrice.toFixed(4)
                ),

            takeProfit:
                Number(
                    takeProfit.toFixed(4)
                ),

            stopLoss:
                Number(
                    stopLoss.toFixed(4)
                ),

            ema20:
                Number(
                    ema20.toFixed(4)
                ),

            ema50:
                Number(
                    ema50.toFixed(4)
                ),

            ema200:
                Number(
                    ema200.toFixed(4)
                ),

            rsi,

            volumeStrength:
                Number(
                    volumeStrength.toFixed(2)
                ),

            reasons
        };
    }
};

window.AnalysisEngine = AnalysisEngine;