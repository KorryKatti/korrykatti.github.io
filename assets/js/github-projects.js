// GitHub Projects Fetcher
(async function () {
    const container = document.getElementById('github-projects');
    if (!container) return;

    try {
        const response = await fetch('https://api.github.com/users/KorryKatti/repos?sort=pushed&per_page=6');
        const repos = await response.json();

        if (!repos || repos.length === 0) {
            container.innerHTML = '<li class="project-item" style="opacity: 0.5;">no projects found.</li>';
            return;
        }

        container.innerHTML = '';
        repos.forEach(repo => {
            const item = document.createElement('li');
            item.className = 'project-item';
            item.innerHTML = `
                <a href="${repo.html_url}" target="_blank" class="project-title">${repo.name.toLowerCase()}</a>
                <p class="project-desc">${repo.description ? repo.description.toLowerCase() : 'no description.'}</p>
                <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.5; font-family: monospace;">
                    ${repo.language ? `<span>${repo.language.toLowerCase()}</span>` : ''}
                    <span>★ ${repo.stargazers_count}</span>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = '<li class="project-item" style="opacity: 0.5;">failed to load projects.</li>';
    }
})();
