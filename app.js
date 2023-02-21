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
// db.init({
//   host: process.env.MYSQLHOST || "localhost",
//   port: process.env.MYSQLPORT || 3306,
//   user: process.env.MYSQLUSER || "root",
//   password: process.env.MYSQLPASSWORD || "",
//   database: process.env.MYSQLDATABASE || "corndb"
// })
// Init objects
db.init({
  host: process.env.MYSQLHOST || "containers-us-west-45.railway.app",
  port: process.env.MYSQLPORT || 6112,
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "gPGTa0R2tv01sPvQ6niw",
  database: process.env.MYSQLDATABASE || "railway"
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
          if (regex.test(receivedPOST.lastName)){
            if (receivedPOST.lastName.trim()==""){
              result = {status: "ERROR", message: "Surname is not valid"}
            }else{
              regex = /^\w+([.-_+]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/;
              if (regex.test(receivedPOST.email)){
                await db.query("insert into Users(userName, userLastName, userEmail, userPhoneNumber, balance) values('"+ receivedPOST.name +"', '"+ receivedPOST.lastName +"', '"+ receivedPOST.email +"', "+ receivedPOST.phoneNumber +", '"+ receivedPOST.balance +"');")
                result = { status: "OK", message: "Insert" }
              }
              else{
                result = {status: "ERROR", message: "Email is not valid"}
              }
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
  let result = { status: "KO", message: "Unkown type" }

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
    if(receivedPOST.user_id==""){
      result = {status: "ERROR", message: "user_id is required"}
    } else{
      var regex = /^(\d{9})$/;
      if (regex.test(receivedPOST.user_id)){
        const existe = await db.query("select count(*) from Users where userPhoneNumber="+receivedPOST.user_id);
        if (Object.values(existe[0])>0){
          var regex = /^[0-9]+$/;
            if (String(receivedPOST.amount).indexOf('.') === -1){
                if (regex.test(receivedPOST.amount)){
                   comprobacion=true;
                }else{
                  comprobacion=false;
                }
            }else{
                var particion = String(receivedPOST.amount).split(".");
                if (regex.test(particion[0])){
                    if (regex.test(particion[1])){
                      comprobacion=true;
                    }else {
                      comprobacion=false;
                    }
                }else{
                  comprobacion=false;
                }
            }
            if(comprobacion===true){
              let token = createToken();
              const fecha = new Date();
              const opciones = { timeZone: "Europe/Madrid" };
              const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
              const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
              await db.query("insert into Transactions(destination,amount,token,timeSetup) values ('"+receivedPOST.user_id+"','"+receivedPOST.amount+"','"+token+"','"+ fechaSQL +"');");
              result = {status: "OK", message: "Transaction created successfully", transaction_token: token};
            } else{
              result = {status: "ERROR", message:"Wrong amount"};
            }
        } else{
          result = {status: "ERROR", message: "No Exist"};
        }
      }else{
        result = {status: "ERROR", message: "ID is not valid"}
      }  
  }
}
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}


function createToken(){
  let charsList = [];
  let tokenSize = 200;
  let token = "P";

  for(i = 0; i < 10; i ++){
    charsList.push(i);
  }

  for(i = 65; i <= 90; i++) {
    charsList.push(String.fromCharCode(i));
  }

  for(i = 97; i <= 122; i++) {
    charsList.push(String.fromCharCode(i));
  }
  
  for(i = 0; i < tokenSize - 1; i++){
    let randomNum = Math.round(Math.random()*(charsList.length - 1));
    token += charsList[randomNum];
  }

  return token;
}

// Define routes
app.post('/api/start_payment', startPayment)
async function startPayment (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "KO", result: "Unkown type" }

  if (receivedPOST) {
    if(receivedPOST.user_id==""){
      result = {status: "ERROR", message: "User_id is required"}
    } else{
      var regex = /^(\d{9})$/;
      if (regex.test(receivedPOST.user_id)){
        const existe = await db.query("select count(*) from Users where userPhoneNumber="+receivedPOST.user_id);
        if (Object.values(existe[0])>0){
          const existeTransaccion = await db.query("select count(*) from Transactions where token='"+receivedPOST.transaction_token+"'");
          if (Object.values(existeTransaccion[0])==0){
            result = {status: "ERROR", message: "Transaction no exist"}
          } else{
            const transaccion = await db.query("select accepted,amount from Transactions where token='"+receivedPOST.transaction_token+"'");
            if (transaccion[0]["accepted"]==0){
              result = {status: "ERROR", message: "Transaction rejects"}
            }else if(transaccion[0]["accepted"]==1){
              result = {status: "ERROR", message: "Repeated transaction"}
            } else if(transaccion[0]["accepted"]==null){
              const fecha = new Date();
              const opciones = { timeZone: "Europe/Madrid" };
              const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
              const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
              await db.query("update Transactions set timeStart='"+fechaSQL+"' where token='"+receivedPOST.transaction_token+"'");
              result = {status: "OK", message: "Transaction completed correctly",amount: transaccion[0]["amount"]}
            }
          }
        } else{
          result = {status: "ERROR", message: "User no exist"}
        }
      }else{
        result = {status: "ERROR", message: "User_id is not valid"}
      }
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

// Define routes
app.post('/api/finish_payment', finishPayment)
async function finishPayment (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "KO", result: "Unkown type" }

  if (receivedPOST) {
    if(receivedPOST.user_id==""){
      result = {status: "ERROR", message: "User_id is required"}
    } else{
      var regex = /^(\d{9})$/;
      if (regex.test(receivedPOST.user_id)){
        const existe = await db.query("select count(*) from Users where userPhoneNumber='"+receivedPOST.user_id+"'");
        if (Object.values(existe[0])>0){
          const existeTransaccion = await db.query("select count(*) from Transactions where token='"+receivedPOST.transaction_token+"'");
          if (Object.values(existeTransaccion[0])==0){
            result = {status: "ERROR", message: "Transaction no exist"}
          } else{
            if (receivedPOST.accept==true || receivedPOST.accept==false){
              if(receivedPOST.accept==true){
                  if (!isNaN(receivedPOST.amount)){
                    const precio = await db.query("select amount from Transactions where token='"+receivedPOST.transaction_token+"'");
                    if (receivedPOST.amount==precio[0]["amount"]){
                      if (receivedPOST.amount<=0){
                        result = {status: "ERROR", message: "Error in the verification of the quantity"}
                      }else{
                        const balance = await db.query("select balance from Users where userPhoneNumber='"+receivedPOST.user_id+"'");
                        const precio = await db.query("select amount from Transactions where token='"+receivedPOST.transaction_token+"'");
                        if (balance[0]["balance"]-precio[0]["amount"]<0){
                          result= {status: "ERROR", message: "Refused transaction due to lack of balance"}
                        }else{
                          const fecha = new Date();
                          const opciones = { timeZone: "Europe/Madrid" };
                          const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
                          const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
                          var cantidad=balance[0]["balance"]-precio[0]["amount"];
                          await db.query("update Transactions set origin ='"+receivedPOST.user_id+"', accepted="+receivedPOST.accept+", timeFinish='"+fechaSQL+"', timeAccept='"+fechaSQL+"' where token='"+receivedPOST.transaction_token+"'");
                          await db.query("update Users set balance='"+cantidad+"' where userPhoneNumber='"+receivedPOST.user_id+"'");
                          result = {status: "OK", message: "Transaction accepted"}
                        }
                      }
                    } else{
                      result = {status: "ERROR", message: "Error in the verification of the quantity"}
                    }
                  }else{
                    result = {status: "ERROR", message: "Error in the verification of the quantity"}
                  }
              }else{
                const fecha = new Date();
                const opciones = { timeZone: "Europe/Madrid" };
                const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
                const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
                await db.query("update Transactions set accepted="+receivedPOST.accept+",timeFinish='"+fechaSQL+"' where token='"+receivedPOST.transaction_token+"'");
                result = {status: "OK", message: "Transaction refused by own client"}   
              }
            }else{
              result = {status: "ERROR", message: "Accept it has to be true or false"}
            }
          }
        } else{
          result = {status: "ERROR", message: "User no exist"}
        }
      }else{
        result = {status: "ERROR", message: "User_id is not valid"}
      }
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}
