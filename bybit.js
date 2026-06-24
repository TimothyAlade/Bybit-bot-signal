// bybit.js
// Production Bybit API Service

const BybitAPI = {

    BASE_URL: "https://api.bybit.com",

    CACHE: new Map(),

    CACHE_DURATION: 30000,

    // ==========================
    // Generic Request
    // ==========================

    async request(endpoint, retries = 2) {

        const cacheKey = endpoint;

        const cached =
            this.CACHE.get(cacheKey);

        if (
            cached &&
            Date.now() - cached.timestamp <
                this.CACHE_DURATION
        ) {
            return cached.data;
        }

        for (
            let attempt = 0;
            attempt <= retries;
            attempt++
        ) {

            try {

                const controller =
                    new AbortController();

                const timeout =
                    setTimeout(
                        () =>
                            controller.abort(),
                        10000
                    );

                const response =
                    await fetch(
                        `${this.BASE_URL}${endpoint}`,
                        {
                            signal:
                                controller.signal
                        }
                    );

                clearTimeout(timeout);

                if (!response.ok) {

                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }

                const data =
                    await response.json();

                if (
                    data.retCode !== 0
                ) {

                    throw new Error(
                        data.retMsg ||
                        "Unknown Bybit Error"
                    );
                }

                this.CACHE.set(
                    cacheKey,
                    {
                        timestamp:
                            Date.now(),
                        data
                    }
                );

                return data;

            } catch (error) {

                console.warn(
                    `Bybit Retry ${
                        attempt + 1
                    }`,
                    error.message
                );

                if (
                    attempt === retries
                ) {

                    throw error;
                }

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            1000 *
                                (attempt + 1)
                        )
                );
            }
        }
    },

    // ==========================
    // Spot Tickers
    // ==========================

    async getSpotTickers() {

        try {

            const data =
                await this.request(
                    "/v5/market/tickers?category=spot"
                );

            return (
                data.result?.list ||
                []
            );

        } catch (error) {

            console.error(
                "Spot Ticker Error:",
                error
            );

            return [];
        }
    },

    // ==========================
    // Futures Tickers
    // ==========================

    async getFuturesTickers() {

        try {

            const data =
                await this.request(
                    "/v5/market/tickers?category=linear"
                );

            return (
                data.result?.list ||
                []
            );

        } catch (error) {

            console.error(
                "Futures Ticker Error:",
                error
            );

            return [];
        }
    },

    // ==========================
    // Candles
    // ==========================

    async getCandles(
        symbol,
        market = "linear",
        interval = "60",
        limit = 200
    ) {

        try {

            const data =
                await this.request(
                    `/v5/market/kline?category=${market}&symbol=${symbol}&interval=${interval}&limit=${limit}`
                );

            return (
                data.result?.list?.reverse() ||
                []
            );

        } catch (error) {

            console.error(
                `Kline Error ${symbol}:`,
                error
            );

            return [];
        }
    },

    // ==========================
    // Open Interest
    // ==========================

    async getOpenInterest(
        symbol
    ) {

        try {

            const data =
                await this.request(
                    `/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=5min`
                );

            return (
                data.result?.list?.[0] ||
                null
            );

        } catch (error) {

            console.error(
                "Open Interest Error:",
                error
            );

            return null;
        }
    },

    // ==========================
    // Funding Rate
    // ==========================

    async getFundingRate(
        symbol
    ) {

        try {

            const data =
                await this.request(
                    `/v5/market/funding/history?category=linear&symbol=${symbol}&limit=1`
                );

            return (
                data.result?.list?.[0] ||
                null
            );

        } catch (error) {

            console.error(
                "Funding Rate Error:",
                error
            );

            return null;
        }
    },

    // ==========================
    // Market Overview
    // ==========================

    async getMarketData(
        symbol
    ) {

        try {

            const [
                funding,
                oi
            ] = await Promise.all([
                this.getFundingRate(
                    symbol
                ),
                this.getOpenInterest(
                    symbol
                )
            ]);

            return {

                fundingRate:
                    funding?.fundingRate ||
                    "0",

                openInterest:
                    oi?.openInterest ||
                    "0"
            };

        } catch {

            return {

                fundingRate: "0",

                openInterest: "0"
            };
        }
    },

    // ==========================
    // Top Coins
    // ==========================

    async getTopCoins(
        market = "futures",
        limit = 20
    ) {

        let coins = [];

        if (
            market === "spot"
        ) {

            coins =
                await this.getSpotTickers();

        } else {

            coins =
                await this.getFuturesTickers();
        }

        return coins
            .filter(
                coin =>
                    Number(
                        coin.turnover24h
                    ) > 0
            )
            .sort(
                (a, b) =>
                    Number(
                        b.turnover24h
                    ) -
                    Number(
                        a.turnover24h
                    )
            )
            .slice(0, limit);
    },

    // ==========================
    // Top Movers
    // ==========================

    async getTopMovers(
        market = "futures",
        limit = 10
    ) {

        let coins = [];

        if (
            market === "spot"
        ) {

            coins =
                await this.getSpotTickers();

        } else {

            coins =
                await this.getFuturesTickers();
        }

        return coins
            .sort(
                (a, b) =>
                    Math.abs(
                        Number(
                            b.price24hPcnt
                        )
                    ) -
                    Math.abs(
                        Number(
                            a.price24hPcnt
                        )
                    )
            )
            .slice(0, limit);
    },

    // ==========================
    // Health Check
    // ==========================

    async testConnection() {

        try {

            const coins =
                await this.getTopCoins(
                    "futures",
                    5
                );

            console.table(
                coins.map(c => ({
                    Symbol:
                        c.symbol,
                    Price:
                        c.lastPrice,
                    Change:
                        c.price24hPcnt
                }))
            );

            return true;

        } catch (error) {

            console.error(
                "Bybit Connection Failed",
                error
            );

            return false;
        }
    }
};

window.BybitAPI = BybitAPI;