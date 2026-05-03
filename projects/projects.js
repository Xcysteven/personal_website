import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');

// State variables for our unified filtering
let query = '';
let selectedIndex = -1;

// EXTRA CREDIT SOLUTION: Unified Filtering Logic
function evaluateFilters() {
    // 1. Filter by Search Query first
    let filteredByQuery = projects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query);
    });

    // 2. Render the Pie Chart based ONLY on the search query
    // (This prevents the pie chart from collapsing into a single 100% wedge when clicked)
    renderPieChart(filteredByQuery);

    // 3. Filter further by the Selected Pie Wedge (Year)
    let finalFilteredProjects = filteredByQuery;
    if (selectedIndex !== -1) {
        // Find out what year the clicked wedge corresponds to
        let rolledData = d3.rollups(filteredByQuery, (v) => v.length, (d) => d.year);
        let selectedYear = rolledData[selectedIndex]?.[0];

        if (selectedYear) {
            finalFilteredProjects = filteredByQuery.filter(p => p.year === selectedYear);
        }
    }

    // 4. Render the final list of project articles to the screen
    renderProjects(finalFilteredProjects, projectsContainer, 'h2');
    
    // Update the Project Count at the top of the page
    if (projectsTitle) {
        projectsTitle.textContent = `${finalFilteredProjects.length} Projects`;
    }
}

// Function to draw/redraw the D3 Pie Chart
function renderPieChart(projectsGiven) {
    let rolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year
    );

    let data = rolledData.map(([year, count]) => {
        return { value: count, label: year };
    });

    let sliceGenerator = d3.pie().value((d) => d.value);
    let arcData = sliceGenerator(data);
    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let arcs = arcData.map((d) => arcGenerator(d));
    let colors = d3.scaleOrdinal(d3.schemeTableau10);

    // Clear existing SVGs and Legends to prevent duplicates
    let svg = d3.select('#projects-pie-plot');
    svg.selectAll('path').remove();
    let legend = d3.select('.legend');
    legend.selectAll('li').remove();

    // Draw the Wedges
    arcs.forEach((arc, i) => {
        svg.append('path')
           .attr('d', arc)
           .attr('fill', colors(i))
           .attr('class', i === selectedIndex ? 'selected' : '')
           .on('click', () => {
               // Toggle selection
               selectedIndex = selectedIndex === i ? -1 : i;
               // Trigger unified filter!
               evaluateFilters(); 
           });
    });

    // Draw the Legend
    data.forEach((d, idx) => {
        legend.append('li')
              .attr('style', `--color:${colors(idx)}`)
              .attr('class', idx === selectedIndex ? 'selected' : '')
              .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
    });
}

// Listen for typing in the search bar
searchInput.addEventListener('input', (event) => {
    query = event.target.value.toLowerCase();
    selectedIndex = -1; // Reset pie selection when user types a new search
    evaluateFilters();  // Trigger unified filter!
});

// Run everything once when the page initially loads
evaluateFilters();