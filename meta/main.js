import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Layout configurations
const width = 800;
const height = 500;
const margin = { top: 20, right: 30, bottom: 40, left: 50 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

async function createScatterplot() {
    // 1. Load the Data
    // Ensure your loc.csv is in the meta folder
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        datetime: new Date(row.date + 'T' + row.time),
        lines: +row.lines // Convert string to number
    }));

    // 2. Setup the SVG and Group for margins
    const svg = d3.select('#scatterplot')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // 3. Create Scales
    // X-Axis: Date of the commit
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.datetime))
        .range([0, innerWidth])
        .nice();

    // Y-Axis: Time of day (mapped to a single dummy date to calculate hours)
    const yScale = d3.scaleTime()
        .domain([new Date(2000, 0, 1, 0, 0), new Date(2000, 0, 1, 23, 59)])
        .range([innerHeight, 0]);

    // R-Scale: Dynamic dot sizing based on lines edited
    const rScale = d3.scaleSqrt()
        .domain(d3.extent(data, d => d.lines))
        .range([3, 20]); // Min radius 3, max radius 20

    // 4. Draw Axes & Gridlines
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).tickFormat(d3.timeFormat("%H:%M"));

    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

    g.append('g')
        .call(yAxis)
        // Add subtle horizontal gridlines
        .call(g => g.selectAll('.tick line').clone()
            .attr('x2', innerWidth)
            .attr('stroke-opacity', 0.1)
        );

    // 5. Tooltip Logic
    const tooltip = d3.select('#commit-tooltip');
    
    function updateTooltipContent(commit) {
        if (!commit) return;
        d3.select('#commit-info').html(`
            <dt>Date:</dt><dd>${commit.datetime.toLocaleDateString()}</dd>
            <dt>Time:</dt><dd>${commit.datetime.toLocaleTimeString()}</dd>
            <dt>Lines Edited:</dt><dd>${commit.lines}</dd>
            <dt>Author:</dt><dd>${commit.author || 'Me'}</dd>
        `);
    }

    // 6. Draw the Dots
    const dots = g.selectAll('circle')
        .data(data)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        // Force all times to the dummy date 2000-01-01 to plot purely by time of day
        .attr('cy', d => yScale(new Date(2000, 0, 1, d.datetime.getHours(), d.datetime.getMinutes())))
        .attr('r', d => rScale(d.lines))
        .attr('fill', 'var(--color-accent, #005a9c)')
        .attr('fill-opacity', 0.6)
        .attr('stroke', 'canvas')
        .attr('stroke-width', 1)
        // Hover Interactions
        .on('mouseenter', (event, d) => {
            d3.select(event.currentTarget).attr('fill-opacity', 1).attr('stroke', 'red');
            tooltip.classed('hidden', false);
            updateTooltipContent(d);
            
            // Position tooltip near the cursor
            tooltip.style('left', `${event.pageX + 15}px`)
                   .style('top', `${event.pageY + 15}px`);
        })
        .on('mousemove', (event) => {
            tooltip.style('left', `${event.pageX + 15}px`)
                   .style('top', `${event.pageY + 15}px`);
        })
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).attr('fill-opacity', 0.6).attr('stroke', 'canvas');
            tooltip.classed('hidden', true);
        });

    // 7. Brushing Logic
    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('start brush end', brushed);

    // Add brush layer on top of dots
    g.append('g')
        .attr('class', 'brush')
        .call(brush);

    // Bring dots to front so hover still works through the brush
    g.selectAll('circle').raise();

    function brushed(event) {
        let selection = event.selection;
        let selectedData = [];

        if (selection) {
            const [[x0, y0], [x1, y1]] = selection;
            selectedData = data.filter(d => {
                const cx = xScale(d.datetime);
                const cy = yScale(new Date(2000, 0, 1, d.datetime.getHours(), d.datetime.getMinutes()));
                return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
            });

            // Highlight selected dots visually
            dots.classed('dimmed', d => !selectedData.includes(d));
        } else {
            // If brush is cleared, reset
            selectedData = data;
            dots.classed('dimmed', false);
        }

        updateSummaryStats(selectedData);
    }

    // 8. Summary Statistics Setup
    function updateSummaryStats(activeData) {
        const statsDiv = d3.select('#stats');
        
        const totalCommits = activeData.length;
        const totalLines = d3.sum(activeData, d => d.lines);
        const avgLines = totalCommits > 0 ? (totalLines / totalCommits).toFixed(1) : 0;

        statsDiv.html(`
            <div class="stat-card"><strong>${totalCommits}</strong> Commits</div>
            <div class="stat-card"><strong>${totalLines}</strong> Lines Edited</div>
            <div class="stat-card"><strong>${avgLines}</strong> Avg Lines/Commit</div>
        `);
    }

    // Initialize stats with all data
    updateSummaryStats(data);
}

// Fire it up
createScatterplot();