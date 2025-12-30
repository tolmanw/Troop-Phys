let challengeChart = null;

// --- Global neon color cache ---
const athleteColors = {};

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
    container.innerHTML = "";
}

// --- Render Monthly Challenge ---
function renderChallenge(athletesData, monthNames) {
    if (!athletesData || !monthNames) return;

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

    const rulesCard = container.querySelector(".challenge-rules-card");
    const rulesBody = rulesCard.querySelector(".challenge-rules");
    const chartCanvas = document.getElementById("challengeChartCanvas");
    const summary = container.querySelector(".challenge-summary");

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

    // --- Rules card styling ---
    rulesCard.style.width = cardWidth;
    rulesCard.style.margin = "0 0 12px 0";
    rulesCard.style.padding = `${isMobile ? 10 : 12}px ${chartPadding}px`;
    rulesCard.style.background = "#1b1f25";
    rulesCard.style.borderRadius = "15px";
    rulesBody.style.fontSize = fontSize + "px";
    rulesBody.style.color = "#e6edf3";
    rulesBody.style.opacity = "0.85";

    // --- Chart canvas ---
    chartCanvas.style.width = "100%";
    chartCanvas.style.height = chartHeight + "px";

    // --- Summary card styling ---
    summary.parentElement.style.width = cardWidth;
    summary.style.display = "flex";
    summary.style.flexDirection = "column";
    summary.style.gap = "4px";
    summary.style.fontSize = fontSize + "px";
    summary.style.color = "#e6edf3";

    // --- Prepare datasets ---
    const currentMonthIndex = monthNames.length - 1;

    const datasets = Object.values(athletesData).map(a => {
        const daily = a.daily_distance_km[currentMonthIndex] || [];
        let cumulative = 0;

        if (!athleteColors[a.display_name]) {
            athleteColors[a.display_name] = `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`;
        }

        return {
            label: a.display_name,
            data: daily.map(d => +(cumulative += d * 0.621371).toFixed(2)),
            borderColor: athleteColors[a.display_name],
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointRadius: 0
        };
    });

    if (!datasets.some(d => d.data.length)) {
        container.innerHTML += "<p style='color:#e6edf3'>No challenge data.</p>";
        return;
    }

    const labels = datasets[0].data.map((_, i) => i + 1);
    const maxDistanceMi = Math.ceil(Math.max(...datasets.flatMap(d => d.data))) + 1;

    // --- Summary content ---
    const totals = datasets
        .map(d => ({
            label: d.label,
            color: d.borderColor,
            total: d.data.at(-1) || 0
        }))
        .sort((a, b) => b.total - a.total);

    const avatarSize = isMobile ? 16 : 20;

    summary.innerHTML = totals.map(t => {
        const athlete = Object.values(athletesData)
            .find(a => a.display_name === t.label);
        return `
            <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
                <img src="${athlete?.profile || ""}" style="width:${avatarSize}px;height:${avatarSize}px;border-radius:50%;object-fit:cover;">
                <span style="color:${t.color}">${t.label}</span>
                <span style="opacity:0.7">${t.total.toFixed(1)} mi</span>
            </div>
        `;
    }).join("");

    // --- Chart ---
    const ctx = chartCanvas.getContext("2d");
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { bottom: chartPaddingBottom, right: paddingRight } },
            plugins: {
                legend: { display: false },
                tooltip: { bodyFont: { size: fontSize }, titleFont: { size: fontSize } }
            },
            scales: {
                x: { ticks: { font: { size: fontSize }, padding: isMobile ? 10 : 6 } },
                y: { min: 0, max: maxDistanceMi, title: { display: true, text: "Cumulative Distance (miles)", font: { size: fontSize } }, ticks: { font: { size: fontSize } } }
            }
        }
    });
}

// --- Toggle logic ---
function initChallengeToggle() {
    const toggle = document.getElementById("challengeToggle");
    toggle.addEventListener("change", () => {
        const container = document.getElementById("container");
        const challengeContainer = document.getElementById("challengeContainer");
        const monthSelector = document.getElementById("dailyMonthSelector");
        const monthLabel = monthSelector.previousElementSibling;

        const on = toggle.checked;
        container.style.display = on ? "none" : "flex";
        challengeContainer.style.display = on ? "block" : "none";
        monthSelector.style.visibility = on ? "hidden" : "visible";
        monthLabel.style.visibility = on ? "hidden" : "visible";

        const { athletesData, monthNames } = window.DASHBOARD.getData();

        if (on) {
            window.DASHBOARD.destroyCharts();
            renderChallenge(athletesData, monthNames);
        } else {
            destroyChallenge();
            window.DASHBOARD.renderDashboard();
        }
    });
}

// --- Init toggle on DOM load ---
document.addEventListener("DOMContentLoaded", () => {
    if (window.DASHBOARD?.getData) {
        initChallengeToggle();
        window.addEventListener("resize", () => {
            if (challengeChart) {
                destroyChallenge();
                const { athletesData, monthNames } = window.DASHBOARD.getData();
                renderChallenge(athletesData, monthNames);
            }
        });
    }
});
