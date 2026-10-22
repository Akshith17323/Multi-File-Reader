const app = require('./app')


const Port = process.env.PORT || 2007;

console.log("[Server] Starting on Port:", Port);

try {
    app.listen(Port, () => {
        console.log(`[Server] Running at http://localhost:${Port}`)
    })
} catch (err) {
    console.error("[Server] Failed to start:", err);
}
