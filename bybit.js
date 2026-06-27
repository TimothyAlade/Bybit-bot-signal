// bybit.js
const BybitAPI = {
    BASE_URL: "https://api.bybit.com",
    CACHE: new Map(),
    CACHE_TIME: 30000,

    async request(endpoint) {
        const cache = this.CACHE.get(endpoint);
        if (cache && Date.now() - cache.time < this.CACHE_TIME) {
            return cache.data;
        }

        try {
            const response = await fetch(`${this.BASE_URL}${endpoint}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            if (json.retCode !== 0) throw new Error(json.retMsg || "API Error");
            
            this.CACHE.set(endpoint, { time: Date.now(), data: json });
            return json;
        } catch (error) {
            console.error("Bybit Request Error:", error);
            return null;
        }
    },

    async getSpotTickers() {
        const data = await this.request("/v5/market/tickers?category=spot");
        return data?.result?.list || [];
    },

    async getFuturesTickers() {
        const data = await this.request("/v5/market/tickers?category=linear");
        return data?.result?.list || [];
    },

    async getTopCoins(market = "futures", limit = 20) {
        let coins = [];
        if (market === "spot") {
            coins = await this.getSpotTickers();
        } else {
            coins = await this.getFuturesTickers();
        }

        if (!coins.length) return [];

        return coins
            .filter(coin => Number(coin.turnover24h) > 0)
            .sort((a, b) => Number(b.turnover24h) - Number(a.turnover24h))
            .slice(0, limit);
    },

    async getCandles(symbol, category = "linear", interval = "60", limit = 200) {
        const data = await this.request(
            `/v5/market/kline?category=${category}&symbol=${symbol}&interval=${interval}&limit=${limit}`
        );
        if (!data || !data.result || !data.result.list) return [];
        return data.result.list.reverse();
    },

    async getMarketData(symbol) {
        try {
            const [funding, openInterest] = await Promise.all([
                this.request(`/v5/market/funding/history?category=linear&symbol=${symbol}&limit=1`),
                this.request(`/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=5min`)
            ]);

            return {
                fundingRate: funding?.result?.list?.[0]?.fundingRate || 0,
                openInterest: openInterest?.result?.list?.[0]?.openInterest || 0
            };
        } catch {
            return { fundingRate: 0, openInterest: 0 };
        }
    }
};

window.BybitAPI = BybitAPI;