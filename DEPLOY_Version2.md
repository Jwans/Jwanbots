# Deploying JBot WhatsApp Bot

## Supported platforms
- [Glitch](https://glitch.com/)
- [Render](https://render.com/)
- [Cyclic](https://cyclic.sh/)

## How to Deploy

### 1. Create a new Node.js app on your chosen platform.

### 2. Add the files:
- `bot.js`
- `package.json`

### 3. Install dependencies (automatic on Glitch/Render/Cyclic).

### 4. Set the following environment variables in your dashboard:
- `OPENAI_API_KEY` — your OpenAI API key (for ChatGPT AI)
- `PAIR_PHONE` — your WhatsApp number for pairing code (e.g., 1234567890)

### 5. Run the app.

### 6. Check the logs:
- If using pairing code: Copy the code and, on WhatsApp (phone), go to Menu > Linked Devices > Link with Code, and enter the code.

### 7. The bot is online!

---

**Notes:**
- Music/video features need you to plug in a third-party API or use a library like `ytdl-core` for YouTube.
- Remember to respect WhatsApp's terms and conditions.
- For more advanced games, add your own logic to `handleGame`.