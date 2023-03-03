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
  host: process.env.MYSQLHOST || "containers-us-west-178.railway.app",
  port: process.env.MYSQLPORT || 6894,
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "RK2jY5ibX9hNpD3NdHCq",
  database: process.env.MYSQLDATABASE || "railway"
})
ws.init(httpServer, port, db)

function createSessionToken(){
  let charsList = [];
  let tokenSize = 33;
  let token = "";

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
app.post('/api/login', login)
async function login (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    if (receivedPOST.email.trim()==""){
      result = {status: "ERROR", message: "Es requereix un correu electrònic"}
    }else{
      let contador = await db.query("select count(*) as cuenta from Users where userEmail='"+receivedPOST.email+"' and userPassword='"+receivedPOST.password+"'")
      if (contador[0]["cuenta"]>0){
        let token=createSessionToken();
        await db.query("update Users set userSessionToken='"+token+"'where userEmail='"+receivedPOST.email+"' and userPassword='"+receivedPOST.password+"'");
        result = {status: "OK", message: "Sessió iniciada", session_token: token}
      }else{
        result = {status: "ERROR", message: "El correu i/o la contrasenya estan malament"}
      }
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}

// Define routes
app.post('/api/signup', signup)
async function signup (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    var regex = /^(\d{9})$/;
    if (regex.test(receivedPOST.phone)){
      const existe = await db.query("select count(*) from Users where userPhoneNumber="+receivedPOST.phone+" or userEmail='"+receivedPOST.email+"'");
      if (Object.values(existe[0])==0){
        regex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ]+$/;
        if (regex.test(receivedPOST.name)){
          regex = /^[ a-zA-ZñÑáéíóúÁÉÍÓÚ]+$/;
          if (regex.test(receivedPOST.surname)){
            if (receivedPOST.surname.trim()==""){
              result = {status: "ERROR", message: "El cognom no és vàlid"}
            }else{
              regex = /^\w+([.-_+]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/;
              if (regex.test(receivedPOST.email)){
                regex = /^([a-zA-Z0-9 _-]+)$/;
                if (regex.test(receivedPOST.password)){
                  const fecha = new Date();
                  const opciones = { timeZone: "Europe/Madrid" };
                  const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
                  const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
                  await db.query("insert into Users(userPhoneNumber,userName, userLastName, userEmail, userBalance, userStatus, userStatusModifyTime, userPassword) values('"+ receivedPOST.phone+"', '"+receivedPOST.name +"', '"+ receivedPOST.surname +"', '"+ receivedPOST.email +"', "+ 100 +", 'active', '"+fechaSQL+"', '"+receivedPOST.password+"');");
                  result = { status: "OK", message: "Usuari creat correctament" }
                } else{
                  result = {status: "ERROR", message: "La contrasenya només pot contenir lletres majúscules i minúscules i números"}
                }
              }
              else{
                result = {status: "ERROR", message: "El correu no és vàlid"}
              }
            }
          }else{
            result = {status: "ERROR", message: "El cognom no és vàlid"}
          }
        }else{
          result = {status: "ERROR", message: "El nom no és vàlid"}
        }
      } else{
        result = {status: "ERROR", message: "Ja existeix un usuari amb aquest número de telèfon o correu electrònic"};
      }
    }else{
      result = {status: "ERROR", message: "El número de telèfon no és vàlid"}
    }
        
    }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}

// Define routes
app.post('/api/get_profiles', getProfiles)
async function getProfiles (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    const usuarios = await db.query("select * from Users");
    result= {status: "OK", profiles: usuarios}
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
app.post('/api/setup_payment', setupPayment)
async function setupPayment (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }
  let comprobacion=false;
  if (receivedPOST) {
    if(receivedPOST.user_id==""){
      result = {status: "ERROR", message: "Es requereix l'user_id"}
    } else{
        const existe = await db.query("select count(*) from Users where userSessionToken='"+receivedPOST.user_id+"'");
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
              const telefono = await db.query("select userPhoneNumber from Users where userSessionToken='"+receivedPOST.user_id+"'")
              await db.query("insert into Transactions(destination,amount,token,timeSetup) values ('"+telefono[0]["userPhoneNumber"]+"','"+receivedPOST.amount+"','"+token+"','"+ fechaSQL +"');");
              result = {status: "OK", message: "Transacció creada correctament", transaction_token: token};
            } else{
              result = {status: "ERROR", message:"La quantitat no és correcte"};
            }
        } else{
          result = {status: "ERROR", message: "No existeix l'usuari"};
        }
       
  }
}
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}

