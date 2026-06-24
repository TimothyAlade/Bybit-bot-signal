// app.js
// High Confidence Trading Scanner

const App = {

    scannedSignals: [],
    chart: null,
    scanInterval: null,

    async init() {

        console.log("Trading Bot Started");

        const container =
            document.getElementById(
                "signalContainer"
            );

        if (container) {
            container.innerHTML = "";
        }

        this.initChart();

        const scanBtn =
            document.getElementById(
                "scanBtn"
            );

        if (scanBtn) {

            scanBtn.addEventListener(
                "click",
                () => this.scanMarket()
            );
        }

        await this.scanMarket();

        this.scanInterval =
            setInterval(() => {

                this.scanMarket();

            }, 60000);

        console.log(
            "Auto Scan Active (60s)"
        );
    },

    initChart() {

        const canvas =
            document.getElementById(
                "equityChart"
            );

        if (!canvas) return;

        const ctx =
            canvas.getContext("2d");

        this.chart =
            new Chart(ctx, {

                type: "line",

                data: {

                    labels: [],

                    datasets: [
                        {
                            label:
                                "Account Equity",

                            data: [],

                            tension: 0.3
                        }
                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false
                }
            });

        this.updateChart();
    },

    updateChart() {

        if (!this.chart) return;

        const equity =
            StorageManager.loadEquity();

        const labels =
            equity.map((_, i) =>
                `${i + 1}`
            );

        const values =
            equity.map(
                item => item.balance
            );

        this.chart.data.labels =
            labels;

        this.chart.data.datasets[0].data =
            values;

        this.chart.update();
    },

    async scanMarket() {

        try {

            const scanBtn =
                document.getElementById(
                    "scanBtn"
                );

            if (scanBtn) {

                scanBtn.disabled = true;

                scanBtn.textContent =
                    "Scanning...";
            }

            const marketType =
                document.getElementById(
                    "marketType"
                )?.value || "futures";

            console.log(
                `Scanning ${marketType}`
            );

            const topCoins =
                await BybitAPI.getTopCoins(
                    marketType,
                    10
                );

            if (!topCoins.length) {

                console.error(
                    "No coins returned"
                );

                return;
            }

            let signals = [];

            for (const coin of topCoins) {

                try {

                    const category =
                        marketType ===
                        "spot"
                            ? "spot"
                            : "linear";

                    const candles =
                        await BybitAPI.getCandles(
                            coin.symbol,
                            category,
                            "60",
                            200
                        );

                    if (
                        !candles ||
                        candles.length < 200
                    ) {
                        continue;
                    }

                    const analysis =
                        AnalysisEngine
                            .generateSignal(
                                candles
                            );

                    if (!analysis) {
                        continue;
                    }

                    signals.push({

                        coin:
                            coin.symbol,

                        market:
                            marketType,

                        ...analysis
                    });

                } catch (err) {

                    console.error(
                        coin.symbol,
                        err
                    );
                }
            }

            signals.sort(
                (a, b) =>
                    b.confidence -
                    a.confidence
            );

            this.scannedSignals =
                signals.slice(0, 100);

            StorageManager.saveSignals(
                this.scannedSignals
            );

            this.renderSignals();

            if (
                this.scannedSignals
                    .length
            ) {

                this.updateAnalysisPanel(
                    this.scannedSignals[0]
                );
            }

            for (
                const signal of
                this.scannedSignals
            ) {

                const exists =
                    PaperTrader.trades.some(
                        trade =>
                            trade.coin ===
                                signal.coin &&
                            trade.status ===
                                "OPEN"
                    );

                if (!exists) {

                    PaperTrader.openTrade(
                        signal
                    );
                }
            }

        } catch (error) {

            console.error(
                "Scan Error",
                error
            );

        } finally {

            const scanBtn =
                document.getElementById(
                    "scanBtn"
                );

            if (scanBtn) {

                scanBtn.disabled =
                    false;

                scanBtn.textContent =
                    "Scan Market";
            }
        }
    },

    renderSignals() {

        const container =
            document.getElementById(
                "signalContainer"
            );

        if (!container) return;

        container.innerHTML = "";

        if (
            !this.scannedSignals.length
        ) {

            container.innerHTML =

                `<div class="signal-card">
                    <h3>No High Confidence Signals</h3>
                </div>`;

            return;
        }

        this.scannedSignals.forEach(
            signal => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "signal-card";

                const statusClass =
                    signal.signal ===
                    "BUY"
                        ? "win"
                        : "loss";

                card.innerHTML = `

                    <h3>${signal.coin}</h3>

                    <p>
                    <strong>Signal:</strong>
                    ${signal.signal}
                    </p>

                    <p>
                    <strong>Price:</strong>
                    ${signal.currentPrice}
                    </p>

                    <p>
                    <strong>Entry:</strong>
                    ${signal.entry}
                    </p>

                    <p>
                    <strong>TP:</strong>
                    ${signal.takeProfit}
                    </p>

                    <p>
                    <strong>SL:</strong>
                    ${signal.stopLoss}
                    </p>

                    <p>
                    <strong>RSI:</strong>
                    ${signal.rsi}
                    </p>

                    <p>
                    <strong>Trend:</strong>
                    ${signal.trend}
                    </p>

                    <p>
                    <strong>Confidence:</strong>
                    ${signal.confidence}%
                    </p>

                    <span
                    class="status ${statusClass}">
                    ${signal.signal}
                    </span>

                `;

                container.appendChild(
                    card
                );
            }
        );
    },

    updateAnalysisPanel(
        signal
    ) {

        const rsi =
            document.getElementById(
                "rsi"
            );

        const macd =
            document.getElementById(
                "macd"
            );

        const trend =
            document.getElementById(
                "emaTrend"
            );

        const volume =
            document.getElementById(
                "volume"
            );

        const funding =
            document.getElementById(
                "fundingRate"
            );

        const openInterest =
            document.getElementById(
                "openInterest"
            );

        if (rsi)
            rsi.textContent =
                signal.rsi;

        if (macd)
            macd.textContent =
                signal.signal;

        if (trend)
            trend.textContent =
                signal.trend;

        if (volume)
            volume.textContent =
                signal.volumeStrength;

        if (funding)
            funding.textContent =
                "--";

        if (openInterest)
            openInterest.textContent =
                "--";
    }

};

document.addEventListener(
    "DOMContentLoaded",
    () => {

        App.init();
    }
);