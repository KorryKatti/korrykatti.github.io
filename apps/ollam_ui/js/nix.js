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

    async run(code, language = "python") {
        const resp = await fetch(`${this.baseUrl}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, language })
        });
        if (!resp.ok) throw new Error("Code execution failed");
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
}
