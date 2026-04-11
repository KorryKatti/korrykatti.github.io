export class PowSolver {
    /**
     * Solves the given challenge by finding a nonce that results in a hash with
     * the required number of leading zeros.
     * @param {string} salt - The salt provided by the backend.
     * @param {number} difficulty - The number of leading zeros required (in hex).
     * @returns {Promise<string>} - The nonce that solves the challenge.
     */
    static async solve(salt, difficulty) {
        let nonce = 0;
        const target = "0".repeat(difficulty);
        const encoder = new TextEncoder();

        while (true) {
            const nonceStr = nonce.toString();
            const data = encoder.encode(salt + nonceStr);
            const hashBuffer = await crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

            if (hashHex.startsWith(target)) {
                return nonceStr;
            }
            nonce++;

            // Safety break just in case, though difficulty 4 is very low
            if (nonce > 1000000) {
                console.error("PoW solver exceeded safety limit");
                return nonceStr;
            }
        }
    }
}
