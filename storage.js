// storage.js
const StorageManager = {
    VERSION: "2.0.0",
    MAX_SIGNALS: 300,
    MAX_TRADES: 500,
    MAX_EQUITY_POINTS: 500,

    isAvailable() {
        try {
            const key = "__storage_test__";
            localStorage.setItem(key, "1");
            localStorage.removeItem(key);
            return true;
        } catch {
            return false;
        }
    },

    save(key, value) {
        if (!this.isAvailable()) return false;
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Save Error (${key})`, error);
            return false;
        }
    },

    load(key, defaultValue = null) {
        if (!this.isAvailable()) return defaultValue;
        try {
            const value = localStorage.getItem(key);
            if (value === null || value === undefined) return defaultValue;
            return JSON.parse(value);
        } catch (error) {
            console.error(`Load Error (${key})`, error);
            return defaultValue;
        }
    },

    number(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    },

    array(value) {
        return Array.isArray(value) ? value : [];
    },

    object(value) {
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    },

    now() {
        return Date.now();
    },

    saveSignals(signals) {
        let list = this.array(signals);
        list = list.slice(-this.MAX_SIGNALS);
        return this.save("signals_history", list);
    },

    loadSignals() {
        return this.array(this.load("signals_history", []));
    },

    saveTrades(trades) {
        const cleaned = this.array(trades).slice(-this.MAX_TRADES);
        return this.save("paper_trades", cleaned);
    },

    loadTrades() {
        return this.array(this.load("paper_trades", []));
    },

    saveBalance(balance) {
        const safeBalance = this.number(balance, 10000);
        return this.save("paper_balance", safeBalance);
    },

    loadBalance() {
        const balance = this.load("paper_balance", 10000);
        return this.number(balance, 10000);
    },

    saveEquity(history) {
        const cleaned = this.array(history).slice(-this.MAX_EQUITY_POINTS);
        return this.save("equity_curve", cleaned);
    },

    loadEquity() {
        return this.array(this.load("equity_curve", []));
    },

    addEquityPoint(balance) {
        const history = this.loadEquity();
        history.push({
            balance: this.number(balance, 10000),
            timestamp: this.now()
        });
        return this.saveEquity(history);
    },

    saveSettings(settings) {
        return this.save("bot_settings", settings);
    },

    loadSettings() {
        return {
            market: "futures",
            riskPercent: 2,
            autoScan: true,
            scanInterval: 1,
            minConfidence: 70,
            ...this.object(this.load("bot_settings", {}))
        };
    },

    saveStats(stats) {
        return this.save("bot_stats", stats);
    },

    loadStats() {
        return {
            totalScans: 0,
            totalSignals: 0,
            lastScanTime: null,
            ...this.object(this.load("bot_stats", {}))
        };
    },

    init() {
        if (!this.exists("paper_balance")) {
            this.saveBalance(10000);
        }
        if (!this.exists("equity_curve")) {
            this.addEquityPoint(10000);
        }
        console.log("StorageManager Ready - Balance: $" + this.loadBalance());
    },

    exists(key) {
        return localStorage.getItem(key) !== null;
    }
};

window.StorageManager = StorageManager;