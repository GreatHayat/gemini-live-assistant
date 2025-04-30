# Gemini Live Assistant

This is a chatbot app that lets you have conversations using both text and voice. It uses the **Gemini LIVE API** from Google and is built with **React**, **TypeScript**, and **Vite**, with styling from **TailwindCSS**.


<img width="1439" alt="Screenshot 2025-04-30 at 1 23 38 PM" src="https://github.com/user-attachments/assets/2a778ba0-ed54-45d1-ad84-11f37155bb20" />

## Features

- Conversational chatbot with text and audio support.
- Built with modern web technologies: React, TypeScript, and Vite.
- Styled using TailwindCSS.
- Includes syntax highlighting for code blocks in conversations..

## Prerequisites

Before getting started, make sure you have:

- Node.js (version 18 or above)
- npm or yarn installed
- A Gemini API key from [Google AI Studio](https://ai.google/studio/)

## Installation

1. Clone the project:
   ```
   git clone https://github.com/GreatHayat/gemini-live-assistant.git
   cd gemini-live-assistant
   ```

2. Install the required packages:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

## Environment Configuration

To connect the app with Gemini:

1. Get your Gemini API key from [Google AI Studio](https://ai.google/studio/)
2. Create a file named `.env.local` in the project root
3. Copy the structure from `.env.sample`
4. Add your API key:
   ```
   VITE_GEMINI_API_KEY=your-api-key-here
   ```

## Available Scripts

- `npm run dev` – Starts the development server
- `npm run build` – Builds the app for production
- `npm run lint` – Checks the code for issues
- `npm run preview` – Previews the production build locally

## Usage

After starting the development server, open your browser at:

```
http://localhost:5173
```

Start chatting with the assistant using text or voice.

## Contributing

Want to contribute? Follow these steps:

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Open a pull request

## License

This project is open-source. You're welcome to use and improve it!

---

Let me know if you’d like a version that includes screenshots or deployment instructions (e.g., for Vercel or Netlify).
