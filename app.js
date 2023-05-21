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
  host: process.env.MYSQLHOST || "containers-us-west-128.railway.app",
  port: process.env.MYSQLPORT || 7062,
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "x1GXenNgqn47pFatNUO3",
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
        await db.query("update Users set userSessionToken='"+token+"' where userEmail='"+receivedPOST.email+"' and userPassword='"+receivedPOST.password+"'");
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
                  let token=createSessionToken();
                  await db.query("insert into Users(userPhoneNumber,userName, userLastName, userEmail, userBalance, userStatus, userStatusModifyTime, userPassword,userSessionToken) values('"+ receivedPOST.phone+"', '"+receivedPOST.name +"', '"+ receivedPOST.surname +"', '"+ receivedPOST.email +"', "+ 100 +", 'NO_VERFICAT', '"+fechaSQL+"', '"+receivedPOST.password+"', '"+token+"');");
                  result = { status: "OK", message: "Usuari creat correctament", session_token: token}
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
              const id = await db.query("select id from Users where userSessionToken='"+receivedPOST.user_id+"'")
              await db.query("insert into Transactions(destination,amount,token,timeSetup) values ('"+id[0]["id"]+"','"+receivedPOST.amount+"','"+token+"','"+ fechaSQL +"');");
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
                        if (balance[0]["userBalance"]-precio[0]["amount"]<0){
                          result= {status: "ERROR", message: "Transacció rebutjada perquè falten diners"}
                        }else{
                          const fecha = new Date();
                          const opciones = { timeZone: "Europe/Madrid" };
                          const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
                          const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
                          const cantidad=balance[0]["userBalance"]-precio[0]["amount"];
                          const id_usu_origen = await db.query("select id from Users where userSessionToken='"+receivedPOST.user_id+"'");
                          await db.query("SET autocommit=0;"); 
                          try{
                            await db.query("update Transactions set origin ='"+id_usu_origen[0]["id"]+"', accepted="+receivedPOST.accept+", timeFinish='"+fechaSQL+"', timeAccept='"+fechaSQL+"' where token='"+receivedPOST.transaction_token+"'");
                            await db.query("update Users set userBalance='"+cantidad+"' where userSessionToken='"+receivedPOST.user_id+"'");
                            const id_usu_destino = await db.query("select destination from Transactions where token='"+receivedPOST.transaction_token+"'");
                            const balanceDestino = await db.query("select userBalance from Users where id='"+id_usu_destino[0]["destination"]+"'");
                            var cantidadDestino=Number(balanceDestino[0]["userBalance"])+Number(precio[0]["amount"]);
                            await db.query("update Users set userBalance='"+cantidadDestino+"' where id='"+id_usu_destino[0]["destination"]+"'");
                            await db.query("commit;");
                          } catch(error){
                            await db.query("rollback;");
                          }
                          await db.query("SET autocommit=1;"); 
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
      const id_usu = await db.query("select id from Users where userPhoneNumber="+receivedPOST.phone)
      const transacciones = await db.query("select * from Transactions where (origin="+id_usu[0]["id"]+" or destination="+id_usu[0]["id"]+") and accepted is not null")
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
        const datos = await db.query("select * from Users where userSessionToken='"+receivedPOST.session_token+"'")
        result = {status: "OK", message: "Les dades", email: datos[0]["userEmail"], name: datos[0]["userName"], 
        surname: datos[0]["userLastName"], phone: datos[0]["userPhoneNumber"], validation_status: datos[0]["userStatus"]}
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

// Define routes
app.post('/api/logout', logout)
async function logout (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    if (receivedPOST.session_token.trim()!=""){
      const contador = await db.query("select count(*) as contador from Users where userSessionToken='"+receivedPOST.session_token+"'")
      if (contador[0]["contador"]>0){
        await db.query("update Users set userSessionToken=NULL where userSessionToken='"+receivedPOST.session_token+"'")
        result = {status: "OK", message: "Sessió tancada correctament"}
      } else{
        result = {status: "ERROR", message: "No s'ha trobat la sessió"}
      }
    }else{
      result = {status: "ERROR", message: "Es requereix token de sessio"}
    }

  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

// Define routes
app.post('/api/get_profiles_by_status', get_profiles_by_status)
async function get_profiles_by_status (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    const usuaris = await db.query("select * from Users where userStatus= '"+receivedPOST.status+"'")
    result = {status: "OK", message: "Els usuaris", profiles: usuaris}
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

// Define routes
app.post('/api/get_profiles_by_range_balance', get_profiles_by_range_balance)
async function get_profiles_by_range_balance (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    const usuaris = await db.query("select * from Users where userBalance>="+receivedPOST.minBalance+" and userBalance<="+receivedPOST.maxBalance+"")
    result = {status: "OK", message: "Els usuaris", profiles: usuaris}
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

// Define routes
app.post('/api/get_profiles_by_range_num_transactions', get_profiles_by_range_num_transactions)
async function get_profiles_by_range_num_transactions (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    const usuaris = await db.query("select Users.*, count(distinct Transactions.id) as total_transacciones from Users inner join (select origin as user_id, id from Transactions where accepted is not null union all select destination as user_id, id from Transactions where accepted is not null) as Transactions on Users.id = Transactions.user_id group by Users.id having total_transacciones between "+receivedPOST.numMin+" AND "+receivedPOST.numMax+";")
    result = {status: "OK", message: "Els usuaris", profiles: usuaris}
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

// Define routes
app.post('/api/get_record_transactions', get_record_transactions)
async function get_record_transactions (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    if (receivedPOST.session_token.trim()!=""){
      const contador = await db.query("select count(*) as contador from Users where userSessionToken='"+receivedPOST.session_token+"'")
      if (contador[0]["contador"]>0){
        const usuario = await db.query("select id,userBalance from Users where userSessionToken='"+receivedPOST.session_token+"'")
        const transactions = await db.query("select Transactions.origin, Users.userPhoneNumber as originPhoneNumber, Transactions.destination, Users_2.userPhoneNumber as destinationPhoneNumber, Transactions.amount, Transactions.accepted, Transactions.timeFinish from Transactions left join Users on Transactions.origin = Users.id left join Users as Users_2 on Transactions.destination = Users_2.id where (origin="+usuario[0]["id"]+" or destination="+usuario[0]["id"]+") and accepted is not null;");
        result = {status: "OK", message: "Les transaccions", id: usuario[0]["id"], balance: usuario[0]["userBalance"], transactions: transactions}
      } else{
        result = {status: "ERROR", message: "No s'ha trobat la sessió"}
      }
    }else{
      result = {status: "ERROR", message: "Es requereix token de sessio"}
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

// Define routes
app.post('/api/send_id', send_id)
async function send_id (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
    if (receivedPOST.session_token.trim()!=""){
      const contador = await db.query("select count(*) as contador from Users where userSessionToken='"+receivedPOST.session_token+"'")
      if (contador[0]["contador"]>0){
        const fileBuffer = Buffer.from(receivedPOST.picture1, 'base64');
        const fileBuffer2 = Buffer.from(receivedPOST.picture2, 'base64');
        const path = "./private"
        const usuarios = await db.query("select userDNIFront,userDNIBack from Users")
        let nameFile=`${createNameFile()}.jpg`;
        let nameFile2=`${createNameFile()}.jpg`;
        let flag=false;
        while(!flag){
          flag=true
          for (let i=0; i<usuarios.length;i++){
            if (nameFile==usuarios[i]["userDNIFront"] || nameFile==usuarios[i]["userDNIBack"]){
              nameFile=`${createNameFile()}.jpg`;
              flag=false;
              break;
            } else if (nameFile2==usuarios[i]["userDNIFront"] || nameFile2==usuarios[i]["userDNIBack"]){
              nameFile2=`${createNameFile()}.jpg`;
              flag=false;
              break;
            }
          }
        }
        await fs.mkdir(path, { recursive: true }) // Crea el directori si no existeix
        await fs.writeFile(`${path}/${nameFile}`, fileBuffer)
        await fs.writeFile(`${path}/${nameFile2}`, fileBuffer2)
        const fecha = new Date();
        const opciones = { timeZone: "Europe/Madrid" };
        const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
        const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
        await db.query("update Users set userStatusModifyTime='"+fechaSQL+"', userStatus='A_VERIFICAR', userDNIFront='"+nameFile+"', userDNIBack='"+nameFile2+"' where userSessionToken='"+receivedPOST.session_token+"'");

        result = { status: "OK", message: "S'han desat les imatges correctament" } 
      } else{
        result = {status: "ERROR", message: "No s'ha trobat la sessió"}
      }
    }else{
      result = {status: "ERROR", message: "Es requereix token de sessio"}
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

function createNameFile(){
  let charsList = [];
  let tokenSize = 41;
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
app.post('/api/get_id', get_id)
async function get_id (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
      const contador = await db.query("select count(*) as contador from Users where userPhoneNumber='"+receivedPOST.phone+"'")
      if (contador[0]["contador"]>0){
          const dni = await db.query("select userDNIFront, userDNIBack from Users where userPhoneNumber='"+receivedPOST.phone+"'")
          if (dni[0]["userDNIFront"]!=null && dni[0]["userDNIBack"]!=null){
            let nameFront = dni[0]["userDNIFront"];
            let nameBack = dni[0]["userDNIBack"];
            let base64Front = await fs.readFile(`./private/${nameFront}`, { encoding: 'base64'})
            let base64Back = await fs.readFile(`./private/${nameBack}`, { encoding: 'base64'})
            result = { status: "OK", message: "Aqui esta el base64 de les dues imatges", imageFront: base64Front, imageBack: base64Back} 
          }else{
            result = {status: "ERROR", message: "No tenen imatges"}
          } 
      } else{
        result = {status: "ERROR", message: "No s'ha trobat l'usuari"}
      }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}

// Define routes
app.post('/api/upload_status', upload_status)
async function upload_status (req, res) {

  let receivedPOST = await post.getPostObject(req)
  let result = { status: "ERROR", message: "Unkown type" }

  if (receivedPOST) {
      const contador = await db.query("select count(*) as contador from Users where userPhoneNumber='"+receivedPOST.phone+"'")
      if (contador[0]["contador"]>0){
          const fecha = new Date();
          const opciones = { timeZone: "Europe/Madrid" };
          const fechaEspaña = fecha.toLocaleString("es-ES", opciones);
          const fechaSQL = fechaEspaña.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
          await db.query("update Users set userStatusModifyTime='"+fechaSQL+"', userStatus='"+receivedPOST.status+"' where userPhoneNumber='"+receivedPOST.phone+"'")
          result = { status: "OK", message: "S'ha actualitzat l'estat de l'usuari"} 
      } else{
        result = {status: "ERROR", message: "No s'ha trobat la sessió"}
      }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))

}