// Define routes
app.post('/api/start_payment', startPayment)
async function startPayment (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    if(receivedPOST.user_id==""){
      result = {status: "ERROR", message: "Es requereix l'user_id"}
    } else{
        const existe = await db.query("select count(*) from Users where userSessionToken='"+receivedPOST.user_id+"'");
        if (Object.values(existe[0])>0){
          const existeTransaccion = await db.query("select count(*) from Transactions where token='"+receivedPOST.transaction_token+"'");
          if (Object.values(existeTransaccion[0])==0){
            result = {status: "ERROR", message: "La transacció no existeix"}
          } else{
            const transaccion = await db.query("select accepted,amount from Transactions where token='"+receivedPOST.transaction_token+"'");
            if (transaccion[0]["accepted"]==0){
              result = {status: "ERROR", message: "La transacció ha sigut rebutjada anteriorment"}
            }else if(transaccion[0]["accepted"]==1){
              result = {status: "ERROR", message: "Transacció repetida"}
            } else if(transaccion[0]["accepted"]==null){
              const fecha = new Date();
              const opciones = { timeZone: "Europe/Madrid" };
              const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
              const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
              await db.query("update Transactions set timeStart='"+fechaSQL+"' where token='"+receivedPOST.transaction_token+"'");
              result = {status: "OK", message: "La transacció existeix",amount: transaccion[0]["amount"]}
            }
          }
        } else{
          result = {status: "ERROR", message: "L'usuari no existeix"}
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
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    if(receivedPOST.user_id==""){
      result = {status: "ERROR", message: "Es requereix l'user_id"}
    } else{
        const existe = await db.query("select count(*) from Users where userSessionToken='"+receivedPOST.user_id+"'");
        if (Object.values(existe[0])>0){
          const existeTransaccion = await db.query("select count(*) from Transactions where token='"+receivedPOST.transaction_token+"'");
          if (Object.values(existeTransaccion[0])==0){
            result = {status: "ERROR", message: "La transacció no existeix"}
          } else{
            if (receivedPOST.accept==true || receivedPOST.accept==false){
              if(receivedPOST.accept==true){
                  if (!isNaN(receivedPOST.amount)){
                    const precio = await db.query("select amount from Transactions where token='"+receivedPOST.transaction_token+"'");
                    if (receivedPOST.amount==precio[0]["amount"]){
                      if (receivedPOST.amount<=0){
                        result = {status: "ERROR", message: "Error a la verificació de la quantitat"}
                      }else{
                        const balance = await db.query("select userBalance from Users where userSessionToken='"+receivedPOST.user_id+"'");
                        const precio = await db.query("select amount from Transactions where token='"+receivedPOST.transaction_token+"'");
                        const id_usu_destino = await db.query("select destination from Transactions where token='"+receivedPOST.transaction_token+"'");
                        const balanceDestino = await db.query("select userBalance from Users where userPhoneNumber='"+id_usu_destino[0]["destination"]+"'");
                        if (balance[0]["userBalance"]-precio[0]["amount"]<0){
                          result= {status: "ERROR", message: "Transacció rebutjada perquè falten diners"}
                        }else{
                          const fecha = new Date();
                          const opciones = { timeZone: "Europe/Madrid" };
                          const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
                          const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
                          var cantidad=balance[0]["balance"]-precio[0]["amount"];
                          var cantidadDestino=Number(balanceDestino[0]["userBalance"])+Number(precio[0]["amount"]);
                          const numOrigen = await db.query("select userPhoneNumber from Users where userSessionToken='"+receivedPOST.user_id+"'");
                          await db.query("update Transactions set origin ='"+numOrigen[0]["userPhoneNumber"]+"', accepted="+receivedPOST.accept+", timeFinish='"+fechaSQL+"', timeAccept='"+fechaSQL+"' where token='"+receivedPOST.transaction_token+"'");
                          await db.query("update Users set userBalance='"+cantidad+"' where userSessionToken='"+receivedPOST.user_id+"'");
                          await db.query("update Users set userBalance='"+cantidadDestino+"' where userPhoneNumber='"+id_usu_destino[0]["destination"]+"'");
                          result = {status: "OK", message: "Transacció aceptada"}
                        }
                      }
                    } else{
                      result = {status: "ERROR", message: "Error a la verificació de la quantitat"}
                    }
                  }else{
                    result = {status: "ERROR", message: "Error a la verificació de la quantitat"}
                  }
              }else{
                const fecha = new Date();
                const opciones = { timeZone: "Europe/Madrid" };
                const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
                const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
                await db.query("update Transactions set accepted="+receivedPOST.accept+",timeFinish='"+fechaSQL+"' where token='"+receivedPOST.transaction_token+"'");
                result = {status: "OK", message: "Transacció refusada per el client"}   
              }
            }else{
              result = {status: "ERROR", message: "Accept a de ser true o false"}
            }
          }
        } else{
          result = {status: "ERROR", message: "L'usuari no existeix"}
        }
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

// Define routes
app.post('/api/transaccions', transaccions)
async function transaccions (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    const contador = await db.query("select count(*) as contador from Users where userPhoneNumber="+receivedPOST.phone)
    if (contador[0]["contador"]>0){
      const transacciones = await db.query("select * from Transactions where (origin="+receivedPOST.phone+" or destination="+receivedPOST.phone+") and accepted is not null")
      result = {status: "OK", message: "Transacciones", transactions: transacciones}
    } else{
      result = {status: "ERROR", message: "Aquest usuari no existeix"}
    }

  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

// Define routes
app.post('/api/get_profile', get_profile)
async function get_profile (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    if (receivedPOST.session_token.trim()!=""){
      const contador = await db.query("select count(*) as contador from Users where userSessionToken='"+receivedPOST.session_token+"'")
      if (contador[0]["contador"]>0){
        const transacciones = await db.query("select * from Users where userSessionToken='"+receivedPOST.session_token+"'")
        result = {status: "OK", message: "Les dades", email: transacciones[0]["userEmail"], name: transacciones[0]["userName"], 
        surname: transacciones[0]["userLastName"], phone: transacciones[0]["userPhoneNumber"], validation_status: transacciones[0]["userStatus"]}
      } else{
        result = {status: "ERROR", message: "Aquest usuari no existeix"}
      }
    }else{
      result = {status: "ERROR", message: "Es requereix token de sessio"}
    }

  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}