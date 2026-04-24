import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// --- Part 1: Latest Projects ---
const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects.slice(0, 3);
const projectsContainer = document.querySelector('.projects');

if (projectsContainer) {
    renderProjects(latestProjects, projectsContainer, 'h2');
}

// --- Part 2: GitHub Stats ---
const githubData = await fetchGitHubData('Xcysteven');
const profileStats = document.querySelector('#profile-stats');

if (profileStats) {
    profileStats.innerHTML = `
          <dl>
            <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
            <dt>Public Gists:</dt><dd>${githubData.public_gists}</dd>
            <dt>Followers:</dt><dd>${githubData.followers}</dd>
            <dt>Following:</dt><dd>${githubData.following}</dd>
          </dl>
      `;
}