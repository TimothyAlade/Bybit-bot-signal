// papertrade.js
// Production Paper Trading Engine

const PaperTrader = {

    START_BALANCE: 10000,

    MAX_OPEN_TRADES: 5,

    RISK_PERCENT: 2,

    balance: 10000,

    trades: [],

    // ==========================
    // Init
    // ==========================

    init() {

        this.balance =
            StorageManager.loadBalance();

        this.trades =
            StorageManager.loadTrades();

        this.updateDashboard();

        console.log(
            "Paper Trader Ready"
        );
    },

    // ==========================
    // Save
    // ==========================

    save() {

        StorageManager.saveBalance(
            this.balance
        );

        StorageManager.saveTrades(
            this.trades
        );
    },

    // ==========================
    // Open Trades Count
    // ==========================

    getOpenTrades() {

        return this.trades.filter(
            trade =>
                trade.status === "OPEN"
        );
    },

    // ==========================
    // Open Trade
    // ==========================

    openTrade(signal) {

        if (!signal)
            return false;

        if (
            signal.confidence < 70
        ) {
            return false;
        }

        const openTrades =
            this.getOpenTrades();

        if (
            openTrades.length >=
            this.MAX_OPEN_TRADES
        ) {

            console.log(
                "Max trades reached"
            );

            return false;
        }

        const duplicate =
            openTrades.find(
                trade =>
                    trade.coin ===
                    signal.coin
            );

        if (duplicate) {

            console.log(
                "Trade already exists:",
                signal.coin
            );

            return false;
        }

        const riskAmount =
            this.balance *
            (
                this.RISK_PERCENT /
                100
            );

        const trade = {

            id:
                crypto.randomUUID(),

            coin:
                signal.coin,

            market:
                signal.market,

            direction:
                signal.signal,

            confidence:
                signal.confidence,

            entry:
                signal.entry,

            stopLoss:
                signal.stopLoss,

            takeProfit:
                signal.takeProfit,

            riskAmount,

            status: "OPEN",

            profit: 0,

            openTime:
                Date.now(),

            closeTime: null
        };

        this.trades.push(
            trade
        );

        this.save();

        this.updateDashboard();

        console.log(
            "Opened:",
            trade.coin
        );

        return true;
    },

    // ==========================
    // Monitor Trades
    // ==========================

    async monitorTrades() {

        const openTrades =
            this.getOpenTrades();

        for (
            const trade
            of openTrades
        ) {

            try {

                const candles =
                    await BybitAPI
                    .getCandles(
                        trade.coin,
                        trade.market === "spot"
                            ? "spot"
                            : "linear",
                        "1",
                        2
                    );

                if (
                    !candles.length
                ) {
                    continue;
                }

                const price =
                    Number(
                        candles.at(-1)[4]
                    );

                this.evaluateTrade(
                    trade,
                    price
                );

            } catch (error) {

                console.error(
                    trade.coin,
                    error
                );
            }
        }
    },

    // ==========================
    // Evaluate
    // ==========================

    evaluateTrade(
        trade,
        currentPrice
    ) {

        if (
            trade.status !== "OPEN"
        ) {
            return;
        }

        const isLong =
            trade.direction === "BUY";

        // BUY WIN

        if (
            isLong &&
            currentPrice >=
            trade.takeProfit
        ) {

            this.closeTrade(
                trade,
                "WIN"
            );

            return;
        }

        // BUY LOSS

        if (
            isLong &&
            currentPrice <=
            trade.stopLoss
        ) {

            this.closeTrade(
                trade,
                "LOSS"
            );

            return;
        }

        // SELL WIN

        if (
            !isLong &&
            currentPrice <=
            trade.takeProfit
        ) {

            this.closeTrade(
                trade,
                "WIN"
            );

            return;
        }

        // SELL LOSS

        if (
            !isLong &&
            currentPrice >=
            trade.stopLoss
        ) {

            this.closeTrade(
                trade,
                "LOSS"
            );
        }
    },

    // ==========================
    // Close Trade
    // ==========================

    closeTrade(
        trade,
        result
    ) {

        trade.status =
            result;

        trade.closeTime =
            Date.now();

        if (
            result === "WIN"
        ) {

            trade.profit =
                trade.riskAmount * 2;

            this.balance +=
                trade.profit;

        } else {

            trade.profit =
                -trade.riskAmount;

            this.balance +=
                trade.profit;
        }

        StorageManager.addEquityPoint(
            this.balance
        );

        this.save();

        this.updateDashboard();

        console.log(
            `${trade.coin} ${result}`
        );
    },

    // ==========================
    // Statistics
    // ==========================

    getStats() {

        const total =
            this.trades.length;

        const wins =
            this.trades.filter(
                t =>
                    t.status === "WIN"
            ).length;

        const losses =
            this.trades.filter(
                t =>
                    t.status === "LOSS"
            ).length;

        const open =
            this.trades.filter(
                t =>
                    t.status === "OPEN"
            ).length;

        const winRate =
            total > 0
                ? (
                    (wins / total) *
                    100
                  ).toFixed(1)
                : 0;

        return {

            total,

            wins,

            losses,

            open,

            winRate
        };
    },

    // ==========================
    // Dashboard
    // ==========================

    updateDashboard() {

        const stats =
            this.getStats();

        const balanceEl =
            document.getElementById(
                "balance"
            );

        const tradesEl =
            document.getElementById(
                "totalTrades"
            );

        const winRateEl =
            document.getElementById(
                "winRate"
            );

        const openEl =
            document.getElementById(
                "openSignals"
            );

        if (balanceEl) {

            balanceEl.textContent =
                "$" +
                this.balance
                .toFixed(2);
        }

        if (tradesEl) {

            tradesEl.textContent =
                stats.total;
        }

        if (winRateEl) {

            winRateEl.textContent =
                stats.winRate +
                "%";
        }

        if (openEl) {

            openEl.textContent =
                stats.open;
        }

        this.renderHistory();
    },

    // ==========================
    // History
    // ==========================

    renderHistory() {

        const table =
            document.getElementById(
                "historyTable"
            );

        if (!table)
            return;

        table.innerHTML = "";

        [...this.trades]
            .reverse()
            .forEach(
                trade => {

                table.innerHTML += `
                <tr>
                    <td>${new Date(trade.openTime).toLocaleString()}</td>
                    <td>${trade.coin}</td>
                    <td>${trade.market}</td>
                    <td>${trade.direction}</td>
                    <td>${trade.entry}</td>
                    <td>${trade.takeProfit}</td>
                    <td>${trade.stopLoss}</td>
                    <td>${trade.status}</td>
                </tr>
                `;
            });
    },

    // ==========================
    // Reset
    // ==========================

    reset() {

        this.balance =
            this.START_BALANCE;

        this.trades = [];

        this.save();

        this.updateDashboard();
    }
};

window.PaperTrader =
    PaperTrader;

document.addEventListener(
    "DOMContentLoaded",
    () => {

        PaperTrader.init();

        setInterval(
            () =>
                PaperTrader
                .monitorTrades(),
            60000
        );
    }
);