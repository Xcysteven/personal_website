import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const width = 800;
const height = 500;
const margin = { top: 20, right: 30, bottom: 40, left: 50 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

// Define global variables so our update functions can access them
let commits = [];
let xScale, yScale, rScale, xAxis, yAxis;
let svg, dotsGroup;
let colors = d3.scaleOrdinal(d3.schemeTableau10); // Color scale for file types

async function initVisualizations() {
    // 1. Load the Data
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        datetime: new Date(row.datetime)
    }));

    // 2. Group the data by Commit and sort chronologically for scrollytelling
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

    // 3. Setup the SVG
    svg = d3.select('#scatterplot')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Group specifically for dots so they stay behind axes/brush if needed
    dotsGroup = g.append('g').attr('class', 'dots');

    // 4. Create Scales
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

    // 5. Draw Axes
    xAxis = d3.axisBottom(xScale);
    yAxis = d3.axisLeft(yScale).tickFormat(d3.timeFormat("%H:%M"));

    g.append('g')
        .attr('class', 'x-axis') // Class added for dynamic updating
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

    g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis)
        .call(g => g.selectAll('.tick line').clone()
            .attr('x2', innerWidth)
            .attr('stroke-opacity', 0.1)
        );

    // 6. Generate the Narrative Text (Scrollytelling Steps)
    d3.select('#scatter-story')
        .selectAll('.step')
        .data(commits)
        .join('div')
        .attr('class', 'step')
        .html((d, i) => `
            <h3>${d.datetime.toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' })}</h3>
            <p>I made ${i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'}.</p>
            <p>I edited <strong>${d.linesEdited}</strong> lines across <strong>${d3.rollups(d.lines, D => D.length, d => d.file).length}</strong> files.</p>
        `);

    // 7. Setup Scrollama
    const scroller = scrollama();
    scroller
        .setup({
            container: '#scrolly-1',
            step: '#scrolly-1 .step',
            offset: 0.5, // Triggers when the step hits the middle of the screen
        })
        .onStepEnter((response) => {
            // Get the datetime from the step that just scrolled into view
            const currentCommitDate = response.element.__data__.datetime;
            
            // Filter commits up to this point in time
            const filteredCommits = commits.filter(d => d.datetime <= currentCommitDate);
            
            // Update all visual components!
            updateScatterPlot(filteredCommits);
            updateSummaryStats(filteredCommits);
            updateFileDisplay(filteredCommits);
        });

    // Initialize the visuals with an empty array or the first commit so it starts blank
    updateScatterPlot([]);
    updateSummaryStats([]);
    updateFileDisplay([]);
}

// === UPDATE FUNCTIONS ===

function updateScatterPlot(filteredCommits) {
    const tooltip = d3.select('#commit-tooltip');

    // D3 Data Join using the commit ID as the unique key for stable animations!
    const dots = dotsGroup.selectAll('circle')
        .data(filteredCommits, d => d.id)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(new Date(2000, 0, 1, d.datetime.getHours(), d.datetime.getMinutes())))
        // We use CSS variables to power the radius transition
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
    // Flatten lines and group by file
    let lines = filteredCommits.flatMap((d) => d.lines);
    let files = d3.groups(lines, (d) => d.file).map(([name, lines]) => {
        return { name, lines };
    }).sort((a, b) => b.lines.length - a.lines.length); // Sort descending by size

    // D3 Join for the Dictionary List
    let filesContainer = d3.select('#files')
        .selectAll('div')
        .data(files, d => d.name)
        .join(
            enter => enter.append('div').call(div => {
                const dt = div.append('dt');
                dt.append('code');
                dt.append('small'); // For the line count
                div.append('dd');
            })
        );

    // Update Text
    filesContainer.select('dt > code').text(d => d.name);
    filesContainer.select('dt > small').text(d => `${d.lines.length} lines`);

    // Draw the unit visualization dots (one for each line)
    filesContainer.select('dd')
        .selectAll('div')
        .data(d => d.lines)
        .join('div')
        .attr('class', 'loc')
        // Color the dot based on its file extension/technology
        .attr('style', d => `--color: ${colors(d.type)}`);
}

// Fire it up
initVisualizations();