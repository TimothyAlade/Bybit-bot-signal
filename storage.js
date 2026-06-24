// storage.js
// Production Storage Manager

const StorageManager = {

    MAX_SIGNALS: 300,
    MAX_TRADES: 500,
    MAX_EQUITY_POINTS: 500,

    // ==========================
    // Generic Save
    // ==========================

    save(key, data) {

        try {

            localStorage.setItem(
                key,
                JSON.stringify(data)
            );

            return true;

        } catch (error) {

            console.error(
                `Storage Save Error (${key})`,
                error
            );

            return false;
        }
    },

    // ==========================
    // Generic Load
    // ==========================

    load(
        key,
        defaultValue = null
    ) {

        try {

            const item =
                localStorage.getItem(key);

            if (!item)
                return defaultValue;

            return JSON.parse(item);

        } catch (error) {

            console.error(
                `Storage Load Error (${key})`,
                error
            );

            return defaultValue;
        }
    },

    // ==========================
    // Remove
    // ==========================

    remove(key) {

        try {

            localStorage.removeItem(key);

            return true;

        } catch (error) {

            console.error(
                `Storage Remove Error (${key})`,
                error
            );

            return false;
        }
    },

    // ==========================
    // Clear All
    // ==========================

    clearAll() {

        try {

            localStorage.clear();

            console.log(
                "Storage cleared"
            );

            return true;

        } catch (error) {

            console.error(
                "Storage Clear Error",
                error
            );

            return false;
        }
    },

    // ==========================
    // Signals
    // ==========================

    saveSignals(signals) {

        const cleaned =
            signals
            .slice(
                -this.MAX_SIGNALS
            );

        return this.save(
            "signals_history",
            cleaned
        );
    },

    loadSignals() {

        return this.load(
            "signals_history",
            []
        );
    },

    addSignal(signal) {

        const signals =
            this.loadSignals();

        signals.push({

            ...signal,

            timestamp:
                Date.now()
        });

        this.saveSignals(signals);
    },

    // ==========================
    // Trades
    // ==========================

    saveTrades(trades) {

        const cleaned =
            trades
            .slice(
                -this.MAX_TRADES
            );

        return this.save(
            "paper_trades",
            cleaned
        );
    },

    loadTrades() {

        return this.load(
            "paper_trades",
            []
        );
    },

    addTrade(trade) {

        const trades =
            this.loadTrades();

        trades.push(trade);

        this.saveTrades(trades);
    },

    // ==========================
    // Balance
    // ==========================

    saveBalance(balance) {

        return this.save(
            "paper_balance",
            balance
        );
    },

    loadBalance() {

        return this.load(
            "paper_balance",
            10000
        );
    },

    // ==========================
    // Settings
    // ==========================

    saveSettings(settings) {

        return this.save(
            "bot_settings",
            settings
        );
    },

    loadSettings() {

        return this.load(
            "bot_settings",
            {

                market: "futures",

                riskPercent: 2,

                autoScan: true,

                scanInterval: 5,

                minConfidence: 70
            }
        );
    },

    // ==========================
    // Equity Curve
    // ==========================

    saveEquity(history) {

        const cleaned =
            history
            .slice(
                -this.MAX_EQUITY_POINTS
            );

        return this.save(
            "equity_curve",
            cleaned
        );
    },

    loadEquity() {

        return this.load(
            "equity_curve",
            []
        );
    },

    addEquityPoint(balance) {

        const history =
            this.loadEquity();

        history.push({

            balance,

            timestamp:
                Date.now()
        });

        this.saveEquity(history);
    },

    // ==========================
    // Statistics
    // ==========================

    saveStats(stats) {

        return this.save(
            "bot_stats",
            stats
        );
    },

    loadStats() {

        return this.load(
            "bot_stats",
            {

                totalTrades: 0,

                wins: 0,

                losses: 0,

                winRate: 0,

                profit: 0
            }
        );
    },

    // ==========================
    // Export Backup
    // ==========================

    exportData() {

        return JSON.stringify({

            signals:
                this.loadSignals(),

            trades:
                this.loadTrades(),

            balance:
                this.loadBalance(),

            settings:
                this.loadSettings(),

            equity:
                this.loadEquity(),

            stats:
                this.loadStats(),

            exportedAt:
                new Date()
                .toISOString()

        }, null, 2);
    },

    // ==========================
    // Import Backup
    // ==========================

    importData(json) {

        try {

            const data =
                JSON.parse(json);

            if (data.signals)
                this.saveSignals(
                    data.signals
                );

            if (data.trades)
                this.saveTrades(
                    data.trades
                );

            if (
                data.balance !==
                undefined
            ) {
                this.saveBalance(
                    data.balance
                );
            }

            if (data.settings)
                this.saveSettings(
                    data.settings
                );

            if (data.equity)
                this.saveEquity(
                    data.equity
                );

            if (data.stats)
                this.saveStats(
                    data.stats
                );

            return true;

        } catch (error) {

            console.error(
                "Import Error",
                error
            );

            return false;
        }
    },

    // ==========================
    // Storage Usage
    // ==========================

    getStorageUsage() {

        let total = 0;

        for (
            let key in localStorage
        ) {

            if (
                localStorage.hasOwnProperty(
                    key
                )
            ) {

                total +=
                    localStorage[key]
                    .length;
            }
        }

        return {

            bytes: total,

            kb:
                (
                    total / 1024
                ).toFixed(2),

            mb:
                (
                    total /
                    1024 /
                    1024
                ).toFixed(2)
        };
    }
};

window.StorageManager =
    StorageManager;