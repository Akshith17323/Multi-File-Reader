 require('dotenv').config
const jwt = require('jsonwebtoken')


async function middleware (req,res,next){  
    try {   
        const header = req.headers.authorization
        const header_token  = header.startsWith("Bearer")?header.split(" ")[1]:""
    
        if (!header_token){
            return res.status(401).json({Message:"please login you account"})
        }

        const verified = await jwt.verify(header_token,process.env.JWT_SECRET)
        if (verified){
            req.user = verified
            return next()
        }
        return res.status(401).json({Message:"token not found"})
        
    }
    catch(err){
        console.log(err)
        return res.status(500).json({Message:"something wrong with the server"})
    }
}

module.exports = middleware