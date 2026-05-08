import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const width = 800;
const height = 500;
const margin = { top: 20, right: 30, bottom: 40, left: 50 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

async function createScatterplot() {
    // 1. Load the Data
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        datetime: new Date(row.datetime)
    }));

    // 2. Group the data by Commit (combines individual lines into whole commits)
    const commits = d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
        const first = lines[0];
        return {
            id: commit,
            datetime: first.datetime,
            author: first.author,
            date: first.date,
            time: first.time,
            linesEdited: lines.length
        };
    });

    // 3. Setup the SVG and Group for margins
    const svg = d3.select('#scatterplot')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // 4. Create Scales
    const xScale = d3.scaleTime()
        .domain(d3.extent(commits, d => d.datetime))
        .range([0, innerWidth])
        .nice();

    const yScale = d3.scaleTime()
        .domain([new Date(2000, 0, 1, 0, 0), new Date(2000, 0, 1, 23, 59)])
        .range([innerHeight, 0]);

    const rScale = d3.scaleSqrt()
        .domain(d3.extent(commits, d => d.linesEdited))
        .range([3, 20]); // Min radius 3, max radius 20

    // 5. Draw Axes & Gridlines
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).tickFormat(d3.timeFormat("%H:%M"));

    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

    g.append('g')
        .call(yAxis)
        .call(g => g.selectAll('.tick line').clone()
            .attr('x2', innerWidth)
            .attr('stroke-opacity', 0.1)
        );

    // 6. Tooltip Logic
    const tooltip = d3.select('#commit-tooltip');

    function updateTooltipContent(commit) {
        if (!commit) return;
        d3.select('#commit-info').html(`
            <dt>Date:</dt><dd>${commit.datetime.toLocaleDateString()}</dd>
            <dt>Time:</dt><dd>${commit.datetime.toLocaleTimeString()}</dd>
            <dt>Lines Edited:</dt><dd>${commit.linesEdited}</dd>
            <dt>Author:</dt><dd>${commit.author || 'Me'}</dd>
        `);
    }

    // 7. Draw the Dots
    const dots = g.selectAll('circle')
        .data(commits)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(new Date(2000, 0, 1, d.datetime.getHours(), d.datetime.getMinutes())))
        .attr('r', d => rScale(d.linesEdited))
        .attr('fill', 'var(--color-accent, #005a9c)')
        .attr('fill-opacity', 0.6)
        .attr('stroke', 'canvas')
        .attr('stroke-width', 1)
        .on('mouseenter', (event, d) => {
            d3.select(event.currentTarget).attr('fill-opacity', 1).attr('stroke', 'red');
            tooltip.classed('hidden', false);
            updateTooltipContent(d);
            
            // Fixed Double Offset: Using clientX and clientY
            tooltip.style('left', `${event.clientX + 15}px`)
                   .style('top', `${event.clientY + 15}px`);
        })
        .on('mousemove', (event) => {
            // Fixed Double Offset: Using clientX and clientY
            tooltip.style('left', `${event.clientX + 15}px`)
                   .style('top', `${event.clientY + 15}px`);
        })
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).attr('fill-opacity', 0.6).attr('stroke', 'canvas');
            tooltip.classed('hidden', true);
        });

    // 8. Brushing Logic
    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('start brush end', brushed);

    g.append('g')
        .attr('class', 'brush')
        .call(brush);

    // Bring dots to front so hover still works through the brush
    g.selectAll('circle').raise();

    function brushed(event) {
        let selection = event.selection;
        let selectedCommits = [];

        if (selection) {
            const [[x0, y0], [x1, y1]] = selection;
            selectedCommits = commits.filter(d => {
                const cx = xScale(d.datetime);
                const cy = yScale(new Date(2000, 0, 1, d.datetime.getHours(), d.datetime.getMinutes()));
                return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
            });

            dots.classed('dimmed', d => !selectedCommits.includes(d));
        } else {
            selectedCommits = commits;
            dots.classed('dimmed', false);
        }

        updateSummaryStats(selectedCommits);
    }

    // 9. Summary Statistics Logic
    function updateSummaryStats(activeCommits) {
        const statsDiv = d3.select('#stats');

        const totalCommits = activeCommits.length;
        const totalLines = d3.sum(activeCommits, d => d.linesEdited);
        const avgLines = totalCommits > 0 ? (totalLines / totalCommits).toFixed(1) : 0;

        statsDiv.html(`
            <div class="stat-card"><strong>${totalCommits}</strong> Commits</div>
            <div class="stat-card"><strong>${totalLines}</strong> Lines Edited</div>
            <div class="stat-card"><strong>${avgLines}</strong> Avg Lines/Commit</div>
        `);
    }

    // Initialize stats with all commits
    updateSummaryStats(commits);
}

// Fire it up
createScatterplot();