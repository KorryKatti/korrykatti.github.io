

---

## 1. Global background + text

```css
body {
  background: #252f26;          /* dark olive */
  color: #f5f5f5;               /* main text */
  font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

a {
  color: #f2b441;               /* gold accent */
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
```

If your layout uses a main `.container`, give it a max width and center it:

```css
.container {
  max-width: 1100px;
  margin: 0 auto;
}
```

---

## 2. Left column card (the whole “status + image + text” block)

Right now it’s white with a light border. Make it a dark console module:

```css
.left-panel {
  background: #181a20;
  border-radius: 16px;
  border: 1px solid #2a2d33;
  padding: 20px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
}
```

Apply that class to whatever wrapper holds your current status, image, intro text, and links.

---

## 3. “CURRENT_STATUS” box

Keep the “system window” feel, but invert the colors:

```css
.status-box {
  background: #1f2229;
  border-radius: 12px;
  border: 1px solid #2a2d33;
  padding: 12px 16px;
  margin-bottom: 18px;
}

.status-label {
  font-weight: 700;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
}

.status-value {
  margin-top: 4px;
  font-size: 0.85rem;
  color: #a0a3aa;
}
```

---

## 4. Collage image

Just give it padding + rounding so it feels “placed”:

```css
.profile-image {
  width: 100%;
  border-radius: 12px;
  margin: 0 0 14px 0;
  display: block;
}
```

Make sure the `<img>` for your collage has `class="profile-image"`.

---

## 5. Intro text + links columns

Keep the messy text vibe but improve readability:

```css
.intro-text {
  font-size: 0.9rem;
  line-height: 1.5;
  color: #f5f5f5;
  margin-bottom: 16px;
}

.columns {
  display: flex;
  gap: 32px;
  font-size: 0.9rem;
}

.columns h4 {
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.columns ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.columns li {
  margin-bottom: 2px;
}
```

Attach `.columns` to the wrapper of “PROJECTS & BLOG / LINKS / SPECIAL”.

---

## 6. “SYSTEM_ERROR” box + button

Make it look like a fake terminal warning:

```css
.error-box {
  background: #1f2229;
  border-radius: 12px;
  border: 1px solid #2a2d33;
  padding: 14px 16px;
  margin-top: 20px;
  font-size: 0.85rem;
  color: #f5f5f5;
}

.error-label {
  font-weight: 700;
}

.button {
  display: inline-block;
  margin-top: 10px;
  padding: 8px 16px;
  border-radius: 999px;
  background: #f2b441;
  color: #181a20;
  font-weight: 600;
  border: none;
  text-decoration: none;
  cursor: pointer;
}
.button:hover {
  background: #e2941d;
}
```

---

## 7. Right side: “Under Construction”

Right side is currently a huge white void. At minimum:

```css
.right-panel {
  color: #a0a3aa;
  padding: 24px;
}

.right-panel h2 {
  font-size: 0.9rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
```

Or you can just blur it out with a faint border box so it matches:

```css
.right-panel-placeholder {
  border: 1px dashed #2a2d33;
  border-radius: 16px;
  padding: 20px;
  color: #a0a3aa;
  font-size: 0.85rem;
}
```

