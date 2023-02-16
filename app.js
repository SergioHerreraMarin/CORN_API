const express     = require('express')
const fs          = require('fs').promises

const webSockets  = require('./appWS.js')
const post        = require('./utilsPost.js')
const database    = require('./utilsMySQL.js')
const wait        = require('./utilsWait.js')

var db = new database()   // Database example: await db.query("SELECT * FROM test")
var ws = new webSockets()

// Start HTTP server
const app = express()
const port = process.env.PORT || 3000

// Publish static files from 'public' folder
app.use(express.static('public'))

// Activate HTTP server
const httpServer = app.listen(port, appListen)
function appListen () {
  console.log(`Listening for HTTP queries on: http://localhost:${port}`)
}

// Close connections when process is killed
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
function shutDown() {
  console.log('Received kill signal, shutting down gracefully');
  httpServer.close()
  db.end()
  ws.end()
  process.exit(0);
}

// Init objects
db.init({
  host: process.env.MYSQLHOST || "localhost",
  port: process.env.MYSQLPORT || 3306,
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "",
  database: process.env.MYSQLDATABASE || "Corndb"
})
ws.init(httpServer, port, db)


// Define routes
app.post('/api/signup', signup)
async function signup (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "KO", message: "Unkown type" }

  if (receivedPOST) {
    var regex = /^(\d{9})$/;
    if (regex.test(receivedPOST.phoneNumber)){
      const existe = await db.query("select count(*) from Users where userPhoneNumber="+receivedPOST.phoneNumber);
      if (Object.values(existe[0])==0){
        regex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ]+$/;
        if (regex.test(receivedPOST.name)){
          regex = /^[ a-zA-ZñÑáéíóúÁÉÍÓÚ]+$/;
          if (regex.test(receivedPOST.lastName) && receivedPOST.lastName.trim()!=""){
            regex = /^\w+([.-_+]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/;
            if (regex.test(receivedPOST.email)){
              await db.query("insert into Users(userName, userLastName, userEmail, userPhoneNumber, balance) values('"+ receivedPOST.name +"', '"+ receivedPOST.lastName +"', '"+ receivedPOST.email +"', "+ receivedPOST.phoneNumber +", '"+ receivedPOST.balance +"');")
              result = { status: "OK", message: "Insert" }
            }
            else{
              result = {status: "ERROR", message: "Email is not valid"}
            }
          }else{
            result = {status: "ERROR", message: "Surname is not valid"}
          }
        }else{
          result = {status: "ERROR", message: "Name is not valid"}
        }
      } else{
        result = {status: "OK", message: "Exist"};
      }
    }else{
      result = {status: "ERROR", message: "Phone is not valid"}
    }
        
    }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}

// Define routes
app.post('/api/get_profiles', getProfiles)
async function getProfiles (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "KO", result: "Unkown type" }

  if (receivedPOST) {
    const usuarios = await db.query("select * from Users");
    result= {status: "OK", profiles: usuarios}
    }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}

// Define routes
app.post('/api/setup_payment', setupPayment)
async function setupPayment (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "KO", result: "Unkown type" }
  let comprobacion=false;
  if (receivedPOST) {
    if(receivedPOST.phoneNumber==""){
      result = {status: "ERROR", message: "user_id is required"}
    } else{
      var regex = /^(\d{9})$/;
      if (regex.test(receivedPOST.phoneNumber)){
        const existe = await db.query("select count(*) from Users where userPhoneNumber="+receivedPOST.phoneNumber);
        if (Object.values(existe[0])>=0){
          var regex = /^[0-9]+$/;
            if (receivedPOST.amount.indexOf(".") === -1 ){
                if (regex.test(receivedPOST.amount)){
                   comprobacion=true;
                }else{
                  comprobacion=false;
                }
            }else{
                var particion = receivedPOST.amount.split(".");
                if (regex.test(particion[0])){
                    if (regex.match(particion[1])){
                      comprobacion=true;
                    }else {
                      comprobacion=false;
                    }
                }else{
                  comprobacion=false;
                }
            }
            if (comprobacion===true){
              //const 
              //await db.query("insert into Transactions(destination,token,timeCreate) values ('"+receivedPOST.+"','"++"','"++"')");
            } else{
              result = {status: "ERROR", message: "Wrong amount"};
            }
        } else{
          result = {status: "ERROR", message: "No Exist"};
        }
      }else{
        result = {status: "ERROR", message: "Phone is not valid"}
      }
      //const usuarios = await db.query("select * from Users");
      //result= {status: "OK", profiles: usuarios}  
  }
}

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}


