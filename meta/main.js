import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const width = 800;
const height = 500;
const margin = { top: 20, right: 30, bottom: 40, left: 50 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

// Global State
let commits = [];
let xScale, yScale, rScale, xAxis, yAxis;
let svg, dotsGroup;
let colors = d3.scaleOrdinal(d3.schemeTableau10); 
let commitIndexScale;
let commitProgress = 100;
let commitMaxTime;
let filteredCommits = [];

const timeSlider = document.getElementById('commit-progress');
const selectedTime = document.getElementById('commit-time');

async function initVisualizations() {
    // 1. Load Data
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        datetime: new Date(row.datetime)
    }));

    // 2. Group and sort commits chronologically
    commits = d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
        const first = lines[0];
        return {
            id: commit,
            datetime: first.datetime,
            author: first.author,
            date: first.date,
            time: first.time,
            linesEdited: lines.length,
            lines: lines
        };
    }).sort((a, b) => a.datetime - b.datetime);

    // 3. Slider Scale for Commit Index Linkage
    commitIndexScale = d3
        .scaleLinear()
        .domain([0, 100])
        .range([0, Math.max(0, commits.length - 1)]);

    // 4. Setup Scatterplot SVG
    svg = d3.select('#scatterplot')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    dotsGroup = g.append('g').attr('class', 'dots');

    // 5. Scatterplot Scales
    xScale = d3.scaleTime()
        .domain(d3.extent(commits, d => d.datetime))
        .range([0, innerWidth])
        .nice();

    yScale = d3.scaleTime()
        .domain([new Date(2000, 0, 1, 0, 0), new Date(2000, 0, 1, 23, 59)])
        .range([innerHeight, 0]);

    rScale = d3.scaleSqrt()
        .domain(d3.extent(commits, d => d.linesEdited))
        .range([3, 30]);

    // 6. Draw Axes
    xAxis = d3.axisBottom(xScale);
    yAxis = d3.axisLeft(yScale).tickFormat(d3.timeFormat("%H:%M"));

    g.append('g')
        .attr('class', 'x-axis') 
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

    g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis)
        .call(g => g.selectAll('.tick line').clone()
            .attr('x2', innerWidth)
            .attr('stroke-opacity', 0.1)
        );

    // 7. Inject Story Steps for Section 1 (Scatterplot)
    d3.select('#scatter-story')
        .selectAll('.step')
        .data(commits)
        .join('div')
        .attr('class', 'step')
        .html((d, i) => `
            <h3>${d.datetime.toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' })}</h3>
            <p>I pushed ${i > 0 ? 'another patch to the repository' : 'the foundational core of this website'}.</p>
            <p>This update introduced <strong>${d.linesEdited}</strong> modifications across <strong>${d3.rollups(d.lines, D => D.length, d => d.file).length}</strong> structural files.</p>
        `);

    // 8. Setup Slider Listener
    timeSlider.value = commitProgress;
    timeSlider.addEventListener('input', onTimeSliderChange);

    // 9. Scrollama Scroller: both visualizations update from the same commit steps
    const scroller1 = scrollama();
    scroller1
        .setup({
            container: '#scrolly-1',
            step: '#scrolly-1 .step',
            offset: 0.5, 
        })
        .onStepEnter((response) => {
            updateVisualsForCommitIndex(response.index, true);
        });

    // Initialize to the latest commit
    updateVisualsForCommitIndex(commits.length - 1, true);
}

// === RESPONSE LAYER UPDATES ===

function onTimeSliderChange() {
    const sliderValue = Number(timeSlider.value);
    const commitIndex = commitIndexScale(sliderValue);
    updateVisualsForCommitIndex(commitIndex, true);
}

