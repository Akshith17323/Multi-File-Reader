const app = require('./app')


const Port = process.env.PORT || 2007;

console.log("🚀 Starting Server on Port:", Port);

try {
    app.listen(Port, () => {
        console.log(`✅ Server running: http://localhost:${Port}`)
    })
} catch (err) {
    console.error("❌ Failed to start server:", err);
}
