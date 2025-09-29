<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    let postContent = '';
    let postTitle = 'Loading...';

    onMount(async () => {
        const slug = $page.params.slug;
        try {
            const response = await fetch(`/blog/posts/${slug}.html`);
            if (response.ok) {
                postContent = await response.text();
                // Attempt to extract title from the fetched HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(postContent, 'text/html');
                const titleElement = doc.querySelector('title');
                if (titleElement) {
                    postTitle = titleElement.textContent || 'Blog Post';
                } else {
                    postTitle = 'Blog Post';
                }
            } else {
                postContent = '<p>Error loading post.</p>';
                postTitle = 'Error';
            }
        } catch (error) {
            postContent = `<p>Error: ${error.message}</p>`;
            postTitle = 'Error';
        }
    });
</script>

<svelte:head>
    <title>{postTitle} - Korrykatti Blog</title>
    <link rel="stylesheet" href="/blog/blogpost.css">
</svelte:head>

<header>
    <h1>{postTitle}</h1>
    <p><a href="/blog" style="color: white;">back to blog</a></p>
</header>

<div class="container">
    {@html postContent}
</div>

<footer>
    <p>&copy; Korrykatti | <a href="/">Go Home</a></p>
</footer>