import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../models/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userID) => {
  try {
    const user = await User.findById(userID)
    const refreshToken = user.generateRefreshToken()
    const accessToken = user.generateAccessToken()
    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }


  } catch (error) {
    throw new ApiError(400, "somethin went worng while generating token")
  }
}

const registerUser = asyncHandler(async (req, res) => {
  // get user  details form frontend 
  const { username, fullname, email, password } = req.body
  console.log("email:", email)

  //vaildation - not empty
  if (
    [fullname, email, username, password].some((fields) => fields?.trim() === "")
  ) {
    throw new ApiError(400, "fullname is required")
  }

  //check  if user alredy exits - email , username
  const exitstingUser = await User.findOne({ $or: [{ username }, { email }] })
  if (exitstingUser) {
    throw new ApiError(403, "user already exits from server")
  }

  // check for image - check avtar image
  // const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  // if (avatarLocalPath || coverImageLocalPath) {
  //   throw new ApiError(400, "avatar file is requrired , coverImage file is requrired")
  // }
  const avatarLocalPath = req.files?.avatar[0]?.path ?? '';
  const coverImageLocalPath = req.files?.coverImage[0]?.path ?? '';

  if (!avatarLocalPath || !coverImageLocalPath) {
    throw new ApiError(400, "Avatar file and cover image file are required");
  }

  // uplode them to  cloudinery 
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)
  if (!avatar || !coverImage) {
    throw new ApiError(400, "somethin went worng while uploading image")
  }


  //create  user object - create enrty in db
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    username: username.toLowerCase(),
    email,
    password
  })
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken "
  )
  if (!createdUser) {
    throw new ApiError(500, "Somthing failed user not created")

  }

  //remove password and referse token filed  from  response 
  return res.status(201).json(
    new ApiResponse(200, "User created successfully", createdUser,)
  )

})

//check for user creation
const loginUser = asyncHandler(async (req, res) => {
  //req body -> data
  const { email, username, password } = req.body
  console.log(email);
  if (!username && !email) {
    throw new ApiError(400, "username and email are required")
  }

  //find the user
  const user = await User.findOne({
    $or: [{ username: username }, { email: email }]
  })
  if (!user) {
    throw new ApiError(401, "user not found")
  }

  // password check
  const isPasswordValid = await user.isPasswordCorrect(password)
  if (!isPasswordValid) {
    throw new ApiError(401, "password is not correct")
  }

  //access and referese token
  const { refreshToken, accessToken } = await generateAccessAndRefreshToken(user._id)

  const loggedINuser = await User.findById(user._id).select("-password -refreshToken")

  //send cookies
  const option = {
    httpOnly: true,
    secure: true
  }
  return res.status(200).cookie("refreshToken", refreshToken, option).cookie("accessToken", accessToken, option)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedINuser,
          accessToken,
          refreshToken
        },
        "user logged in successfully"
      )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )
  const options = {
    httpOnly: true,
    secure: true
  }
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if (!incomingRefreshToken) {
    throw new ApiError(400, "unauthorized request")
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    )

    //qury for mongodb
    const user = await user.findById(decodedToken._id)
    if (!incomingRefreshToken) {
      throw new ApiError(401, "invalid referse Token")
    }

    //match token
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "referse token is expired or used")
    }

    //generate new access token
    const options = {
      httpOnly: true,
      secure: true
    }

    const { accessToken, newrefreshToken } = await generateAccessAndRefreshToken(user._id)

    return res
      .status(200)
      .cookie("accessToken ", accessToken, options)
      .cookie(" newrefreshToken", newrefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken, refreshToken: newrefreshToken
          },
          "Access Token refreshed successfully"
        )
      )

  } catch (error) {
    throw new ApiError(401, error?.message || "invalid referse Token")
  }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body
  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
  if (!isPasswordCorrect) {
    throw new ApiError(401, "old password is not correct")
  }
  user.password = newPassword
  await user.save({ validateBeforeSave: false })
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"))

})

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "current user fetched successfully")
})

const updateAcountDetails = asyncHandler(async (req, res) => {
  const { fullname, email, } = req.body
  if (!fullname || !email) {
    throw new ApiError(400, "fullname and email are required")
  }
  const user = await User.findById(
    req.user?._id,
    {
      $set: {
        fullname,
        email: email,
      }
    }
  ).select("-password")
  return res
    .status(200)
    .json(new ApiResponse(200, user, "account details updated successfully"))
});


const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLoaclPath = req.file?.path

  if (!avatarLoaclPath) {
    throw new ApiError(400, "avatar file is mising")
  }

  const avatar = uploadOnCloudinary(avatarLoaclPath)

  if (!avatar.url) {
    throw new ApiError(400, "error while uploading avatar")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,

    {
      $set: {
        avatar: avatar.url
      }
    },
    {
      new: true
    }
  ).select("-password")

  return res
    .status(200)
    .json(new ApiResponse(200, user, "avatar updated successfully"))
})

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path
  if (!coverImageLocalPath) {
    throw new ApiError(404, " cover image is missing")
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)
  if (!coverImage.url) {
    throw new ApiError(404, " Error while uploding cover image")
  }

  const user = await User.findByIdAndUpdate(req.user._id,

    {
      $set: {
        coverImage: coverImage.url
      }
    },
    {
      new: true
    }
  ).select("-password")

  return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image updated successfully"))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {

  const { username } = req.params

  if (!username) {
    throw new ApiError(404, "Please enter a username")
  }

  const channel = await User.aggregate([{

    $match: {
      username: username?.toLowerCase()
    }
  },
  {
    $lookup: {
      from: "subcriptions",
      localField: "_id",
      foreignField: "channel",
      as: "subscribers"
    }
  },
  {
    $lookup: {
      from: "subcriptions",
      localField: "_id",
      foreignField: "subscribers",
      as: "subscribedTo"
    }
  },
  {
    $addFields: {
      subscribersCount: {
        $size: "$subscribers"
      },
      channelsSbscribedToCount: {
        $size: "$subscribedTo"
      },
      isSubscribed: {
        $cond: {
          if: { $in: [req.user?._id, "subscribers.subscriber"] },
          then: true,
          else: false
        }
      }
    }
  },
  {
    $project:{
      fullname: 1,
      username: 1,
      subscribersCount:1,
      channelsSbscribedToCount: 1,
      isSubscribed: 1,
      avatar: 1,
      coverImage  : 1,
      email: 1,
    }
  }
  ])

  if (!channel?.length) {
    throw new Error(404, "channel does not exists")
  }
  return res 
  .status(200)
  .json( new ApiResponse(200, channel[0], "user channel fatched successfully"))
})


const getWatchHistory = asyncHandler(async (req, res)=>{
  const user = await User.aggregate([
    {
      $match:{
        _id: new mongoose.Types.objectId(req.user._id)
      }
    },
    {
      $lookup:{
        from: "Videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup:{
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline:[
                {
                  $project:{
                    fullname:1,
                    username:1,
                    avatar:1
                  }
                }
              ]
            },
            
          },
          {
            $addFields:{
              owner:{
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ])
  return res
  .status(200)
  .json(new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully"))
})



export {
  registerUser, loginUser, logoutUser, refreshAccessToken, getCurrentUser,
  changeCurrentPassword, updateAcountDetails, updateUserAvatar, updateCoverImage,
  getUserChannelProfile, getWatchHistory
}