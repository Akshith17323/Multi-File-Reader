const app = require('../src/app')


const Port = process.env.PORT || 2007;

app.listen(Port,()=>{
    console.log(`http://localhost:${Port}`)
})
