require('dotenv').config
const jwt = require('jsonwebtoken')


async function middleware (req,res,next){  
    try {   
        const header = req.header.authorization
        const header_token  = header.startsWith("Bearer")?header.split(" ")[1]:""
    
        if (!header_token){
            return res.status(401).josn({Message:"please login you account"})
        }

        const verified = await jwt.verify(header_token,process.env.JWT_SECRET)
        if (verified){
            next()
        }
        return res.status(401).json({Message:"token not found"})
        
    }
    catch(err){
        console.log(err)
        return res.status(500).json({Message:"something wrong with the server"})
    }
}

module.exports = middleware