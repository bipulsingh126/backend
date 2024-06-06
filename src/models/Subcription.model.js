import mongoose, {Schema} from "mongoose";


const subcriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, //one who subscribe
        ref: "User"
    },
    channel: {
        type : Schema.Types.ObjectId, // channel to which subscriber subscribes
        ref : "User"
    }
}, {timestamps: true})

export const Subcription = mongoose.model("Subcription", subcriptionSchema);