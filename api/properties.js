module.exports = {
  port : 8080, //8082
  login: "submitapi",
  password: "submitapi",
  host: "localhost",
  maxNumber: 1000,
  getAPIInterval: 600000, //API Table is reloaded every ten minutes
  getUsersInterval: 600000, //Users Table is reloaded every ten minutes
  APIKeyTestInterval: 60000, //APITest every 1 minute
  APIKeyTestMaxCounter: 5 //APITest max 5 calls during APIKeyTestInterval
}

