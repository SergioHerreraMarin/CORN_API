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
app.post('/dades', getPostDades)
async function getPostDades (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "KO", result: "Unkown type" }

  var textFile = await fs.readFile("./public/consoles/consoles-list.json", { encoding: 'utf8'})
  var objConsolesList = JSON.parse(textFile)

  if (receivedPOST) {

    switch(receivedPOST.type){

      case "consola":
        var objFilteredList = objConsolesList.filter((obj) => { return obj.name == receivedPOST.name })
        await wait(1500)
        if (objFilteredList.length > 0) {
            result = { status: "OK", result: objFilteredList[0] }
        }
      break;

      case "marques":
        var objBrandsList = objConsolesList.map((obj) => { return obj.brand })
        await wait(1500)
        let senseDuplicats = [...new Set(objBrandsList)]
        result = { status: "OK", result: senseDuplicats.sort() }
      break;

      case "marca":
        var objBrandConsolesList = objConsolesList.filter ((obj) => { return obj.brand == receivedPOST.name })
        await wait(1500)
        objBrandConsolesList.sort((a,b) => { 
            var textA = a.name.toUpperCase();
            var textB = b.name.toUpperCase();
            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
        })
        result = { status: "OK", result: objBrandConsolesList }
      break;

      case "addNewUser":
        //Mirar si existe

        //Fatlta terminar xd 
        try{
          const result = await db.query("insert into Users(userName, userLastName, userEmail, userPhoneNumber, balance) values('"+ receivedPOST.name +"', '"+ receivedPOST.lastName +"', '"+ receivedPOST.email +"', '"+ receivedPOST.phoneNumber +"', '"+ receivedPOST.balance +"');")
          result = { status: "OK", result: "result" }
        }catch(error){
          result = { status: "OK", result: "noResult"}
        }
        
      break;

    }

  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}


