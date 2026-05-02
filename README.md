# NeuroX: Cognitive Relay Ecosystem

**Public GitHub Repository**: [https://github.com/uvishwakchander/NeuroX_Promptwars](https://github.com/uvishwakchander/NeuroX_Promptwars)  
**Live Application**: [https://neurox-promptwars-git-635406548197.europe-west1.run.app/app/](https://neurox-promptwars-git-635406548197.europe-west1.run.app/app/)

---

## 📌 1. Chosen Vertical
**Cognitive Health & Workspace Productivity (Neuro-Inclusion)**
NeuroX bridges the gap between high-performance SaaS tools and neuro-inclusive wellness. It is designed to mitigate burnout, prevent context-switching penalties (the "Interruption Cost"), and provide on-demand empathetic AI support for modern knowledge workers.

## 🧠 2. Approach and Logic
Standard task managers treat all notifications equally, which can destroy the "flow state" of a neurodiverse individual (e.g., those with ADHD or Autism) who has finally achieved Hyper-Focus. Our approach flips this dynamic:

*   **State-Aware Routing**: Instead of interrupting a focused user, the backend evaluates incoming tasks via a deterministic scoring engine. 
*   **The Relay Engine**: If a task scores high in urgency (e.g., a "Critical" server outage) but the target user is in "Hyper-Focus", the system actively intercepts the notification.
*   **AI Contextualization**: The system redirects the task to a peer in a "Transitioning" state, using **Google Gemini 1.5 Flash** to generate a one-sentence TL;DR summary so the peer can act immediately without needing full context.

## ⚙️ 3. How the Solution Works
NeuroX is deployed as a modular Single Page Application (SPA) backed by a highly concurrent Python API.

*   **Frontend (The Command Center)**: Built with Vanilla HTML/JS/CSS utilizing a custom "Technical Brutalist" design system (sharp 0px geometry, deep void-charcoal surfaces). It features:
    *   **Dashboard**: Calculates the daily financial and cognitive cost of interruptions.
    *   **Focus Room**: A collaborative space for body-doubling.
    *   **Wellness Suite**: Includes an interactive HTML Canvas "Bubble Focus" game to reset ocular fatigue, and an **AI Therapy Chat** powered by the Gemini API for immediate empathetic support.
*   **Backend (The Relay Server)**: A FastAPI Python backend deployed on **Google Cloud Run**. It exposes endpoints for scoring tasks (`/relay-nudge`) and managing the conversational AI (`/therapy-chat`).
*   **Authentication**: Scaffolded for **Google Firebase** OAuth to ensure seamless and secure enterprise onboarding.

## 📝 4. Assumptions Made
1.  **State Telemetry**: We assume that in a full production environment, the user's cognitive state (Hyper-Focus, Flow, Scattered, Transitioning) is derived from biometric wearables or deep OS integrations (e.g., tracking mouse velocity and app switching). For this MVP, states are mocked in an in-memory dictionary.
2.  **Peer Availability**: The system assumes there is at least one peer in a "Transitioning" or "Flow" state willing to accept redirected tasks. If no peer is available, the system gracefully returns a 503 HTTP fallback.
3.  **Environment Variables**: It is assumed that the deployment environment (Google Cloud Run) has the `GEMINI_API_KEY` injected via Cloud Secret Manager or Environment Variables, as the local `.env` is intentionally excluded from version control for security.
