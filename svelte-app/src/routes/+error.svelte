<script>
    import { page } from '$app/stores';
</script>

<svelte:head>
    <title>Page Not Found - Korrykatti</title>
</svelte:head>

<style>
    body {
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 50px;
    }
    h1 {
      font-size: 36px;
      margin-bottom: 20px;
    }
    p {
      font-size: 18px;
      margin-bottom: 20px;
    }
    a {
      color: #007bff;
    }
</style>

<h1>{$page.status} - {$page.error?.message}</h1>
<p>Oops! The page you're looking for couldn't be found.</p>
<a href="/">Go to Homepage</a>