const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwD4QRvrg0RKeSoGvjD1vKK1V0NB15I6xPP51-WoW0-DosiWpn4Zx-ZN8QhYVXaw1e2Ow/exec';

let allData = [];
let filtered = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let currentTab = 'all';

// Question columns (not metadata)
const META_COLS = ['Timestamp', 'Frequency', 'Time of Day'];

async function loadData() {
    try {
        const res = await fetch(SCRIPT_URL + '?action=getData');
        const json = await res.json();
        if (json.result === 'success') {
            allData = json.data.filter(r => r.Timestamp);
            document.getElementById('lastUpdated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
            applyFilters();
            updateStats();
        }
    } catch(err) {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="6"><div class="empty">⚠️ Could not load data. Check your Apps Script deployment.</div></td></tr>';
    }
}

function updateStats() {
    const counts = { Daily: 0, Weekly: 0, Monthly: 0, Additional: 0 };
    let yesTotal = 0, noTotal = 0;

    allData.forEach(row => {
        if (counts[row.Frequency] !== undefined) counts[row.Frequency]++;
        Object.keys(row).forEach(key => {
            if (!META_COLS.includes(key) && !key.endsWith('- Notes') && !key.includes('date') && !key.includes('Date')) {
                if (row[key] === 'Yes') yesTotal++;
                if (row[key] === 'No') noTotal++;
            }
        });
    });

    document.getElementById('statTotal').textContent = allData.length;
    document.getElementById('statDaily').textContent = counts.Daily;
    document.getElementById('statWeekly').textContent = counts.Weekly;
    document.getElementById('statMonthly').textContent = counts.Monthly;
    document.getElementById('statAdditional').textContent = counts.Additional;
    document.getElementById('statYes').textContent = yesTotal;
    document.getElementById('statNo').textContent = noTotal;
}

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const freq = document.getElementById('freqFilter').value;
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;

    filtered = allData.filter(row => {
        const ts = new Date(row.Timestamp);
        if (freq && row.Frequency !== freq) return false;
        if (from && ts < new Date(from)) return false;
        if (to && ts > new Date(to + 'T23:59:59')) return false;
        if (search) {
            const rowStr = JSON.stringify(row).toLowerCase();
            if (!rowStr.includes(search)) return false;
        }
        return true;
    });

    currentPage = 1;
    renderTable();
    renderNoAnswers();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty">No submissions found.</div></td></tr>';
        document.getElementById('pageInfo').textContent = 'No results';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
        return;
    }

    tbody.innerHTML = page.map(row => {
        const ts = row.Timestamp ? new Date(row.Timestamp).toLocaleString('en-GB') : '—';
        const freq = row.Frequency || '—';
        const time = row['Time of Day'] || '—';

        let yes = 0, no = 0, total = 0;
        Object.keys(row).forEach(key => {
            if (!META_COLS.includes(key) && !key.endsWith('- Notes') && !key.includes('date') && !key.includes('Date')) {
                if (row[key] === 'Yes') { yes++; total++; }
                if (row[key] === 'No') { no++; total++; }
            }
        });
        const pct = total > 0 ? Math.round((yes / total) * 100) : 0;
        const pctColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#e07b00' : '#dc2626';

        return `<tr>
            <td style="font-family:'DM Mono',monospace;font-size:0.78rem;">${ts}</td>
            <td><span class="badge ${freq}">${freq}</span></td>
            <td>${time}</td>
            <td class="yes">${yes}</td>
            <td class="no">${no}</td>
            <td><span style="font-weight:700;color:${pctColor}">${pct}%</span></td>
        </tr>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages} (${filtered.length} results)`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

function renderNoAnswers() {
    const container = document.getElementById('noAnswersList');
    const noRows = filtered.filter(row => {
        return Object.keys(row).some(key =>
            !META_COLS.includes(key) && !key.endsWith('- Notes') && !key.includes('date') && !key.includes('Date') && row[key] === 'No'
        );
    });

    if (noRows.length === 0) {
        container.innerHTML = '<div class="empty">✅ No "No" answers found for the current filters.</div>';
        return;
    }

    container.innerHTML = noRows.map(row => {
        const ts = row.Timestamp ? new Date(row.Timestamp).toLocaleString('en-GB') : '—';
        const freq = row.Frequency || '—';

        const noItems = Object.keys(row)
            .filter(key => !META_COLS.includes(key) && !key.endsWith('- Notes') && !key.includes('date') && !key.includes('Date') && row[key] === 'No')
            .map(key => {
                const note = row[key + ' - Notes'] || '';
                return `<div class="no-item">
                    <div class="question">❌ ${key}</div>
                    <div class="note">Note: <span>${note || 'No note provided'}</span></div>
                </div>`;
            }).join('');

        return `<div class="no-card">
            <div class="no-card-header">
                <h3><span class="badge ${freq}" style="margin-right:8px;">${freq}</span>${row['Time of Day'] ? row['Time of Day'] + ' check' : 'Submission'}</h3>
                <span class="timestamp">${ts}</span>
            </div>
            <div class="no-items">${noItems}</div>
        </div>`;
    }).join('');
}

function changePage(dir) {
    currentPage += dir;
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tabAll').style.display = tab === 'all' ? 'block' : 'none';
    document.getElementById('tabNo').style.display = tab === 'no' ? 'block' : 'none';
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('freqFilter').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    applyFilters();
}

// Event listeners
['searchInput', 'freqFilter', 'dateFrom', 'dateTo'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
});

loadData();
// Auto-refresh every 60 seconds
setInterval(loadData, 60000);

function exportToExcel() {
    if (filtered.length === 0) {
        alert('No data to export.');
        return;
    }

    // Get all unique headers from filtered data
    const allHeaders = [];
    filtered.forEach(row => {
        Object.keys(row).forEach(key => {
            if (!allHeaders.includes(key)) allHeaders.push(key);
        });
    });

    // Build CSV rows
    const csvRows = [];

    // Header row
    csvRows.push(allHeaders.map(h => `"${h}"`).join(','));

    // Data rows
    filtered.forEach(row => {
        const values = allHeaders.map(header => {
            const val = row[header] !== undefined ? row[header] : '';
            // Escape quotes and wrap in quotes
            return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `premises-checklist-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}