let challengeChart = null;

async function loadChallengeData() {
    const response = await fetch("data/athletes.json");
    const data = await response.json();
    return {
        athletes: Object.values(data.athletes),
        monthNames: data.month_names.map(m => m.substr(0,3))
    };
}

document.getElementById("challengeToggle").addEventListener("change", async e => {
    const on = e.target.checked;

    document.getElementById("container").style.display = on ? "none" : "flex";
    const challengeContainer = document.getElementById("challengeContainer");
    challengeContainer.style.display = on ? "block" : "none";

    if (on) {
        destroyChallenge();
        const { athletes, monthNames } = await loadChallengeData();
        const currentMonthIndex = new Date().getMonth();
        renderChallenge(athletes, monthNames, currentMonthIndex);
    } else {
        destroyChallenge();
        document.getElementById("container").style.display = "flex";
    }
});

function destroyChallenge() {
    if (challengeChart) {
        challengeChart.destroy();
        challengeChart = null;
    }
    const container = document.getElementById("challengeContainer");
    container.querySelector("canvas").remove();
    container.innerHTML += '<canvas id="challenge" style="width:100%; height:300px;"></canvas>';
}

function renderChallenge(athletes, months, idx) {
    document.getElementById("challengeContainer").querySelector("h2").textContent = `${months[idx]} Challenge`;
    
    const datasets = athletes.map(a => {
        let cumulative = 0;
        return {
            label: a.display_name,
            data: (a.daily_distance_km[idx] || []).map(d => +(cumulative += d * 0.621371).toFixed(2)),
            tension: 0.3,
            borderColor: getRandomColor(),
            fill: false,
            pointRadius: 3,
            borderWidth: 2
        };
    });

    const labels = datasets[0]?.data.map((_, i) => i + 1) || [];

    const ctx = document.getElementById("challenge").getContext("2d");
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: "bottom" }
            },
            scales: {
                x: { title: { display: true, text: "Day of Month" } },
                y: { title: { display: true, text: "Cumulative Distance (mi)" }, beginAtZero: true }
            }
        },
        plugins: [{
            id: "athleteImages",
            afterDatasetsDraw(chart) {
                const { ctx, scales: { x, y } } = chart;
                athletes.forEach((a, i) => {
                    const dataset = chart.data.datasets[i];
                    const lastIndex = dataset.data.length - 1;
                    const xPos = x.getPixelForValue(lastIndex + 1);
                    const yPos = y.getPixelForValue(dataset.data[lastIndex]);

                    const img = new Image();
                    img.src = a.profile;
                    img.onload = () => {
                        const size = 24;
                        ctx.drawImage(img, xPos - size / 2, yPos - size / 2, size, size);
                    };
                });
            }
        }]
    });
}

function getRandomColor() {
    const r = Math.floor(Math.random() * 200 + 30);
    const g = Math.floor(Math.random() * 200 + 30);
    const b = Math.floor(Math.random() * 200 + 30);
    return `rgb(${r},${g},${b})`;
}
