document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
  
    // Function to fetch article content from file
    async function fetchArticleContent(fileName) {
      const response = await fetch(`articles/${fileName}`);
      const content = await response.text();
      return content;
    }
  
    // Function to filter articles based on search input
    async function filterArticles(query) {
      const filteredResults = [];
      for (const article of articles) {
        const content = await fetchArticleContent(article.fileName);
        if (content.toLowerCase().includes(query.toLowerCase())) {
          filteredResults.push(article);
        }
      }
      return filteredResults;
    }
  
    // Function to display search results
    function displayResults(results) {
      searchResults.innerHTML = '';
      results.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.title;
        li.addEventListener('click', () => {
          window.location.href = `articles/${result.fileName}`;
        });
        searchResults.appendChild(li);
      });
    }
  
    // Event listener for input changes
    searchInput.addEventListener('input', async function () {
      const query = this.value.trim();
      if (query.length === 0) {
        searchResults.innerHTML = '';
        return;
      }
      const filteredArticles = await filterArticles(query);
      displayResults(filteredArticles);
    });
  });
  
  // Dummy articles array (replace with actual article filenames)
  const articles = [
    { title: 'Sample Article 1', fileName: 'article1.html' },
    { title: 'Sample Article 2', fileName: 'article2.html' },
    { title: 'Sample Article 3', fileName: 'article3.html' }
    // Add more articles here...
  ];
  