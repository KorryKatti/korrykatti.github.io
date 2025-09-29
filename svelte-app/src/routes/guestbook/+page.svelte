<script>
    import { onMount } from 'svelte';

    let nameInput = '';
    let messageInput = '';
    let captchaQuestion = '';
    let captchaAnswer = '';
    let correctAnswer = 0;
    let entries = [];

    async function loadEntries() {
        try {
            const response = await fetch('https://korrykatti.pythonanywhere.com/guestbook');
            if (!response.ok) throw new Error('Network response was not ok');
            const fetchedEntries = await response.json();
            
            // Basic XSS prevention
            const escapeHTML = (str) => {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            };

            entries = fetchedEntries.reverse().map(entry => ({
                name: escapeHTML(entry.name),
                message: escapeHTML(entry.message)
            }));
        } catch (error) {
            console.error('Error loading entries:', error);
            entries = [{ name: 'System', message: 'Error loading entries. Please try again later.' }];
        }
    }

    function generateCaptcha() {
        const num1 = Math.floor(Math.random() * 10);
        const num2 = Math.floor(Math.random() * 10);
        captchaQuestion = `What is ${num1} + ${num2}?`;
        correctAnswer = num1 + num2;
    }

    async function submitMessage() {
        const userAnswer = parseInt(captchaAnswer, 10);

        // Check localStorage for submission timestamp
        const lastSubmission = localStorage.getItem('lastSubmission');
        const currentTime = Date.now();
        const twentyDaysInMillis = 20 * 24 * 60 * 60 * 1000; // 20 days in milliseconds

        if (lastSubmission && (currentTime - lastSubmission < twentyDaysInMillis)) {
            alert('You can only submit once every 20 days. Please wait before trying again.');
            return;
        }

        if (userAnswer !== correctAnswer) {
            alert('Incorrect answer to the CAPTCHA. Please try again.');
            generateCaptcha();
            captchaAnswer = '';
            return;
        }

        try {
            const response = await fetch('https://korrykatti.pythonanywhere.com/submit_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ 
                    name: nameInput.trim(), 
                    message: messageInput.trim()
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                // Store the current timestamp in localStorage
                localStorage.setItem('lastSubmission', currentTime);
                nameInput = '';
                messageInput = '';
                captchaAnswer = '';
                generateCaptcha();
                loadEntries();
            } else {
                console.error('Error submitting message:', result.message);
            }
        } catch (error) {
            console.error('Error submitting message:', error);
        }
    }

    onMount(() => {
        loadEntries();
        generateCaptcha();
    });
</script>

<svelte:head>
    <title>Guestbook - Korrykatti</title>
</svelte:head>

<style>
    body {
        background: #000;
        color: #b8b8b8;
        font-family: 'Courier New', monospace;
        padding: 20px;
    }
    .entry {
        background: #0a0a0a;
        border: 1px solid #333;
        border-radius: 5px;
        padding: 10px;
        margin-bottom: 10px;
        animation: flicker 0.15s infinite;
    }
    form {
        margin-bottom: 20px;
        background: #111;
        padding: 15px;
        border-radius: 5px;
        border: 1px solid #333;
    }
    input, textarea {
        width: 100%;
        padding: 10px;
        margin: 5px 0;
        border: 1px solid #ccc;
        border-radius: 5px;
        background: #222;
        color: #fff;
    }
    button {
        background-color: #4CAF50;
        color: white;
        padding: 10px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
    button:hover {
        background-color: #45a049;
    }
    #captchaQuestion {
        margin: 10px 0;
        color: #c43c3c;
    }
    /* Flicker effect */
    @keyframes flicker {
        0% { opacity: 1; }
        49% { opacity: 1; }
        50% { opacity: 0.8; }
        51% { opacity: 1; }
        100% { opacity: 1; }
    }
</style>

<h1>Guestbook</h1>
<form on:submit|preventDefault={submitMessage}>
    <input type="text" bind:value={nameInput} placeholder="Your Name" required>
    <textarea bind:value={messageInput} placeholder="Your Message" required></textarea>
    <div id="captchaQuestion">{captchaQuestion}</div>
    <input type="text" bind:value={captchaAnswer} placeholder="Your Answer" required>
    <button type="submit">Submit</button>
</form>
<div id="entries">
    {#each entries as entry}
        <div class="entry">
            <strong>{@html entry.name}</strong>
            <p>{@html entry.message}</p>
        </div>
    {:else}
        <p>No entries yet.</p>
    {/each}
</div>