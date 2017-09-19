
-- request conbined all criterias except tag : usually latitude / longitude are in the request
CREATE INDEX ON MEASUREMENTS("latitude","longitude","startTime","value","userId","qualification","atypical");

-- request on userId is exclusive
CREATE INDEX ON MEASUREMENTS("userId", "latitude","longitude");

-- if request on tag, request is join on reportUuid and we except a few value in measurements table
CREATE INDEX ON TAGS("tag");
CREATE INDEX ON MEASUREMENTS("reportUuid", "latitude","longitude");

-- request on dateAndTimeOfCreation are usually on one single date
CREATE INDEX ON MEASUREMENTS("dateAndTimeOfCreation");