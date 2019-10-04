
-- request conbined all criterias except tag : usually latitude / longitude are in the request
CREATE INDEX ON MEASUREMENTS("latitude","longitude","startTime","value","userId","qualification","atypical");

-- request on userId is exclusive
CREATE INDEX ON MEASUREMENTS("userId", "latitude","longitude");

-- if request on tag, request is join on reportUuid and we except a few value in measurements table
CREATE INDEX ON TAGS("tag");
CREATE INDEX ON MEASUREMENTS("reportUuid", "latitude","longitude");

-- request on dateAndTimeOfCreation are usually on one single date
CREATE INDEX ON MEASUREMENTS("dateAndTimeOfCreation");

-- request by the API to retrieve measurements by flight id
CREATE INDEX ON MEASUREMENTS("flightId", "startTime");

--request to seak measurement with same flightNumber 
CREATE INDEX ON MEASUREMENTS("flightNumber", "measurementEnvironment", "flightId", "flightSearch", "startTime");

-- request to retrieve flights with departure dates
CREATE INDEX ON FLIGHTS("flightNumber", "departureTime", "arrivalTime");

-- request to retrieve flights with measurements dates
CREATE INDEX ON FLIGHTS("flightNumber", "startTimeMin", "startTimeMax");