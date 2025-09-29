<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    let pageContent = '';
    let pageTitle = 'Loading...';

    onMount(async () => {
        const slug = $page.params.slug;
        try {
            const response = await fetch(`/thunder/${slug}.html`);
            if (response.ok) {
                pageContent = await response.text();
                // Attempt to extract title from the fetched HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(pageContent, 'text/html');
                const titleElement = doc.querySelector('title');
                if (titleElement) {
                    pageTitle = titleElement.textContent || 'Thunder Page';
                } else {
                    pageTitle = 'Thunder Page';
                }
            } else {
                pageContent = '<p>Error loading page.</p>';
                pageTitle = 'Error';
            }
        } catch (error) {
            pageContent = `<p>Error: ${error.message}</p>`;
            pageTitle = 'Error';
        }
    });
</script>

<svelte:head>
    <title>{pageTitle} - Korrykatti Thunder</title>
</svelte:head>

<header>
    <h1>{pageTitle}</h1>
    <p><a href="/" style="color: white;">go home</a></p>
</header>

<div class="container">
    {@html pageContent}
</div>

<footer>
    <p>&copy; Korrykatti | <a href="/">Go Home</a></p>
</footer>