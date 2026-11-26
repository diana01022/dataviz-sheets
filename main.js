
import Chart from 'chart.js/auto';

const charts = {};
let sheets = [];

const participantColors = [
  '#E76F51',
  '#457B9D',
  '#2A9D8F',
  '#9B5DE5',
  '#F4A261',
  '#E63946',
  '#6A994E',
  '#F15BB5',
  '#577590',
  '#FFB703',
  '#7209B7',
  '#43AA8B',
  '#F3722C',
  '#4361EE',
  '#BC6C25'
];

function readings(sheet, metric) {
  const points = sheet[metric] ?? [];

  return points
    .filter(point => point.date)
    .map(({ date, value }) => ({
      date,
      value: Number.isFinite(value) ? value : null,
    }));
}

function draw(id, type, unit, datasets) {
  if (charts[id]) {
    charts[id].destroy();
  }

  charts[id] = new Chart(document.getElementById(id), {
    type,
    data: {
      datasets: datasets.map((dataset, index) => {
        const color = dataset.color ?? participantColors[index % participantColors.length];

        return {
          ...dataset,
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          tension: 0.3,
        };
      }),
    },
    options: {
      responsive: true,
      parsing: {
        xAxisKey: 'date',
        yAxisKey: 'value',
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: unit,
          },
        },
      },
    },
  });
}

function participantDatasets(sheets, metric) {
  const dates = new Set();

  const participants = sheets.map((sheet, index) => {
    const byDate = new Map();

    for (const { date, value } of readings(sheet, metric)) {
      dates.add(date);
      byDate.set(date, value);
    }

    return {
      name: sheet.name,
      byDate,
      color: participantColors[index % participantColors.length],
    };
  });

  const calendar = [...dates].sort();

  return participants.map(({ name, byDate, color }) => ({
    label: name,
    color,
    data: calendar.map(date => ({
      date,
      value: byDate.get(date) ?? null,
    })),
  }));
}

function classSummary(sheets) {
  const totals = new Map();
  const counts = new Map();

  for (const sheet of sheets) {
    for (const { date, value } of readings(sheet, 'steps_count')) {
      if (value === null) continue;

      totals.set(date, (totals.get(date) ?? 0) + value);
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }

  return [...totals.keys()].sort().map(date => ({
    date,
    total: totals.get(date),
    mean: totals.get(date) / counts.get(date),
  }));
}

function showLeaderboard(elementId, metric, unit) {
  const leaderboard = document.getElementById(elementId);

  const rankings = sheets.map(sheet => {
    const values = readings(sheet, metric)
      .map(point => point.value)
      .filter(value => value !== null);

    const total = values.reduce((sum, value) => sum + value, 0);

    return {
      name: sheet.name,
      total,
    };
  });

  rankings.sort((a, b) => b.total - a.total);

  leaderboard.innerHTML = '';

  rankings.slice(0, 3).forEach((participant, index) => {
    const item = document.createElement('li');
    item.textContent = `${index + 1}. ${participant.name}`;

    const score = document.createElement('span');
    score.textContent = `${Math.round(participant.total).toLocaleString()} ${unit}`;

    item.appendChild(score);
    leaderboard.appendChild(item);
  });
}

function showProfile(sheet) {
  document.querySelector('#home-page').hidden = true;
  document.querySelector('#profile-page').hidden = false;

  document.querySelector('#profile-name').textContent = sheet.name;

  const index = sheets.indexOf(sheet);
  const color = participantColors[index % participantColors.length];

  draw('steps', 'bar', 'Steps', [
    {
      label: sheet.name,
      color,
      data: readings(sheet, 'steps_count'),
    },
  ]);

  draw('minutes', 'line', 'Minutes', [
    {
      label: sheet.name,
      color,
      data: readings(sheet, 'screen_total_min'),
    },
  ]);
}

function showHome() {
  document.querySelector('#profile-page').hidden = true;
  document.querySelector('#home-page').hidden = false;
}

async function drawCharts() {
  const response = await fetch('/api/data');
  sheets = await response.json();

  if (!response.ok) {
    throw new Error(sheets.error);
  }

  if (!sheets.length) {
    throw new Error('No participant data found.');
  }

  const participants = document.querySelector('#participants');

  participants.innerHTML = '';

  sheets.forEach((sheet, index) => {
    const card = document.createElement('button');
    card.className = 'participant-card';
    card.textContent = sheet.name;
    card.style.borderTop = `5px solid ${participantColors[index % participantColors.length]}`;

    card.addEventListener('click', () => {
      showProfile(sheet);
    });

    participants.appendChild(card);
  });

  showLeaderboard('steps-leaderboard', 'steps_count', 'steps');
  showLeaderboard('screen-leaderboard', 'screen_total_min', 'min');

  draw('all-steps', 'line', 'Steps', participantDatasets(sheets, 'steps_count'));

  draw('all-minutes', 'line', 'Minutes', participantDatasets(sheets, 'screen_total_min'));

  const summary = classSummary(sheets);

  draw('total', 'bar', 'Total steps', [
    {
      label: 'Class total',
      color: '#457B9D',
      data: summary.map(({ date, total }) => ({
        date,
        value: total,
      })),
    },
  ]);

  draw('mean', 'line', 'Average steps', [
    {
      label: 'Class average',
      color: '#9B5DE5',
      data: summary.map(({ date, mean }) => ({
        date,
        value: mean,
      })),
    },
  ]);

  document.querySelector('#back-button').addEventListener('click', showHome);
}

drawCharts().catch(error => {
  document.querySelector('#error').textContent = error.message;
});
