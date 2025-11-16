// Modal functionality
document.addEventListener('DOMContentLoaded', () => {
    const openModalBtn = document.getElementById('open-modal-btn');
    const modal = document.getElementById('modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Get last commit info
async function getLastCommit() {
    try {
        const response = await fetch("https://api.github.com/repos/korrykatti/korrykatti.github.io/commits");
        const commits = await response.json();
        const lastCommitDate = new Date(commits[0].commit.committer.date);

        const now = new Date();
        const diffTime = Math.abs(now - lastCommitDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        document.getElementById('last-updated').textContent = 
            `LAST_UPDATE: ${diffDays} days ago (${lastCommitDate.toDateString()})`;
    } catch (error) {
        console.error("Error fetching last commit:", error);
        document.getElementById('last-updated').textContent = "SYSTEM_ERROR: update data unavailable";
    }
}

async function getStatus() {
    try {
        const response = await fetch('http://duinogame.pythonanywhere.com/statusget');
        const data = await response.json();
        const statusContainer = document.getElementById('status-container');

        let statusHtml = `<div class="status-header"><strong>CURRENT_STATUS:</strong> ${data.current_status.status}</div>`;
        if (data.current_status.status === 'online') {
            statusHtml += '<div class="status-bar"></div>';
            statusHtml += '<div class="activities">';
            data.current_status.activities.forEach(activity => {
                statusHtml += '<div class="activity">';
                if (activity.activity_type === 'spotify') {
                    statusHtml += `Listening to: ${activity.title} by ${activity.artist}`;
                } else if (activity.activity_type === 'game') {
                    statusHtml += `Playing: ${activity.name}`;
                } else {
                    statusHtml += `${activity.name}`;
                }
                statusHtml += '</div>';
            });
            statusHtml += '</div>';
        }
        statusContainer.innerHTML = statusHtml;
    } catch (error) {
        console.error('Error fetching status:', error);
        const statusContainer = document.getElementById('status-container');
        statusContainer.innerHTML = '<strong>CURRENT_STATUS:</strong> Error fetching status';
    }
}

// Initialize
window.addEventListener('load', () => {
    getLastCommit();
    getStatus();
});