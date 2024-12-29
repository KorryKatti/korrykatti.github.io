document.addEventListener('DOMContentLoaded', function() {
    const linesContainer = document.querySelector('.connecting-lines');
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Create lines
    const lines = ['top', 'bottom', 'left', 'right'];
    lines.forEach(position => {
        const line = document.createElement('div');
        line.className = `line line-${position}`;
        line.style.transition = 'all 2s cubic-bezier(0.4, 0, 0.2, 1)';
        line.style.position = 'absolute';
        
        // Set initial positions and calculate total distance
        switch(position) {
            case 'top':
                line.style.top = '0';
                line.style.left = `${Math.random() * 100}%`;
                line.dataset.startPosition = line.style.left;
                line.dataset.totalDistance = `${windowWidth}px`;
                line.dataset.moveDistance = `${windowWidth * 0.5}px`;
                break;
            case 'bottom':
                line.style.bottom = '0';
                line.style.left = `${Math.random() * 100}%`;
                line.dataset.startPosition = line.style.left;
                line.dataset.totalDistance = `${windowWidth}px`;
                line.dataset.moveDistance = `${windowWidth * 0.5}px`;
                break;
            case 'left':
                line.style.left = '0';
                line.style.top = `${Math.random() * 100}%`;
                line.dataset.startPosition = line.style.top;
                line.dataset.totalDistance = `${windowHeight}px`;
                line.dataset.moveDistance = `${windowHeight * 0.5}px`;
                break;
            case 'right':
                line.style.right = '0';
                line.style.top = `${Math.random() * 100}%`;
                line.dataset.startPosition = line.style.top;
                line.dataset.totalDistance = `${windowHeight}px`;
                line.dataset.moveDistance = `${windowHeight * 0.5}px`;
                break;
        }
        
        line.dataset.position = '0px';
        linesContainer.appendChild(line);
    });

    // Continuous coordinate update function
    function updateCoordinates() {
        document.querySelectorAll('.line').forEach(line => {
            const rect = line.getBoundingClientRect();
            let coordinates = '';
            
            if (line.classList.contains('line-top') || line.classList.contains('line-bottom')) {
                coordinates = `${Math.round(rect.left)}px`;
                
                // Move line horizontally
                const currentLeft = parseFloat(coordinates);
                const totalDistance = parseFloat(line.dataset.totalDistance);
                const moveDistance = parseFloat(line.dataset.moveDistance);
                
                if (currentLeft < moveDistance) {
                    line.style.left = `${currentLeft + 5}px`;
                }
            } else {
                coordinates = `${Math.round(rect.top)}px`;
                
                // Move line vertically
                const currentTop = parseFloat(coordinates);
                const totalDistance = parseFloat(line.dataset.totalDistance);
                const moveDistance = parseFloat(line.dataset.moveDistance);
                
                if (currentTop < moveDistance) {
                    line.style.top = `${currentTop + 5}px`;
                }
            }
            
            line.setAttribute('data-position', coordinates);
        });
        
        requestAnimationFrame(updateCoordinates);
    }

    // Start coordinate tracking
    updateCoordinates();
});