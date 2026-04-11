import { PowSolver } from './pow_solver.js';

export class NixService {
    constructor(baseUrl = "https://ollamas-ahh.onrender.com") {
        this.baseUrl = baseUrl;
        this.isWakingUp = false;
        this.status = "offline";
    }

    async ping() {
        try {
            const resp = await fetch(`${this.baseUrl}/ping`);
            if (resp.ok) {
                this.status = "online";
                return true;
            }
        } catch (e) {
            this.status = "offline";
        }
        return false;
    }

    async run(code, language = "python", options = {}) {
        // 1. Fetch PoW Challenge
        const challengeResp = await fetch(`${this.baseUrl}/challenge`);
        if (!challengeResp.ok) throw new Error("Failed to fetch PoW challenge");
        const challenge = await challengeResp.json();

        // 2. Solve PoW
        const nonce = await PowSolver.solve(challenge.salt, challenge.difficulty);

        // 3. Send request with PoW solution and logging data
        const resp = await fetch(`${this.baseUrl}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code,
                language,
                pow_id: challenge.id,
                pow_nonce: nonce,
                user_prompt: options.userPrompt || "",
                ai_text: options.aiText || "",
                model: options.model || ""
            })
        });
        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || "Code execution failed");
        }
        return await resp.json();
    }

    async startPinging(updateCallback) {
        if (this.isWakingUp) return;
        this.isWakingUp = true;

        // Initial ping
        await this.ping();
        if (updateCallback) updateCallback(this.status);

        while (this.isWakingUp && this.status !== "online") {
            const success = await this.ping();
            if (updateCallback) updateCallback(this.status);
            if (success) {
                this.isWakingUp = false;
                break;
            }
            await new Promise(r => setTimeout(r, 5000));
        }
        this.isWakingUp = false;
    }

    async submitReview(review, selectedTool) {
        // Only submit review for code interpreter mode
        if (selectedTool !== 'code') return;

        try {
            await fetch(`${this.baseUrl}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ review })
            });
        } catch (e) {
            console.warn("Review submission failed:", e);
        }
    }
}
