let challengeChart = null;

// --- Global neon color cache ---
const athleteColors = {};

// --- Month selection (MANUAL FOR NOW) ---
function getSelectedMonthDayLimit() {
    // January 2026
    const year = 2026;
    const monthIndex = 0; // January
    return new Date(year, monthIndex + 1, 0).getDate(); // 31
}

// --- Mobile / desktop settings ---
function getSettings() {
    const isMobile = window.innerWidth <= 600;
    return {
        isMobile,
        fontSize: isMobile ? 6 : 8,
        athleteImgSize: isMobile ? 20 : 40,
        chartHeight: isMobile ? 340 : 450,
        chartPadding: isMobile ? 10 : 20,
        chartPaddingBottom: isMobile ? 20 : 20,
        paddingRight: isMobile ? 20 : 20,
        cardWidth: isMobile ? "100%" : "700px",
        headerPaddingTop: 12,
        headerFontSize: isMobile ? 12 : 16
    };
}

function destroyChallenge() {
    if (challengeChart) {
        challengeChart.destroy();
        challengeChart = null;
    }
    const container = document.getElementById("challengeContainer");
    if (container) container.innerHTML = "";
}

function renderChallenge(athletesData, monthNames) {
    if (!athletesData) return;

    const currentDay = getSelectedMonthDayLimit();

    const container = document.getElementById("challengeContainer");
    container.innerHTML = `
        <div class="challenge-card challenge-rules-card">
            <h3>Challenge Rules</h3>
            <div class="challenge-rules"></div>
        </div>

        <div class="challenge-card">
            <h2>Monthly Challenge</h2>
            <canvas id="challengeChartCanvas"></canvas>
        </div>

        <div class="challenge-card challenge-summary-card">
            <h3>Totals</h3>
            <div class="challenge-summary"></div>
        </div>
    `;

    const canvas = document.getElementById("challengeChartCanvas");
    const ctx = canvas.getContext("2d");

    const {
        isMobile,
        fontSize,
        athleteImgSize,
        chartHeight,
        chartPadding,
        chartPaddingBottom,
        paddingRight,
        cardWidth,
        headerPaddingTop,
        headerFontSize
    } = getSettings();

    // --- Prepare datasets ---
    const pointsPerActivity = {
        Swim: 4,
        Run: 1,
        Ride: 0.25,
        "Weight Training": 0.1
    };

    const datasets = Object.values(athletesData).map(a => {
        let cumulative = 0;

        if (!athleteColors[a.display_name]) {
            athleteColors[a.display_name] =
                `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`;
        }

        const dailyPoints = (a.daily || []).map((d, i) => {
            if (i >= currentDay) return null;

            let dayPoints = 0;
            d.activities.forEach(act => {
                const miles = (act.distance_km || 0) * 0.621371;
                const time = act.time_min || 0;

                if (pointsPerActivity[act.type]) {
                    if (act.type === "Weight Training") {
                        dayPoints += time * pointsPerActivity[act.type];
                    } else {
                        dayPoints += miles * pointsPerActivity[act.type];
                    }
                }
            });

            cumulative = Math.round((cumulative + dayPoints) * 100) / 100;
            return cumulative;
        });

        return {
            label: a.display_name,
            data: dailyPoints,
            borderColor: athleteColors[a.display_name],
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointRadius: 0,
            spanGaps: true
        };
    });

    const labels = datasets[0]?.data.map((_, i) => i + 1) || [];
    const maxPoints =
        Math.ceil(Math.max(...datasets.flatMap(d => d.data.filter(v => v !== null)))) + 1;

    // --- Chart ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { bottom: chartPaddingBottom, right: paddingRight } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    bodyFont: { size: fontSize },
                    titleFont: { size: fontSize }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: { size: fontSize },
                        padding: isMobile ? 10 : 6,
                        maxRotation: 0,
                        minRotation: 0
                    }
                },
                y: {
                    min: 0,
                    max: maxPoints,
                    title: {
                        display: true,
                        text: "Cumulative Points",
                        font: { size: fontSize }
                    },
                    ticks: { font: { size: fontSize } }
                }
            }
        },
        plugins: [{
            id: "athleteImages",
            afterDatasetsDraw(chart) {
                const { ctx, scales: { x, y } } = chart;

                Object.values(athletesData).forEach((a, i) => {
                    const d = chart.data.datasets[i];
                    if (!d?.data.length) return;

                    const lastIdx = d.data
                        .map((v, idx) => v !== null ? idx : -1)
                        .filter(v => v >= 0)
                        .pop();

                    if (lastIdx === undefined) return;

                    const xPos = x.getPixelForValue(lastIdx + 1);
                    const yPos = y.getPixelForValue(d.data[lastIdx]);
                    const size = athleteImgSize;

                    const img = new Image();
                    img.src = a.profile;
                    img.onload = () => {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(xPos, yPos, size / 2, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(img, xPos - size / 2, yPos - size / 2, size, size);
                        ctx.restore();
                    };
                });
            }
        }]
    });
}
