import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";




dotenv.config({
    path: './.env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 5000 , ()=>{
        console.log(`Listening on port ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("MONGODB CONNECTION FAILED : ", err);
})












// import exprees from "express";
// const app = exprees();

// ;( async ()=>{
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
//         app.on('error', ()=>{
//             console.log('Error connecting to database');
//             throw error
//         })
//         app.listen(process.env.PORT, ()=>{
//         console.log(`Listening on port ${process.env.PORT}`);
//         })
//     } catch (error) {
//         console.log("error:", error)
//         throw error
//     }
// })()