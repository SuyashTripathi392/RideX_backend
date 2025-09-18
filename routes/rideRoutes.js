import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { acceptRide, cancelRide, completeRide, createRide, getAvailableRides, getCompletedRides, getCurrentRide, getDriverDetails, getDriverStats, getUserDashboard, getUserRides, startRide } from '../controllers/rideController.js';


const rideRoutes=express.Router()
rideRoutes.use(verifyToken)

rideRoutes.post('/request',createRide)
rideRoutes.post('/accept/:ride_id',acceptRide)
rideRoutes.post('/start/:ride_id',startRide)
rideRoutes.post('/complete/:ride_id',completeRide)


rideRoutes.get('/available', getAvailableRides);
rideRoutes.get('/current', getCurrentRide);

rideRoutes.get('/my-rides', getUserRides);  

rideRoutes.get("/stats", verifyToken, getDriverStats);
rideRoutes.get("/dashboard", verifyToken, getUserDashboard);
rideRoutes.get("/driver/:ride_id", getDriverDetails);
rideRoutes.get('/completed',verifyToken,getCompletedRides)

rideRoutes.post("/cancel/:rideId", verifyToken, cancelRide);



export default rideRoutes