function updateVisualsForCommitIndex(rawIndex, syncSlider = false) {
    if (!commits.length) {
        return;
    }

    const clampedIndex = Math.max(0, Math.min(commits.length - 1, Math.round(rawIndex)));
    commitMaxTime = commits[clampedIndex].datetime;
    filteredCommits = commits.slice(0, clampedIndex + 1);

    commitProgress = commits.length === 1 ? 100 : (clampedIndex / (commits.length - 1)) * 100;
    if (syncSlider) {
        timeSlider.value = String(commitProgress);
    }

    selectedTime.textContent = commitMaxTime.toLocaleString('en', { dateStyle: "long", timeStyle: "short" });
    updateScatterPlot(filteredCommits);
    updateSummaryStats(filteredCommits);
    updateFileDisplay(filteredCommits); // Slider coordinates updates globally across sections
}

function updateScatterPlot(filteredCommits) {
    const tooltip = d3.select('#commit-tooltip');
    const domainCommits = filteredCommits.length > 0 ? filteredCommits : commits;

    xScale.domain(d3.extent(domainCommits, d => d.datetime)).nice();
    const xAxisGroup = svg.select('g.x-axis');
    xAxisGroup.selectAll('*').remove();
    xAxisGroup.call(xAxis);

    const sortedCommits = d3.sort(filteredCommits, d => -d.linesEdited);

    dotsGroup.selectAll('circle')
        .data(sortedCommits, d => d.id)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(new Date(2000, 0, 1, d.datetime.getHours(), d.datetime.getMinutes())))
        .style('--r', d => rScale(d.linesEdited))
        .attr('r', d => rScale(d.linesEdited)) 
        .attr('fill', 'var(--color-accent, #005a9c)')
        .attr('fill-opacity', 0.6)
        .attr('stroke', 'canvas')
        .attr('stroke-width', 1)
        .on('mouseenter', (event, d) => {
            d3.select(event.currentTarget).attr('fill-opacity', 1).attr('stroke', 'red');
            tooltip.classed('hidden', false);
            d3.select('#commit-info').html(`
                <dt>Date:</dt><dd>${d.datetime.toLocaleDateString()}</dd>
                <dt>Time:</dt><dd>${d.datetime.toLocaleTimeString()}</dd>
                <dt>Lines Edited:</dt><dd>${d.linesEdited}</dd>
            `);
            tooltip.style('left', `${event.clientX + 15}px`)
                   .style('top', `${event.clientY + 15}px`);
        })
        .on('mousemove', (event) => {
            tooltip.style('left', `${event.clientX + 15}px`)
                   .style('top', `${event.clientY + 15}px`);
        })
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).attr('fill-opacity', 0.6).attr('stroke', 'canvas');
            tooltip.classed('hidden', true);
        });
}

function updateSummaryStats(filteredCommits) {
    const statsDiv = d3.select('#stats');
    const totalCommits = filteredCommits.length;
    const totalLines = d3.sum(filteredCommits, d => d.linesEdited);
    const avgLines = totalCommits > 0 ? (totalLines / totalCommits).toFixed(1) : 0;

    statsDiv.html(`
        <div class="stat-card"><strong>${totalCommits}</strong> Commits</div>
        <div class="stat-card"><strong>${totalLines}</strong> Lines Edited</div>
        <div class="stat-card"><strong>${avgLines}</strong> Avg Lines/Commit</div>
    `);
}

function updateFileDisplay(filteredCommits) {
    let lines = filteredCommits.flatMap((d) => d.lines);
    let files = d3.groups(lines, (d) => d.file).map(([name, lines]) => {
        return { name, lines };
    }).sort((a, b) => b.lines.length - a.lines.length); 

    let filesContainer = d3.select('#files')
        .selectAll('div')
        .data(files, d => d.name)
        .join(
            enter => enter.append('div').call(div => {
                const dt = div.append('dt');
                dt.append('code');
                dt.append('small'); 
                div.append('dd');
            })
        );

    filesContainer.select('dt > code').text(d => d.name);
    filesContainer.select('dt > small').text(d => `${d.lines.length} lines`);

    filesContainer.select('dd')
        .selectAll('div')
        .data(d => d.lines)
        .join('div')
        .attr('class', 'loc')
        .attr('style', d => `--color: ${colors(d.type)}`);
}

initVisualizations();
