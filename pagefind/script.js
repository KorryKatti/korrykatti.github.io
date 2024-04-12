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
      if (content.toLowerCase().includes(query.toLowerCase()) || article.title.toLowerCase().includes(query.toLowerCase())) {
        filteredResults.push(article);
      }
    }
    return filteredResults;
  }

  // Function to display search results
  async function displayResults(results) {
    searchResults.innerHTML = '';
    results.forEach(async result => {
      const resultBox = document.createElement('div');
      resultBox.classList.add('search-result-box');

      // Create image element
      const resultImage = document.createElement('img');
      resultImage.classList.add('search-result-image');
      resultImage.src = result.image; // Replace 'image' with the actual property name where image URL is stored
      resultBox.appendChild(resultImage);

      // Create article name element
      const resultTitle = document.createElement('h3');
      resultTitle.classList.add('search-result-title');
      resultTitle.textContent = result.title;
      resultBox.appendChild(resultTitle);

      // Make the entire box clickable
      resultBox.addEventListener('click', () => {
        window.location.href = `articles/${result.fileName}`;
      });

      searchResults.appendChild(resultBox);
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
  { title: 'Thunder', fileName: 'Thunder.html', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRBfcHmsQKdQ5PPx9ziLeuaG072VrtullSZEe2JMJQA6w&s' },
  { title: 'Sample Article 2', fileName: 'article2.html', image: 'path/to/image2.jpg' },
  { title: 'Sample Article 3', fileName: 'article3.html', image: 'path/to/image3.jpg' }
  // Add more articles here...
];
