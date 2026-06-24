// analysis.js
// Advanced Technical Analysis Engine

const AnalysisEngine = {

    // ==========================
    // Extract Closing Prices
    // ==========================
    getCloses(candles) {
        return candles.map(candle => Number(candle[4]));
    },

    // ==========================
    // Extract Volumes
    // ==========================
    getVolumes(candles) {
        return candles.map(candle => Number(candle[5]));
    },

    // ==========================
    // EMA
    // ==========================
    calculateEMA(prices, period) {

        if (prices.length < period) return [];

        const multiplier = 2 / (period + 1);

        let ema = [];

        const sma =
            prices.slice(0, period)
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

        for (let i = prices.length - period; i < prices.length; i++) {

            const diff =
                prices[i] - prices[i - 1];

            if (diff > 0)
                gains += diff;
            else
                losses += Math.abs(diff);
        }

        if (losses === 0)
            return 100;

        const rs = gains / losses;

        return Number(
            (100 - (100 / (1 + rs)))
            .toFixed(2)
        );
    },

    // ==========================
    // Average Volume
    // ==========================
    averageVolume(volumes, period = 20) {

        if (volumes.length < period)
            return 0;

        const slice =
            volumes.slice(-period);

        return (
            slice.reduce((a, b) => a + b, 0)
            / period
        );
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

        if (!ema20 || !ema50 || !ema200)
            return "UNKNOWN";

        if (
            ema20 > ema50 &&
            ema50 > ema200
        ) {
            return "STRONG BULLISH";
        }

        if (
            ema20 < ema50 &&
            ema50 < ema200
        ) {
            return "STRONG BEARISH";
        }

        if (ema20 > ema50)
            return "BULLISH";

        if (ema20 < ema50)
            return "BEARISH";

        return "SIDEWAYS";
    },

    // ==========================
    // Advanced Signal Generator
    // ==========================
    generateSignal(prices, volumes = []) {

        const currentPrice =
            prices.at(-1);

        const ema20 =
            this.calculateEMA(prices, 20).at(-1);

        const ema50 =
            this.calculateEMA(prices, 50).at(-1);

        const ema200 =
            this.calculateEMA(prices, 200).at(-1);

        const rsi =
            this.calculateRSI(prices);

        let score = 0;

        const reasons = [];

        // EMA Trend

        if (ema20 > ema50) {
            score += 20;
            reasons.push("EMA20 > EMA50");
        }

        if (ema50 > ema200) {
            score += 20;
            reasons.push("EMA50 > EMA200");
        }

        if (currentPrice > ema20) {
            score += 15;
            reasons.push("Price Above EMA20");
        }

        // RSI

        if (
            rsi >= 50 &&
            rsi <= 70
        ) {
            score += 20;
            reasons.push("Healthy RSI");
        }

        if (rsi < 30) {
            score += 15;
            reasons.push("Oversold");
        }

        if (rsi > 75) {
            score -= 15;
            reasons.push("Overbought");
        }

        // Volume Confirmation

        if (volumes.length > 20) {

            const avgVol =
                this.averageVolume(
                    volumes,
                    20
                );

            const currentVol =
                volumes.at(-1);

            if (
                currentVol >
                avgVol * 1.4
            ) {

                score += 25;

                reasons.push(
                    "Volume Spike"
                );
            }
        }

        let signal = "HOLD";

        if (score >= 80) {
            signal = "STRONG BUY";
        }

        else if (score >= 60) {
            signal = "BUY";
        }

        else if (score <= 20) {
            signal = "SELL";
        }

        let stopLoss;
        let takeProfit;
        let riskReward;

        if (
            signal === "BUY" ||
            signal === "STRONG BUY"
        ) {

            stopLoss =
                currentPrice * 0.985;

            takeProfit =
                currentPrice * 1.03;

            riskReward =
                (
                    (takeProfit - currentPrice)
                    /
                    (currentPrice - stopLoss)
                ).toFixed(2);
        }

        else {

            stopLoss =
                currentPrice * 1.015;

            takeProfit =
                currentPrice * 0.97;

            riskReward =
                (
                    (currentPrice - takeProfit)
                    /
                    (stopLoss - currentPrice)
                ).toFixed(2);
        }

        return {

            signal,

            confidence:
                Math.min(score, 100),

            score,

            reasons,

            trend:
                this.determineTrend(
                    prices
                ),

            currentPrice:
                Number(
                    currentPrice.toFixed(4)
                ),

            rsi,

            ema20:
                Number(
                    ema20?.toFixed(4)
                ),

            ema50:
                Number(
                    ema50?.toFixed(4)
                ),

            ema200:
                Number(
                    ema200?.toFixed(4)
                ),

            entry:
                Number(
                    currentPrice.toFixed(4)
                ),

            stopLoss:
                Number(
                    stopLoss.toFixed(4)
                ),

            takeProfit:
                Number(
                    takeProfit.toFixed(4)
                ),

            riskReward:
                Number(riskReward)

        };
    }

};

// Example:
// const closes = AnalysisEngine.getCloses(candles);
// const volumes = AnalysisEngine.getVolumes(candles);
// const signal = AnalysisEngine.generateSignal(closes, volumes);